# Design

## Context

See `proposal.md` for motivation and `specs/` for observable requirements. The web client currently uses one Supabase Auth client with PKCE and starts collection loading immediately after restoring a session. Protected API requests validate the JWT and use a user-scoped Supabase client; authentication also synchronizes a limited `perfiles_publicos` projection used by ranking and gifts. RLS already restricts writes to that projection to its owner. Brickset categories remain in a local JSON catalog.

## Goals / Non-Goals

**Goals:**
- Keep Google OAuth and classic identities under the same Supabase Auth session model, with Username/password login and email-based registration/recovery.
- Gate collection initialization on a successfully loaded, complete profile.
- Keep profile preferences relational, owner-scoped, and compatible with the existing public ranking projection.
- Make multi-table preference updates atomic and validate selected categories against the authoritative local catalog.

**Non-Goals:**
- Implement friend search, friend requests, or public username lookup.
- Add a general media library, image editor or uploads unrelated to profile avatars.
- Activate currencies or languages other than EUR and Spanish.
- Backfill usernames automatically or revoke existing sessions.

## Decisions

1. **Keep Supabase Auth as the session authority.** Continue using the existing browser Supabase client and PKCE for Google. The browser uses `signUp`, `resetPasswordForEmail`, and password updates. Classic login sends only Username/password to `POST /api/auth/login`; its anon client calls the narrowly authorized `SECURITY DEFINER` RPC `resolver_acceso_username`. The RPC checks the supplied password against the existing Auth bcrypt hash before returning an email and atomically limits attempts to five per account/minute in a private table. It grants no direct table privileges and does not permit username-only email enumeration. The server then calls Supabase Auth `signInWithPassword`, preserving email confirmation and Auth restrictions, and returns only access/refresh tokens with `Cache-Control: no-store`. The browser installs them via `setSession`. No service-role client is involved and passwords never enter application tables or application logs. The registration form collects a username, while the profile/onboarding write remains the authoritative database claim; Auth metadata is not treated as a profile source of truth.

	Registration additionally requires matching password confirmation, a shared visibility switch, and independent live red/green checks for length >= 5, uppercase, lowercase, and a digit. These checks apply only to registration, not login, so existing passwords remain usable. Supabase Auth may impose stricter password settings. Switching auth modes hides/disables registration-only inputs and clears custom errors; successful submission clears both secrets and restores masking.

2. **Keep private preferences separate from the authorized public identity.** Create `user_profiles` keyed to `auth.users`, with username, avatar URL, currency, language, onboarding state, and timestamps. Store favorites in a child relation keyed by `(user_id, category_name)`. Enforce the username regex and case-insensitive uniqueness in PostgreSQL, and prevent username changes after onboarding. By explicit user authorization, publish the saved username through the existing `perfiles_publicos.display_name` field, while retaining its limited schema and keeping emails and preferences private. A custom avatar may flow into its existing `avatar_url` field.

3. **Use user-scoped API operations and an atomic save RPC.** Add authenticated profile read/save endpoints that use the same anon-key client carrying the request JWT as other ordinary user operations. The backend validates favorite category names against the local category catalog. A user-scoped PostgreSQL function applies the profile and complete favorites set, updates the public avatar projection, and marks onboarding complete in one transaction; it derives ownership from `auth.uid()`, uses RLS-compatible privileges, and is executable by `authenticated` only. No `service_role` is used for profile reads or writes. This is preferred to independent browser table writes because it gives the multi-table update a single commit and keeps catalog validation on the server.

4. **Gate startup before collection requests.** On session restore/change, load the caller's profile through the authenticated API before calling the current collection initializer. If there is no complete profile, show the mandatory modal and load no collection, ranking, gamification, or notification data. Public configuration and the local category catalog may be loaded as needed for the form. Fail closed on profile read/save errors while retaining the session and entered form values. Use a session/request generation check so a delayed profile response cannot unlock the app for a different account.

5. **Use the saved username consistently with avatar precedence.** Derive the session label, tooltip and public identity from `user_profiles.username`, never provider names, email or unverified metadata. Use a generic `Coleccionista` fallback when no saved username exists. Profile saves update the public name, authenticated requests synchronize it, and schema application backfills existing projections. Rankings and new gift/thanks notices read the saved username directly, even when the public projection is stale. New notices store an internal `actorUserId`, excluded from the API's public data allowlist. Schema application also updates old gift/thanks user/message fields without changing IDs, timestamps, read state, amounts or reward data. Resolve gift authors from their donor FK; resolve thanks authors from a valid stored actor ID or exactly one distinct acknowledgment author with the same donor and transaction timestamp. Never guess from a Google name; use `Coleccionista` when the actor/profile cannot be identified reliably. Other notice types are unchanged. Prefer the saved avatar over provider metadata and retain the Google-avatar fallback when no custom avatar exists. The profile menu is 190.5px wide, half its previous 381px, subject to viewport bounds.

6. **Delete only the authenticated account after explicit confirmation.** Place a logout-styled action at the bottom of Preferences, not onboarding. A separate native dialog mirrors minifigure deletion, warns about irreversibility and initially focuses Cancel. Only confirmation sends `DELETE /api/profile`, without a body or selector. The JWT-scoped anon client calls parameterless `eliminar_cuenta_usuario()`, an authenticated-only `SECURITY DEFINER` function with an empty search path. It derives its sole target from `auth.uid()`, verifies the authenticated role, deletes that Auth identity and lets foreign-key cascades remove owned records transactionally. It grants no direct Auth-table access and never uses `service_role`. Failures preserve the session and edited preferences; success signs out locally and clears the UI. Block duplicate confirmations/cancellation while pending and ignore responses belonging to a previous session; stale 401 responses must not sign out a different token.

## Risks / Trade-offs

- [Storage and database writes are not a distributed transaction] → Upload to a new immutable path, keep the previous avatar until the profile commit and attempt cleanup on failure. Account deletion removes owned files before deleting Auth; if SQL later fails, its rows roll back but removed files cannot be restored automatically.
- [Existing Google users cannot be assigned unique usernames silently] → Require onboarding on their next app load; preserve their Auth session and all collection data.
- [Username claims can race or collide by case] → Treat the database unique index as authoritative, map conflicts to a safe username-unavailable message, and never rely on a preflight check.
- [Email confirmation may yield no session immediately after classic signup] → Keep signup/confirmation feedback explicit; perform the relational username claim only when an authenticated session exists and let onboarding re-confirm the value if it was not persisted.
- [Category names may later be removed or renamed in the local catalog] → Validate every save against the current catalog and report rejected favorites without partially replacing the saved set.
- [A custom avatar could be overwritten by OAuth synchronization] → Resolve avatar precedence from `user_profiles` on each synchronization and test the next-request behavior.
- [A profile lookup failure could expose collection data if startup continues] → Make profile loading a required gate before any protected data initialization.

## Migration Plan

Preferences uses three compact rows: Username/avatar, language/currency and favorites. Selected categories stay visible independently of search, with removable choices and an exact 0/3 through 3/3 counter. Disable remaining choices at three. The API and save RPC reject more than three, and a trigger locks the profile parent row to enforce the cap for direct writes while allowing replacement at capacity. Existing excess rows are not deleted by migration: the form starts with the first three and only Save persists the new set.

Cargar previews a PNG/JPEG/WebP up to 2 MiB locally with FileReader. Only Save uploads it through the JWT-scoped Supabase browser client to public bucket `profile-avatars`, using `<auth.uid()>/<uuid>.<extension>` with no overwrite. Persist the resulting HTTP(S) URL through the profile API; preserve legacy URLs and provider fallback. Ignore stale reads after closing/changing session. Attempt removal of uncommitted new uploads and of previous managed avatars only after success and only within the same user's folder/project. Bucket policies permit owner-folder listing/deletion and supported unique filenames; public image delivery never exposes private preferences. Account deletion cleans only the caller's files through JWT before the SQL RPC; a Storage failure prevents Auth deletion. No service-role access is added.

Apply the updated main schema for favorite limits and `supabase/profile-avatars.sql` for the bucket/policies, then restart the backend. Neither file is automatically applied to remote Supabase.

1. Apply the additive Supabase schema migration creating `user_profiles`, favorites, constraints, RLS policies and authenticated RPCs. Preserve existing Auth identities and collection rows. Update existing public names only to their saved usernames, as explicitly authorized; applying the schema does not delete accounts.
	Then apply `supabase/username-login.sql`, which installs pgcrypto in `extensions`, the private attempt counter and the password-protected anon login RPC. This is the explicitly authorized exception to ordinary JWT/RLS-only access; ordinary profile/data routes remain unchanged.
2. Deploy the authenticated profile API and compatible public-avatar synchronization. Existing Google sessions remain valid; accounts without completed profiles are handled lazily at their next app load.
	Apply the updated `supabase/schema.sql` before deploying account deletion: it creates the own-account RPC and updates public usernames. Schema application itself does not delete identities; deletion requires a subsequent authenticated confirmation. Username publication is the explicitly approved privacy-contract change.
3. Deploy the web auth forms, profile gate, onboarding and settings modal. Verify both Google and classic flows with the configured email-confirmation behavior.
4. Roll back by restoring the previous application/API version. Leave the additive tables and user data intact; remove them only through a separately reviewed migration after confirming no deployed version uses them.

## Open Questions

None that block this design. Email confirmation behavior follows the existing Supabase configuration; username immutability and URL-based avatars are the selected defaults recorded in the proposal.