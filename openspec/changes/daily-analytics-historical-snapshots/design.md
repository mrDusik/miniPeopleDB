# Design

## Context

Ver `proposal.md` para motivacion y alcance confirmado.

- `src/server.js` ofrece una API Express con frontend estatico y crea repositorios ordinarios con cliente anon + JWT. El middleware actual protege una lista explicita de rutas; la ruta historica nueva debe incorporarse, mientras las rutas cron usan autenticacion independiente.
- `src/minifiguras-repository.js` calcula valor con mercado, compra como fallback y cero sin ambos; excluye buscadas. No hay historial de eventos que permita contar altas brutas.
- `src/gamificacion.js` contiene `calcularGamificacion` y niveles con IDs desde 0, Duplo. La gamificacion persistida contiene objetos JSON de nivel y logros, no un nivel escalar.
- `supabase/schema.sql` referencia `auth.users`; `private.dna_calcular(uuid)` calcula porcentajes sobre logros persistidos. La RPC actual de categorias solo autoriza `service_role` y no debe reutilizarse como puerta generica del cron.
- `BricksetScraper` serializa peticiones y espera por defecto 9 segundos entre ellas. `createBricksetSyncJobs` mantiene tareas ordinarias en memoria, devuelve 202 y no ofrece recuperacion tras reinicio.
- Node test, mock compartido de Supabase, PGlite y JSDOM son los mecanismos existentes de verificacion. No existe libreria de graficos ni manifiesto de despliegue en el proyecto.

## Goals / Non-Goals

**Goals:** separar permisos de usuario y administrativos; reutilizar valoracion, gamificacion y DNA; ejecutar trabajo largo sin conexion HTTP abierta; persistir progreso e idempotencia; proporcionar lecturas temporales acotadas y tres graficos accesibles.

**Non-Goals:** inventar historial previo; introducir framework frontend o motor DNA alternativo; convertir variacion neta en altas reales; publicar historicos de otros usuarios; resolver despliegue serverless o colas distribuidas generales; modificar contratos ordinarios de precios/ranking.

## Decisions

### 1. Fecha logica de Madrid y conjunto de usuarios al inicio

La RPC de inicio calcula `(clock_timestamp() AT TIME ZONE 'Europe/Madrid')::date` una vez y lo persiste en el trabajo. No usar `CURRENT_DATE` dependiente de timezone de sesion ni la fecha al terminar. La programacion externa usa timezone IANA Madrid, no una hora UTC fija.

La misma transaccion materializa IDs existentes de `auth.users` como elementos de trabajo. Solo IDs: no correos, metadatos OAuth ni actividad reciente. Usuarios nuevos esperan al siguiente trabajo; eliminados quedan omitidos y se ajusta el recuento elegible. La cola se lee mediante paginacion estable por clave, no offset mutable ni una consulta limitada implicitamente a 1.000 filas.

Alternativa descartada: inferir actividad desde `minifiguras` o `gamificacion`, porque excluiria cuentas vacias contra lo confirmado por el usuario.

### 2. Persistencia del historico y ejecucion

En `supabase/schema.sql`, crear:

- `public.user_daily_snapshots`: columnas del contrato, UUID, FK `auth.users`, unique `(user_id, snapshot_date)`, indice `(user_id, snapshot_date DESC)`, checks de recuentos, nivel >= 0 y porcentajes. `total_value NUMERIC(14,2)` permite agregados mayores que un precio individual; percentages `NUMERIC(5,2)`. `created_at` identifica la primera insercion; un upsert mantiene id y created_at.
- `private.daily_sync_runs`: id, fecha logica, estado, fase, timestamps, lease_owner aleatorio, lease_expires_at, resultado y error controlado. Un indice parcial constante para estados pending/running impide dos trabajos activos globales.
- `private.daily_sync_users`: `(run_id, user_id)`, estado/checkpoint y datos minimos de progreso, FK de usuario con cascada.
- `private.daily_sync_prices`: `(run_id, figure_id)` canonico, estado, numero de intentos, precio valido o codigo de fallo. Materializa IDs distintos de inventarios de usuarios incluidos y conserva resultados entre reinicios.
- `private.daily_sync_figure_prices`: cache global por `figure_id`, con ultimo precio Brickset valido y `fetched_at`. No concede acceso directo a clientes.

La cache es fresca durante 24 horas desde `fetched_at`. Al aplicar el esquema, se puede sembrar idempotentemente desde checkpoints exitosos recientes de ejecuciones anteriores, insertando solo IDs que aun no esten cacheados y conservando el `checkpoint_at` original; asi el primer job despues del despliegue reutiliza datos validos ya descargados. Al iniciar un run, se materializan todos los IDs distintos del roster. Los IDs con cache fresca quedan completados en `daily_sync_prices` sin llamada externa y el precio cacheado se copia a las filas de inventario que aun existan. Solo los IDs ausentes/caducados quedan pendientes. `aplicar_daily_sync_precio` actualiza cache global, inventarios elegibles y checkpoint en la misma transaccion cuando Brickset devuelve un precio valido; un fallo conserva tanto la cache anterior como los precios ya persistidos. `failedPrices` cuenta solo intentos externos fallidos del run.

Esto reduce los runs diarios a IDs nuevos o cuyo precio lleva mas de 24 horas sin actualizar, manteniendo snapshots diarios con el ultimo precio valido conocido. La frescura maxima declarada es, por tanto, 24 horas; el cache nunca modifica snapshots ya capturados.

RLS historico: SELECT exclusivamente de `auth.uid()`; revocar DML de anon/authenticated. Tablas de ejecucion sin grants a usuarios y con RLS sin politicas de cliente como defensa adicional. Funciones administrativas SECURITY DEFINER con search_path fijo, nombres cualificados, comprobacion `auth.role()`, revocacion de PUBLIC/anon/authenticated y EXECUTE solo service_role. Ninguna RPC permite elegir arbitrariamente tabla, operacion SQL o usuario fuera del trabajo.

Alternativa descartada: ejecutar un upsert directo con service_role desde cualquier ruta o usar solo memoria para progreso. El primer enfoque amplia permisos; el segundo pierde trabajos al reiniciar.

### 3. RPC allowlisted y trabajador durable

Proponer un conjunto pequeno de RPC separadas por responsabilidad:

- `iniciar_daily_sync`: devolver trabajo activo o crear run, usuarios e IDs atomicos.
- `reclamar_daily_sync` / `renovar_daily_sync`: adquirir o renovar lease mediante compare-and-set con hora de base de datos.
- `leer_daily_sync_fuentes`: obtener pagina de trabajo o fuentes minimas de un usuario del trabajo reclamado.
- `aplicar_daily_sync_precio`: persistir resultado de un ID y actualizar precios de filas aun existentes del conjunto elegible, sin crear figuras ni cambiar metadatos.
- `capturar_daily_sync_usuario`: verificar fuentes, aplicar estado de gamificacion y snapshot junto al checkpoint en una transaccion.
- `finalizar_daily_sync` / `consultar_daily_sync`: confirmar terminalidad y exponer solo estado agregado al coordinador.

Todos los mutadores comprueban run, lease_owner y lease vigente; bloquean la fila del run para comprobar el lease dentro de la misma transaccion que escribe. Un resultado de un worker sustituido se rechaza aunque termine su fetch tarde. La conexion con service_role permanece encapsulada en el repositorio administrativo del coordinador: no hay `.from()` global desde rutas HTTP de usuario.

Un coordinador nuevo, por ejemplo `src/daily-analytics-jobs.js`, recibe repositorio, scraper compartido, categorias y reloj/timers inyectables. Se activa tras inicio persistido y al arrancar el backend busca trabajos recuperables. En fallo transitorio persiste intentos y siguiente reintento con backoff acotado; tras agotarlos marca failed, libera exclusividad y permite nueva ejecucion. Cierre del servidor cancela timers/fetch y deja el lease recuperable. Heartbeats independientes mantienen el lease durante esperas de Brickset y Retry-After. No se mantienen transacciones SQL abiertas durante red o esperas.

La aplicacion requiere un proceso backend residente. No ejecutar el worker como trabajo efimero de una funcion serverless. Para conservar el limite global existente, el despliegue inicial usa una instancia backend y un unico scraper compartido entre cron y operaciones ordinarias; una ampliacion multiinstancia necesita limiter distribuido y queda fuera del cambio.

Alternativa descartada: responder 200 tras todas las consultas. El tiempo minimo puede ser horas. Tambien se descarta una cola externa porque el Postgres existente basta para este trabajo concreto.

### 4. Refresco y captura por usuario coherentes

Primera fase: materializar IDs distintos y completar desde la cache global los precios con menos de 24 horas; procesar con `BricksetScraper` solo IDs sin cache fresca, con timeout de fetch finito y politica existente de intervalo/429; persistir estado por ID. Un fallo de scraping conserva cache/precios anteriores y cuenta como failedPrices, no como fallo global. Reiniciar no repite IDs ya confirmados, salvo fetch que termino sin checkpoint. Inventarios nuevos durante el trabajo no amplian la cola de IDs: se incluyen en la captura actual con precio persistido y se refrescan en el siguiente trabajo.

Segunda fase: obtener figuras actuales, regalos recibidos y revision de fuentes de cada usuario. Ejecutar `calcularGamificacion` con categorias locales validas, sin reimplementar logros ni perder regalos. La revision incluye inventario canonico completo necesario para valoracion/logros, regalos y huella vigente de categorias/objetivos; no basta con timestamp de una sola figura. Confirmar con la RPC de captura que esas fuentes siguen correspondiendo a la revision; si hubo mutacion, volver a leer y recalcular con reintentos limitados.

La RPC serializa escrituras de gamificacion del usuario y valida las fuentes actuales antes de persistir. Captura los totales desde el mismo conjunto validado de figuras, aplica el estado calculado y llama a `private.dna_calcular` sobre los logros confirmados, usando los mismos pesos vigentes. Upsert de gamificacion, upsert del snapshot y checkpoint de usuario se confirman juntos. Ante conflicto con regalos/mutaciones o reconciliacion de categorias, reintentar sin sobrescribir un estado mas reciente; verificar este cruce mediante test de concurrencia SQL. No se promete un instante global simultaneo para todos los usuarios: cada medicion representa el estado coherente del usuario al capturarlo dentro del batch.

Si la cuenta desaparece, marcarla omitida o eliminar su elemento por cascada y no recrearla. Calcular processedUsers desde checkpoints confirmados, no un contador incrementado antes del commit. Calcular totalUsers como procesados mas pendientes elegibles; nunca usar numero de intentos.

Redondear EUR y cada proporcion a dos decimales en SQL. Cuatro ceros representan Newbie. No renormalizar silenciosamente los porcentajes historicos; permitir hasta 0,02 puntos de diferencia total por redondeo. Mapear nivel a `nivel.id`, con Duplo 0 para estado vacio valido; un estado invalido produce error, no fallback arbitrario a 1.

### 5. Contratos HTTP y errores

Rutas cron separadas de `authenticate()`: leer `CRON_SECRET` de entorno/configuracion backend, comparar bearer de manera resistente a timing y no llamar `auth.getUser` ni sincronizar perfil. Comprobar secreto ausente con 503; token incorrecto con 401. Configuracion administrativa ausente o almacenamiento inaccesible producen 503 controlado, nunca una ejecucion aparente. Rechazar cuerpos o parametros que pretendan elegir usuario o fecha.

POST devuelve 202 con identificador, estado y fecha. GET de estado requiere el mismo secreto y devuelve estructura definida en `analitica-historica`; al completar `result` lleva `{ success: true, processedUsers, timestamp }`. Un trabajo sin usuarios puede completar con processedUsers 0. El proveedor puede consultar GET para monitorizacion, pero POST confirmado ya deja trabajo durable y no exige polling para ejecutarse.

`GET /api/analytics/history` se anade a la proteccion JWT ordinaria y usa un repositorio de lectura con anon + JWT. Filtra siempre por usuario derivado de sesion; no lee Auth ni usa service_role. Valida fechas con parser estricto de calendario y aritmetica de fechas sin DST; defaults hoy Madrid y 90 dias, maximo 366. La lectura acotada tiene como maximo 366 filas mas baseline y selecciona solo columnas necesarias.

Respuesta: `{ snapshots: [{ snapshotDate, totalFigures, totalValue, bricks, level, dna: { collector, explorer, rarityHunter, fan } }], baseline: { snapshotDate, totalFigures } | null }`. Convertir numericos de PostgREST a numeros finitos validados, sin cambiar el contrato de APIs existentes. Baseline es el ultimo registro anterior al rango: solo permite delta diario si su fecha es el dia inmediatamente anterior a la primera medicion.

### 6. Modal y graficos sin framework

Instalar Chart.js y servir su bundle UMD local mediante `/vendor/chart.js`, siguiendo `/vendor/supabase.js`; no introducir CDN ni enviar datos historicos a terceros. Usar eje temporal numerico con ticks formateados desde fechas Madrid, evitando adaptador de fechas adicional y conversion accidental a dia local del navegador.

En `public/index.html`, anadir acceso Historico junto al panel propio y dialog con rango segmentado 30/90/365, fechas personalizadas, estado/reintento y tres lienzos. Mantener la composicion de accesos del desplegable existente. `public/app.js` usa `apiFetch`, secuencia de peticiones y limpieza de sesion como los modales actuales. Destruir instancias Chart al cerrar/recrear o cambiar cuenta. `public/styles.css` reserva altura responsive por grafico y scroll vertical interno, sin tarjetas anidadas ni cambios de tipografia global.

Graficos:

- Valor: linea EUR en eje izquierdo; barras `Cambio neto` en eje derecho. Un delta requiere snapshot en la fecha anterior. Sin baseline adyacente, primer delta null. Insertar entradas null solo en la representacion para cortar huecos, nunca como snapshots API.
- DNA: cuatro lineas rellenas apiladas, eje 0..100, Collector `--dna-collector` azul, Explorer rojo, Rarity Hunter amarillo y Fan verde. Newbie no recibe area inventada; tooltips muestran cifras guardadas.
- Progresion: Bricks lineal y nivel entero escalonado con ejes separados; ambos pueden bajar. Un unico snapshot se representa como punto inspeccionable.

Cada grafico incluye leyenda, tooltips, nombre accesible y una tabla semantica de los datos consultados disponible al usuario. No basar accesibilidad solo en color o canvas. Estados vacio/error no simulan ceros. Los huecos y cambios netos negativos se distinguen sin inventar incorporaciones.

Alternativa descartada: SVG o canvas propio para toda la logica de graficos; Chart.js aporta escalas, mezcla de series y lifecycle probado con una dependencia acotada.

## Risks / Trade-offs

- Batch prolongado y carga de Brickset: deduplicar por ID, compartir limiter, observar duracion/fallos y conservar precios en errores. Si supera un dia, el trigger siguiente devuelve el trabajo activo; no se inventan snapshots de dias omitidos.
- No es una fotografia global a las 04:00 exactas: la fecha es logica de inicio y cada usuario se captura tras el refresco. Documentar semantica y mostrar fecha de medicion; no usarlo como cierre contable.
- Reinicio durante un fetch: una consulta puede repetirse, pero precios/checkpoints y snapshots son idempotentes; no se promete exactly-once de HTTP externo.
- Mutaciones concurrentes: revision de fuentes, serializacion de gamificacion, transaccion de captura y retries finitos. Probar especificamente regalos y eliminaciones durante captura.
- Mayor superficie administrativa: RPC acotadas con rol + grants + lease, tabla historica RLS y tests reales PGlite; actualizar la regla de `AGENTS.md` en implementacion.
- Captura de DNA derivado: solo snapshots historicos privados; no modificar consultas actuales ni recalcular pasado.
- Crecimiento del historico: indice por usuario/fecha y ventanas limitadas; sin purga automatica en esta entrega.
- Diferencias JSDOM/canvas: mock de Chart para contratos de datos/lifecycle y comprobacion real en navegador de rendering no vacio, tooltips y responsive.

## Migration Plan

1. En implementacion, actualizar la regla administrativa aprobada en `AGENTS.md`; aplicar schema aditivo idempotente, grants/RLS y RPC, y verificarlo con PGlite antes de habilitar cron.
2. Desplegar backend con worker durable y Chart.js, mantener cron desactivado hasta configurar secretos en el entorno. Documentar ejemplo sin valores reales en `sup.env.example`; no escribir secretos en git.
3. Habilitar UI y lectura JWT; historico vacio es esperado, no backfill.
4. Ejecutar un POST autorizado de prueba y consultar estado; comprobar una fila por usuario, cuentas vacias, lectura aislada y una segunda ejecucion sin duplicados.
5. Configurar cron-job.org o proveedor equivalente a las 04:00 Europe/Madrid mediante POST HTTPS y bearer. Configurar monitorizacion del estado final, trabajos estancados, duracion y failedPrices. No asumir que 202 significa completado.
6. Rollback: desactivar trigger, detener worker y revocar RPC diarias; revertir UI/API sin borrar historico. No volver a una version que rechace la excepcion sin desactivar el trabajo. Eliminar nuevas tablas solo mediante procedimiento explicito de mantenimiento, no rollback automatico destructivo.

## Open Questions

- Dominio final, proveedor cron elegido y politica operativa de alertas/rotacion se configuran en despliegue; no cambian contratos ni tareas de implementacion.