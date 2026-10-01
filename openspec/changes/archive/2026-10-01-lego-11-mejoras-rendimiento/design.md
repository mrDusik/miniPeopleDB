# Design

## Context

- `public/app.js` es un único script sin framework, probado con jsdom (`window.fetch` simulado). El estado relevante es global: `currentCatalog`, `currentFilters`, `catalogForOptions`, `hasLoadedFullCatalog`, `requestSequence`, `activeSort`, `currentPage` (`pageSize = 10`).
- Hoy `loadCatalog(filters)` construye query params, llama a `GET /minifiguras?…`, y después encadena `await loadTotal()` y `await loadGamification()`. `setLoading(true)` deshabilita los controles durante todo ese ciclo.
- `refreshCatalogAfterMutation()` hace hasta dos `loadCatalog` (uno sin filtros para refrescar opciones y otro con filtros).
- El backend filtra en `matchesFilters` de [src/minifiguras-repository.js](../../../src/minifiguras-repository.js) con `normalizeText` (trim, minúsculas, NFD sin diacríticos). `POST`/`PUT` devuelven la minifigura (más `gamificacion` si `x-gamificacion: true`); `DELETE` devuelve `204`; `PUT /minifiguras/:id/observada` devuelve la minifigura.
- `openMinifiguraView(id)` (tarjetas de rankings/watchlist) hace `GET /minifiguras?id=…`.
- Las imágenes vienen del CDN de BrickLink y no tienen `loading`, `decoding` ni dimensiones.

## Goals / Non-Goals

**Goals:**
- Cero peticiones de red al filtrar, ordenar, paginar o abrir un detalle presente en la caché.
- Respuesta visual inmediata tras mutaciones confirmadas; revalidación sin bloquear controles.
- Reducir layout/paint al renderizar tabla y tarjetas en Safari iOS/iPadOS.

**Non-Goals:**
- Persistir la caché entre recargas (`localStorage`, IndexedDB, Service Worker).
- Actualizaciones optimistas antes de la respuesta del servidor.
- Virtualización de la tabla (ya está paginada a 10 filas).
- Calcular `/valoracion` o gamificación en el cliente.
- Cambios en el backend, en Supabase o en la API pública.

## Decisions

### 1. Caché como array en memoria + filtrado puro en cliente
Se introduce `catalogCache` (array completo del usuario) y `activeFilters`. `applyFilters()` deriva `currentCatalog = catalogCache.filter(matches)` y llama a `renderCatalogPage()`. `matchesClientFilters(minifigura, filters)` replica `matchesFilters`/`normalizeText` del backend; `estadoColeccion` se compara con los valores ya canónicos (`COLECCIÓN`/`BUSCADA`) normalizados, `anio` como entero y `observada` como booleano.
- *Alternativa*: seguir llamando al servidor con debounce. Descartada: mantiene la latencia en redes móviles.
- *Alternativa*: compartir el módulo de filtrado entre `src/` y `public/`. Descartada: `public/app.js` no usa módulos ES y el backend no sirve `src/`; se duplica una función pequeña y se cubre con un test de paridad contra el repositorio.

### 2. Separar "cargar caché" de "renderizar"
`loadCatalog` se divide en:
- `fetchCatalog()` → `GET /minifiguras` sin parámetros, protegido por `requestSequence` (descarta respuestas obsoletas). Devuelve el array o lanza.
- `setCatalogCache(catalog)` → actualiza `catalogCache`, `catalogForOptions` (vía `renderDynamicFilterOptions`), estado de paneles colapsados y llama a `applyFilters({ preservePage })`.
- La carga inicial (`initialize`) usa `setLoading(true)` como hoy; `Buscar` y `Mostrar todo` solo llaman a `applyFilters()` con `currentPage = 1`.
- `loadTotal()` y `loadGamification()` se ejecutan en paralelo (`Promise.all`) tras la carga inicial, en vez de secuencialmente.

### 3. Mutaciones: aplicar respuesta confirmada + revalidar en segundo plano
- `upsertCached(minifigura)` elimina la clave `gamificacion` y sustituye por `id` o añade; `removeCached(id)`.
- Tras `POST`/`PUT`/`DELETE`/observación OK: aplicar a caché → `applyFilters({ preservePage: true })` → `void revalidate()`.
- `revalidate()` = `Promise.all([fetchCatalog().then(setCatalogCache), loadTotal(), loadGamification()])` sin `setLoading`; si `fetchCatalog` falla, se ignora silenciosamente (la caché local queda vigente). Un contador propio evita que una revalidación antigua pise a una nueva (reutiliza `requestSequence`).
- La sincronización masiva de precios sigue mostrando su estado bloqueante actual, pero al terminar usa `revalidate()` esperado (`await`) para reflejar precios nuevos.
- *Alternativa*: actualizaciones optimistas. Descartada: el servidor valida categorías y límite de observadas; revertir complica la UI sin beneficio claro.

### 4. Detalle desde caché
`openMinifiguraView(id)` busca primero en `catalogCache` (ID normalizado a mayúsculas) y solo hace `GET /minifiguras?id=…` si no está.

### 5. Renderizado
- Helper `createLazyImage({ src, alt, width, height, className })` usado por `thumbCell`, `rankingCard` y `renderWatchlist`: `loading="lazy"`, `decoding="async"`, `width`/`height` coherentes con el CSS (40×40 tabla; tamaños actuales de `.ranking-img`/watchlist).
- `renderCatalogPage()` construye las filas en un `DocumentFragment` y usa `catalogBody.replaceChildren(fragment)`; lo mismo en rankings/watchlist.
- CSS: `.ranking-card` y `.watchlist-card` con `content-visibility: auto; contain-intrinsic-size: auto <alto actual>;`. Navegadores sin soporte ignoran la propiedad.
- No se aplica `content-visibility` a las filas de la tabla: la contención de tamaño, layout y paint no tiene efecto sobre cajas internas de tabla (`tr`/`td`), y la tabla ya está paginada a 10 filas.
- *Alternativa*: `IntersectionObserver` propio. Descartada: `loading="lazy"` nativo está soportado en Safari ≥ 15.4 y no añade código.

### 6. Limpieza por sesión
`clearUserData()` vacía `catalogCache` y `activeFilters` e incrementa `requestSequence` para descartar respuestas en vuelo del usuario anterior.

## Risks / Trade-offs

- [Divergencia entre filtrado cliente y servidor] → Test de paridad que ejecuta `matchesClientFilters` (extraído del script vía jsdom) y `MinifigurasRepository.list` con el mock de Supabase sobre los mismos fixtures y filtros (acentos, mayúsculas, parciales).
- [Datos desactualizados si otra pestaña/dispositivo modifica el catálogo] → La revalidación tras cada mutación y al iniciar sesión acota la ventana; no se añade polling (fuera de alcance).
- [Revalidación que llega tras otra mutación local y la "deshace"] → `requestSequence` se incrementa en cada mutación aplicada, por lo que la respuesta de una revalidación anterior se descarta.
- [`content-visibility` puede alterar el tamaño de las tarjetas o el scroll horizontal de la watchlist] → `contain-intrinsic-size: auto …` con valores medidos; verificación manual en Safari iPad.
- [Tests web existentes que inspeccionan URLs con filtros] → Se reescriben para aserciones sobre filas renderizadas y ausencia de peticiones (ver tasks).

## Migration Plan

Cambio solo de frontend estático: se despliega con el servidor actual. Rollback revirtiendo `public/app.js` y `public/styles.css`; la API no cambia.
