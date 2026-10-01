# Design

## Context

- `POST /sincronizacion/brickset` ([src/server.js](../../../src/server.js)) lee el catálogo, lanza `BRICKSET_CONCURRENCY` (por defecto 4) workers contra `brickset.getPrice` y, al final, llama una vez a `repository.updatePrices(Map)`, que falla entera (`MinifiguraNoEncontradaError`) si algún ID ya no existe.
- `BricksetScraper._fetchHtml` reintenta `retries = 1` vez sin espera. Con Brickset devolviendo `429` tras ~7–8 peticiones, todo lo posterior falla.
- `brickset` es una única instancia por `createServer`, compartida por todas las peticiones: es el punto natural para un limitador global.
- El `repository` se crea por petición en `authenticate()` con un cliente Supabase ligado al token del usuario (RLS). Una tarea que sobrevive a la petición sigue usando ese cliente.
- En el cliente, `setSyncLoading(true)` deshabilita todos los botones y el handler espera la respuesta final del `POST`.

## Goals / Non-Goals

**Goals:**
- No superar el límite de Brickset y recuperarse de `429` sin intervención.
- Que la interfaz no quede bloqueada durante minutos.
- No perder precios ya obtenidos si la tarea se interrumpe o el usuario elimina figuras mientras tanto.

**Non-Goals:**
- Persistir el estado de las tareas en Supabase o sobrevivir a reinicios del servidor.
- Cancelar una tarea en curso desde la interfaz.
- Programar actualizaciones periódicas automáticas.
- Notificaciones push / WebSockets / SSE.

## Decisions

### 1. Limitador global dentro de `BricksetScraper`
Una cola promesa-encadenada (`this.queue = this.queue.then(...)`) serializa todas las peticiones de `_fetchHtml` y garantiza `minIntervalMs` entre inicios (`BRICKSET_MIN_INTERVAL_MS`, por defecto `9000`, ≈ 6–7/min). Un campo `blockedUntil` retrasa la siguiente petición cuando llega un `429`.
- Manejo de `429`: leer `Retry-After` (segundos o fecha HTTP); si falta, `defaultRetryAfterMs` (`60000`). Fijar `blockedUntil`, reintentar hasta `maxRateLimitRetries` (`3`) y después lanzar `BricksetPriceError('BRICKSET_LIMITE')`.
- Otros errores HTTP/red: se elimina el reintento inmediato (`retries` pasa a `0` por defecto); el limitador ya espacia las peticiones.
- Reloj y espera inyectables (`now`, `sleep`) para tests deterministas sin temporizadores reales.
- *Alternativa*: limitador en el gestor de tareas. Descartada: la consulta individual del formulario también golpea Brickset y debe compartir el mismo cupo.

### 2. Gestor de tareas en memoria por usuario
`createBricksetSyncJobs({ brickset })` en un módulo nuevo `src/brickset-sync-jobs.js`, instanciado una vez en `createServer`:
- `start(userId, repository)` → si hay tarea `en_curso` para el usuario, la devuelve; si no, lee el catálogo, crea `{ estado, procesados, total, actualizados, fallidos }` y lanza el bucle sin `await`.
- `status(userId)` → copia del estado o `{ estado: 'inactiva' }`.
- `refreshRepository(userId, repository)` → sustituye el repositorio de la tarea en curso por el de la última petición autenticada (ver decisión 4).
- Bucle: por cada figura, `await brickset.getPrice(id)`; si OK, `await repository.updatePrice(id, precio)`; actualizar contadores; capturar cualquier error por figura sin abortar la tarea.
- *Alternativa*: cola persistente en Supabase. Descartada por alcance (Non-Goals).

### 3. Persistencia incremental tolerante a borrados
Nuevo `MinifigurasRepository.updatePrice(id, precio)`: actualiza solo `precio` con `update(...).eq('id', id)` (no `upsert`, para no recrear figuras borradas). Si no afecta filas, devuelve `null` y la tarea registra la figura como fallida con `MINIFIGURA_NO_ENCONTRADA`. Tras actualizar llama a `notifyPersisted()` para mantener la gamificación coherente. `updatePrices` se conserva para compatibilidad pero deja de usarse desde el servidor.
- *Alternativa*: un único `updatePrices` al final. Descartada: una tarea larga perdería todo ante un reinicio o un borrado concurrente.

### 4. Token de la tarea
El cliente Supabase de la tarea está ligado al token del `POST`. Para tareas que se acerquen a la caducidad del token, cada `GET /sincronizacion/brickset` (sondeo del cliente, que usa la sesión refrescada) llama a `refreshRepository`, de modo que las siguientes escrituras usan el token más reciente. Si una escritura falla por autenticación, la figura se marca fallida y la tarea continúa.

### 5. API
- `POST /sincronizacion/brickset` → `202` + estado. Errores previos al inicio (categorías, catálogo no disponible) mantienen sus códigos `500` actuales.
- `GET /sincronizacion/brickset` → `200` + estado. Otros métodos → `405` con `allow: GET, POST`.

### 6. Interfaz
- Nuevo bloque en `#gamification-details`, tras `.collection-summary`: `<div id="sync-progress" class="sync-progress" hidden>` con `<progress id="sync-progress-bar">` y `<span id="sync-progress-label">` (`Actualizando precios: X / N`). Estilos reutilizando los de `.gamification-progress progress`.
- `startSync()` → `POST`; con `en_curso` llama a `showSyncProgress(state)` y arranca un sondeo (`setTimeout` cada `2000` ms) de `GET`. Con `completada` llama a `finishSync(state)`.
- `finishSync(state)` → oculta la barra, habilita `🔄`, `await revalidate()` (de lego-11) y `showToast('Actualización de precios terminada: X actualizadas, Y fallidas.', 'success')`.
- Solo `🔄` se deshabilita; se elimina el bloqueo global de `setSyncLoading`/`trackButtonsDuringSync`, que ya no es necesario porque la tarea no bloquea la interfaz.
- `initialize()` consulta `GET` tras cargar el catálogo para retomar una tarea en curso. `clearUserData()` cancela el sondeo y oculta la barra.
- Durante la tarea, el cliente no refresca la tabla en cada sondeo (evita repintados constantes en iPad); refresca una vez al terminar.

## Risks / Trade-offs

- [El límite real de Brickset es desconocido y puede cambiar] → Intervalo y espera por defecto configurables por variables de entorno; el manejo de `429` se adapta aunque el intervalo sea demasiado corto.
- [Tareas largas: con 9 s por figura, 100 figuras ≈ 15 min] → Es el coste de respetar el límite; la interfaz sigue usable y el progreso es visible.
- [Reinicio del servidor pierde el estado de la tarea] → Los precios ya persistidos se conservan; el usuario puede relanzar. Documentado como Non-Goal.
- [Varios usuarios simultáneos comparten el cupo y avanzan más despacio] → Aceptable para el uso actual; el limitador es FIFO y justo.
- [`notifyPersisted` por figura añade lecturas a Supabase] → Una lectura extra cada ~9 s es despreciable.
- [Cambio incompatible del `POST`] → Solo lo consume `public/app.js`, que se actualiza en el mismo cambio.

## Migration Plan

Despliegue conjunto de servidor y frontend. Eliminar `BRICKSET_CONCURRENCY` de los entornos si estaba definida (se ignora). Rollback: revertir los ficheros; no hay cambios de esquema.

## Open Questions

- Valores definitivos de `BRICKSET_MIN_INTERVAL_MS` y `defaultRetryAfterMs`: se ajustarán observando las respuestas reales de Brickset; no cambian el diseño.
