# Tasks

## 1. Supabase handoff persistence

- [x] 1.1 Add an additive SQL migration for the private handoff table and purpose-built create, public-key lookup, confirmed-account publish, and proof-checked consume RPCs; verify expiry, email binding, state transitions, and direct-table privilege restrictions with a PGlite test.
- [x] 1.2 Extend the PGlite security tests to verify only the intended roles can execute each RPC, `service_role` has no direct table access, ciphertext is consumed once, wrong proofs and mismatched emails fail, and expired rows cannot be read.

## 2. Hosted confirmation and API

- [x] 2.1 Add create, public-key lookup, publish, and consume API handlers using the anon Supabase client, strict input/body limits, confirmed-user validation, bounded rate limits, generic errors, and `Cache-Control: no-store`; verify success, rejection, expiry, and response shapes with `test-support/supabase-mock.js`.
- [x] 2.2 Add the minimal HTTPS confirmation page that verifies only signup `token_hash` values, removes verification parameters from browser history, encrypts the session for the registered public key, and publishes ciphertext; verify valid, malformed, duplicate, and failed confirmation cases in browser tests.

## 3. Android registration and session recovery

- [x] 3.1 Implement persistent Web Crypto handoff keys and poll proof, registration redirect, active/resume polling, single-use decryption, session establishment, and terminal cleanup; verify with focused auth tests that the existing profile gate opens onboarding before protected data requests.
- [x] 3.2 Extend auth tests for confirmation on another device, app restart/recovery, expiry, invalid ciphertext, replay, and unchanged Google PKCE behavior; update `docs/android-installation.md` with the callback allowlist and rollout requirements.

## 4. Integration verification

- [x] 4.1 Run the focused API, PGlite, browser-auth, and Android asset-build checks; verify the handoff does not use `service_role`, expose plaintext tokens, alter web registration, or regress Google OAuth.
