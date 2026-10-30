# Tasks

## 1. Approval and provider setup

- [x] 1.1 Obtain explicit owner approval for the exact `service_role` RPC allowlist in the persistence delta; verify the approved list grants no direct table access and record the decision before database or backend implementation.
- [x] 1.2 Confirm a user-controlled Firebase project and register `com.mrdusik.minipeopledb`; store the backend FCM credential in the deployment secret manager and verify no server credential or private config is committed or included in the APK.

## 2. Database ownership and dispatch boundary

- [x] 2.1 Add per-installation FCM registration storage, JWT-derived ownership, RLS, rotation, permission state, single-owner token constraint, logout revocation, and account-deletion cleanup; verify with SQL tests that users cannot read or alter another account's registration.
- [x] 2.2 Add the private transactional outbox and notification-insert enqueue path with notification-ID uniqueness; verify inserts enqueue once and updates to an existing notification do not enqueue again.
- [x] 2.3 Implement only the owner-approved security-definer dispatch RPCs for event claim, event-bound recipient token resolution, and attempt recording; verify anon/authenticated are denied, service_role has no direct table grants, and RPC tests reject arbitrary recipient selection.
- [x] 2.4 Document the schema deployment and rollback in the database runbook; verify the documented SQL is additive, repeatable where intended, and leaves existing notification rows and JWT/RLS behavior intact.

## 3. Backend delivery worker

- [x] 3.1 Implement the FCM worker using only the approved RPC allowlist and backend-held credentials; automated tests verify a generic test send is restricted to the event's active recipient tokens and logs contain no token, payload, or credential. Live provider verification remains blocked by 1.2.
- [x] 3.2 Add leased outbox processing, idempotency, bounded backoff, finite TTL, transient/permanent error handling, and invalid-token deactivation; verify retry, lease recovery, expiry, duplicate, and permanent-token-error tests.
- [x] 3.3 Add operational configuration and sanitized health/error reporting; verify missing or invalid FCM configuration disables push without breaking existing notification APIs or exposing provider details.

## 4. Native Android behavior

- [x] 4.1 Add Capacitor-compatible FCM receipt, notification-channel creation, and Android 13+ contextual permission flow; verify granted, denied, revoked, foreground, background, and normally terminated process behavior on supported Android versions.
- [x] 4.2 Implement authenticated token registration, refresh, permission synchronization, logout/account-switch revocation, and offline pending revocation; verify owner changes never leave two active owners and revocation retries before new-account registration.
- [x] 4.3 Implement privacy-minimized display, foreground duplicate suppression, notification-ID deduplication, and validated tap routing through the authenticated inbox; verify no payload business data is shown before fetch, no arbitrary route is accepted, and opening does not mark read or execute actions.
- [x] 4.4 Document Firebase configuration, permission behavior, force-stop/TTL limitations, and local-device test steps; verify the instructions build the APK without server credentials in packaged assets.

## 5. End-to-end verification

- [x] 5.1 Run the full automated suite and Android build; verify existing web/in-app/Realtime behavior, authenticated inbox access, and notification action/read contracts remain unchanged.
- [ ] 5.2 Exercise the end-to-end matrix for app foreground, background, process terminated, logged out, permission denied, offline/reconnect, duplicate delivery, expired push, and invalid token; verify the durable inbox recovers every persisted notification independently of FCM.

## 6. Preferencias de notificaciones del sistema

- [x] 6.1 Mostrar en Preferencias Android un toggle que refleje permiso y canal nativos, y retirar el control del modal Notificaciones; activar solicita permiso/registro y desactivar abre los ajustes nativos.
- [x] 6.2 Añadir tests de interfaz y verificar el plugin Android que consulta el estado real de permiso/canal y abre los ajustes de notificaciones.
