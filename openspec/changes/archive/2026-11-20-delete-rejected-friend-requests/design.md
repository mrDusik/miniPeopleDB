# Design

## Decision

Rejecting a pending request deletes its `friend_requests` row instead of persisting a `rejected` state. Before deleting it, the RPC clears `social_request_id` on the recipient's `friend_request` notification. The notification remains visible as historical information, but is no longer actionable because it no longer references a request. The RPC continues returning `status: rejected` as an action result, not a stored state.

The sender can submit a fresh request after deletion; it receives a new ID and notification. The recipient cannot reject an accepted request.

## Migration

An idempotent migration detaches notifications from legacy rejected rows before deleting them, replaces the rejection and counter RPCs, and narrows the request status constraint to `pending` and `accepted`. The notification reference constraint permits an unlinked historical `friend_request` notification; acceptance requires a live request ID. The rejection RPC remains restricted to `authenticated`; it uses the caller's JWT and does not use `service_role`.

## Interface

After a successful rejection, remove the row from the received list, reset any locally displayed incoming relationship to `none`, update counts and notifications, and refresh social gamification. The original notification remains in the notification modal with its accept action disabled. Acceptance behavior remains unchanged.

## Validation

Cover legacy-row cleanup, notification preservation, and migration idempotence with PGlite; cover deletion, notification availability and disabled acceptance, fresh resend, new request ID, list/count/search state and acceptance with API, mock, and browser tests.
