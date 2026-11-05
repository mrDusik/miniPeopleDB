# Proposal

## Why

Android email registration currently sends confirmation links to the Android app's custom-scheme callback. If the link is opened in another browser or on another device, the app that created the account never receives the Supabase session and cannot start onboarding. A short-lived, single-use handoff will let the registering Android app establish its own session after email ownership is verified.

## What Changes

- Add a hosted HTTPS email-confirmation callback that verifies Supabase signup links in any browser and transfers the resulting session to the registering Android app without putting tokens in URLs or returning them in plaintext from the handoff API.
- Add a narrowly scoped, temporary Supabase handoff store and allowlisted RPCs for registration, publication by the confirmed account, and one-time retrieval by the originating app. Keep the table inaccessible to direct client queries and do not use `service_role`.
- Have Android persist a pending handoff, poll while active and on resume, restore the session through Supabase Auth, and then use the existing profile gate to show onboarding. If Android is closed during confirmation, complete the handoff when the app is opened again.
- Keep Google OAuth and web email-registration behavior unchanged. Expire unclaimed handoffs, prevent replay, and show generic recoverable errors.
- Document the Supabase redirect allowlist and backend migration/deployment requirements.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `autenticacion-usuarios`: automatically establish the registering user's session after email confirmation in an external browser, then enforce the existing profile/onboarding gate.
- `android-local-installation`: support a cross-browser and cross-device email-confirmation handoff while preserving the existing OAuth callback and JWT/RLS behavior.

## Impact

- Android/web client: registration redirect, hosted confirmation page, cryptographic handoff, pending-state persistence, and session restoration.
- Express API: narrowly scoped handoff endpoints using the public Supabase anon client and allowlisted RPCs only; no service-role access.
- Supabase: a private, expiring handoff table and restricted RPC grants. Tests must verify grants, email binding, expiry, encryption-only storage, and single-use consumption with PGlite.
- Operations: deploy the backend and apply the SQL migration, then allowlist the HTTPS confirmation callback in Supabase Auth.
- Tests and docs: cover API, PGlite, browser, Android and onboarding behavior, and document rollout/configuration.
