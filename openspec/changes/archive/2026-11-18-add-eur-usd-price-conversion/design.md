# Design

## Context

See [proposal.md](proposal.md) for the motivation and [specs](specs/) for the behavior contract.

- `user_profiles.currency` already exists, defaults to `EUR`, and is the only supported value in validation and the SQL constraint.
- `precio` and `precioCompra` are numeric EUR values throughout persistence, API responses, totals and analytics snapshots.
- `BricksetScraper` already parses Brickset USD quotes, obtains the BCE USD-per-EUR daily rate, caches it for 24 hours, and converts Brickset prices to EUR before returning them. Its rate accessor is currently private to the scraper.
- `public/app.js` formats prices in several independent views, and profile forms already load and save the currency preference.
- Ordinary profile/API operations use the authenticated user's JWT and RLS. The shared BCE quote is public data and needs no privileged database access.

## Goals / Non-Goals

**Goals:**

- Reuse one validated BCE quote for Brickset and user-price conversions.
- Keep EUR as the canonical storage and API unit so existing price rows and valuation contracts remain compatible.
- Make the profile currency control both presentation and the denomination of manually entered purchase prices.
- Fail explicitly when a required conversion cannot be completed.

**Non-Goals:**

- Do not add a third currency, currency detection, or exchange-rate providers other than the existing BCE source.
- Do not store an original input currency per price or rewrite historical values when the user's preference changes.
- Do not convert price values in persisted analytics snapshots, database rows, or API responses.

## Decisions

### One shared BCE quote, served by the authenticated backend

Expose the current quote through a small authenticated valuation endpoint, using the existing scraper's BCE URL, parser, timeout, cache and retry policy. Refactor the rate accessor only as needed so both the scraper and endpoint share the same in-process quote and in-flight request. Return the quote as USD per EUR together with its currencies and reference date; keep network access to the BCE on the server rather than relying on browser CORS or making duplicate requests from clients.

Alternatives considered:
- Fetch from the browser: rejected because it bypasses the existing cache, creates CORS/network dependencies for web and Android, and duplicates exchange-rate logic.
- Add another quote cache/provider: rejected because it risks inconsistent rates between Brickset and user-entered prices.

### EUR remains canonical

Continue storing and returning `precio`, `precioCompra`, valuation summaries and analytics values in EUR. EUR profile values pass through unchanged. For USD display, multiply canonical EUR by the BCE USD-per-EUR quote. For a USD purchase input, divide by the same quote and round the stored EUR amount to cents. Format the converted amount to cents for display. Differences are calculated from canonical EUR values first and then converted, avoiding subtraction of independently rounded display strings.

Existing figures and profiles already use EUR, so no price-data rewrite is required. Expand only the existing profile currency constraint and its validators; preserve the EUR default. Add a transactional, rerunnable migration before deploying code that saves USD.

Alternative considered:
- Add a currency column to every price field: rejected because current values are EUR, this expands the data model and migration surface, and is unnecessary for the requested display/input conversion.

### Currency is applied at presentation and form boundaries

Use the authenticated user's profile currency for all own and public-profile price displays, independently of the viewed profile's private preference. Centralize conversion alongside existing price formatters so tables, forms, totals, rankings, watchlists, historical charts and own notifications use the same quote. When a purchase form is opened, convert the stored EUR value for display; only convert and submit it back to canonical EUR after the user saves. A currency change itself SHALL NOT rewrite minifigure records.

Before confirming a switch to USD, prepare a valid quote. If the quote cannot be loaded, retain the previous confirmed profile currency and form values and report a retryable error. A later BCE outage while an already-USD profile is active must never cause an EUR amount to be shown with a USD label or allow an unconverted USD price to be saved.

Alternative considered:
- Change only the currency symbol: rejected because it would misrepresent EUR amounts as USD.

## Risks / Trade-offs

- [The BCE quote may be unavailable] → Reuse the current cache/retry behavior, expose a controlled error, and block conversion instead of guessing or silently relabeling.
- [Converting a USD input to canonical EUR rounds to cents] → Make EUR the authoritative stored amount and test both conversion directions and resulting display precision; avoid repeated conversion during reads and language changes.
- [A deployment rollback could encounter USD profiles] → Apply the database constraint migration first; a rollback must retain acceptance of EUR/USD while any USD profile exists.
- [Several UI surfaces format money independently] → Route all currency-bearing views through the shared conversion/formatting helpers and test representative inventory, summary, analytics, rankings and notification output.

## Migration Plan

1. Add and test a transactional, rerunnable migration that expands only the profile currency constraint to `EUR`/`USD`, retaining the EUR default and existing data, RLS and grants.
2. Deploy the migration before backend/frontend code that can save USD profiles.
3. Deploy the backend rate endpoint, profile validation and conversion-aware web resources together.
4. Verify an existing EUR profile and prices remain unchanged; save USD, reload, enter/edit prices in USD, switch back to EUR and verify all stored amounts remain canonical EUR.
5. On rollback, disable choosing USD in the client but retain database/backend support until no USD profile remains. Do not silently rewrite preferences or narrow the constraint.
