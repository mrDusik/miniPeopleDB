# Proposal

## Why

MiniPeople DB ya permite gestionar el catálogo, pero no ofrece una forma persistente de vigilar figuras prioritarias ni filtros suficientemente expresivos para localizar una pieza por nombre y taxonomía. Además, el modal actual mezcla los flujos de alta, edición y consulta, y la persistencia de IDs no garantiza una representación canónica para integraciones y URLs de imágenes.

## What Changes

- **BREAKING**: ampliar el modelo persistido de `data/minifiguras.json` con `observada`, normalizar todos los IDs a `id.toUpperCase().trim()` al procesarlos y migrar los registros existentes con `observada: false`.
- Añadir watchlist persistente para figuras `COLECCIÓN` y `BUSCADA`, con máximo de 10 elementos, filtro de observadas, toggle accesible y galería horizontal bajo los rankings.
- Extender los filtros de catálogo con búsqueda parcial e insensible a mayúsculas por `nombre`, y reemplazar las opciones estáticas de categoría/subcategoría por opciones derivadas del catálogo actual con contadores y dependencia en cascada.
- **BREAKING**: actualizar el comportamiento de año recibido desde Brickset: `0` o ausencia se convertirá en el año actual durante la sincronización, en lugar de dejar el campo vacío.
- Rediseñar el modal en dos columnas con preview BrickLink y tres modos explícitos: creación bloqueada hasta sincronizar un ID, edición con campos externos de solo lectura y visualización completamente no editable.
- Convertir el ID de la tabla en enlace `.id-link` que abre el modal de visualización; mantener las imágenes con IDs minúsculos únicamente en la URL CDN.
- Mantener los contratos locales JSON y de persistencia atómica, y ampliar las pruebas de repositorio, API y navegador para migración, normalización, watchlist, filtros, modal, sincronización y accesibilidad.

## Capabilities

### New Capabilities

Ninguna. Los requisitos se integran en capacidades existentes.

### Modified Capabilities

- `minifiguras`: añade el estado `observada`, su migración y validación, normaliza IDs, incorpora filtros por nombre y observación, y define el límite persistente de la watchlist.
- `interfaz-web-minifiguras`: añade filtros dinámicos, toggle y galería de observación, enlace de ID, modal unificado por modos y controles de validación/solo lectura.
- `valoracion-coleccion`: expone los datos necesarios para la galería de observadas, ordenados por precio Brickset sin alterar los rankings existentes.

## Impact

- **Persistencia y backend**: `data/minifiguras.json`, `src/minifiguras-repository.js` y `src/server.js`, incluyendo filtros, actualización de observación y fallback de año en el detalle Brickset.
- **Frontend**: `public/index.html`, `public/app.js` y `public/styles.css`, incluyendo nuevos controles, modal, preview y estados visuales.
- **Tests**: `test/minifiguras.test.js`, `test/web.test.js` y pruebas relacionadas con Brickset/valoración; se conservará el aislamiento mediante archivos JSON temporales.
- No se añade base de datos ni dependencia externa: el catálogo JSON local continúa siendo la fuente de verdad.
