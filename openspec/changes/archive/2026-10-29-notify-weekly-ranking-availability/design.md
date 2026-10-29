# Design

## Context

The weekly Top 10 is reconciled only after a daily-sync run finishes successfully. It is derived from V2 snapshots, and existing notifications cover Top 10 membership transitions rather than general availability. The inbox uses an explicit payload allowlist and opening a ranking must not change read state.

## Goals / Non-Goals

**Goals:** Emit one durable availability notice per registered account and Madrid ISO week, atomically with the first successful daily-sync completion that has a valid weekly candidate. Let the user open the weekly dialog from that notice.

**Non-Goals:** Backfill notices for prior weeks, change ranking calculations, replace Top 10 transition notices, or mark a notice read when its action is used.

## Decisions

- Hook publication to the transition of a daily-sync run into `completed`, after the existing finalizer has captured snapshots and reconciled weekly membership. A trigger keeps the change additive and prevents HTTP ranking reads from creating notifications.
- Store one private publication row keyed by `week_start`. The row is inserted in the same transaction as the notices; conflict means this week was already announced. Failed transactions roll back both the marker and notices.
- Send to registered accounts, not only Top 10 members, because this is an informational availability event. Keep the payload allowlisted to `weekStart` and a fixed message.
- Render a dedicated action in the existing inbox that activates the existing weekly-ranking opener. It does not call the mark-read endpoint.
- In the production migration, seed the current week as already announced when it is already available, without sending a retroactive notice. New notices begin with a future first-availability event.

## Risks / Trade-offs

- [Risk] A completed daily-sync retry could announce twice. → The private week key and completion-transition trigger make publication idempotent.
- [Risk] An incomplete or failed sync could announce prematurely. → Only transition to `completed` is observed, and publication requires at least one valid weekly member.
- [Risk] Applying the feature during an already available week could create a misleading late notice. → The incremental migration silently seeds that week's publication marker.

## Migration Plan

Apply the additive SQL migration before deploying the application. It adds the notification type, private publication state and trigger, and silently seeds the current week if already available. Rollback removes the trigger/function, state table and notification type allowance; existing notices, if any, should be retained unless the product explicitly requests deletion.