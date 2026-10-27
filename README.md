# MiniPeopleDB

MiniPeopleDB es una aplicación web multiusuario para catalogar, valorar y compartir colecciones de minifiguras LEGO. Incluye un dashboard servido por Express, una API REST y gamificación social. La interfaz está en español; los datos de colección y progreso se aíslan por usuario.

El proyecto se desarrolla con **Spec-Driven Development**: los requisitos se mantienen en OpenSpec y las funcionalidades cuentan con pruebas automatizadas.

---

## 🚀 Características Principales

* **Colección e inventario:** alta, consulta, edición y borrado de minifiguras; categorías y subcategorías Brickset; estados `COLECCIÓN` y `BUSCADA`; fecha de alta, datos de compra e imagen de cada figura. Las altas y ediciones validan IDs, importes, fechas y la relación categoría-subcategoría.
* **Búsqueda y seguimiento:** filtros por ID, nombre, categoría, subcategoría, año, estado y observación. La búsqueda de la tabla se aplica sobre la colección cargada en el navegador; incluye ordenación, paginación y un límite de diez figuras observadas.
* **Resumen y valoración:** valor total en euros, contadores de colección y buscadas, galería de observación y destacados Top 5 por precio y antigüedad. El valor de mercado Brickset tiene prioridad sobre el precio de compra; las buscadas no aportan al total.
* **Sincronización Brickset:** consulta individual de nombre, descripción, categoría, subcategoría, año y precio, sin edición manual de estos campos; actualización masiva del precio en segundo plano, con progreso, pausa/reanudación, resultados parciales, límite global de peticiones y tratamiento de `429 Retry-After`.
* **Gamificación:** Bricks, niveles, progreso y logros V2 calculados a partir del inventario, relaciones sociales y catálogo de categorías; los pagos directos de regalos y agradecimientos se mantienen separados de los hitos.
* **DNA de colección:** cuatro rasgos (Rarity Hunter, Collector, Explorer y Fan), porcentajes privados para el usuario y un resumen público limitado al rasgo principal.
* **Ranking social:** Top 10 global ordenable por nivel, tamaño de colección o rasgo DNA, más un Top 10 semanal de Bricks netos; perfil público reducido, destacados de cada colección, logros de solo lectura y regalos únicos de 50 Bricks globales o 5 semanales. Los destacados ajenos ausentes se pueden añadir a las propias buscadas sin editar datos de terceros.
* **Notificaciones en tiempo real:** avisos personales de entradas y salidas del Top 10, regalos recibidos y agradecimientos, además del resumen diario. La bandeja pagina resultados, actualiza el badge de no leídas y permite marcar avisos como leídos o agradecer regalos para dar 5 Bricks.
* **API REST:** respuestas JSON y errores de negocio controlados; recursos de datos autenticados y aislamiento de colección por usuario.
* **Analítica histórica:** capturas diarias privadas de valor, figuras, Bricks, nivel y DNA; gráficas y tablas accesibles sin reconstruir días ausentes.

### Valoración y moneda

Todos los importes se expresan exclusivamente en Euros (€). Cada minifigura puede incluir en su raíz:

* `precioCompra`: precio pagado, opcional y no negativo.
* `fechaCompra`: fecha opcional con formato `YYYY-MM-DD`.
* `precio`: valor actual obtenido de Brickset, opcional y no negativo.

El valor total solo incluye figuras `COLECCIÓN`. Para cada una se prioriza `precio` y se usa `precioCompra` como alternativa cuando no hay precio de Brickset. Las figuras `BUSCADA` se contabilizan, pero no contribuyen al total ni a los rankings.

La consulta usa scraping/fetch directo de `https://brickset.com/minifigs/<ID>` y extrae `Current Value - New`. Si una consulta falla, se conserva el precio anterior.

Nombre y descripción se autocompletan desde `Name` de Brickset y permanecen deshabilitados y sombreados. Si contiene ` - `, el primer separador divide nombre y descripción, conservando las comas posteriores. Sin ese separador, se guarda como nombre solo el texto anterior a la primera coma y la descripción queda vacía; sin coma, todo el texto es el nombre. La misma regla se aplica en alta ordinaria, alta desde ranking y sincronización individual al editar; no se migran registros existentes ni se cambian sus nombres con la actualización masiva de precios.

---

## Arquitectura e integraciones

* **Aplicación:** Node.js con módulos ES, Express 5 y frontend estático sin framework: HTML semántico, CSS y JavaScript del navegador. Supabase JS y Chart.js se sirven como recursos locales en `/vendor/supabase.js` y `/vendor/chart.js`.
* **Identidad:** Supabase Auth admite Google OAuth con PKCE y cuentas clásicas. El acceso clásico pide Username y contraseña; el registro también pide email y repetir contraseña. La API valida el bearer token con Supabase Auth.
* **Persistencia:** Supabase Postgres almacena minifiguras, gamificación, perfiles públicos, ponderaciones DNA y regalos. RLS limita las operaciones ordinarias a la identidad autenticada.
* **Acceso administrativo:** `SUPABASE_SERVICE_ROLE_KEY` se usa desde el proceso backend para las RPC allowlisted del recálculo de categorías y del worker de analítica diaria. Como excepción puntual autorizada, el script de corrección de nombres usa solo sus dos RPC temporales de mantenimiento, que deben retirarse al terminar. No se entrega al navegador ni se usa en rutas ordinarias; estas conservan `anon` + JWT y RLS.
* **Brickset:** el backend lee páginas públicas de `brickset.com` mediante `fetch` y extrae campos de minifigura; no utiliza una API key. Normaliza a EUR los precios publicados en USD con el último tipo de referencia diario del BCE, cacheado 24 horas; si no obtiene una tasa válida, falla de forma segura. Las peticiones se serializan globalmente y el intervalo mínimo se configura con `BRICKSET_MIN_INTERVAL_MS`.
* **Catálogo de categorías:** `data/categorias-brickset.json` es la fuente local validada. Se puede actualizar manualmente desde la página pública de categorías de Brickset con `node scripts/sync-brickset-categorias.js`.
* **Imágenes:** las imágenes de minifiguras se cargan desde el CDN de BrickLink (`img.bricklink.com`); logos, iconos, niveles y otros recursos de la interfaz son locales en `public/`.
* **Despliegue y monitorización:** el servidor escucha en `PORT` (3000 por defecto) y ofrece `GET /health` para comprobaciones de salud, por ejemplo desde Render o UptimeRobot. No hay manifiesto de despliegue ni pipeline CI de tests en este repositorio.
* **Calidad:** `node:test` y `node:assert` para pruebas, JSDOM para flujos DOM y PGlite para validar SQL/RPC localmente. Los tests de API usan `test-support/supabase-mock.js`; no requieren credenciales ni red real.
* **Especificación:** OpenSpec mantiene las capacidades en `openspec/specs/`, junto con propuestas activas/archivadas en `openspec/changes/`. GitHub Actions contiene los pasos de preparación de OpenSpec para Copilot, no un workflow de CI de la aplicación.

### Seguridad y privacidad

Las rutas de colección, gamificación e histórico propio requieren `Authorization: Bearer <token>` y operan con el cliente `anon` más el JWT del usuario. Las tablas privadas tienen RLS por usuario. El ranking y los logros públicos usan proyecciones limitadas; no publican correos, compras ni la distribución DNA completa. Las excepciones con `service_role` son el reconciliador backend de categorías y el worker diario autenticado por `CRON_SECRET`; ambos se limitan a sus RPC allowlisted y no se exponen en rutas ordinarias ni en el navegador. El acceso clásico tiene una excepción sin `service_role`: la RPC `resolver_acceso_username` valida la contraseña antes de resolver el email y limita los intentos a cinco por cuenta/minuto. No permite consultar emails sin conocer la contraseña ni leer las tablas privadas; solo Supabase Auth emite la sesión definitiva.

### Acceso clásico por Username

Antes de desplegar esta versión, aplicar en el SQL Editor de Supabase primero `supabase/schema.sql` y después `supabase/username-login.sql`. El segundo archivo es una migración idempotente que requiere `pgcrypto` en el esquema `extensions` y crea la RPC de acceso y el contador privado de intentos. Los archivos locales no actualizan automáticamente la base de datos remota. El acceso por Username requiere que la cuenta tenga su Username guardado mediante el onboarding; Google y la confirmación/recuperación por email siguen disponibles.

El registro comprueba al menos cinco caracteres, una mayúscula, una minúscula y un número, además de la coincidencia de ambas contraseñas. Las directrices cambian de rojo a verde y el interruptor muestra u oculta ambos campos. Supabase puede imponer una longitud mínima mayor: revisar su configuración de Auth si se quieren admitir contraseñas de exactamente cinco caracteres. Las contraseñas no se guardan en tablas de la aplicación ni se registran en logs del servidor.

### Identidad y eliminación de cuenta

El username guardado sustituye al nombre de Google y al email como identidad visible de la aplicación y nombre público en rankings y avisos de regalos/agradecimientos, por autorización expresa. Los emails y las preferencias siguen siendo privados. Aplicar el `supabase/schema.sql` actualizado antes de desplegar: migra los nombres públicos y corrige también el autor/mensaje de los avisos sociales ya emitidos, conservando IDs, fechas, lectura, importes y recompensas. Las funciones de ranking y la generación de avisos leen el username directamente del perfil, sin depender de una proyección pública actualizada ni de que el propietario vuelva a iniciar sesión. Los autores históricos se resuelven por referencias de regalo/agradecimiento o una referencia interna guardada, nunca por semejanza de nombres Google; cuando no hay una identidad o perfil fiables se muestra Coleccionista. Esa referencia interna no se devuelve por la API. Hay que volver a aplicar el esquema para activar estos cambios en funciones y datos ya desplegados; los archivos locales no modifican Supabase remoto.

Preferencias incluye al final "Eliminar cuenta", con el estilo de Cerrar sesión. Abre una confirmación separada, irreversible, con Cancelar enfocado por defecto; abrir o cancelar no borra nada. Solo confirmar envía `DELETE /api/profile`, sin cuerpo ni selector, mediante el JWT de la cuenta. La RPC SQL solo elimina `auth.uid()` y sus datos asociados por cascada, en una transacción y sin `service_role`; no concede lectura ni borrado directo sobre Auth. Un fallo conserva cuenta, sesión y preferencias; tras éxito se limpia la aplicación y se cierra la sesión local. La migración no se ha aplicado automáticamente a Supabase remoto. Reiniciar el backend tras desplegar el código para activar el nuevo método DELETE.

## API principal

### Avatar y favoritas

Preferencias tiene tres filas: Username y avatar con Cargar/vista previa; Idioma y Moneda; favoritas. Las seleccionadas se muestran incluso al buscar, con contador `0/3` a `3/3`. Navegador, API y SQL impiden guardar más de tres. No se borran automáticamente favoritas antiguas: el formulario parte de hasta tres y solo Guardar actualiza el conjunto.

Antes de activar la carga, aplicar `supabase/schema.sql` actualizado y `supabase/profile-avatars.sql` en Supabase. El segundo configura el bucket público `profile-avatars` y sus políticas JWT por carpeta. Admite PNG/JPEG/WebP de hasta 2 MiB; previsualizar no sube el archivo. Solo Guardar crea una ruta única de la cuenta y persiste su URL, sin service_role. Las migraciones remotas no se aplican automáticamente.

El guardado intenta limpiar subidas descartadas y avatares administrados anteriores. La eliminación de cuenta limpia primero sus archivos mediante Storage; si Storage falla no se elimina Auth. Los archivos físicos no participan en la transacción SQL: si el borrado SQL posterior falla, las filas se conservan pero puede ser necesario cargar de nuevo el avatar. Reiniciar el backend tras desplegar para activar esa limpieza.

| Ruta | Métodos | Acceso | Uso |
| --- | --- | --- | --- |
| `/` y recursos de `public/` | `GET` | Público | Dashboard y activos estáticos |
| `/health` | `GET` | Público | Health check para hosting/monitorización |
| `/config/supabase` | `GET` | Público | URL y clave pública `anon` del proyecto |
| `/api/auth/login` | `POST` | Username y contraseña | Establecer sesión clásica; devuelve solo access/refresh tokens, sin caché |
| `/api/profile` | `GET`, `PUT`, `DELETE` | JWT propio | Consultar/guardar preferencias o eliminar la cuenta propia sin parámetros de identidad |
| `/categorias` | `GET` | Público | Catálogo local validado de categorías |
| `/minifiguras` | `GET`, `POST` | Autenticado | Listar/filtrar la colección propia y crear registros |
| `/minifiguras/:id` | `PUT`, `DELETE` | Autenticado | Editar o borrar una figura propia |
| `/minifiguras/:id/observada` | `PUT` | Autenticado | Activar/desactivar seguimiento |
| `/minifiguras/:id/brickset` | `GET` | Autenticado | Consultar metadatos y precio Brickset |
| `/valoracion` y `/valor-total` | `GET` | Autenticado | Resumen, destacados y observadas |
| `/sincronizacion/brickset` | `GET`, `POST`, `PATCH` | Autenticado | Consultar/iniciar tarea y pausar/reanudarla |
| `/gamificacion` y `/gamificacion/dna` | `GET` | Autenticado | Estado propio de gamificación y DNA |
| `/api/ranking` | `GET` | Autenticado | Top 10 global con criterio opcional |
| `/api/ranking/semanal` | `GET` | Autenticado | Top 10 de Bricks netos de la semana actual |
| `/api/ranking/:userId/logros` | `GET` | Autenticado | Logros públicos del Top 10 |
| `/api/ranking/regalar` | `POST` | Autenticado | Enviar regalo único de Bricks |
| `/api/notificaciones` | `GET` | Autenticado | Listar notificaciones propias; acepta `cursor` para paginar |
| `/api/notificaciones/leer-todas` | `POST` | Autenticado | Marcar todas las notificaciones propias como leídas |
| `/api/notificaciones/:id/leer` | `POST` | Autenticado | Marcar una notificación propia como leída |
| `/api/notificaciones/:id/agradecer` | `POST` | Autenticado | Agradecer un regalo recibido y reclamar la recompensa |
| `/api/cron/daily-sync` | `POST` | `CRON_SECRET` | Iniciar o reutilizar un trabajo durable; devuelve `202` antes de terminar |
| `/api/cron/daily-sync/:jobId` | `GET` | `CRON_SECRET` | Consultar estado agregado `pending`, `running`, `completed` o `failed` |
| `/api/analytics/history` | `GET` | JWT propio | Leer snapshots propios por rango y baseline |

Los estados de colección aceptados son `COLECCIÓN` y `BUSCADA`. Los filtros de nombre e ID se aplican en el cliente sobre el catálogo cargado; los parámetros de `GET /minifiguras` también están disponibles para consumidores de la API.

### Notificaciones

La bandeja carga hasta 15 avisos por página y usa el cursor devuelto para continuar. Supabase Realtime avisa de cambios de la sesión autenticada; recibir o abrir la bandeja no marca avisos como leídos. El badge cambia al marcar una notificación individualmente o usar `POST /api/notificaciones/leer-todas`. Los avisos de regalo incluyen la acción para agradecerlo; agradecer es independiente de marcarlo como leído.

### Actualización de Amigos

En una base que ya tiene las tablas y RPC de amistad, ejecutar `supabase/friends-social-upgrade.sql` en el SQL Editor antes de desplegar esta actualización y reiniciar el backend. Es transaccional e idempotente: añade el resumen limitado de ranking, contadores propios y eliminación recíproca con JWT; no modifica grants directos de tablas ni usa `service_role`. Las instalaciones nuevas incluyen estas funciones en `supabase/schema.sql`. Si la base conserva la restricción de notificaciones anterior a las amistades, ejecutar también `supabase/friend-notification-types.sql`.

El botón Amigos y sus pestañas muestran totales confirmados por sesión; un error de lectura no se representa como cero. Eliminar una amistad desde Amigos o Buscador la retira de ambas cuentas, borra su solicitud aceptada y notificaciones sociales vinculadas, y permite solicitar amistad de nuevo. No cambia colecciones, Bricks ni regalos. Los SQL locales no se aplican automáticamente a Supabase remoto.

Para mantener privado el rechazo, aplicar también `supabase/friend-request-privacy.sql` antes de probar contra una base existente. Es transaccional e idempotente: las solicitudes rechazadas siguen apareciendo como pendientes/enviadas al emisor, sin cambios de búsqueda, contadores ni fechas visibles; solo el destinatario conoce el rechazo y puede aceptarlas después. El emisor consulta sus solicitudes mediante RPC y no puede leer el estado real de la tabla por RLS. Las instalaciones nuevas ya incluyen esta protección en `supabase/schema.sql`.

### Analítica histórica diaria

La vigencia de la caché global de precios se configura con `DAILY_SYNC_PRICE_CACHE_TTL_HOURS`: entero entre 0 y 8760 horas, con valor predeterminado de 24. Un valor de `0` desactiva la reutilización y hace que cada ID se consulte en Brickset en cada nuevo trabajo. Configúrala como variable de entorno del Web Service en Render; cada nuevo trabajo aplicará ese umbral. El esquema actualizado debe estar aplicado en Supabase para que la RPC acepte el parámetro.

El worker escribe eventos JSON `[daily-analytics] inicio` y `[daily-analytics] resumen` en stdout. El resumen incluye inicio y fin UTC, duración total y por fase, espera de lease, IDs de precio que requirieron trabajo, número y duración media de llamadas a Brickset, fallos, usuarios procesados y estado final persistido. En local se ven en la terminal de `npm.cmd start`; en producción, en los logs de ejecución del proveedor que mantiene el servidor. Se correlacionan con el `jobId` devuelto por el cron. La aplicación no los persiste ni envía por email: para alertas por correo hay que configurar una regla del proveedor de hosting o integrar un servicio de correo.

El trigger externo inicia `POST /api/cron/daily-sync` con `Authorization: Bearer <CRON_SECRET>` y sin cuerpo ni parámetros que seleccionen usuario o fecha. Una respuesta `202` contiene `{ "jobId", "status", "snapshotDate" }`: confirma que el trabajo quedó persistido, **no** que la captura haya terminado. Consulta `GET /api/cron/daily-sync/:jobId` con el mismo secreto para obtener `processedUsers`, `totalUsers`, `failedPrices` y el estado terminal. Solo `completed` incluye `result: { "success": true, "processedUsers": N, "timestamp": "...Z" }`; `failed` no informa éxito ni errores internos. La fecha lógica se fija una vez al iniciar según `Europe/Madrid` y permanece igual si el proceso cruza medianoche.

El worker procesa todas las cuentas de Supabase Auth, también las que no tienen colección: su snapshot inicial contiene cero figuras, valor, Bricks y porcentajes DNA, con nivel Duplo `0`. Los precios Brickset se comparten por ID en una caché privada global; cada run reutiliza los precios frescos según `DAILY_SYNC_PRICE_CACHE_TTL_HOURS` (24 horas por defecto) y consulta solo IDs nuevos o caducados, respetando el límite global del scraper. Al inicializar la caché desde `schema.sql`, se importa el checkpoint exitoso más reciente de cada ID; la RPC aplica el TTL configurado para decidir si todavía está fresco. Un fallo al refrescar conserva el último precio válido y solo cuenta en `failedPrices` si se intentó consultar ese ID caducado. Valor de colección usa precio Brickset y, como alternativa, precio de compra; `BUSCADA` no cuenta. Cada fila es única por usuario/fecha y una repetición del mismo día actualiza esa fila sin cambiar días anteriores. No existe backfill de snapshots. Estos representan el estado coherente de cada cuenta al procesarla, no una fotografía global simultánea a las 04:00.

El proceso ocurre en fases: (1) al recibir el POST, fija la fecha de Madrid y persiste el roster de Auth y los IDs distintos de sus inventarios; (2) copia al inventario los precios cacheados dentro del TTL configurado y marca esos IDs completados sin llamar a Brickset; (3) consulta secuencialmente solo los IDs ausentes o caducados, guarda cada resultado válido en la caché y checkpoint, y conserva el valor anterior si falla; (4) cuando termina la fase de precios, recalcula cada usuario con sus figuras y regalos y confirma gamificación, DNA, snapshot y checkpoint en una transacción; (5) publica `completed` solo cuando todos los usuarios elegibles están capturados. Las escrituras tardan como mínimo unos 9 segundos por cada ID que realmente requiere consulta externa, más la latencia y posibles esperas de `Retry-After`; por ejemplo, 329 IDs caducados implican al menos unos 49 minutos. Un segundo run con esos precios aún frescos evita esas consultas. Los heartbeats renuevan el lease durante la espera y el worker recupera checkpoints tras reiniciar.

`GET /api/analytics/history?from=YYYY-MM-DD&to=YYYY-MM-DD` usa el JWT normal y solo consulta el propio historial mediante RLS. Si se omiten fechas, `to` es hoy en Madrid y `from` son los 89 días anteriores; el máximo inclusivo es 366 días. Devuelve snapshots existentes en orden ascendente y el último baseline propio anterior al rango. Los días ausentes no se inventan: el cambio neto solo se calcula contra una medición del día calendario anterior, admite descensos y no representa altas brutas. El nivel es el identificador numérico vigente y puede disminuir; cuatro porcentajes DNA cero permanecen cero. Los cambios posteriores de pesos no reescriben snapshots históricos.

### Ranking semanal de Bricks

`GET /api/ranking/semanal` requiere JWT y no acepta parámetros para elegir usuario, fecha, semana o criterio. Devuelve `{ available, availableFrom, weekStart, weekEnd, entries }`; cada entrada conserva el saldo global `bricks` y añade `bricksSemanales` y `snapshotDate`. La proyección pública reutiliza nivel, perfil, destacados, DNA acotado y estado de regalo del ranking global; no incluye la base semanal, snapshots completos, compras ni correos. Los errores de lectura responden `500 RANKING_SEMANAL_NO_DISPONIBLE`; una consulta válida sin candidatos comparables responde `200` con `available: false` y `entries: []`.

La activación V2 se fija una sola vez en el corte autorizado: `availableFrom` es el lunes estrictamente posterior a la fecha efectiva de despliegue en `Europe/Madrid`, incluso si el corte ocurre en lunes. El primer resultado necesita snapshots V2 de base dominical y una captura de la semana que empieza el lunes. Cada semana compara el snapshot más reciente de lunes a domingo con la fila exacta del domingo anterior; no sustituye bases ausentes por cero ni reutiliza filas V1. Se conservan deltas positivos, cero y negativos. Son diferencias entre estados medidos por el worker, no un registro de actividad ni un corte simultáneo exacto a medianoche; regalos y cambios de precio o reglas pueden formar parte del neto cuando aparezcan en las capturas.

La instalación normal de `supabase/schema.sql`, el arranque del servidor y `opsx-apply` no aplican el reset ni despliegan producción. El corte requiere una operación explícita del propietario, mantenimiento y confirmación de proyecto; producción requiere además backup restaurable. Solo el proyecto desechable `wvcnftjhvcdxmuqpjqda` permite omitirlo con `--test-no-backup`. Consulta el [runbook de Gamificación V2](docs/gamificacion-v2-runbook.md) y el [informe de cobertura Brickset](docs/brickset-series-coverage-2026-10-26.md). El operador debe aceptar las cuatro estimaciones y que `General` permanezca sin clasificar; el JSON ya usa las rutas oficiales y el corte canonicalizará las referencias guardadas. El cron solo se reactiva tras verificar la reconstrucción y el primer snapshot V2.

La comprobación visual local usó respuestas fixture interceptadas, sin modificar colecciones: Playwright verificó accesos y criterios en 390×844, 800×1100, 844×390 y 1280×900; los modales global y semanal conservaron iguales dimensiones y tipografía, con filas y destacados expandidos. La consulta semanal mostró el delta firmado y `No disponible` antes del estreno, sin scroll horizontal en portrait. Estas pruebas no aplican el esquema remoto ni sustituyen verificar allí los grants/RLS o confirmar el snapshot del domingo.

---

## 📦 Estructura del Proyecto

```text
mi-proyecto/
├── .github/                  # Prompts, configuración de Copilot y workflow de OpenSpec
├── data/                     # Catálogos locales Brickset y gamificación
│   ├── categorias-brickset.json
│   ├── gamificacion.json
│   └── minifiguras.json      # Fixture/datos locales heredados; colección activa en Supabase
├── openspec/                 # Especificaciones OpenSpec y cambios activos/archivados
│   ├── changes/
│   └── specs/
├── public/                   # Aplicación web frontend estática
│   ├── app.js, index.html, styles.css
│   └── *_images/, fonts/      # Recursos visuales locales
├── scripts/                  # Sincronización manual de categorías
├── src/                      # Servidor, repositorios y lógica de dominio
│   ├── services/             # Configuración de Supabase
│   ├── brickset-*.js         # Scrapers y trabajos de sincronización
│   ├── *-repository.js       # Persistencia y consultas
│   ├── gamificacion.js       # Logros, niveles y DNA
│   └── server.js             # API, autenticación y arranque
├── supabase/                 # Esquema SQL y scripts de prueba de datos
├── test/                     # Pruebas automatizadas (node:test)
├── test-support/             # Mock de Supabase y utilidades de pruebas
├── reviews/                  # Revisiones documentadas
├── AGENTS.md                 # Convenciones del proyecto
├── EFICIENCIA.md             # Notas de metodología SDD
├── package.json              # Scripts y dependencias
└── README.md
```

## ▶️ Ejecución

1. Aplica `supabase/schema.sql` en el SQL Editor de Supabase.
2. En Supabase › Authentication › Providers habilita **Google** (Client ID y Secret de Google Cloud).
3. En Supabase › Authentication › URL Configuration configura las URLs de retorno como se explica abajo.
4. Define `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` como variables de entorno o en `sup.env` (excluido de Git). El arranque normal requiere las tres: la clave de servicio inicializa el reconciliador backend. Para habilitar el trigger diario, configura además `CRON_SECRET` como secreto solo del backend y del proveedor cron. Sin él, las rutas cron responden `503 CRON_NO_CONFIGURADO`. Nunca copies claves o secretos al navegador, logs o repositorio. Las rutas de usuario siguen usando exclusivamente `anon` + JWT y RLS. `SUPABASE_URL` es la URL del proyecto Supabase, no la del hosting.

```bash
npm install
npm test
npm start
```

El servidor queda disponible en `http://localhost:3000` (o en el puerto de `PORT`). Aplica `supabase/schema.sql` antes del primer arranque para instalar tablas, políticas RLS, funciones y permisos. Los tests no necesitan credenciales reales: las rutas de usuario usan `test-support/supabase-mock.js` y las RPC se validan con PGlite.

Para mostrar los dos rasgos DNA con porcentajes en Ranking Global, vuelve a aplicar `supabase/schema.sql`: actualiza la respuesta de `ranking_global()` con el resumen publico `dna_rasgos`, sin exponer ponderaciones ni los cuatro porcentajes completos.

El selector del Ranking Global, alineado a la izquierda encima de las filas, permite ordenar por Nivel (predeterminado), Colección, Rarity Hunter, Collector, Explorer o Fan. Cada criterio selecciona el Top 10 de todos los usuarios; los empates se resuelven por nivel, Bricks y finalmente ID de usuario. Al elegir un rasgo DNA, las filas muestran exclusivamente su porcentaje y nombre, incluido 0 % para Newbie; Nivel y Colección conservan los dos rasgos principales o el texto Newbie. `GET /api/ranking?criterio=coleccion` acepta `nivel`, `coleccion`, `rarityHunter`, `collector`, `explorer` y `fan`; omitir el parámetro conserva Nivel. La posición del panel principal sigue usando Nivel. Antes de desplegar esta versión, reaplica el esquema completo en Supabase para actualizar la RPC `ranking_global(p_criterio text default 'nivel')`, sus permisos y la proyección del rasgo seleccionado. Las llamadas SQL sin argumentos siguen siendo válidas y los porcentajes DNA completos permanecen privados. Las pruebas automatizadas cubren la API con el mock y la selección y permisos SQL con PGlite; no sustituyen la verificación del entorno remoto autorizado.

### Desarrollo local en cualquier rama

No hace falta mergear a `main` ni desplegar en Render: el servidor sirve el código de la rama que tengas activa. `npm start` sigue funcionando; para reiniciar automáticamente el servidor cuando cambien sus módulos, usa Node.js 22 o posterior y:

```bash
npm run dev
```

Después de modificar HTML, CSS o JavaScript del navegador, recarga la página. En PowerShell con scripts bloqueados puedes usar `npm.cmd run dev` y `npm.cmd start`.

**Configuración necesaria en Supabase (una sola vez por proyecto):**

En **Authentication › URL Configuration**, conserva la URL de producción de Render en **Site URL** y sus entradas existentes en **Redirect URLs**. Añade estas entradas a **Redirect URLs** y guarda los cambios:

```text
http://localhost:3000/**
http://127.0.0.1:3000/**
```

La aplicación solicita volver al origen y ruta desde donde iniciaste sesión. Si Supabase no permite esa URL, puede usar el **Site URL** como destino y enviarte a Render. Los patrones anteriores incluyen la barra final y las rutas locales; no uses comodines para la URL de producción. Esta lista se configura en Supabase, no en `sup.env`, y no requiere un despliegue.

Si el puerto 3000 está ocupado, añade también `http://localhost:3001/**` y `http://127.0.0.1:3001/**` en Supabase y arranca así en PowerShell:

```powershell
$env:PORT = '3001'
npm.cmd run dev
```

En ese caso abre `http://localhost:3001/`. En Google Cloud conserva como URI de redirección autorizada el callback de Supabase (`https://<PROJECT_REF>.supabase.co/auth/v1/callback`), no el localhost de la aplicación.

**Datos y verificación:** el código es local, pero los datos siguen en el proyecto Supabase configurado. Si usas las mismas credenciales que Render, las altas, cambios, borrados y regalos afectan a los mismos datos. Para aislar las pruebas, usa un proyecto Supabase de desarrollo, aplica `supabase/schema.sql`, habilita Google y configura sus URLs locales antes de poner sus credenciales en `sup.env`. Las variables de entorno `SUPABASE_URL` y `SUPABASE_ANON_KEY` tienen prioridad sobre ese fichero.

Para comprobarlo, abre la URL local e inicia sesión con Google: al terminar debes seguir en el mismo localhost y puerto. Si vuelves a Render, revisa las **Redirect URLs** del proyecto indicado por `SUPABASE_URL`. Un cambio de esquema de la spec requiere aplicarlo en ese proyecto Supabase, aunque no despliegues el código en Render.

Las peticiones a Brickset se serializan y respetan un intervalo mínimo global de 9 segundos. Puede ajustarse con `BRICKSET_MIN_INTERVAL_MS`; la sincronización masiva se ejecuta en segundo plano y expone su progreso en la interfaz.

### Corrección puntual de nombres y descripciones de Brickset

Esta herramienta de mantenimiento corrige `nombre` y `descripcion` de todas las minifiguras existentes de todos los usuarios del proyecto elegido. No es un proceso nocturno ni una ruta de la aplicación. Consulta cada ID distinto una vez por ejecución, pagina los IDs y respeta el intervalo de Brickset de 9 segundos; no depende del precio, categoría o año publicados. Usa las mismas reglas de separación del campo `Name` que el alta de figuras.

El script espera hasta 30 segundos por petición y reintenta los fallos de red o timeout hasta dos veces más, manteniendo el intervalo de 9 segundos entre peticiones. Los mensajes de error de red pueden corresponder a intentos intermedios recuperados: solo `failedIds` en el resumen final identifica los IDs que no pudieron resolverse. Si quedan fallos, puedes repetir la vista previa sin modificar datos; el modo de aplicación también es reejecutable. Estos ajustes son exclusivos de esta herramienta y no cambian los límites del worker nocturno.

1. Antes de aplicar cambios en producción, crea un respaldo recuperable de `public.minifiguras` con su clave `(user_id, id)` y los textos originales. La corrección reemplaza también nombres y descripciones antiguos personalizados. Pausa el cron de Brickset mientras ejecutas la herramienta para evitar consultas paralelas desde otro proceso.
2. Aplica únicamente `supabase/brickset-name-correction.sql` en el SQL Editor del proyecto destino. Instala dos RPC temporales restringidas a `service_role`: lectura de IDs únicos y actualización de los dos campos de texto. No amplía permisos de clientes ordinarios ni forma parte de `schema.sql`.
3. Usa un archivo de credenciales privado, fuera de Git (puede ser el `sup.env` existente si apunta a producción), con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. El script lee exclusivamente ese archivo, sin heredar credenciales de otro proyecto desde variables del proceso. No pegues la clave en comandos ni logs.
4. Ejecuta primero la vista previa, que consulta Brickset y muestra los valores propuestos sin escribir filas:

```powershell
node scripts/correct-brickset-names.js --env-file sup.env
```

Para reintentar solo los fallidos, copia sus IDs del `failedIds` mostrado por la pasada anterior y pásalos separados por comas. Por ejemplo, para consultar únicamente DIM030:

```powershell
node scripts/correct-brickset-names.js --env-file sup.env --ids DIM030
```

`--ids` también admite varios IDs, como `--ids DIM030,CAS056`, y se puede combinar con `--apply --confirm-project PROJECT_REF_PROD` para aplicar solo a esa selección. El script sigue leyendo las páginas de IDs existentes en Supabase, pero no consulta Brickset ni escribe para los demás. Rechaza listas vacías o inválidas en lugar de ejecutar una pasada completa. El resumen anterior no se guarda automáticamente: usa los IDs impresos en consola. Una vista previa, incluso correcta, no ha aplicado los resultados previos a la BD.

5. Comprueba el destino mostrado y las propuestas. Para aplicar, confirma explícitamente el `project-ref` del dominio `https://<project-ref>.supabase.co`:

```powershell
node scripts/correct-brickset-names.js --env-file sup.env --apply --confirm-project PROJECT_REF_PROD
```

La aplicación vuelve a consultar Brickset; ambas pasadas pueden durar varios minutos. Cada RPC actualiza atómicamente las filas todavía existentes del ID en todas las cuentas, solo si sus textos son distintos. No inserta figuras ni modifica precios, categorías, estado, fechas de compra/registro o gamificación. Un ID no resuelto conserva sus textos y aparece en `failedIds`; esos fallos permiten continuar y producen código de salida 1. Un fallo de BD detiene la ejecución sin declarar éxito: los IDs ya aplicados quedan corregidos y se puede reejecutar, porque las escrituras son idempotentes. El resumen distingue IDs consultados de filas realmente modificadas.

6. Verifica el resultado, conserva el respaldo según la política de producción y elimina las RPC temporales en el SQL Editor. Después puedes reactivar el cron:

```sql
drop function if exists public.leer_correccion_nombres_brickset(text, integer);
drop function if exists public.aplicar_correccion_nombres_brickset(text, text, text);
notify pgrst, 'reload schema';
```

### Despliegue de analítica histórica

El cambio de esquema es aditivo. Antes de desplegar código, aplica `supabase/schema.sql` en el Supabase autorizado y verifica las tablas, RLS, grants y RPC con sus pruebas SQL. Mantén desactivado el proveedor cron durante esa migración. Configura `SUPABASE_SERVICE_ROLE_KEY` y `CRON_SECRET` en el gestor de secretos del backend; `sup.env.example` contiene solo nombres y placeholders. No guardes el bearer en Git, navegador, parámetros de URL ni logs.

El worker requiere un backend Node residente y una sola instancia, ya que comparte el limitador serial de Brickset con la sincronización ordinaria. No despliegues este worker como función efímera ni escales a varias instancias sin un limitador distribuido. El backend recupera trabajos pendientes al arrancar; si el lease del worker anterior sigue vigente, espera e intenta reclamarlo de nuevo hasta que venza o el trabajo deje de estar activo. Al cerrar, deja que el lease caduque; no borres tablas para reiniciarlo.

Antes de activar el horario:

1. Envía manualmente `POST https://<HOST>/api/cron/daily-sync` con `Authorization: Bearer <CRON_SECRET>` desde un cliente HTTPS autorizado. No incluyas cuerpo, usuario ni fecha.
2. Comprueba el `202` y guarda el `jobId`; consulta `GET https://<HOST>/api/cron/daily-sync/<jobId>` hasta ver `completed` o `failed`. Repetir POST mientras siga activo devuelve el mismo trabajo. Tras completar, una nueva ejecución del mismo día vuelve a procesar estado actual y actualiza la fila existente por usuario/fecha.
3. Valida el historial propio desde dos cuentas de prueba distintas y confirma que cada una solo ve sus snapshots y baseline; una cuenta sin figuras debe mostrar nivel `0` y DNA en ceros.
4. Configura el proveedor cron para llamar por HTTPS cada día a las 04:00 de `Europe/Madrid` (zona IANA, con horario de verano) y guarda allí el secreto como cabecera `Authorization`, no en una URL.
5. Monitoriza el estado final: `202` significa aceptado, no completado. Alerta ante `failed`, un trabajo `running` estancado, o fallos/duración de scraping; consulta el endpoint de estado con el mismo secreto.

**Rollback no destructivo:** desactiva primero el cron externo, espera a que el trabajo activo termine o detén el backend para que el lease pueda expirar y despliega la versión anterior. Rota o elimina `CRON_SECRET` del proveedor y del backend; si se revierte el worker, revoca solo el `EXECUTE` de sus RPC diarias y conserva lo necesario para el reconciliador de categorías. No elimines `user_daily_snapshots` ni los metadatos de runs automáticamente. Para reactivar, reaplica el esquema aditivo y rota el secreto fuera de Git. La lectura histórica puede seguir desplegada o revertirse por separado sin borrar mediciones.

### Ranking social y buscadas

Cada fila del Ranking Global ofrece **Ver logros**. Abre un modal de solo lectura con el nombre público completo del coleccionista, sin cambiar el nivel, progreso ni Bricks del usuario activo.

`GET /api/ranking/:userId/logros` exige `Authorization: Bearer <JWT>` y devuelve únicamente usuarios del Top 10 vigente:

```json
{
  "userId": "00000000-0000-4000-8000-00000000000b",
  "displayName": "Grace",
  "bricks": 200,
  "nivel": { "id": 4, "nombre": "Citizen" },
  "logros": []
}
```

Cada logro puede exponer `id`, `type`, `nombre`, `descripcion`, `bricks`, `repetible`, `cantidad` y `total`, nunca donantes, correo ni metadatos privados. La consulta no recalcula ni escribe gamificación. Errores: `401 NO_AUTENTICADO`, `400 USUARIO_INVALIDO`, `404 USUARIO_NO_ENCONTRADO` (también si sale del Top 10), `500 LOGROS_NO_DISPONIBLES`; métodos distintos de GET devuelven 405.

Las tarjetas Top 3 por precio y antigüedad de otros usuarios muestran una lupa con más solo si el ID no existe en el catálogo completo propio, ni en `COLECCIÓN` ni en `BUSCADA`, independientemente de filtros o página. El alta rápida abre el modal con ID deshabilitado y sombreado, metadatos e imagen precargados, Nombre y Descripción vacíos, BUSCADA fijo y seguimiento editable. Nombre es obligatorio; Descripción es opcional. No copia datos personales ni compras del propietario. Guardar usa el `POST /minifiguras` existente y crea un registro del usuario autenticado; `409 ID_DUPLICADO` no sobrescribe datos. El límite de seguimiento sigue siendo diez figuras. Los campos obligatorios muestran sus asteriscos en rojo; la edición propia mantiene estado, seguimiento y compra editables según las reglas vigentes.

**Despliegue:** aplicar primero `supabase/schema.sql` en un Supabase de pruebas autorizado y después en el destino. Después configurar `SUPABASE_SERVICE_ROLE_KEY` solo como secreto backend y desplegar el servidor. El proceso compara la huella del JSON al arrancar y vigila cambios mientras corre; un cambio válido recalcula en una transacción la gamificación existente de todos los usuarios. La RPC está restringida a `service_role`; no abre políticas generales ni habilita consultas privilegiadas en rutas de usuario. Mantener `anon` + JWT para toda operación ordinaria y nunca enviar la clave de servicio al frontend.

Antes de desplegar, verificar en el entorno SQL real que public/anon no pueden ejecutar `ranking_logros`, authenticated solo recibe la proyección del Top 10, las lecturas directas de tablas siguen aisladas por usuario y consultar logros no modifica registros. Registrar los resultados; sin entorno autorizado esta comprobación queda pendiente y bloquea el despliegue, aunque los tests con mock pasen.

**Rollback:** restaurar frontend/backend anteriores y la definición anterior de `ranking_global`; revocar y eliminar `ranking_logros(uuid)` cuando no tenga consumidores. Las buscadas creadas se conservan como registros normales propios. Los tests automatizados usan `test-support/supabase-mock.js`; no validan por sí solos permisos SQL reales.

### DNA de colección

**Filosofía de los logros:** los logros de colección reflejan los requisitos cumplidos por el inventario y los totales conocidos actuales; no son premios permanentes ni un historial de adquisiciones. Se ganan, pierden y recuperan automáticamente al añadir, editar, eliminar o cambiar una figura entre `COLECCIÓN` y `BUSCADA`, al variar los totales de categorías/subcategorías o al desplegar nuevos objetivos que el inventario ya cumple. El recálculo ajusta sus cantidades, Bricks, nivel y progreso; las siguientes consultas de DNA y ranking reflejan el resultado. `repetible: false` significa como máximo una concesión vigente, no que se conserve para siempre. Los regalos recibidos permanecen independientes de estos requisitos y no se pierden por cambios de colección.

Los nuevos logros de primera categoría son The Legend., Heh! There is another one for you!, Change will not come in a single sunrise. y Start Poetry. (10 Bricks por Zelda, Pokémon, Horizon y Minecraft). Los de figura son Mental Breakdown. (SH0129, 3000 Bricks), The Dark Plastic. (SH0002, 1000) y Concrete Savanna. (SH0604, 700). Estos siete no son repetibles. You're shooting for the stars. concede 500 Bricks por categoría con al menos el 50% de su total conocido y Strike!! concede 1200 por categoría completa. Ambos son acumulables y repetibles en categorías distintas; solo cuentan figuras en `COLECCIÓN` y totales conocidos positivos.

**Actualización de usuarios existentes:** aplicar primero el esquema SQL actualizado para incorporar sus pesos DNA y después desplegar y reiniciar el backend con `SUPABASE_SERVICE_ROLE_KEY`. La huella del reconciliador incluye categorías y objetivos: el primer arranque recalcula Bricks, logros, nivel y progreso aunque las categorías no hayan cambiado, conserva regalos y persiste mediante la RPC administrativa existente. Una huella ya aplicada no vuelve a recalcular. DNA se actualiza al consultar los logros recalculados. No se ejecuta desde rutas de usuario y requiere las autorizaciones y verificaciones remotas indicadas abajo.

`GET /gamificacion/dna` requiere `Authorization: Bearer <JWT>` y no acepta un ID de usuario. Calcula en cada lectura las proporciones agregadas de la sesión autenticada; no persiste porcentajes ni modifica logros, Bricks, nivel o minifiguras. Responde solo con el principal y las cuatro proporciones:

```json
{
  "principal": "Collector",
  "porcentajes": {
    "rarityHunter": 20,
    "explorer": 10,
    "collector": 50,
    "fan": 20
  }
}
```

Si no hay contribuciones de logros de colección, el resultado es `Newbie` con cuatro ceros; los regalos no contribuyen al DNA. El principal se elige sobre las contribuciones exactas, con prioridad de empate `Explorer > Collector > Fan > Rarity Hunter`, antes de redondear. La leyenda del modal muestra Rarity Hunter en amarillo, Explorer en rojo, Collector en azul y Fan en verde. El ranking público expone únicamente `dnaPrincipal`; no revela porcentajes ajenos. Los errores son `401 NO_AUTENTICADO` y `500 DNA_NO_DISPONIBLE`.

**Migración y despliegue DNA:** ejecutar el `supabase/schema.sql` completo primero en un Supabase de pruebas expresamente autorizado. La actualización crea y siembra de forma idempotente `dna_ponderaciones`, instala el helper privado y las RPC, y reemplaza `ranking_global()` dentro de una transacción sin `CASCADE`. Antes de desplegar, verificar con roles reales que `anon` no ejecuta las RPC, `authenticated` solo consulta su DNA, la matriz/helper son inaccesibles, el ranking solo incluye el principal y las políticas RLS existentes siguen aislando las tablas. PGlite y el mock son controles locales, no sustituyen esta autorización ni las pruebas remotas. Después de superar esas comprobaciones y contar con autorización explícita del destino, desplegar backend y luego frontend. Sin un entorno de prueba autorizado, mantener pendiente la verificación y bloqueado cualquier despliegue.

**Rollback DNA:** restaurar primero frontend/backend y la firma/permisos anteriores de `ranking_global()` en una transacción; revocar y retirar `gamificacion_dna()` y el helper cuando no tengan consumidores. Retirar `dna_ponderaciones` solo después de comprobar dependencias. No borrar ni reescribir logros, Bricks, regalos o minifiguras: DNA se calcula al consultar y no requiere backfill.

### Poblar miniPeopleDB_prueba con veinte coleccionistas

Estos scripts son exclusivamente para el proyecto Supabase **miniPeopleDB_prueba**, con `supabase/schema.sql` aplicado. Comprueba el nombre del proyecto en el Dashboard antes de ejecutarlos; no hay una deteccion automatica del proyecto destino.

1. En SQL Editor, ejecuta completo `supabase/insert-miniPeopleDB-prueba.sql` como `postgres`. Anade veinte usuarios ficticios a los existentes, con perfiles publicos, entre tres y nueve figuras en coleccion y una buscada por usuario, seguimiento, regalos entre ellos, Bricks, logros, nivel, siguiente nivel y progreso coherentes. Los importes y metadatos son datos sinteticos; las imagenes se obtienen por los IDs como en la app. Estos usuarios no tienen contrasena ni identidad Google y no sirven para probar login.
2. Recarga la app en `http://localhost:3002/` para ver el Ranking Global. Con veintidos usuarios, solo se muestran los diez con mas Bricks; las cuentas reales pueden quedar fuera del Top 10.
3. Para retirar esos datos, ejecuta completo `supabase/rollback-miniPeopleDB-prueba.sql`. Solo borra los veinte UUID reservados que conservan la marca `lego-13-prueba-v1` y su correo ficticio; sus figuras, perfiles, gamificacion y enlaces de regalos se eliminan por cascada. Conserva las cuentas originales y sus datos no relacionados con estos usuarios.

Ambos scripts usan transacciones. El insert rechaza una segunda ejecucion o colisiones de UUID/correo: ejecuta primero el rollback para volver a poblar. El rollback se puede repetir, pero rechaza UUIDs de usuarios ajenos y regalos de los ficticios a cuentas no ficticias, para no dejar sus Bricks incoherentes. Si hay un error y SQL Editor conserva la transaccion abierta, ejecuta `ROLLBACK;` antes de continuar. No se necesitan claves de servicio.

La prueba de `test/supabase.test.js` ejecuta estos SQL con PostgreSQL embebido (PGlite), usa el mock de Supabase para validar los repositorios y compara gamificacion con el calculo real de la app. Verifica tambien reejecucion, colisiones, Top 10 y conservacion de las cuentas originales. No ejecuta cambios en Supabase remoto ni sustituye la validacion del esquema Auth de tu proyecto.