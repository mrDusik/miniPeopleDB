# Design

## Context

See [proposal.md](proposal.md) for motivation and the delta specs for observable contracts. The browser already uses the Supabase JS client, while ordinary API requests are authenticated with a user JWT and the daily analytics worker uses a separate `service_role` client restricted to allowlisted RPCs. Gift registration is already transactional; daily snapshots are captured per user and finalized as one durable job.

## Goals / Non-Goals

**Goals:**
- Preserve an authenticated, durable inbox that can recover after a realtime disconnect.
- Keep gift acknowledgements and both +5 rewards atomic and durable across gamification recalculations.
- Generate rank transitions without making ranking reads mutate state, and generate daily summaries only after the complete daily job succeeds.

**Non-Goals:**
- Email, push, or browser system notifications.
- Automatic read changes when the inbox opens, scrolls, or receives Realtime events.
- Changing ranking membership, ordering, or the existing 50-Brick gift reward.

## Decisions

1. **Persist notifications and use Realtime only for delivery hints.** Add a user-owned `public.notificaciones` table with event type, constrained JSON payload, `is_read`, and `created_at`. RLS permits an authenticated user to select their rows and update only `is_read`; ordinary clients cannot insert, edit payloads, or delete rows. Enable owner-scoped Supabase Realtime for inserts. The API remains the source for paged history and unread count, using a fixed page size of 15 and a stable `(created_at, id)` keyset cursor. Reconnect and modal-open events refetch persisted state. Single-item and mark-all endpoints are the only read mutations.

2. **Write social events in the same transaction as their rewards.** Extend the existing gift RPC to insert the receiver's notification with the confirmed 50-Brick gift. Add an authenticated thank RPC keyed by the receiver-owned gift notification. A unique thank record per original gift prevents duplicate claims. In one transaction it records the thanks, grants the original donor the existing +5 Bricks and a separate repeatable `regalo` achievement worth +5, creates the donor's notification, and grants no thank reward to the user who clicked the action. Use a distinct stable achievement ID and zero DNA weight; do not merge the reward into `someone-liked-your-collection`, whose existing 50-Brick meaning remains unchanged. The achievement is named `Gratitude is the sign of noble souls`, with the description `Un coleccionista te dio las gracias por tu regalo.`

3. **Track ranking membership transitions as state, not as read side effects.** Keep the previous Top 10 membership and position per user and ranking. Recompute the Global Top 10 after committed changes to ranking inputs (gamification and public profile), diff it against stored membership, then persist state and entry/exit notifications together. Repeated writes with unchanged membership emit nothing; a later re-entry is a new transition. Recompute Weekly membership once after all snapshots for a daily run are captured, not after each user page, so partial runs cannot create false exits. Weekly processing remains gated by its existing availability date. The Global transition uses the existing default Level ordering.

4. **Create daily summaries at job finalization.** Extend the existing finalization RPC to compare each confirmed snapshot with that user's latest earlier snapshot, derive signed deltas, and insert or update one summary per `(user_id, snapshot_date)`. Calculate daily ranking movement from the completed snapshot set, only for users who were members at both comparison points. The summary is not visible before job completion. An upsert on a same-day rerun updates its data while preserving `is_read` and the original creation timestamp.

5. **Separate user operations from the cron worker.** Inbox reads, marking one/all as read, and thanking use the request's anon client plus authenticated JWT and RLS. Thanking uses a narrowly allowlisted authenticated RPC that derives the thanker from `auth.uid()`. Daily summaries and global membership reconciliation use only allowlisted administrative RPCs from backend workers; no browser code, ordinary endpoint, or general-purpose service-role query can access global notification data.

6. **Reuse the existing modal and asset conventions.** Place the local envelope button at the left above the Rankings panel and reuse it in the dialog heading. Render notification cards by event type, with per-item check actions, a collapsible daily summary, existing local collection, bill, Brick, DNA, and gift assets, and a green Realtime toast. In landscape, expanded Global and Weekly ranking rows show at most three price and age highlights. Compute relative labels on each open using Europe/Madrid calendar dates; use `title` with `es-ES` formatting and `DD/MM/YYYY HH:mm`. The precise threshold for `Hace un instante` is assumed to be less than one minute; the remaining labels partition current and previous calendar weeks, with older records in the final group.

## Risks / Trade-offs

- [Risk] Recomputing a global Top 10 on every ranking-input mutation may be costly as the user base grows. → Restrict recomputation to committed ranking-input changes, keep the candidate projection/indexed, and measure the RPC in database tests; do not recompute during reads or notification delivery.
- [Risk] Browser Realtime may disconnect or deliver duplicate events. → Persist first, deduplicate rendered rows by notification ID, and refetch the cursor-based source of truth on open/reconnect.
- [Risk] A gamification recalculation could erase acknowledgement rewards. → Derive durable acknowledgement counts from the thank ledger wherever gamification is rebuilt, and cover both authenticated and cron/category recalculation paths.
- [Risk] A partial daily run could expose misleading deltas. → Generate daily notifications only from finalization after all required snapshots are confirmed; retain the existing failed-job behavior.
- [Risk] Existing users have no historical rank-membership state at rollout. → Seed current Global membership without emitting entry notifications; create the initial Weekly baseline only when the existing availability and snapshot rules permit it.

## Migration Plan

1. Apply additive, idempotent schema changes for notification storage, thank records, rank membership state, RLS, indexes, and narrowly scoped RPCs/triggers. Migrate existing thank achievements and their Bricks from the user who clicked Thanks to the original gift donor, once per database.
2. Deploy backend/API and worker changes while the UI remains compatible; verify RPC grants and trigger behavior with PGlite and the Supabase mock.
3. Deploy the UI and enable the notification table in the Realtime publication. Seed current Global membership without historical alerts.
4. Roll back by disabling the UI subscription and new routes/triggers first. Keep persisted notifications and reward ledgers intact so a rollback does not revoke granted Bricks; remove schema only in a separately approved destructive migration.

## Open Questions

None. The new achievement's display copy and the one-minute `Hace un instante` threshold are recorded assumptions because the request does not prescribe them.