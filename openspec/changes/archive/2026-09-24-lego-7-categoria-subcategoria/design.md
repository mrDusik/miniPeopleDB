# Design

## Context

See [proposal.md](proposal.md) for motivation. Current state relevant to this design:

- `data/temas-brickset.json` is a flat array `{ tema, total }[]`, validated by `validateTemas` in [src/temas-repository.js](../../../src/temas-repository.js) and served via `GET /temas` in [src/server.js](../../../src/server.js).
- `src/brickset-themes-scraper.js` parses `https://brickset.com/browse/minifigs` into that flat shape with a single regex over `<a href="/minifigs/category-...">Name</a> (total)` anchors.
- `src/minifiguras-repository.js` validates each minifigura against `MINIFIGURA_FIELDS` (a fixed allow-list) including `tematica`, checked against the flat set of official theme names loaded from `TemasRepository`.
- `public/app.js` populates the `#tema` filter select and the `#form-tematica` form select from `GET /temas`, and renders a fixed set of table columns including `descripcion` and `tematica`.
- `.github/agents/brickset.agent.md` reconciles `data/temas-brickset.json` and `data/minifiguras.json` by name/total diffing, with no concept of a nested level.
- On Brickset, subcategory pages (e.g. "Series 17 Minifigures") are themselves listed under the parent category's browse page as `<a href="/minifigs/category-X/subcategory-Y">Name</a> (n)`, but the exact markup must be re-verified when implementing the scraper.

## Goals / Non-Goals

**Goals:**
- Rename the "tema/tematica" concept to "categoria" end-to-end (data file, field name, endpoint, filter param, classes, error codes) so the codebase and API are self-consistent.
- Add an optional, second-level `subcategoria` that is always scoped to a `categoria` and validated against the locally cached catalog.
- Keep the local JSON catalog as the single source of truth for valid `categoria`/`subcategoria` pairs, with no live Brickset calls on the request path.
- Keep persistence atomic and keep existing test isolation patterns (injectable `filePath`, `fetchImpl`, repository).

**Non-Goals:**
- Populating `subcategoria` values for existing minifiguras (done manually by the user, per proposal).
- Supporting more than two levels of nesting.
- Changing how individual/bulk price scraping (`brickset-scraper.js`) works.
- Populating `subcategorias` for every category: Brickset does not expose an exhaustive, low-cost way to discover every subcategory for all ~130 categories (see Decisions below), so this change scopes subcategory data to `Collectible Minifigures` only. Other categories keep `subcategorias: []` until this is explicitly revisited.

## Decisions

### Nested categories file replaces the flat one
`data/categorias-brickset.json` becomes an array of `{ categoria: string, total: integer, subcategorias: { subcategoria: string, total?: integer }[] }`. Each subcategory carries its own optional `total`, entered by hand by the user (Brickset does not expose subcategory totals in static HTML; they live behind a JS-driven `SUBCATEGORY` filter). `total` absent or `0` both mean "not provided" and are treated identically: no feature reads or aggregates a subcategory's `total` when it is `0` or missing. There is no sum-of-subcategories-equals-category-total invariant — that check was rejected earlier as impractical to keep in sync automatically, and this per-subcategory manual total does not change that. Rejected alternative: keep two parallel files (categories + subcategories) — rejected because it duplicates the categoria name as a join key and complicates atomic sync (two files can't be swapped as one transaction).

### `validateTemas` becomes `validateCategorias` with nested checks
Extend the existing validation approach (single pass, throws a typed error) to also: require `subcategorias` to be an array of `{ subcategoria, total? }` objects, where `subcategoria` is a non-empty trimmed string and `total`, when present, is a non-negative integer; and enforce uniqueness of subcategory names *within* a category (not globally).

### Renaming is a straight rename, not an alias layer
Since this is a local single-consumer app (no external API consumers besides its own `public/app.js`), the proposal already marks this as **BREAKING**. Introducing a compatibility shim (`tematica` accepted as an alias of `categoria`) would add permanent complexity for a project with no external clients — rejected in favor of a clean rename across `src/`, `public/`, `data/`, `.github/agents/brickset.agent.md`, and `test/`.

### Scope restricted to Collectible Minifigures
Brickset's public browse page (`/browse/minifigs`) lists only categories, not subcategories. Subcategory names exist per-category behind a JS-rendered `SUBCATEGORY` `<select>` filter on each category's page (e.g. `https://brickset.com/minifigs/category-Collectible-Minifigures`), which is not present in the static HTML `fetch_webpage` sees and is impractical to discover reliably for ~130 categories by paginating every minifigure listing. Given this, subcategory data is populated only for `Collectible Minifigures` (the category the user cares about and where an exhaustive Series enumeration is feasible via that category's own subcategory filter, read directly in a browser), obtained by reading that `<select>`'s options rather than scraping listing pages. Every other category keeps `subcategorias: []`. Rejected alternative: scrape every category's listing pages to infer subcategories from minifigure tags — rejected as too costly and fragile to keep in sync automatically; revisit only if the user asks to extend scope to more categories.

### Filter semantics for `subcategoria` without `categoria`
Per the modified `minifiguras` spec, filtering by `subcategoria` alone (without `categoria`) is allowed and matches on subcategory name only, since subcategory names are typically unique per category and the UI always sends both together when the user has picked a category. This avoids adding a second validation path that requires `categoria` whenever `subcategoria` is present, keeping the filter implementation symmetrical with the existing `tema`/`anio`/`estadoColeccion` filters.

### UI dependent selects (filter panel only)
`public/app.js` gets a `renderSubcategoryOptions(selectElement, categoria, placeholderText)` helper invoked on `change` of the filter panel's `#categoria` select and whenever the categories catalog reloads. The categories catalog fetched from `GET /categorias` is kept in memory as `officialCategorias` (array of `{ categoria, total, subcategorias }`), and a `Map<categoria, subcategoria[]>` (`subcategoriasPorCategoria`) is derived from it once per load. This dependent-select behavior applies only to the filter panel (`#categoria`/`#subcategoria`); the create/edit form does not have dependent selects (see below).

### Form fields become read-only, filled from a single Brickset lookup
The create/edit form's `categoria`, `subcategoria`, and `anio` were originally planned as a `categoria` select with a dependent `subcategoria` select and a free-entry `anio` number input. That was superseded once `precio` was already read-only and fetched from Brickset per-minifigure: for consistency, `categoria`, `subcategoria`, and `anio` were converted to read-only inputs (`public/index.html`) filled together with `precio` by a single button (`#lookup-brickset`, "Consultar datos en Brickset"), which calls `GET /minifiguras/:id/brickset` (see the `valoracion-coleccion` delta spec). This removes manual entry/validation-at-typing-time for these three fields; `validatePayload` in `public/app.js` still validates the resulting values against `officialCategorias`/`subcategoriasPorCategoria` before submit, unchanged from before. The bulk "Actualizar precios desde Brickset" button is explicitly out of scope for this behavior and continues to update only `precio` via the existing `getPrice`/`/sincronizacion/brickset` path.

### Brickset detail scraping uses the `<dt>/<dd>` "Minifig details" list, not the tags snippet
An initial implementation of `parseBricksetDetails` looked for a `<div class="tags floatleft">...</div>` snippet (observed via a tool that renders/derives HTML from the page). That snippet is not present in the plain server-rendered HTML a real `fetch()` receives, so the initial version always failed with `BRICKSET_DETALLES_NO_DISPONIBLES` in manual testing (real bug, reported and reproduced against `https://brickset.com/minifigs/col450`). The fix reads the actual static markup instead: a `<dl>` with `<dt>Category</dt><dd><a>...</a></dd>`, `<dt>Subcategory</dt><dd>...</dd>` (optional), and `<dt>Year released</dt><dd>...</dd>` entries, confirmed by fetching real pages (`col450`, `st008`) directly with Node's `fetch`. Test fixtures in `test/brickset-scraper.test.js` and `test/minifiguras.test.js` were rewritten to use this real markup shape instead of the fabricated one.

### Icon-only actions with accessible labels
`Nueva minifigura`, `Editar`, and `Eliminar` were converted from text buttons to icon-only buttons (`.button-icon` in `public/styles.css`) using small inline SVGs (plus/pencil/trash), each with an `aria-label` and `title` carrying the original text so the accessible name and tooltip are unchanged even though no text is visible. `actionsCell` and the static "Nueva minifigura" button in `public/index.html` were updated accordingly; no changes to `data-action`/`data-id` wiring, so click handling in `catalogBody`'s delegated listener is unaffected.

### Table ID column no longer opens the image preview
`idCell` previously rendered a `.id-link` button with `data-action="preview"`, duplicating the thumbnail's preview behavior. Per explicit request, the ID cell is now plain text (`cell(minifigura.id)`); only the thumbnail image (`data-action="preview"` on `.table-thumb`) and the ranking cards open the image modal.

### Filters-form and rankings layout
- `.filters-form`'s grid was widened from `repeat(3, 1fr) auto` to `repeat(5, 1fr) auto` to match its actual 5 fields (`id`, `categoria`, `subcategoria`, `anio`, `estadoColeccion`) plus the `Buscar`/`Mostrar todo` actions, so they render in a single row at desktop widths (existing `@media` breakpoints still collapse to 2/1 columns on narrower viewports).
- Filter/placeholder option text was shortened from "Todas las categorías" / "Todas las subcategorías" / "Todos los estados" to "Todas" / "Todas" / "Todos" (`public/index.html` static option, `public/app.js` dynamically-rendered options).
- The two ranking sections (`#top-five-list`, `#oldest-five-list`) were moved out of `<header class="page-header">` (which has `max-width: 760px`) into their own `.rankings` container as a direct sibling of `.search-panel`/`.results-panel`, so the rankings span the same full width as those panels instead of being cramped inside the narrower header. Each ranking keeps its own bordered box (`.top-five`) side-by-side in a two-column grid (`.rankings { grid-template-columns: 1fr 1fr }`, collapsing to one column ≤900px).
- `.ranking-card` changed from a fixed `120px` width to `flex: 1 1 0; min-width: 0`, and `.ranking-row`'s gap shrank, so all 5 cards in a ranking always fit within its column without horizontal scrolling — they shrink proportionally with the viewport instead.

### Table column changes
`descripcion` column is removed from the table (`public/index.html` `<thead>` and the corresponding `cell(minifigura.descripcion)` in `renderCatalog`), while the field and its form input remain untouched, per proposal.

## Risks / Trade-offs

- [Risk] Subcategory names are not scraped automatically by `parseBricksetCategorias` (only categories are); populating them for `Collectible Minifigures` required a one-off manual read of that category's `SUBCATEGORY` filter in a live browser session → Mitigation: this is a one-time population documented here; the `Brickset` agent re-reviews only `Collectible Minifigures`' subcategories on each run using the same approach, and all other categories intentionally stay `subcategorias: []` per the scope decision above.
- [Risk] Renaming `tematica` → `categoria` is breaking for anyone with the old `data/minifiguras.json` field names or bookmarked `?tema=` URLs → Mitigation: this is a local single-user app with no external consumers; proposal explicitly calls this out as **BREAKING** and the change updates all first-party call sites in the same change.
- [Risk] Existing `data/minifiguras.json` entries lack `subcategoria` and, after rename, will have `categoria` instead of `tematica` → Mitigation: a one-time field rename of `tematica` → `categoria` in `data/minifiguras.json` is included in tasks; `subcategoria` stays absent (allowed, per spec) until filled in manually.
