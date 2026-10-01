# Tasks

## 1. Limitador global de Brickset

- [x] 1.1 Añadir tests en `test/brickset-scraper.test.js` con reloj y `sleep` inyectados: peticiones serializadas y separadas por `minIntervalMs` aunque se lancen en paralelo; `429` con `Retry-After` en segundos y como fecha HTTP retrasa la siguiente petición; `429` sin cabecera usa `defaultRetryAfterMs`; tras `maxRateLimitRetries` se lanza `BRICKSET_LIMITE`; errores no-429 no se reintentan. Verificar que fallan.
- [x] 1.2 Implementar en `BricksetScraper` la cola serializada, `blockedUntil`, parseo de `Retry-After`, opciones `minIntervalMs`/`defaultRetryAfterMs`/`maxRateLimitRetries`/`now`/`sleep` y `retries` por defecto `0`; leer `BRICKSET_MIN_INTERVAL_MS` en `createServer`. Verificar con 1.1 y los tests existentes del scraper.

## 2. Persistencia incremental

- [x] 2.1 Añadir tests de `MinifigurasRepository.updatePrice(id, precio)` con `test-support/supabase-mock.js`: actualiza solo `precio`, no recrea figuras eliminadas (devuelve `null`), rechaza precios no válidos y llama a `onCatalogPersisted`. Verificar que fallan.
- [x] 2.2 Implementar `updatePrice` con `update().eq('id', …)`. Verificar con 2.1.

## 3. Tareas en segundo plano y API

- [x] 3.1 Añadir tests unitarios de `src/brickset-sync-jobs.js` con un scraper falso controlable: estado inicial, avance de `procesados`, `actualizados`/`fallidos`, tarea única por usuario, aislamiento entre usuarios, catálogo vacío `completada`, figura eliminada marcada `MINIFIGURA_NO_ENCONTRADA`, `refreshRepository` usado en escrituras posteriores. Verificar que fallan.
- [x] 3.2 Implementar `createBricksetSyncJobs`. Verificar con 3.1.
- [x] 3.3 Reescribir en `src/server.js` `POST /sincronizacion/brickset` (`202` + estado) y añadir `GET` (`200`, `inactiva`, `refreshRepository`), `405` con `allow: GET, POST`; eliminar `BRICKSET_CONCURRENCY`. Adaptar el test masivo de `test/minifiguras.test.js` (sondear hasta `completada`) y añadir tests de autenticación/aislamiento del `GET`. Verificar con `npm.cmd test`.

## 4. Interfaz de progreso

- [x] 4.1 Añadir tests jsdom: `en_curso` deshabilita solo `🔄` y muestra la barra con `procesados/total`; el sondeo actualiza la barra; `completada` oculta la barra, habilita `🔄`, revalida y muestra el Toast `toast-success` con el texto exacto; respuesta inicial `completada` no muestra la barra; error al iniciar muestra Toast de error y rehabilita `🔄`; al iniciar sesión con tarea en curso se retoma sin `POST`; cerrar sesión detiene el sondeo. Verificar que fallan.
- [x] 4.2 Añadir en `public/index.html` el bloque `#sync-progress` dentro de `#gamification-details` y sus estilos en `public/styles.css`. Verificar con 4.1.
- [x] 4.3 Implementar en `public/app.js` `startSync`, sondeo, `showSyncProgress`, `finishSync`, retoma en `initialize()` y limpieza en `clearUserData()`; eliminar el bloqueo global de `setSyncLoading`/`trackButtonsDuringSync`. Verificar con 4.1.
- [x] 4.4 Reescribir los tests de sincronización existentes de `test/web.test.js` (bloqueo global de botones) según el nuevo comportamiento. Verificar que pasan.

## 5. Cierre

- [x] 5.1 Ejecutar `npm.cmd test` completo y verificar que toda la suite pasa sin tests omitidos.
- [x] 5.2 Ejecutar `openspec validate lego-12-sincronizacion-brickset-segundo-plano --strict` y verificar que no hay errores.
- [x] 5.3 Comprobación manual contra Brickset real: actualizar un catálogo de más de 8 figuras y verificar que no quedan fallos `429`, que la barra avanza y que aparece el Toast blanco al terminar.
