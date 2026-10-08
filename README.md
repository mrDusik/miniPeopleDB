# MiniPeopleDB

MiniPeopleDB es una aplicación web multiusuario para catalogar, valorar y compartir colecciones de minifiguras LEGO. Incluye un dashboard servido por Express, una API REST y gamificación social. La interfaz está en español; los datos de colección y progreso se aíslan por usuario.

El proyecto se desarrolla con **Spec-Driven Development**: los requisitos se mantienen en OpenSpec y las funcionalidades cuentan con pruebas automatizadas.

---

## 🚀 Características Principales

* **Colección e inventario:** alta, consulta, edición y borrado de minifiguras; categorías y subcategorías Brickset; estados `COLECCIÓN` y `BUSCADA`; fecha de alta, datos de compra e imagen de cada figura. Las altas y ediciones validan IDs, importes, fechas y la relación categoría-subcategoría.
* **Búsqueda y seguimiento:** filtros por ID, nombre, categoría, subcategoría, año, estado y observación. La búsqueda de la tabla se aplica sobre la colección cargada en el navegador; incluye ordenación, paginación y un límite de diez figuras observadas.
* **Resumen y valoración:** valor total en euros, contadores de colección y buscadas, galería de observación y destacados Top 5 por precio y antigüedad. El valor de mercado Brickset tiene prioridad sobre el precio de compra; las buscadas no aportan al total.
* **Sincronización Brickset:** consulta individual de categoría, subcategoría, año y precio; actualización masiva del precio en segundo plano, con progreso, pausa/reanudación, resultados parciales, límite global de peticiones y tratamiento de `429 Retry-After`.
* **Gamificación:** Bricks, niveles, progreso y logros calculados a partir del inventario y el catálogo de categorías. Los regalos recibidos se conservan al recalcular la parte derivada de la colección.
* **DNA de colección:** cuatro rasgos (Rarity Hunter, Collector, Explorer y Fan), porcentajes privados para el usuario y un resumen público limitado al rasgo principal.
* **Ranking social:** Top 10 global ordenable por nivel, tamaño de colección o rasgo DNA; perfil público reducido, destacados de cada colección, logros de solo lectura y regalos únicos de 50 Bricks. Los destacados ajenos ausentes se pueden añadir a las propias buscadas sin editar datos de terceros.
* **API REST:** respuestas JSON y errores de negocio controlados; recursos de datos autenticados y aislamiento de colección por usuario.
* **Analítica histórica:** capturas diarias privadas de valor, figuras, Bricks, nivel y DNA; gráficas y tablas accesibles sin reconstruir días ausentes.

### Valoración y moneda

Todos los importes se expresan exclusivamente en Euros (€). Cada minifigura puede incluir en su raíz:

* `precioCompra`: precio pagado, opcional y no negativo.
* `fechaCompra`: fecha opcional con formato `YYYY-MM-DD`.
* `precio`: valor actual obtenido de Brickset, opcional y no negativo.

El valor total solo incluye figuras `COLECCIÓN`. Para cada una se prioriza `precio` y se usa `precioCompra` como alternativa cuando no hay precio de Brickset. Las figuras `BUSCADA` se contabilizan, pero no contribuyen al total ni a los rankings.

La consulta usa scraping/fetch directo de `https://brickset.com/minifigs/<ID>` y extrae `Current Value - New`. Si una consulta falla, se conserva el precio anterior.

---

## Arquitectura e integraciones

* **Aplicación:** Node.js con módulos ES, Express 5 y frontend estático sin framework: HTML semántico, CSS y JavaScript del navegador. Supabase JS y Chart.js se sirven como recursos locales en `/vendor/supabase.js` y `/vendor/chart.js`.
* **Identidad:** Supabase Auth delega el inicio de sesión en Google OAuth con flujo PKCE. La API valida el bearer token con Supabase Auth.
* **Persistencia:** Supabase Postgres almacena minifiguras, gamificación, perfiles públicos, ponderaciones DNA y regalos. RLS limita las operaciones ordinarias a la identidad autenticada.
* **Acceso administrativo:** `SUPABASE_SERVICE_ROLE_KEY` se usa exclusivamente desde el proceso backend para las RPC allowlisted del recálculo de categorías y del worker de analítica diaria. No se entrega al navegador ni se usa en rutas ordinarias; estas conservan `anon` + JWT y RLS.
* **Brickset:** el backend lee páginas públicas de `brickset.com` mediante `fetch` y extrae campos de minifigura; no utiliza una API key. Las peticiones se serializan globalmente y, por defecto, esperan al menos 9 segundos entre inicios.
* **Catálogo de categorías:** `data/categorias-brickset.json` es la fuente local validada. Se puede actualizar manualmente desde la página pública de categorías de Brickset con `node scripts/sync-brickset-categorias.js`.
* **Imágenes:** las imágenes de minifiguras se cargan desde el CDN de BrickLink (`img.bricklink.com`); logos, iconos, niveles y otros recursos de la interfaz son locales en `public/`.
* **Despliegue y monitorización:** el servidor escucha en `PORT` (3000 por defecto) y ofrece `GET /health` para comprobaciones de salud, por ejemplo desde Render o UptimeRobot. No hay manifiesto de despliegue ni pipeline CI de tests en este repositorio.
* **Calidad:** `node:test` y `node:assert` para pruebas, JSDOM para flujos DOM y PGlite para validar SQL/RPC localmente. Los tests de API usan `test-support/supabase-mock.js`; no requieren credenciales ni red real.
* **Especificación:** OpenSpec mantiene las capacidades en `openspec/specs/`, junto con propuestas activas/archivadas en `openspec/changes/`. GitHub Actions contiene los pasos de preparación de OpenSpec para Copilot, no un workflow de CI de la aplicación.

### Seguridad y privacidad

Las rutas de colección, gamificación e histórico propio requieren `Authorization: Bearer <token>` y operan con el cliente `anon` más el JWT del usuario. Las tablas privadas tienen RLS por usuario. El ranking y los logros públicos usan proyecciones limitadas; no publican correos, compras ni la distribución DNA completa. Las únicas excepciones privilegiadas son el reconciliador backend de categorías y el worker diario autenticado por `CRON_SECRET`; ambos se limitan a sus RPC allowlisted y no se exponen en rutas ordinarias ni en el navegador.

## API principal

| Ruta | Métodos | Acceso | Uso |
| --- | --- | --- | --- |
| `/` y recursos de `public/` | `GET` | Público | Dashboard y activos estáticos |
| `/health` | `GET` | Público | Health check para hosting/monitorización |
| `/config/supabase` | `GET` | Público | URL y clave pública `anon` del proyecto |
| `/categorias` | `GET` | Público | Catálogo local validado de categorías |
| `/minifiguras` | `GET`, `POST` | Autenticado | Listar/filtrar la colección propia y crear registros |
| `/minifiguras/:id` | `PUT`, `DELETE` | Autenticado | Editar o borrar una figura propia |
| `/minifiguras/:id/observada` | `PUT` | Autenticado | Activar/desactivar seguimiento |
| `/minifiguras/:id/brickset` | `GET` | Autenticado | Consultar metadatos y precio Brickset |
| `/valoracion` y `/valor-total` | `GET` | Autenticado | Resumen, destacados y observadas |
| `/sincronizacion/brickset` | `GET`, `POST`, `PATCH` | Autenticado | Consultar/iniciar tarea y pausar/reanudarla |
| `/gamificacion` y `/gamificacion/dna` | `GET` | Autenticado | Estado propio de gamificación y DNA |
| `/api/ranking` | `GET` | Autenticado | Top 10 global con criterio opcional |
| `/api/ranking/:userId/logros` | `GET` | Autenticado | Logros públicos del Top 10 |
| `/api/ranking/regalar` | `POST` | Autenticado | Enviar regalo único de Bricks |
| `/api/cron/daily-sync` | `POST` | `CRON_SECRET` | Iniciar o reutilizar un trabajo durable; devuelve `202` antes de terminar |
| `/api/cron/daily-sync/:jobId` | `GET` | `CRON_SECRET` | Consultar estado agregado `pending`, `running`, `completed` o `failed` |
| `/api/analytics/history` | `GET` | JWT propio | Leer snapshots propios por rango y baseline |

Los estados de colección aceptados son `COLECCIÓN` y `BUSCADA`. Los filtros de nombre e ID se aplican en el cliente sobre el catálogo cargado; los parámetros de `GET /minifiguras` también están disponibles para consumidores de la API.

### Analítica histórica diaria

El trigger externo inicia `POST /api/cron/daily-sync` con `Authorization: Bearer <CRON_SECRET>` y sin cuerpo ni parámetros que seleccionen usuario o fecha. Una respuesta `202` contiene `{ "jobId", "status", "snapshotDate" }`: confirma que el trabajo quedó persistido, **no** que la captura haya terminado. Consulta `GET /api/cron/daily-sync/:jobId` con el mismo secreto para obtener `processedUsers`, `totalUsers`, `failedPrices` y el estado terminal. Solo `completed` incluye `result: { "success": true, "processedUsers": N, "timestamp": "...Z" }`; `failed` no informa éxito ni errores internos. La fecha lógica se fija una vez al iniciar según `Europe/Madrid` y permanece igual si el proceso cruza medianoche.

El worker procesa todas las cuentas de Supabase Auth, también las que no tienen colección: su snapshot inicial contiene cero figuras, valor, Bricks y porcentajes DNA, con nivel Duplo `0`. Los precios Brickset se comparten por ID en una caché privada global durante 24 horas: cada run reutiliza los precios frescos y consulta solo IDs nuevos o caducados, respetando el límite global del scraper. Al desplegar la caché se inicializa, cuando existen, desde checkpoints exitosos de las últimas 24 horas. Un fallo al refrescar conserva el último precio válido y solo cuenta en `failedPrices` si se intentó consultar ese ID caducado. Valor de colección usa precio Brickset y, como alternativa, precio de compra; `BUSCADA` no cuenta. Cada fila es única por usuario/fecha y una repetición del mismo día actualiza esa fila sin cambiar días anteriores. No existe backfill de snapshots. Estos representan el estado coherente de cada cuenta al procesarla, no una fotografía global simultánea a las 04:00.

El proceso ocurre en fases: (1) al recibir el POST, fija la fecha de Madrid y persiste el roster de Auth y los IDs distintos de sus inventarios; (2) copia al inventario los precios cacheados con hasta 24 horas y marca esos IDs completados sin llamar a Brickset; (3) consulta secuencialmente solo los IDs ausentes o caducados, guarda cada resultado válido en la caché y checkpoint, y conserva el valor anterior si falla; (4) cuando termina la fase de precios, recalcula cada usuario con sus figuras y regalos y confirma gamificación, DNA, snapshot y checkpoint en una transacción; (5) publica `completed` solo cuando todos los usuarios elegibles están capturados. Las escrituras tardan como mínimo unos 9 segundos por cada ID que realmente requiere consulta externa, más la latencia y posibles esperas de `Retry-After`; por ejemplo, 329 IDs caducados implican al menos unos 49 minutos. Un segundo run con esos precios aún frescos evita esas consultas. Los heartbeats renuevan el lease durante la espera y el worker recupera checkpoints tras reiniciar.

`GET /api/analytics/history?from=YYYY-MM-DD&to=YYYY-MM-DD` usa el JWT normal y solo consulta el propio historial mediante RLS. Si se omiten fechas, `to` es hoy en Madrid y `from` son los 89 días anteriores; el máximo inclusivo es 366 días. Devuelve snapshots existentes en orden ascendente y el último baseline propio anterior al rango. Los días ausentes no se inventan: el cambio neto solo se calcula contra una medición del día calendario anterior, admite descensos y no representa altas brutas. El nivel es el identificador numérico vigente y puede disminuir; cuatro porcentajes DNA cero permanecen cero. Los cambios posteriores de pesos no reescriben snapshots históricos.

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

### Despliegue de analítica histórica

El cambio de esquema es aditivo. Antes de desplegar código, aplica `supabase/schema.sql` en el Supabase autorizado y verifica las tablas, RLS, grants y RPC con sus pruebas SQL. Mantén desactivado el proveedor cron durante esa migración. Configura `SUPABASE_SERVICE_ROLE_KEY` y `CRON_SECRET` en el gestor de secretos del backend; `sup.env.example` contiene solo nombres y placeholders. No guardes el bearer en Git, navegador, parámetros de URL ni logs.

El worker requiere un backend Node residente y una sola instancia, ya que comparte el limitador serial de Brickset con la sincronización ordinaria. No despliegues este worker como función efímera ni escales a varias instancias sin un limitador distribuido. El backend recupera trabajos pendientes al arrancar y deja que un lease caduque al cerrar; no borres tablas para reiniciarlo.

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