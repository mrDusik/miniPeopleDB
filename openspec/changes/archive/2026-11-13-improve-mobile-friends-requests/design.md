# Design

## Context

See `proposal.md` for motivation and `specs/amigos/spec.md` for the behavior contract. The modal is rendered by the shared web client used by the Capacitor Android package. The sent-request projection includes a request ID but deliberately masks rejected requests as pending. `friend_requests` has no direct write grants for authenticated users; friend mutations use JWT-bound RPCs, and deleting a request cascades to its linked notification.

## Goals / Non-Goals

**Goals:**

- Let the sender withdraw their own pending or rejected request without exposing which of those states it had.
- Keep withdrawal, linked notification removal, and the affected users' social-gamification recalculation coherent.
- Give the sender's ranking summary more horizontal space on smartphone/Android by placing the received-request actions in a narrow vertical action column.

**Non-Goals:**

- Changing the existing privacy of rejection status, friend acceptance, or unrelated Android-native behavior.
- Adding a new persistence table or granting direct table writes to authenticated users.
- Changing the desktop arrangement of received-request actions.

## Decisions

### Use a narrowly scoped, session-authorized revocation RPC

Add a revocation operation to the existing friends API/repository flow and back it with a dedicated Supabase RPC. The RPC derives the actor from `auth.uid()`, requires the `authenticated` role, and deletes only a request whose sender is that actor and whose status is pending or rejected. It also recalculates social gamification for the two participants in the same transaction. The API uses the request ID already returned for sent rows and the user's JWT; it does not use `service_role` or grant table-level delete permission.

Deleting the request removes it from both list projections and allows the existing unique-pair constraint to accept a later request. The foreign-key cascade removes the notification associated with the withdrawn request. Requests accepted by the recipient are not revocable.

The RPC returns the same successful outcome for pending and rejected requests so the sender's existing rejection privacy is preserved. An absent, accepted, or non-owned request produces a controlled not-found result rather than exposing another user's request.

### Render revocation for all sent rows

Because the sender's list intentionally does not distinguish rejected from pending, render the X action for both states. This matches the RPC's allowed states and avoids using button presence to disclose a rejection. On success, remove the row from the local sent list, refresh counts, and reset the corresponding search relationship state so a new request can be initiated.

### Stack received actions only at mobile portrait widths

Keep the current horizontal action arrangement on larger displays. In the smartphone/Android portrait responsive rules, arrange the received pending request's accept and reject buttons vertically in the existing lateral action area. Preserve the equal 60px button width and 44px minimum touch height; keep rejected rows' existing status and accept-only action.

### Keep SQL installation paths and tests aligned

Define the RPC and its authenticated-only execute grant in both `supabase/schema.sql` and the existing friends upgrade migration so fresh and existing installations have the same behavior. Update the Amigos installation notes in `README.md`. Cover the route/repository with the standard Supabase mock, and validate ownership, allowed states, cascade, gamification, permissions, and rollback with PGlite.

## Risks / Trade-offs

- [Deleting a rejected request removes its history and permits a new request] → This is the explicitly selected behavior; keep the operation available only to its original sender and only while the request is pending or rejected.
- [A gamification recalculation or notification cascade failure could leave partial effects] → Perform all persistence changes inside the RPC transaction and add rollback assertions in PGlite tests.
- [A narrow action column can still reduce the summary width on very small screens] → Stack the received actions, retain compact touch-sized controls, and assert the resulting responsive layout in automated UI tests.

## Migration Plan

1. Add the RPC and its grants to `supabase/schema.sql` and `supabase/friends-social-upgrade.sql`.
2. Document and apply the upgrade SQL to an existing authorized Supabase project before deploying the backend and client; fresh installations use the updated schema.
3. Roll back by restoring the prior client/backend first, then removing the new RPC from the schema/migration only after no deployed code calls it. No data backfill is required.
