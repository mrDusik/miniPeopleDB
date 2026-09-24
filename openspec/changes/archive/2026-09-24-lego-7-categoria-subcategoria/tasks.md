# Tasks

## 1. Catálogo local de categorías y subcategorías

- [x] 1.1 Renombrar `data/temas-brickset.json` a `data/categorias-brickset.json` con la estructura anidada `{ categoria, total, subcategorias: string[] }` (sin total por subcategoría), poblando `subcategorias` de `Collectible Minifigures` con nombres reales razonablemente verificables en Brickset y dejando `subcategorias: []` en el resto de categorías por ahora
- [x] 1.2 Renombrar `src/temas-repository.js` a `src/categorias-repository.js`: clases `TemasRepository`→`CategoriasRepository`, `TemasNoDisponiblesError`/`TemasInvalidosError`/`TemasPersistenciaError`→`CategoriasNoDisponiblesError`/`CategoriasInvalidosError`/`CategoriasPersistenciaError`, `validateTemas`→`validateCategorias` con validación anidada de `subcategorias` (arreglo de nombres únicos por categoría, sin total) y verificar con `node --test test/temas.test.js` renombrado (tarea 6.1)
- [x] 1.3 Renombrar `src/brickset-themes-scraper.js` a `src/brickset-categorias-scraper.js`: `BricksetThemesScraper`/`BricksetThemesError`/`parseBricksetThemes`→`BricksetCategoriasScraper`/`BricksetCategoriasError`/`parseBricksetCategorias`. El scraper solo extrae nombres y totales de categoría (`subcategorias` se devuelve como `[]`), ya que Brickset no publica subcategorías ni sus totales en el listado público
- [x] 1.4 Actualizar `scripts/sync-brickset-themes.js` (renombrar a `scripts/sync-brickset-categorias.js` y su script en `package.json`) para usar `BricksetCategoriasScraper`/`CategoriasRepository` y la nueva ruta de archivo por defecto

## 2. API de minifiguras y categorías

- [x] 2.1 Actualizar `src/server.js`: renombrar la ruta `GET /temas` a `GET /categorias`, usar `CategoriasRepository`, y renombrar el parámetro de filtro `tema` a `categoria` añadiendo soporte para `subcategoria` e `id` en `GET /minifiguras`
- [x] 2.2 Actualizar `src/minifiguras-repository.js`: renombrar el campo `tematica`→`categoria`, añadir el campo opcional `subcategoria` a `MINIFIGURA_FIELDS`, validar que `categoria` exista en el catálogo de categorías y que `subcategoria` (cuando esté presente) pertenezca a esa `categoria`, y añadir el filtro por `id` (coincidencia parcial) y por `subcategoria` (con o sin `categoria`)
- [x] 2.3 Renombrar el campo `tematica`→`categoria` en `data/minifiguras.json`, dejando `subcategoria` ausente en todos los registros existentes
- [x] 2.4 Verificar con `node --test test/minifiguras.test.js` que las validaciones y filtros nuevos pasan (tras actualizar los tests en la tarea 6.2)

## 3. Interfaz web: renombrado y columna de tabla

- [x] 3.1 Actualizar `public/index.html`: renombrar la etiqueta y el `id` del filtro `tema`→`categoria` y del campo del formulario `form-tematica`→`form-categoria`, eliminar la columna `Descripción` de la tabla (`<thead>`), y añadir un campo de filtro `id`
- [x] 3.2 Actualizar `public/app.js`: cargar `GET /categorias`, renombrar `loadThemes`/`renderThemeOptions`/`officialThemes` a sus equivalentes de categoría, eliminar `cell(minifigura.descripcion)` de `renderCatalog`, y añadir el envío del filtro `id` en `loadCatalog`
- [x] 3.3 Verificar manualmente o con `test/web.test.js` que la página carga sin la columna `Descripción` y que el filtro por `id` envía el parámetro esperado a `GET /minifiguras`

## 4. Interfaz web: selects dependientes de subcategoría

- [x] 4.1 Añadir en `public/index.html` los controles `subcategoria` en el panel de filtros y en el formulario de alta/edición, junto a sus columnas de tabla `Categoría` y `Subcategoría`
- [x] 4.2 Implementar en `public/app.js` un mapa `categoria → subcategorias[]` derivado de `GET /categorias`, y una función que repueble el `select` de `subcategoria` al cambiar la `categoria` del filtro o del formulario, limpiando la subcategoría previa si ya no pertenece a la nueva categoría
- [x] 4.3 Deshabilitar o vaciar el `select` de `subcategoria` cuando la `categoria` seleccionada no tenga subcategorías registradas, en el filtro y en el formulario
- [x] 4.4 Verificar con `test/web.test.js` que cambiar la categoría del filtro y del formulario actualiza las opciones de subcategoría disponibles

## 5. Agente Brickset

- [x] 5.1 Actualizar `.github/agents/brickset.agent.md` para operar sobre `data/categorias-brickset.json` y el modelo anidado: detectar altas, bajas y renombrados de subcategorías (solo nombres, sin total) con la misma evidencia exigida para categorías, y reconciliar `categoria`/`subcategoria` en `data/minifiguras.json`
- [x] 5.2 Actualizar las referencias a nombres de archivo, comandos (`node --test test/temas.test.js test/minifiguras.test.js`) y terminología (`tema`→`categoria`) en el resto del documento del agente

## 6. Tests

- [x] 6.1 Renombrar y actualizar `test/temas.test.js` (o crear `test/categorias.test.js`) para cubrir `validateCategorias`, `parseBricksetCategorias`, y los nuevos códigos de error `CATEGORIAS_*`; verificar con `node --test test/categorias.test.js`
- [x] 6.2 Actualizar `test/minifiguras.test.js` para usar `categoria`/`subcategoria` en lugar de `tematica`, cubrir el filtro por `id` y `subcategoria`, y cubrir el rechazo de una `subcategoria` que no pertenece a la `categoria` indicada; verificar con `node --test test/minifiguras.test.js`
- [x] 6.3 Actualizar `test/web.test.js` para reflejar la columna eliminada (`Descripción`), la columna nueva (`Subcategoría`), el filtro por `id` y el comportamiento dependiente del `select` de subcategoría; verificar con `node --test test/web.test.js`
- [x] 6.4 Ejecutar la suite completa con `npm test` y confirmar que todos los tests pasan

## 7. Ampliación de subcategorías de Collectible Minifigures

- [x] 7.1 Completar `data/categorias-brickset.json` con el conjunto íntegro de subcategorías oficiales de `Collectible Minifigures` (60 subcategorías, obtenidas del filtro `SUBCATEGORY` de `https://brickset.com/minifigs/category-Collectible-Minifigures`), manteniendo `subcategorias: []` en el resto de categorías
- [x] 7.2 Actualizar `test/categorias.test.js` para verificar que `Collectible Minifigures` incluye subcategorías representativas conocidas (p. ej. `Series 17 Minifigures`, `Team GB`) y que otras categorías conservan `subcategorias: []`
- [x] 7.3 Verificar con `node --test test/categorias.test.js test/minifiguras.test.js test/web.test.js` que la suite sigue en verde

## 8. Total manual por subcategoría

- [x] 8.1 Cambiar `subcategorias` de `string[]` a `{ subcategoria: string, total?: integer }[]` en `data/categorias-brickset.json`, migrando las 60 subcategorías de `Collectible Minifigures` al nuevo formato con `total: 0` como valor de partida a rellenar manualmente
- [x] 8.2 Actualizar `validateCategorias` en `src/categorias-repository.js` para validar el nuevo objeto `{ subcategoria, total? }` (subcategoria no vacía, total entero no negativo si está presente) y tratar `total` ausente o `0` como "no definido" sin exigirlo en ninguna validación cruzada
- [x] 8.3 Actualizar `src/minifiguras-repository.js` y `public/app.js` para extraer el nombre (`subcategoria.subcategoria`) al construir el mapa `categoria → subcategorias[]` usado en validaciones y en los `select` dependientes
- [x] 8.4 Actualizar `test/categorias.test.js` para cubrir el nuevo formato objeto y confirmar que `total` ausente o `0` se acepta como válido sin ser tenido en cuenta; verificar con `node --test`

## 9. Aviso de revisión manual del total de subcategoría

- [x] 9.1 Actualizar `.github/agents/brickset.agent.md` para que, al añadir o renombrar una subcategoría de `Collectible Minifigures`, el agente emita un aviso de `REVISIÓN MANUAL PENDIENTE` listando cada subcategoría afectada y solicitando completar a mano su número de minifiguras
- [x] 9.2 Reflejar el requisito en `specs/categorias-brickset/spec.md` con el escenario correspondiente

## 10. Rellenar Categoría, Subcategoría y Año desde Brickset

- [x] 10.1 Añadir `parseBricksetDetails` y `BricksetScraper.getDetails(id)` en `src/brickset-scraper.js`, extrayendo `categoria`, `subcategoria` (opcional) y `anio` de la misma página pública usada para el precio, reutilizando la lógica de reintentos/timeout existente
- [x] 10.2 Sustituir `GET /minifiguras/:id/precio` por `GET /minifiguras/:id/brickset` en `src/server.js`: resuelve la `categoria`/`subcategoria` extraídas contra el catálogo local de categorías, devolviendo `{ id, categoria, subcategoria?, anio, precio }` o `502 BRICKSET_CATEGORIA_DESCONOCIDA` si la categoría no coincide con ninguna local
- [x] 10.3 Actualizar `public/index.html`: convertir `categoria`, `subcategoria` y `anio` del formulario de alta/edición en campos de solo lectura (como `precio`) y renombrar el botón `lookup-price`→`lookup-brickset` a "Consultar datos en Brickset"
- [x] 10.4 Actualizar `public/app.js`: eliminar los `select` dependientes del formulario (categoria/subcategoria siguen siendo `select` solo en el panel de filtros), y hacer que el botón de consulta rellene `categoria`, `subcategoria`, `anio` y `precio` a la vez
- [x] 10.5 Actualizar `test/brickset-scraper.test.js`, `test/minifiguras.test.js` y `test/web.test.js` para el nuevo endpoint y el formulario de solo lectura; verificar con `node --test` que la suite completa pasa

## 11. Corrección: extracción real de categoría/subcategoría/año de Brickset

- [x] 11.1 Corregir `parseBricksetDetails` en `src/brickset-scraper.js` para leer `Category`/`Subcategory`/`Year released` desde la lista real `<dt>/<dd>` de la página de Brickset, en lugar del fragmento `<div class="tags floatleft">` (que no existe en el HTML servido a un `fetch()` simple y provocaba que la consulta fallara siempre en pruebas manuales, p. ej. `COL450`)
- [x] 11.2 Verificar la corrección contra páginas reales de Brickset (`col450`, `st008`) descargadas con `fetch` de Node, y contra el endpoint `GET /minifiguras/:id/brickset` en vivo
- [x] 11.3 Actualizar los fixtures de `test/brickset-scraper.test.js` y `test/minifiguras.test.js` para usar el marcado `<dt>/<dd>` real; verificar con `node --test` que la suite completa pasa

## 12. Ajustes de interfaz: filtros, iconos, vista previa y rankings

- [x] 12.1 Ampliar `.filters-form` en `public/styles.css` a `repeat(5, 1fr) auto` para que los 5 campos y los botones `Buscar`/`Mostrar todo` se muestren en una sola fila en anchos de escritorio
- [x] 12.2 Abreviar en `public/index.html` (opción estática) y `public/app.js` (opciones generadas) los textos "Todas las categorías"/"Todas las subcategorías"/"Todos los estados" a "Todas"/"Todas"/"Todos"
- [x] 12.3 Convertir `Nueva minifigura`, `Editar` y `Eliminar` en botones de icono (`.button-icon` con SVG inline) con `aria-label`/`title`, sin cambiar `data-action`/`data-id`
- [x] 12.4 Eliminar el botón `.id-link` de `idCell` en `public/app.js` (ahora `cell(minifigura.id)` de solo texto); la vista previa de imagen solo se abre desde la miniatura de la columna `Imagen`
- [x] 12.5 Mover el contenedor `.rankings` fuera de `<header class="page-header">` (limitado a `max-width: 760px`) a un contenedor propio, hermano de `.search-panel`/`.results-panel`, para que ocupe el mismo ancho; mostrar los dos rankings lado a lado en una cuadrícula de 2 columnas, cada uno en su propia caja diferenciada
- [x] 12.6 Cambiar `.ranking-card` de ancho fijo (120px) a `flex: 1 1 0; min-width: 0` y reducir el `gap` de `.ranking-row`, para que las 5 tarjetas de cada ranking quepan siempre en una fila sin scroll horizontal, encogiéndose según el ancho disponible
- [x] 12.7 Actualizar `test/web.test.js` (textos de opción abreviados, eliminación de aserciones sobre `.id-link`, selector `#lookup-brickset`) y verificar con `node --test` que la suite completa pasa

## 13. Correcciones de revisión (`/revisar`)

- [x] 13.1 Refrescar el snapshot codificado en `test/minifiguras.test.js` ("la migracion conserva el orden y los datos de valoracion persistidos") para incluir `COL450`, añadido al catálogo personal durante pruebas manuales; suite completa en verde (77/77 antes de las tareas 13.2-13.3)
- [x] 13.2 Añadir un test dedicado que ejercite explícitamente que el `total` de una subcategoría (ausente, `0` o un número) no afecta si una minifigura la acepta como válida, demostrando que el valor no se usa en ningún cálculo o validación cruzada
- [x] 13.3 Añadir un test en `test/web.test.js` que confirme que `Nueva minifigura`, `Editar` y `Eliminar` no muestran texto visible y exponen el nombre de la acción mediante `aria-label`
- [x] 13.4 Verificar con `node --test` que la suite completa pasa (79/79)
