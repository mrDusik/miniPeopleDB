# Proposal

## Why

Brickset organiza sus minifiguras en categorías (actualmente modeladas en la app como "Tema") que a su vez agrupan subcategorías (por ejemplo, "Collectible Minifigures" contiene "Series 17 Minifigures", "Team GB", etc.), cada una con su propio total de minifiguras publicado. El catálogo local no captura este segundo nivel, por lo que no se puede filtrar, clasificar ni validar minifiguras por subcategoría, ni sincronizar de forma coherente los totales anidados que publica Brickset.

## What Changes

- **BREAKING**: Renombrar el catálogo local `data/temas-brickset.json` a `data/categorias-brickset.json`, con una estructura anidada `{ categoria, total, subcategorias: string[] }` (sin total por subcategoría: Brickset no publica ese dato en HTML estático accesible).
- **BREAKING**: Renombrar en toda la aplicación el concepto "Tema"/`tematica` a "Categoría"/`categoria`: campo `tematica` de cada minifigura pasa a `categoria`, el endpoint `GET /temas` pasa a `GET /categorias`, el parámetro de filtro `?tema=` pasa a `?categoria=`, las clases `TemasRepository`/`BricksetThemesScraper` pasan a `CategoriasRepository`/`BricksetCategoriasScraper`, y los códigos de error `TEMAS_*` pasan a `CATEGORIAS_*`.
- Añadir el nuevo campo opcional `subcategoria` a cada minifigura. Su valor SHALL pertenecer al conjunto de subcategorías declaradas para la `categoria` de esa misma minifigura en el catálogo local; si `categoria` no tiene subcategorías registradas, `subcategoria` no SHALL estar presente. No se poblará este campo en los datos existentes: se completará manualmente.
- **Alcance de subcategorías**: por el volumen de trabajo que supondría revisar manualmente las ~130 categorías de Brickset, las subcategorías solo se completan para `Collectible Minifigures` (la única categoría local con `subcategorias` no vacío), obtenidas directamente del filtro `SUBCATEGORY` de esa categoría en Brickset. El resto de categorías conserva `subcategorias: []` hasta que se decida ampliar el alcance.
- El scraper automático (`BricksetCategoriasScraper`) solo extrae nombres y totales de categoría desde `https://brickset.com/browse/minifigs`; no extrae subcategorías (Brickset no las publica en ese listado). La lista de subcategorías de `Collectible Minifigures` se revisa y mantiene manualmente (por el agente `Brickset` o el usuario).
- Actualizar el agente `Brickset` (`.github/agents/brickset.agent.md`) para reconciliar también subcategorías, limitado a `Collectible Minifigures`: alta/baja/renombrado de subcategorías, y coherencia de `categoria`/`subcategoria` en `minifiguras.json`.
- Interfaz web: renombrar la columna y el filtro "Temática" a "Categoría"; añadir un selector de "Subcategoría" dependiente de la categoría seleccionada en el formulario de alta/edición y en el panel de filtros; añadir un campo de búsqueda por `id` en el panel de filtros; eliminar la columna "Descripción" de la tabla de resultados (el campo `descripcion` se conserva en el modelo y en el formulario).
- Ampliar la suite de tests existente (`test/temas.test.js` → categorías, `test/minifiguras.test.js`, `test/web.test.js`) para cubrir la nueva estructura anidada, el renombrado y las reglas de coherencia categoría/subcategoría. `test/brickset-scraper.test.js` (precio individual) no se ve afectado.
- Convertir `categoria`, `subcategoria` y `anio` del formulario de alta/edición en campos de solo lectura, rellenados junto a `precio` por un único botón ("Consultar datos en Brickset") que consulta `GET /minifiguras/:id/brickset`; la actualización masiva de precios (botón de cabecera) SHALL seguir actualizando solo `precio`.
- Ajustes de interfaz solicitados durante la implementación: filtros y sus botones en una sola fila; textos de opción "todas/todos" abreviados a "Todas"/"Todas"/"Todos"; `Nueva minifigura`, `Editar` y `Eliminar` como botones de icono con `aria-label`; el `id` de la tabla deja de abrir la vista previa de imagen (solo la miniatura la abre); los dos rankings se muestran lado a lado ocupando el ancho combinado de los paneles `Consulta`/`Resultados`, cada uno en su propia caja y con sus tarjetas siempre en una fila sin scroll horizontal.

## Capabilities

### New Capabilities
- `categorias-brickset`: catálogo local anidado de categorías y subcategorías oficiales de Brickset, con su sincronización manual y su exposición vía `GET /categorias`.

### Modified Capabilities
- `minifiguras`: el campo `tematica` se renombra a `categoria`, se añade el campo opcional `subcategoria` coherente con la categoría, y el filtro `?tema=` se renombra a `?categoria=`.
- `interfaz-web-minifiguras`: la tabla y los formularios usan "Categoría" en lugar de "Temática", se añade el selector dependiente de "Subcategoría", se añade el filtro por `id`, y se elimina la columna "Descripción" de la tabla.

## Impact

- `data/temas-brickset.json` se elimina en favor de `data/categorias-brickset.json`.
- `src/temas-repository.js`, `src/brickset-themes-scraper.js`, `scripts/sync-brickset-themes.js`, `src/minifiguras-repository.js` y `src/server.js` cambian de nombres de clases, campos, rutas y códigos de error.
- `public/index.html`, `public/app.js` y `public/styles.css` cambian etiquetas, selects dependientes, columna de tabla y filtro por `id`.
- `.github/agents/brickset.agent.md` se actualiza para el nuevo modelo con subcategorías.
- `test/temas.test.js`, `test/minifiguras.test.js` y `test/web.test.js` se actualizan o renombran para reflejar el nuevo modelo.
- Es un cambio incompatible con integraciones externas que usen los nombres de campo, rutas o archivo anteriores.
