# Proposal

## Why

Users currently add minipersonas one at a time even when Brickset already associates several minipersonas with one set. Adding by set number will make collecting a set faster while keeping the same metadata, purchase-date rules, and inventory behavior as individual creation.

## What Changes

- Rename the creation modal to `Añadir a inventario` and offer `Nueva minipersona` and `Añadir por set` modes, preserving the existing individual flow.
- Look up a Brickset set by number, show its minipersonas and allow users to select tracking and collection state for each.
- Prefer the same-number variant named Complete for bare-number searches, including full CMF series, while respecting explicit suffixes.
- Show existing inventory entries using their saved data, report duplicate IDs after saving, and atomically add the remaining entries.
- Keep the set-entry flow usable on desktop, smartphone, and Android, including expandable minipersona images and non-clickable IDs.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `interfaz-web-minifiguras`: Update creation-modal behavior and specify set lookup, per-minipersona controls, responsive table, and image enlargement.
- `minifiguras`: Specify set-based retrieval and atomic multi-minipersona creation while preserving the existing inventory model and per-user access rules.

## Impact

- The minipersona creation modal, set lookup dialog, and set-results table in the web and Android-compatible interface.
- Authenticated set lookup and inventory creation behavior, including Brickset errors, existing inventory entries, and all-or-nothing persistence for new entries.
- Automated UI, API, and persistence tests. No new user-visible data model or privileged access is intended.
