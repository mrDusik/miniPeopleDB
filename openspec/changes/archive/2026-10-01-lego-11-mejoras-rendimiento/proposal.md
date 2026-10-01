# Proposal

## Why

En móviles e iPad la interfaz de MiniPeople DB se percibe lenta: cada `Buscar`, `Mostrar todo` o mutación lanza una cadena secuencial de peticiones (`GET /minifiguras` → `GET /valoracion` → `GET /gamificacion`), bloquea los controles mientras tanto y reconstruye la tabla completa, incluidas las miniaturas remotas de BrickLink. Como el catálogo de cada usuario es pequeño y ya se descarga completo al iniciar sesión, filtrar y ordenar en el cliente elimina la latencia de red de las interacciones más frecuentes.

## What Changes

- Introducir en `public/app.js` una caché en memoria del catálogo completo del usuario autenticado, cargada con un único `GET /minifiguras` sin parámetros al iniciar sesión.
- `Buscar`, `Mostrar todo`, la ordenación y la paginación se resolverán en memoria sobre la caché, sin `fetch` al servidor y sin estado de carga bloqueante. La semántica de filtrado replicará la del backend (normalización sin acentos, coincidencia parcial en `id` y `nombre`, exacta en `categoria`, `subcategoria`, `anio`, `estadoColeccion` y `observada`).
- Las mutaciones (crear, editar, eliminar, alternar observación) aplicarán la respuesta confirmada del servidor a la caché, volverán a renderizar al instante conservando filtros, orden y página, y revalidarán en segundo plano catálogo, `/valoracion` y `/gamificacion` sin bloquear la interfaz. La sincronización masiva de precios también revalidará la caché.
- Optimizar el renderizado: imágenes de tabla, rankings y watchlist con `loading="lazy"`, `decoding="async"` y dimensiones explícitas; tarjetas de rankings y watchlist con `content-visibility: auto` y `contain-intrinsic-size`; inserción de filas mediante un único `DocumentFragment`.
- La caché se vacía al cerrar sesión o expirar la sesión; no se persiste en `localStorage`/IndexedDB.
- La API `GET /minifiguras` con parámetros de filtro se mantiene sin cambios para otros clientes y tests de API.
- **BREAKING (contrato de la interfaz web)**: la interfaz deja de enviar parámetros de filtro a `GET /minifiguras`; los tests web que verifican la URL solicitada deberán verificar el resultado filtrado en la tabla.

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `interfaz-web-minifiguras`: el filtrado pasa a resolverse en el cliente sobre una caché local; la actualización tras crear/editar/eliminar pasa a ser local con revalidación en segundo plano; se añaden requisitos de caché de catálogo por sesión y de renderizado eficiente de imágenes y tarjetas.

## Impact

- **Código**: `public/app.js` (estado de caché, `loadCatalog`, handlers de filtros, `refreshCatalogAfterMutation`, `toggleObserved`, sincronización masiva, `clearUserData`, creación de `<img>`), `public/styles.css` (`content-visibility`, `contain-intrinsic-size`).
- **Tests**: `test/web.test.js` y `test/filters-repro.test.js` (aserciones basadas en la URL de filtro); nuevos tests jsdom para filtrado en memoria, ausencia de `fetch` al filtrar, actualización de caché tras mutaciones y atributos de imágenes.
- **Backend / Supabase**: sin cambios. Los endpoints y la RLS por usuario se mantienen.
- **Dependencias**: ninguna nueva.
