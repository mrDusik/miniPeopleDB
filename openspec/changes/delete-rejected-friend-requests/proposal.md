# Proposal

## Why

Rejected friend requests currently remain as persistent relationships. This prevents the original sender from trying again and keeps rejected entries in request lists and counts.

## What Changes

- Delete a pending friend request when its recipient rejects it, while preserving the original notification as non-actionable history.
- Allow the original sender to create a new request after rejection.
- Exclude rejected requests from persisted states, lists, and counts while preserving the rejection response returned by the API.
- Update the frontend, Supabase migration, mock, and automated coverage.

## Capabilities

### Modified

- `amigos`: rejection deletes the request and a later send creates a new request.

## Impact

- Supabase RPCs and an incremental migration, friend request repository/mock, API/UI behavior, and related tests.
- No change to authentication: ordinary social actions continue using the authenticated user's JWT and RLS.
