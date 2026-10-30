# Design

## Context

The app is a Capacitor 8 Android package. `notificaciones` is already a durable Supabase table protected by RLS; the authenticated API reads the user's own rows, and the foreground client uses Realtime with inbox refresh on reconnect. Android currently has no FCM client dependency or push permission declaration. The persistence policy enumerates its privileged `service_role` exceptions and forbids general direct access.

See `proposal.md` for motivation and the spec deltas for user-visible behavior and the proposed policy change.

## Goals / Non-Goals

**Goals:**
- Send a generic Android system alert for a newly persisted notification when the app is backgrounded or its process has ended normally.
- Keep the inbox, authenticated API, and foreground Realtime as canonical; make push delivery recoverable and duplicate-safe.
- Keep device-token operations user-scoped and the server-side FCM exception auditable and narrowly allowlisted.

**Non-Goals:**
- Change web notification behavior, notification creation rules, or the existing read/action contract.
- Promise delivery after the user force-stops the app, disables notifications, uninstalls it, or remains offline beyond the FCM TTL.
- Include notification contents in push banners or build a general-purpose privileged notification API.

## Decisions

### FCM provider and credentials

Use Firebase Cloud Messaging with a Capacitor-compatible Android push integration and the existing confirmed application ID `com.mrdusik.minipeopledb`. Configure the app with a user-controlled Firebase project and Android app registration. Keep the Firebase server credential in the backend deployment secret store only; never put it in `google-services.json`, the APK, browser assets, `sup.env`, or source control. The Android Firebase configuration file contains client configuration, not the server credential, and must be excluded from commits if it contains project-specific values.

The backend sends a generic notification payload plus a minimal data envelope (`notification_id`, allowlisted category, schema version). It does not send `notificaciones.payload` or user-entered content. A stable Android notification tag derived from the notification ID lets repeat sends replace the same visible alert rather than create another one. FCM acceptance is not treated as proof that a device displayed the alert.

### Registration and permission lifecycle

Maintain a per-installation registration with an opaque installation identifier, FCM token, permission state, and owner derived from the authenticated JWT. Token registration, refresh, permission-state changes, and revocation use user-authenticated API/RLS paths; callers cannot select an owner by supplying a `user_id`. Enforce one active owner per token. On logout, attempt revocation before clearing the session, retain a local pending-revocation marker if offline, and send it before any later account registration on that installation. Account deletion cascades registration cleanup. On app resume, reconcile the Android 13+ runtime permission and channel state; a denied permission disables delivery to that installation without disabling the inbox.

Create one stable Android notification channel before enabling delivery. Ask for `POST_NOTIFICATIONS` only after a signed-in user reaches a context that explains the benefit. The system permission remains authoritative; the app's stored permission state is a delivery optimization, not an authorization boundary.

### Transactional outbox and privileged boundary

Write a private push-outbox event in the same database transaction as insertion of a notification, with a uniqueness constraint on the persisted notification ID. Do not enqueue on updates to an existing notification (for example, a daily-summary refresh), so updating the inbox cannot create another alert. A backend worker claims queued events with a short lease, resolves only that event's recipient and that recipient's active installation tokens, sends through FCM, and records per-token outcomes. Retry transient provider/network failures with bounded backoff and a finite TTL; permanently invalid tokens are deactivated. A lease expiry makes interrupted work eligible for retry. The persisted inbox row remains available regardless of push status.

**Required policy addition—approved implementation boundary:** the project owner explicitly approved on 2026-10-30 exactly three individually allowlisted `SECURITY DEFINER` RPCs: `android_push_claim_events(integer, integer)`, `android_push_resolve_event_tokens(uuid, uuid)`, and `android_push_record_attempt(uuid, uuid, uuid, text, text, integer)`. They cannot select a client-chosen recipient and expose no generic table access. `service_role` receives no direct grants to notification, installation-token, outbox, or delivery tables; token registration/revocation remains JWT/RLS-scoped. This approval authorizes scoped code and tests only. No Firebase project is confirmed, so project registration, credential provisioning, remote migration/deployment, and live activation remain pending.

This boundary is chosen over a broad server-role query because the existing policy permits only enumerated global exceptions. A direct `service_role` read of the notification/token tables or a generic “send to user” RPC is explicitly rejected.

### Foreground, tap, and recovery

When foregrounded, the app continues to use its existing Realtime/in-app path and suppresses a second system alert. In background, Android/FCM may display the generic alert while the app process is absent. A tap carries only the notification identifier and allowlisted category; the app validates the session, fetches the own-row through the existing authenticated API, then opens that inbox item. A logged-out user authenticates first; arbitrary URLs or actions from push data are ignored. Opening a push does not mark the row read or execute a social action.

On resume/reconnect, refresh the inbox and unread count through existing APIs, covering expired, missed, or delayed FCM messages. FCM TTL is finite and configurable; choose an initial maximum of 24 hours so stale banners do not linger. An expired or rejected push does not delete or mutate the durable notification.

## Risks / Trade-offs

- [Firebase project and deployment credential have not been provisioned] → Keep push disabled until the owner registers the Android app, provisions the backend-only secret and applies the migration; do not ask for or commit credentials.
- [FCM/Android may delay or suppress messages, especially under force-stop, battery restrictions, or expired TTL] → Treat push as best-effort, keep the inbox canonical, refresh on resume/reconnect, and document force-stop as unsupported for immediate delivery.
- [Logout while offline cannot immediately revoke the server-side token association] → Keep banners content-free, retain a local pending-revocation marker, retry before re-registration, and remove invalid or stale tokens during dispatch. A short FCM TTL limits exposure but does not make offline revocation instantaneous.
- [Permission denial, channel muting, or OS settings override app state] → Preserve the in-app inbox and Realtime behavior and reconcile permission on resume.
- [Firebase credentials/configuration may be missing or misconfigured] → Fail closed for push only; continue ordinary app operation and expose sanitized operational health without logging tokens, payloads, or secrets.
- [At-least-once dispatch can repeat provider sends] → Use a unique outbox event per notification, per-event leases/attempt records, stable Android notification tags, and client-side notification-ID deduplication.

## Migration Plan

1. Owner approval for the exact RPC allowlist is recorded above. Before deployment, the owner must still confirm a user-controlled Firebase project and register the Android application ID. Code implementation may proceed while this external setup remains pending; do not activate or deploy push without it.
2. In an owner-controlled environment, deploy additive database changes for user-owned registrations, a private outbox, transactional enqueue, RLS/grants, and only the approved RPC allowlist. Verify anon/authenticated cannot call dispatch RPCs and `service_role` cannot directly access the protected tables.
3. Deploy the backend worker and provider credential through the deployment secret manager. Keep dispatch disabled until database policy and FCM configuration are verified.
4. Add Android permission/channel and token lifecycle support, then enable dispatch gradually in a non-production Firebase/Supabase environment.
5. Roll back by disabling the worker/provider configuration first, then removing Android push integration. Preserve existing notification rows and JWT/RLS paths; do not delete the inbox as part of rollback. Remove additive push registrations/outbox only after confirming no worker can claim them.

## Open Questions

None. The service-role policy exception and Firebase project are explicit approval/configuration gates, not implementation assumptions.
