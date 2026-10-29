# Proposal

## Why

Users may not notice that the weekly ranking has become available unless they open it themselves. A single durable notice when the first valid weekly snapshot makes the ranking available gives everyone a timely entry point without repeating the message on later daily recalculations.

## What Changes

- Notify registered users once per Madrid ISO week when the completed daily sync first produces a valid weekly ranking.
- Include an action in the notification inbox that opens the Weekly Ranking dialog; opening it does not mark the notification as read.
- Keep ranking reads side-effect free and preserve existing Top 10 entry/exit notifications.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `notificaciones`: add a durable, once-per-week availability notice and an action to open the ranking.
- `ranking-semanal`: define the first-valid-measurement event that triggers the notice.

## Impact

- Supabase schema and daily-sync finalization.
- Notification payload allowlist and inbox rendering/action handling.
- PGlite and web tests for availability, deduplication, and navigation.