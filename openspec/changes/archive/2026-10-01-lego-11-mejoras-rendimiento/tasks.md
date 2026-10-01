# Tasks

## 1. Tests de contrato (rojo)

- [x] 1.1 Crear `test/cache-web.test.js` (jsdom + `window.fetch` simulado) con casos que fallen hoy: tras la carga inicial, `Buscar` y `Mostrar todo` no registran peticiones a `/minifiguras`; ordenar y paginar no registran peticiones; la carga inicial pide `/minifiguras` sin parámetros una sola vez. Verificar con `npm.cmd test` que fallan por el motivo esperado.
- [x] 1.2 Añadir test de paridad: con los fixtures de `test-support/fixtures.js` y una batería de filtros (acentos, mayúsculas, parciales en `id`/`nombre`, `categoria`, `subcategoria`, `anio`, `estadoColeccion`, `observada`), comparar los IDs renderizados en la tabla con `MinifigurasRepository.list` sobre `test-support/supabase-mock.js`. Verificar que falla antes de implementar.
- [x] 1.3 Añadir tests de mutación: tras `POST`/`PUT`/`DELETE`/`PUT …/observada` OK la tabla refleja el cambio antes de resolver la revalidación (fetch de revalidación con promesa pendiente), los controles siguen habilitados, y la caché ignora la clave `gamificacion`; tras error del servidor la tabla no cambia; si la revalidación falla, la tabla conserva el cambio local sin mensaje de error de carga.
- [x] 1.4 Añadir tests de sesión y obsolescencia: `clearUserData`/cierre de sesión vacía la tabla y una respuesta de revalidación anterior que llega tarde no sobrescribe a la más reciente.
- [x] 1.5 Añadir tests de renderizado: miniaturas de tabla e imágenes de ranking/watchlist tienen `loading="lazy"`, `decoding="async"`, `width` y `height`; `styles.css` contiene `content-visibility: auto` y `contain-intrinsic-size` para `.ranking-card` y `.watchlist-card`; `catalogBody.replaceChildren` se invoca una sola vez por renderizado de página (espía en jsdom).

## 2. Caché y filtrado en memoria

- [x] 2.1 Añadir en `public/app.js` el estado `catalogCache`/`activeFilters`, `normalizeClientText` y `matchesClientFilters` replicando `matchesFilters` del backend, y `applyFilters({ preservePage })`. Verificar con el test 1.2.
- [x] 2.2 Dividir `loadCatalog` en `fetchCatalog()` (sin parámetros, con `requestSequence`) y `setCatalogCache()` (opciones dinámicas, paneles colapsados, `applyFilters`); ejecutar `loadTotal()` y `loadGamification()` en paralelo en la carga inicial. Verificar con 1.1 y los tests web existentes de carga inicial y de error de catálogo.
- [x] 2.3 Cambiar los handlers de `Buscar` y `Mostrar todo` para construir `activeFilters` y llamar a `applyFilters()` sin red, conservando la lógica de los toggles `📦`/`🔍` y del estado sin coincidencias. Verificar con 1.1 y 1.2.
- [x] 2.4 Hacer que `openMinifiguraView(id)` use la caché antes de recurrir a `GET /minifiguras?id=…`. Verificar con el test de tarjetas de ranking de `test/web.test.js` (caso fuera de caché sigue pidiendo a la API).

## 3. Mutaciones y revalidación en segundo plano

- [x] 3.1 Implementar `upsertCached`, `removeCached` y `revalidate()` (catálogo, `/valoracion` y `/gamificacion` en paralelo, sin `setLoading`, errores de catálogo silenciosos, descarte por `requestSequence`). Verificar con 1.3 y 1.4.
- [x] 3.2 Sustituir `refreshCatalogAfterMutation()` en alta, edición y eliminación por aplicar la respuesta a la caché + `applyFilters({ preservePage: true })` + `void revalidate()`. Verificar con 1.3.
- [x] 3.3 Actualizar `toggleObserved` para usar `upsertCached` + `applyFilters` (reaplicando el filtro de observación) + `void revalidate()`. Verificar con 1.3 y los tests de watchlist existentes.
- [x] 3.4 Hacer que la sincronización masiva de precios espere `revalidate()` en lugar de `loadCatalog(currentFilters)`. Verificar con los tests de sincronización de `test/web.test.js`.
- [x] 3.5 Vaciar `catalogCache`/`activeFilters` e incrementar `requestSequence` en `clearUserData()`. Verificar con 1.4 y `test/auth-web.test.js`.

## 4. Renderizado eficiente

- [x] 4.1 Añadir `createLazyImage` y usarlo en `thumbCell`, `rankingCard` y `renderWatchlist` con dimensiones coherentes con el CSS actual. Verificar con 1.5.
- [x] 4.2 Construir filas de `renderCatalogPage()` (y tarjetas de rankings/watchlist) en un `DocumentFragment` con un único `replaceChildren`. Verificar con 1.5.
- [x] 4.3 Añadir en `public/styles.css` `content-visibility: auto` y `contain-intrinsic-size: auto <alto>` para `.ranking-card` y `.watchlist-card`. Verificar con 1.5.

## 5. Adaptar tests existentes y cierre

- [x] 5.1 Reescribir `los toggles 📦 y 🔍 filtran por estado…` en `test/web.test.js` y `test/filters-repro.test.js` para afirmar filas renderizadas y ausencia de peticiones con filtros en lugar de inspeccionar la URL. Verificar que pasan.
- [x] 5.2 Ejecutar `npm.cmd test` completo y verificar que toda la suite pasa sin tests omitidos.
- [x] 5.3 Ejecutar `openspec validate lego-11-mejoras-rendimiento --strict` y verificar que no hay errores.
- [x] 5.4 Comprobación manual en Safari iPad: rankings y watchlist sin saltos de scroll ni tarjetas en blanco, e imágenes cargando al desplazarse.
