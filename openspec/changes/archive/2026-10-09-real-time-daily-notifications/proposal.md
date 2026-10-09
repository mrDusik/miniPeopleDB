# Proposal

## Why

MiniPeopleDB already supports ranking gifts and captures private daily collection snapshots, but it has no durable inbox to tell users about social interactions or explain how their collection changed overnight. A notification center connects those existing capabilities while keeping user data private and the daily worker's privileged access bounded.

## What Changes

- Add a persistent notification inbox with per-item and global read actions, realtime delivery, 15-item incremental loading, relative date groups, and exact-date tooltips.
- Notify users about received ranking gifts, thanks, and entry to or exit from the Global and Weekly rankings. Allow one thank-you per received gift; award the original gift donor a separate, durable gift-type achievement and +5 Bricks without changing the existing 50-Brick gift achievement.
- Generate a collapsible daily progress notification from confirmed daily snapshots, including collection, value, Bricks, level, DNA, and eligible ranking-position deltas.
- Add an envelope control above the Rankings panel and notification dialog consistent with the existing achievements dialog. Unread state changes only through an item's check button or the explicit "Marcar todas como leídas" action.

## Capabilities

### New Capabilities
- `notificaciones`: Persistent user notifications for social, ranking, and daily progress events, including authenticated retrieval, read state, and realtime delivery.

### Modified Capabilities
- `interfaz-web-minifiguras`: Add the notification entry point, unread indicator, paged dialog, temporal grouping, daily card, and thank-you action.
- `ranking-global`: Emit a recipient notification for a successful gift and support its one-time thank-you response.
- `ranking-semanal`: Include Weekly ranking membership transitions in notifications and daily position summaries.
- `analitica-historica`: Create daily progress notifications only from confirmed snapshots in the existing 04:00 Europe/Madrid sync.
- `persistencia-supabase`: Persist notifications and thank-you rewards under RLS and the existing allowlisted administrative-worker boundary.

## Impact

Expected implementation areas are `public/index.html`, `public/app.js`, and `public/styles.css`; `src/server.js` and new notification repository logic; `supabase/schema.sql` and the Supabase mock; and focused API, browser, RPC/PGlite, and daily-sync tests. Ordinary inbox and thank-you operations use the authenticated user's JWT and RLS. Daily notification generation remains inside the existing cron worker's allowlisted RPC path; no ordinary route or browser code receives `service_role` access.