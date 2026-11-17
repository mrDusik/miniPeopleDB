# Tasks

## 1. Brickset set lookup

- [x] 1.1 Extend the Brickset scraper to normalize set numbers, prefer same-number Complete variants for bare searches, and parse set minifigure IDs; add fixture tests for `71851-1`, `72154-1`, `71001-17`, explicit variants, pagination, empty sets, missing sets, malformed responses, timeouts, and rate limits in `test/brickset-scraper.test.js`.
- [x] 1.2 Add an authenticated set lookup route that resolves new minifigure metadata and merges the current user's saved records; verify found, Complete CMF series, empty, missing, temporary-error, and ownership cases using `test-support/supabase-mock.js` in `test/minifiguras.test.js`.

## 2. Atomic inventory creation

- [x] 2.1 Add repository support for validating and inserting a batch through the user's JWT/RLS client, preserving existing records and reporting duplicate IDs; verify multi-row creation, default fields, duplicates, concurrent conflicts, and all-or-none failure in `test/minifiguras.test.js`.
- [x] 2.2 Add the authenticated batch-creation API behavior and refresh derived collection state once after commit; verify invalid payloads, database failure without partial inserts, duplicate-only batches, and gamification refresh using the Supabase mock in `test/minifiguras.test.js`.

## 3. Set-based creation interface

- [x] 3.1 Add the inventory-modal title and creation selectors plus the set-number dialog, provider-neutral status messages, retry, and close behavior; verify the default individual flow remains unchanged and set lookup states are covered in `test/web.test.js`.
- [x] 3.2 Render responsive set rows with database-backed read-only duplicates, per-new-row tracking/state controls, shared purchase date, enlarged images, non-clickable IDs, price, and independent sorting by Minifigura (implicitly ID), category, subcategory, year and price; verify desktop and smartphone layouts and row interactions in `test/web.test.js`.
- [x] 3.3 Connect save to the atomic batch operation and show the agreed singular/plural duplicate message without success-shaped errors; verify successful mixed batches, duplicate-only results, purchase fields, and failed saves in `test/web.test.js`.

## 4. Integration verification

- [x] 4.1 Run the focused Brickset, API, and web test files and verify they pass: `npm test -- test/brickset-scraper.test.js test/minifiguras.test.js test/web.test.js`.
- [x] 4.2 Run the Android web asset build and verify the updated interface packages successfully: `npm run android:web`.
