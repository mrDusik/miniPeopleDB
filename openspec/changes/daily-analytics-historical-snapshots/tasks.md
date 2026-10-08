# Tasks

## 1. Contratos y modelo Supabase

- [x] 1.1 Actualizar `AGENTS.md` para incorporar la excepcion administrativa diaria aprobada, limitada al worker y RPC allowlisted, manteniendo JWT/RLS en rutas ordinarias; verificar que coincide con el delta `persistencia-supabase` y no autoriza acceso global de usuario.
- [x] 1.2 Crear `user_daily_snapshots` en `supabase/schema.sql` con FK a `auth.users`, nivel >= 0, importes/porcentajes validados, unique usuario/fecha e indice temporal; verificar mediante PGlite en `test/supabase-daily-analytics.test.js` instalacion repetida del schema, checks, cascada y upsert que conserva id/created_at.
- [x] 1.3 Crear tablas privadas de runs, usuarios y precios con checkpoints, estados, lease, reintentos e indice que impide dos runs activos; verificar en PGlite unicidad global, materializacion de cuentas vacias y borrado de cuentas sin bloquear trabajo.
- [x] 1.4 Definir RLS/grants para lectura exclusiva del historico propio y prohibicion de DML/metadata para clientes; verificar en PGlite usando roles reales anon/authenticated, dos usuarios y SELECT/DML, sin confiar solo en mocks.

## 2. RPC administrativas y captura atomica

- [x] 2.1 Implementar RPC de inicio/estado con allowlist, guard de service_role, fecha Madrid, roster Auth e IDs distintos; verificar con PGlite denegacion por rol/EXECUTE, un unico run activo, fecha invierno/verano y estado sin datos de Auth ni pesos.
- [x] 2.2 Implementar adquisicion/renovacion de lease y lectura paginada de trabajo/fuentes minimas; verificar en PGlite reclamacion tras caducidad, rechazo de lease_owner antiguo y ausencia de truncamiento con mas de 1.000 usuarios/IDs.
- [x] 2.3 Implementar RPC de confirmacion de precio/checkpoint por ID, acotada al run y filas aun existentes; verificar en PGlite ID compartido, fallo sin cambiar precio previo, rechazo de precios invalidos y no recreacion de figura eliminada.
- [x] 2.4 Implementar revision canonica de inventario, regalos y huella de categorias/objetivos, y RPC de captura que valida fuentes y serializa gamificacion; verificar intercalando mutacion/regalo/recambio de huella entre lectura y commit que rechaza estados obsoletos sin perder regalos.
- [x] 2.5 Confirmar gamificacion calculada, totales, DNA desde `private.dna_calcular`, snapshot y checkpoint de usuario en una transaccion; verificar con PGlite rollback inducido, fallback mercado/compra, exclusion de buscadas, nivel Duplo 0, Newbie y porcentajes redondeados.
- [x] 2.6 Implementar finalizacion/fallo y recuentos derivados de checkpoints; verificar que reintentos no duplican processedUsers, fallos SQL no devuelven exito, cuentas eliminadas ajustan elegibles y cambios posteriores de pesos no alteran dias anteriores.

## 3. Repositorio administrativo y trabajador recuperable

- [x] 3.1 Extender `test-support/supabase-mock.js` con las RPC allowlisted, runs, checkpoints y snapshots necesarios, reutilizando sus fixtures; verificar tests de API/coordinador sin red ni credenciales y conservar la suite de ranking/categorias existente.
- [x] 3.2 Crear repositorio administrativo encapsulado, con configuracion service_role solo backend y metodos RPC acotados; verificar con mock que no realiza operaciones globales `.from()` ni transmite credenciales a respuestas o errores.
- [x] 3.3 Crear coordinador `src/daily-analytics-jobs.js` con lease, heartbeats, timers/reloj inyectables, backoff acotado y recuperacion en arranque/cierre; verificar en `test/daily-analytics-jobs.test.js` reinicio en cada fase, worker antiguo rechazado y fecha logica estable al cruzar medianoche.
- [x] 3.4 Procesar precios deduplicados con la instancia compartida de `BricksetScraper`, timeout finito y limite/reintentos vigentes; verificar con fetch/timers simulados serializacion con sincronizacion ordinaria, `429 Retry-After`, checkpoint por ID y conservacion de precios en fallos.
- [x] 3.5 Procesar usuarios con `calcularGamificacion`, categorias validas, regalos y revision de fuentes; verificar con tests del coordinador cuentas vacias, precio que modifica logro/DNA, relectura ante conflictos y fallo terminal tras reintentos agotados sin exito aparente.

## 4. Rutas HTTP de cron e historico

- [x] 4.1 Incorporar `CRON_SECRET` a configuracion backend y dependencias inyectables de `createServer`, sin publicarlo en `/config/supabase`; verificar pruebas de configuracion sin leer secretos reales y respuesta publica sin claves administrativas.
- [x] 4.2 Implementar POST de inicio y GET de estado cron con autenticacion independiente, comparacion segura, 202 durable, 401/503/405 y rechazo de identidad/fecha elegidas por cliente; verificar en `test/daily-analytics-api.test.js` mediante mock que llamadas no autorizadas no ejecutan RPC, JWT normal no sirve y GET desconocido devuelve 404.
- [x] 4.3 Conectar el worker a inicio, recuperacion de arranque y cierre del backend; verificar mediante test de integracion que 202 ocurre antes de terminar scraping, una llamada activa devuelve el mismo jobId y el resultado final contiene success/processedUsers/timestamp sin duplicados.
- [x] 4.4 Implementar repositorio de lectura historica con anon + JWT y proteger `/api/analytics/history` en el middleware ordinario; verificar con mock aislamiento de dos usuarios, orden ascendente, conversion numerica, baseline propio, ausencia de historico y error `HISTORICO_NO_DISPONIBLE`.
- [x] 4.5 Validar calendario y rangos inclusivos con defaults de Madrid y maximo 366 dias; verificar tests API de fechas imposibles, bisiestos, DST, orden invertido, query repetida/desconocida, `userId`, falta de sesion y metodo no permitido.

## 5. Modal y representacion historica

- [x] 5.1 Instalar Chart.js y servir bundle local `/vendor/chart.js`, siguiendo el patron Supabase existente; verificar instalacion, GET del bundle con tipo correcto y ausencia de CDN/errores de carga.
- [x] 5.2 Incorporar boton Historico y modal semantico en `public/index.html` con rangos 30/90/365, fechas personalizadas, estados y alternativa tabular; verificar en `test/analytics-web.test.js` con JSDOM nombres accesibles, apertura por teclado, cierre/Escape y retorno de foco sin alterar accesos existentes.
- [x] 5.3 Implementar carga con `apiFetch`, secuencia de peticiones, defaults y reintento en `public/app.js`; verificar con JSDOM rango enviado, vacio/error, respuestas fuera de orden, cierre durante carga y cambio de cuenta sin filtracion de datos previos.
- [x] 5.4 Crear grafico combinado valor EUR/cambio neto y tabla equivalente, con baseline adyacente, deltas negativos y huecos null; verificar datos/configuracion enviados al mock de Chart para 12 -> 9 figuras, primer dia sin baseline y dia perdido.
- [x] 5.5 Crear area DNA apilada 0..100 con colores CSS actuales, tooltips historicos y Newbie sin normalizacion ficticia; verificar datasets y tabla accesible para porcentajes redondeados, cuatro ceros y huecos, sin pesos en cliente.
- [x] 5.6 Crear series Bricks/nivel con ejes independientes y nivel entero escalonado, y destruir instancias al cerrar/cambiar sesion; verificar con JSDOM descensos, nivel 0, una sola medicion, rangos sucesivos y lifecycle sin instancias duplicadas.
- [x] 5.7 Aplicar estilos responsive en `public/styles.css` con espacio estable para canvas y scroll vertical del modal; verificar en navegador real escritorio y movil que graficos no estan vacios, se inspeccionan tooltips, no hay solapamientos/scroll horizontal y Escape/foco funcionan.

## 6. Documentacion y validacion integrada

- [x] 6.1 Actualizar `README.md` y `sup.env.example` con rutas, respuestas asincronas, secretos sin valores reales, requisito de backend residente de una instancia, cron HTTPS a las 04:00 Europe/Madrid y monitorizacion de completed/failed; verificar que 202 no se describe como captura terminada y que nivel inicial/fecha logica/cambio neto estan documentados.
- [x] 6.2 Documentar despliegue aditivo, prueba manual del trigger y rollback no destructivo con cron/worker desactivados; verificar entrega del procedimiento, incluyendo repeticion del mismo dia, lectura por dos cuentas y rotacion de secreto fuera de git.
- [x] 6.3 Ejecutar tests focalizados SQL, API, coordinador y web y despues `npm.cmd test -- --test-reporter=dot`; verificar suite completa sin red/credenciales y regresiones de DNA, gamificacion, categorias, ranking y sincronizacion ordinaria cubiertas.
- [x] 6.4 Validar el cambio con `openspec validate daily-analytics-historical-snapshots --strict`, revisar `git diff --check` y comprobar visualmente los tres graficos con datos de prueba en navegador; verificar todos los escenarios de aceptacion antes de marcar implementacion completada, sin configurar servicios externos ni credenciales reales automaticamente.

## 7. Cache global de precios Brickset

- [x] 7.1 Crear `private.daily_sync_figure_prices` por ID canonico con precio y `fetched_at`; sembrar idempotentemente desde checkpoints exitosos recientes, proteger la cache sin grants de cliente y verificar en PGlite antiguedad conservada, RLS/grants y schema repetido.
- [x] 7.2 Cambiar inicio de run para marcar como completados los IDs con cache <=24 horas y propagar esos precios a figuras elegibles existentes; guardar cache, filas de inventario y checkpoint en la misma RPC al refrescar, y verificar en PGlite ID fresco/caducado, fallo y borrado concurrente.
- [x] 7.3 Extender mock y worker para consultar Brickset solo para IDs ausentes/caducados, reutilizar cache entre runs y mantener snapshots completos; verificar que un segundo run fresco no hace fetch y que un ID caducado se actualiza una sola vez.
- [x] 7.4 Actualizar README con la vigencia de 24 horas, semantica del ultimo precio conocido y efecto en `failedPrices`/duracion.
- [x] 7.5 Ejecutar pruebas SQL, worker y regresion completa, `openspec validate --strict` y `git diff --check`; medir la segunda ejecucion del mismo conjunto frente a la primera.