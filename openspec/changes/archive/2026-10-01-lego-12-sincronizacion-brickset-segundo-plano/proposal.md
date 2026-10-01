# Proposal

## Why

La actualización masiva de precios (`🔄`) siempre actualiza unas 7–8 minifiguras y falla el resto: Brickset responde HTTP `429 Too Many Requests` al superar su límite de peticiones, y el scraper reintenta inmediatamente, lo que vuelve a fallar. Respetar ese límite hace que actualizar todo el catálogo tarde minutos, demasiado para una única petición HTTP que bloquea la interfaz.

## What Changes

- Limitar globalmente las peticiones a Brickset desde el servidor: secuenciales, con un intervalo mínimo entre ellas (configurable) y compartido por todos los usuarios, la sincronización masiva y la consulta individual del formulario.
- Ante `429`, esperar lo indicado por `Retry-After` (o un tiempo por defecto) y reintentar la misma figura un número acotado de veces antes de marcarla como fallida con el código `BRICKSET_LIMITE`.
- Convertir la actualización masiva en una tarea en segundo plano por usuario:
  - **BREAKING**: `POST /sincronizacion/brickset` responde HTTP `202` con el estado de la tarea (`en_curso`, `procesados`, `total`, `actualizados`, `fallidos`) en lugar de esperar al resultado final con HTTP `200`. Si ya hay una tarea en curso para el usuario, devuelve esa misma tarea sin iniciar otra.
  - Nuevo `GET /sincronizacion/brickset` que devuelve el estado de la tarea actual o la última del usuario.
  - Cada precio válido se persiste en cuanto se obtiene, de modo que el progreso no se pierde si la tarea se interrumpe.
- Interfaz: mientras la tarea esté en curso, el botón `🔄` permanece deshabilitado y el panel desplegable del resumen muestra una barra de progreso (`procesados / total`). Al terminar se oculta la barra, se habilita el botón, se refrescan tabla y resumen, y se muestra un Toast blanco indicando que ha terminado con el número de actualizadas y fallidas. El resto de la interfaz permanece usable durante la tarea.
- Al recargar la página o iniciar sesión con una tarea en curso, la interfaz retoma la barra de progreso.
- Se elimina `BRICKSET_CONCURRENCY` (sustituido por el intervalo mínimo global).

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `valoracion-coleccion`: la actualización masiva pasa a ser una tarea en segundo plano con persistencia incremental, consulta de estado y límite global de peticiones a Brickset con manejo de `429`.
- `interfaz-web-minifiguras`: la actualización masiva bloquea solo el botón `🔄`, muestra progreso en el panel desplegable y notifica el final con un Toast blanco.

## Impact

- **Código**: `src/brickset-scraper.js` (limitador global y manejo de `429`/`Retry-After`), `src/server.js` (gestor de tareas por usuario, `POST`/`GET /sincronizacion/brickset`), `src/minifiguras-repository.js` (persistencia de un precio ignorando figuras eliminadas durante la tarea), `public/index.html`, `public/app.js`, `public/styles.css`.
- **API**: cambio incompatible en la respuesta de `POST /sincronizacion/brickset`; nuevo `GET` en la misma ruta (autenticado, aislado por usuario).
- **Tests**: `test/brickset-scraper.test.js`, `test/minifiguras.test.js` (sincronización masiva), `test/web.test.js` (tests de sincronización existentes), nuevos tests de limitador, tareas y UI de progreso.
- **Operación**: la tarea vive en memoria del proceso; un reinicio del servidor la interrumpe, conservando los precios ya persistidos.
