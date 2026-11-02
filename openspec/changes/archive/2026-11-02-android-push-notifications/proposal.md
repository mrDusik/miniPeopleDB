# Proposal

## Why

The existing notification inbox is durable and updates in real time while the app is active, but it does not alert Android users when the app is backgrounded or its process is not running. Add private, reliable FCM delivery without changing the existing inbox contract or weakening ordinary JWT/RLS access.

## What Changes

- Add native Android push delivery for persisted notifications, while retaining the current in-app/Realtime behavior as the source of truth.
- Define authenticated device-token ownership, permission handling, registration lifecycle, logout/account-switch revocation, and invalid-token cleanup.
- Specify privacy-minimized push payloads, notification tap/deep-link handling, and deduplication, retry, and offline behavior.
- **Policy addition requiring explicit user review before implementation:** allow only a named, narrowly scoped server-side push-delivery mechanism for a single persisted notification and its recipient's active tokens. Do not grant general `service_role` table access, expose service credentials to the app, or change ordinary JWT/RLS operations.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `notificaciones`: Extend existing persisted/in-app notification behavior to Android FCM delivery and notification interaction.
- `persistencia-supabase`: Amend the existing privileged-access policy to enumerate a narrowly scoped push-delivery exception, subject to review.

## Impact

Capacitor 8 Android app and notification UI; Supabase notification/token/outbox persistence and RLS; authenticated API and a server-side FCM delivery component; Firebase project credentials and Android notification configuration. Existing web notifications, notification persistence, and normal user JWT/RLS access remain unchanged.
