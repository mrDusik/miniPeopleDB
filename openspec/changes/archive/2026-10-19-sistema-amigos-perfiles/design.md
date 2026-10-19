# Design

## Context

See `proposal.md` for motivation and the capability deltas under `specs/` for externally visible contracts. The server authenticates protected routes with Supabase JWT and repositories use the request-scoped client. Friend data does not exist. `perfiles_publicos` and `user_profiles` have RLS, direct reads of other users' profiles are restricted, and ranking/achievement data is exposed through limited RPCs. Notifications are persisted with a type allowlist and the browser already supports independent actions and disabled-after-success states.

## Goals / Non-Goals

**Goals:**
- Add durable friend request and friendship state with authorization derived from `auth.uid()`.
- Add narrow, authenticated search/profile projections without granting clients general access to other users' tables.
- Keep notification actions idempotent and synchronize the notification, request, and friendship state.
- Make the username migration deterministic, collision-aware, and safe to rerun.

**Non-Goals:**
- Add public unauthenticated user discovery, messaging, friend recommendations, or privacy settings.
- Expose full collections, purchase data, OAuth identity, profile preferences, or per-achievement DNA weights.
- Change the existing ranking membership/order, gamification calculation, or achievement ordering.

## Decisions

### Persist one directional request per unordered user pair

Add a request record with sender, recipient, status (`pending`, `rejected`, `accepted`) and timestamps, plus a canonical pair key that prevents a second or reverse request for the same two accounts. Add a canonical friendship record keyed by the ordered pair of user IDs. A rejected request remains addressable by its recipient and may transition to accepted; the sender cannot replace or resend it. If the other user tries to send a reverse request while one exists, return a conflict and leave the existing request available to its recipient. This makes the rejection rule enforceable under concurrent requests; keeping only client-side state or deleting rejected requests would permit duplicates and re-sends.

Either participant may remove an established friendship through a JWT-scoped RPC. Lock the accepted request using the same lock order as acceptance, verify that the caller participates in the canonical friendship, and delete the friendship and its accepted request in one transaction. Request-linked social notifications are removed by their existing cascade. A repeated removal is a no-op; a caller outside the pair cannot remove it. Pending or rejected requests are not removed through this operation. This releases pair uniqueness for a new request after removal and prevents a late acceptance of the old request from restoring the friendship. No collection, gamification, gift, or unrelated notification is modified.

### Mutate social state through caller-checked atomic database operations

Use narrowly allowlisted Supabase RPCs for sending, rejecting, and accepting requests. Each operation derives the actor from `auth.uid()`, verifies the request participant and current state, and atomically persists request/friendship changes with the associated notification. Keep direct table policies scoped to participants and do not expose write grants for social state. These calls use the authenticated request client, never `service_role`; ordinary API handlers remain thin validators and map domain errors to stable HTTP responses. The notification quick action delegates to the same acceptance operation as the received-requests tab.

### Use separate, bounded projections for search and profile

Expose authenticated search and profile-summary operations that return only fields required by their respective contracts. Search and social lists return identity, level, Bricks, global position, collection count, and the same limited DNA summary as the default global ranking (principal trait and at most two aggregate traits), plus relation state. They never return collection entries, the full four-trait DNA distribution, or individual DNA weights. Use the default global ranking order for global position, without limiting discovery to its Top 10. The profile projection returns the requested Tops, four aggregate DNA percentages, collection/search counts and five recent entries, and five achievements in the established order. It excludes emails, OAuth metadata, preferences, purchase fields, and DNA weights. Direct cross-user table grants remain unchanged. This is an explicit extension of the current ranking-only public-data contract, not a general table-read policy. A combined database projection avoids multiple client queries with wider privileges and produces a consistent read.

Add a bounded authenticated counts operation that takes no target user ID and returns only the caller's total friendships, sent pending/rejected requests, and received pending/rejected requests. Derive all three from `auth.uid()`, never search-result sizes or a fixed placeholder. Fetch counts after session initialization and when opening Friends; refresh after send, reject, accept, and remove, and when reopening or receiving social events. Invalidate stale count responses on session change and clear the badge rather than retaining another user's total. Do not label failed count loads as confirmed zero.

### Keep browser actions independent and share the profile dialog

Add the Friends launcher and tabbed dialog to the existing modal system. Reuse the ranking row's visual data but render it as a non-expanding friend row. Keep rankings limited to their existing expansion, gift, and achievement controls, without a profile launcher. Use one profile dialog and request lifecycle for friends, search, sent requests, and received requests; invalidate outstanding requests and clear data on close or session change. The notification action updates the existing row to `Aceptada` only after the server confirms it.

Friends and search rows reuse the ranking summary layout, dimensions, icons, typography, and responsive rules: global position, avatar, username, level image/number/name, limited DNA summary, Bricks icon/value, and collection icon/count. Opening the user launches the shared profile rather than an accordion. Keep send/accept/reject/remove controls independent from that launcher. Every row representing an established friend, including a matching search result, offers an accessible remove control; confirm success on the server before clearing the row or changing counts, block duplicate submissions, and keep failed actions recoverable.

Label tabs `Amigos (N)`, `Solicitudes Enviadas (N)`, and `Solicitudes Recibidas (N)` using the counts response; leave `Buscador` unchanged. Replace the static `375` on the Friends launcher with the authenticated user's friend count, including its accessible name and tooltip. Preserve its existing header placement and styling; the ranking launcher is not this counter. Render usernames as `strong` in both social notification messages, using text nodes for surrounding copy, and replace the quick-accept heart with `/status_images/friends.png`. Preserve the disabled `Aceptada` state and do not change read state.

### Migrate legacy names before enabling discovery

Run a transactional, deterministic migration before deploying search. Select only incomplete profiles whose username is exactly `Coleccionista`, ordered by `created_at` and then `user_id`. Allocate the next free `ColeccionistaN` using the existing case-insensitive unique index, and update the public display name in the same transaction. The onboarding flow remains able to replace these temporary names. Do not roll the migration back to duplicate defaults; usernames already chosen by users or assigned by the migration must survive feature rollback.

### Validate each security boundary in its existing test layer

Use the Supabase mock for route status, identity derivation, response projection, duplicate actions and notification behavior. Extend the PGlite coverage for RLS, pair uniqueness, state transitions, actor checks, atomic rollback and the username migration. Add browser tests for tabs, keyboard/focus behavior, profile launchers, loading/error states, stale-session responses, and disabled accepted actions. Keep the current no-network test requirement.

Extend these same layers for reciprocal removal, pair reuse, rejection of foreign actors, acceptance/removal ordering, and rollback of a failed delete. Cover exact social summary allowlists and count isolation in API/PGlite tests; verify bold usernames, `friends.png`, ranking-compatible rows, live counts, failed actions, and stale-session responses in web tests. Supply a narrowly scoped, repeatable SQL migration for existing databases as well as updating the base schema; validate both upgrade and fresh-install paths.

## Risks / Trade-offs

- [Authenticated search and profile summaries reveal more public data than the current ranking] -> Limit each response to the exact approved fields, retain JWT checks, expose no direct cross-user table reads, and test negative fields and RLS explicitly.
- [Concurrent send/accept actions can create duplicate or contradictory state] -> Enforce pair uniqueness in the database and make all state transitions and event creation atomic and idempotent.
- [Legacy username collisions or concurrent signups can violate uniqueness] -> Allocate names transactionally against the existing case-insensitive unique index, skip occupied suffixes, and validate deterministic reruns with PGlite.
- [Top lists and snapshots can become expensive for large collections] -> Fetch counts, limited recent records and Tops in one purpose-specific projection and inspect its query plan against representative data before rollout.
- [Changing notification types can break the existing type constraint or payload allowlist] -> Update schema, repository projection, browser rendering and mock fixtures together; retain all existing notification contracts.

## Migration Plan

1. Apply an additive database migration for friendship/request state, notification types and indexes, limited search/profile operations, grants/RLS, and the legacy username backfill. Run it transactionally and validate uniqueness and profile/public-name consistency before commit.
2. Deploy backend repository and routes using the new JWT-scoped operations, then deploy the browser controls and notification action. Keep existing ranking, gift, and notification routes compatible.
3. Verify migration counts and username collisions, exercise representative search/profile responses, and run API, PGlite, and browser suites before enabling the Friends launcher.
4. If rollout must stop, disable the new UI and routes while retaining the additive schema and assigned usernames. Prefer a forward fix; dropping populated friendship tables or restoring duplicate default names is not a safe rollback.

## Open Questions

None. Rejection visibility, re-acceptance, profile access scope, and legacy-name collision behavior were resolved during proposal authoring.