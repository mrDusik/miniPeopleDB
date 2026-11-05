# Design

## Context

See `proposal.md` for the motivation. Android currently sends signup confirmation to the custom-scheme OAuth callback; the app already routes any established Supabase session through `handleSession`, which checks the profile before loading protected data. The server exposes the public Supabase configuration and keeps the Username-login exception on the anon client and its dedicated RPC. The user explicitly authorized a narrowly scoped additional exception for this email-confirmation handoff.

## Goals / Non-Goals

**Goals:**
- Transfer a confirmed signup session to the Android installation that initiated that signup, whether confirmation is opened on the same or another device.
- Allow the app to recover the handoff after process termination, without persisting plaintext session tokens in the relay.
- Keep existing Google OAuth, web registration, JWT/RLS behavior, and mandatory onboarding intact.

**Non-Goals:**
- Force-start an Android app that is not running. The app completes the handoff while active or on its next launch/resume.
- Add `service_role` use, general-purpose public session exchange, or access to user data through the handoff.
- Change how web registrations or Google OAuth callbacks work.

## Decisions

### Use a hosted HTTPS confirmation callback

Android registration creates a handoff before calling `signUp` and sets `emailRedirectTo` to a dedicated HTTPS callback on the configured backend, carrying only the opaque handoff ID. The callback accepts only Supabase signup verification parameters, consumes `token_hash` with `verifyOtp`, and immediately removes verification parameters from browser history. The callback URL and handoff ID are not credentials; the handoff proof and private decryption key never appear in the email URL.

This supports a browser with no PKCE verifier, including a different device. Keeping the current custom-scheme redirect would work only when the confirmation link returns to the same installed app that initiated signup.

### Bind the relay to the account and originating app

The app generates an ephemeral RSA-OAEP key pair with Web Crypto, persists the non-extractable private `CryptoKey` in IndexedDB, and sends the public key and normalized-email digest when creating a handoff. The API returns a random poll proof, which the app stores alongside the key and opaque handoff ID. The proof is never included in the email link.

After `verifyOtp`, the hosted callback fetches the challenge's public key and encrypts the access and refresh tokens with a fresh AES-GCM key; it wraps that key with RSA-OAEP. The browser sends only this ciphertext and its authenticated access token to the API. The API validates the access token with Supabase Auth using the anon key. The publish RPC additionally checks `auth.uid()`, confirmed email, and the matching email digest before storing the ciphertext.

The Android app polls with the handoff ID and proof. The consume RPC compares the proof digest, deletes or marks the row consumed atomically, and returns ciphertext once. Android unwraps and decrypts the session locally, passes it to Supabase `setSession`, then deletes the key and proof. No handoff API returns plaintext access or refresh tokens.

### Use a private table and only purpose-built RPCs

Store the email digest, public key, proof digest, state, expiry, and encrypted payload in a private table with no direct grants to `anon`, `authenticated`, or `service_role`. Use narrowly scoped RPCs for create, public-key lookup, authenticated publish, and proof-checked one-time consume; revoke default execution and grant only the roles each operation requires. Set a maximum 24-hour lifetime, enforce state transitions and email binding in SQL, reject repeated publication/consumption, and delete expired ciphertext during cleanup operations.

The API uses the anon key and, for publication, the verified user's JWT. It does not use `service_role`. These RPCs are the explicitly approved, permanent exception for this narrowly defined handoff; they cannot resolve credentials, issue a session, access application tables, or serve ordinary user-data routes. API handlers use strict request limits, no-store responses, generic errors, and bounded rate limits for challenge creation.

This approach is more durable than a public Realtime channel, which can lose the message while Android is offline or closed. A server-memory relay would be lost on restart or deployment. A durable encrypted record provides offline recovery without making the server capable of decrypting a session.

### Reuse the existing session and onboarding path

The app checks pending handoffs while active and on Capacitor resume/startup. After decryption it calls Supabase `setSession`; the normal auth-state handler runs `handleSession`, profile verification, and the existing mandatory onboarding gate. Handoff completion does not initialize inventory independently. The Google PKCE callback remains unchanged.

### Keep the hosted callback minimal

Serve a dedicated page without third-party scripts or analytics. Apply `Cache-Control: no-store`, a restrictive Content Security Policy, and `Referrer-Policy: no-referrer`; do not log verification parameters, tokens, poll proofs, or encrypted payloads. Validate callback type and parameter cardinality, and show only generic success/failure messages.

## Risks / Trade-offs

- [The Android app cannot be force-started from a different device] → Poll while active and recover on the next launch/resume; make this behavior explicit on the confirmation page.
- [A stolen poll proof could claim a pending ciphertext] → Keep it out of the email URL, store only its digest server-side, send it only over HTTPS, and bind the ciphertext to the app's non-extractable private key.
- [Supabase email redirect configuration or callback deployment may be incomplete] → Apply the database migration and deploy the callback before allowlisting and releasing the Android client; test the configured Supabase project end to end.
- [Web Crypto persistence can fail on a device or browser] → Do not create the signup without a persisted key and poll proof; surface a recoverable generic error and retain the standard signup error handling.
- [Expired, consumed, or malformed handoffs can strand a newly confirmed account] → Expire at 24 hours, remove local temporary material on terminal failures, and keep errors generic. Verify rollout behavior and recovery messaging before release.
- [Ciphertext rows can remain after expiry if no cleanup request runs] → Make expired rows unreadable immediately and opportunistically delete them in create, publish, and consume RPCs; retain no plaintext credentials.

## Migration Plan

1. Apply the additive SQL migration and validate table/function privileges, state transitions, email binding, expiry, and replay protection with PGlite.
2. Deploy the API handlers and hosted confirmation page. The handlers must be available before any client uses the new callback.
3. Add the exact HTTPS callback path to Supabase Auth's allowed redirect URLs without changing the Site URL or Google callback.
4. Release the Android client that creates and polls handoffs. Existing installed clients and already-sent confirmation links continue to use their prior callback; new registrations use the HTTPS flow.
5. Test confirmation on the same device, on another device while Android is active, and on another device while Android is closed; verify onboarding appears before protected data requests.

Rollback stops creating new handoffs and restores the prior Android signup redirect. Keep the migration and RPCs until outstanding handoffs expire; then remove the functions and private table. Confirmed accounts remain confirmed, and existing Google OAuth and web signup behavior do not depend on the migration.
