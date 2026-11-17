# Design

## Context

See `proposal.md` for the motivation and `specs/` for the behavior contract. The existing creation form in `public/app.js` handles one ID at a time, while `src/server.js` serves authenticated minifigure operations through the user's Supabase client. `MinifigurasRepository.create` validates and inserts one row, and `supabase/schema.sql` enforces uniqueness per `(user_id, id)`. Brickset HTML requests already use the backend `BricksetScraper`, its queue, timeout, and rate-limit handling.

The change must keep set lookup and inventory reads/writes server-side, use the authenticated user's JWT/RLS, and preserve the ordinary single-minipersona form unchanged apart from the new creation-mode shell.

## Goals / Non-Goals

**Goals:**

- Reuse the current Brickset and inventory paths for set metadata, saved records, and image enlargement.
- Add one set lookup flow and one atomic multi-record create flow without broadening access privileges.
- Keep duplicate records read-only and preserve the per-record state chosen for new records.
- Refresh collection-derived state once after a successful batch.

**Non-Goals:**

- Change the single-minipersona creation, edit, or view flows.
- Store set membership as a new inventory field or create a separate set collection.
- Change the existing optional purchase-date or empty purchase-price semantics.
- Add service-role access, public set lookup, or a new third-party dependency.

## Decisions

### Perform set resolution through the existing backend Brickset scraper

Extend the server-side scraper with set-content lookup using Brickset's set page and its minifigure inventory data. For a bare number, search Brickset's paginated set results for a variant of that exact number with `Complete` in its name, falling back to `-1` only when none exists. Resolve the actual suffix from the result link, never a hard-coded CMF suffix. Explicit variants bypass this search and remain unchanged. Search failures or malformed result pages propagate as controlled errors rather than silently selecting `-1`. Continue using the scraper's serialized request queue, timeout, and rate-limit handling for every request. Parse and validate the resolved set's minifigure IDs, then resolve metadata for new IDs using the existing minifigure detail path and official-category mapping.

The authenticated set lookup route will return a controlled result that distinguishes a missing set, a set without minifigures, and a temporary Brickset failure. It will merge only the current user's inventory records for IDs present in that set; saved values take precedence over Brickset values. Other users' inventory is never consulted.

**Alternative considered:** Fetch Brickset directly from the browser. This would expose the integration to client-side network/CORS constraints and bypass the backend's established request throttling and error handling.

### Keep the set workflow in the existing form and use a separate lookup dialog

Keep the current form as the inventory modal, add the two creation-mode selectors, and show a small set-number dialog for lookup. Keep set rows in local form state until saving. Reuse the table's image enlargement behavior and status/observation icon patterns, but render IDs as plain text in this table. Rows already in the user's catalog show persisted data and disabled controls; only new rows can be configured.

Use a `Cerrar` action in the lookup heading and omit the provider name from lookup messages. Show the inventory-formatted price on desktop and mobile. Reuse the inventory comparator with independent sort state for the set table, exposing sorting on the Minifigura, category, subcategory, year and price headings. Minifigura implicitly sorts by ID without separate ID/name controls. Sorting never changes draft row selections or the inventory order.

Title the lookup dialog `Buscar set`. Before a set table is selected, hide the result heading, summary and explanatory text and show a `Buscar set` button instead. Disable it while the lookup dialog is open, and refresh its enabled state on dialog close, including Escape.

Keep the submitted search text alongside the resolved lookup result. Display that text in the set heading and restore it when reopening the lookup dialog, while retaining the backend's canonical variant internally.

If a nonempty lookup contains only existing inventory entries, show the complete-set message and keep `Continuar` disabled without retaining an actionable lookup result. Users can search another set or close the dialog; mixed sets still proceed with read-only duplicates.

**Alternative considered:** Create a separate set-inventory page or store a draft set on the server. Neither is needed for a transient form workflow and both would add state and cleanup behavior.

### Persist new rows with one authenticated batch insert

Add a repository operation that normalizes and validates every new row before writing. Insert the rows in a single Supabase statement through the request's user-scoped client so PostgreSQL applies the existing `(user_id, id)` uniqueness and RLS policies. Configure duplicate conflicts to be ignored rather than replaced, and return the IDs actually inserted plus IDs that were already present. A database or validation error rejects the statement, leaving no newly inserted subset. Run the existing catalog-persisted/gamification callback once after a successful batch.

The client also marks duplicates during lookup for the read-only preview. The repository remains authoritative at save time in case another request added an ID after the preview. Existing records are never sent as updates. Empty batches of only known duplicates are no-ops that return the duplicate IDs for the agreed message.

**Alternative considered:** Send one ordinary create request per minipersona. A later request could fail after earlier rows had committed, violating the all-or-none batch requirement.

### Keep authentication and errors within existing boundaries

Place lookup and batch creation under the protected minifigure route family. Both operations use the current JWT and RLS; no service-role client or new database privilege is introduced. Return controlled Brickset and persistence errors, and do not label a timeout, rate limit, or parser failure as “El set no se encuentra”.

**Alternative considered:** Add a global set endpoint or administrative RPC. Set contents are public source data, but merging them with inventory and creating records is user-scoped; global or privileged access is unnecessary.

## Risks / Trade-offs

- [Brickset changes its set inventory markup or endpoint] -> Keep the parser isolated in the scraper, test with captured HTML fixtures, distinguish parse failures from missing sets, and expose a retryable error.
- [A set contains enough minifigures to trigger Brickset throttling while resolving metadata] -> Reuse the existing serialized request queue and surface loading/error states; do not bypass rate limits with parallel requests.
- [Bare-number variant discovery adds search requests] -> Retain the loading state and request throttling, stop once the matching Complete variant is found, and skip discovery for explicit variants.
- [Another request adds a figure during preview] -> Recheck uniqueness in the atomic insert, ignore the conflicting row without modifying it, and include it in the duplicate result.
- [Gamification refresh fails after the inventory insert] -> Match the existing post-persistence callback behavior and ensure the inventory rows themselves remain all-or-none; surface the failure rather than claiming that no write occurred.

## Migration Plan

No schema migration is expected. Deploy the server and client changes together. Rollback consists of reverting the application deployment; existing inventory records remain valid and do not require conversion.
