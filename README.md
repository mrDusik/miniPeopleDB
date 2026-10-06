# 🧩 LEGO Minifigures Management API & Dashboard (`lego-mini-api`)

Una solución web completa para la gestión, catalogación y valoración de colecciones de minifiguras LEGO. Combina un servidor **API REST** desarrollado en Node.js/Express con una **interfaz gráfica interactiva (Dashboard)** servida en la raíz.

Desarrollado siguiendo la metodología **Spec-Driven Development (SDD)** asistida por IA.

---

## 🚀 Características Principales

* **Dashboard Interactivo Web (UI):**
  * **Visualización Dinámica:** Tabla interactiva con información de ID, Nombre, Descripción, Temática, Año, Estado, Precio y Diferencia entre precio y precio de compra.
  * **Filtros Avanzados:** Búsqueda en tiempo real por `tema`, `año` y `estado de colección`.
  * **Ordenación:** Las columnas `Año` y `Precio` se pueden ordenar ascendente y descendentemente.
  * **Modales CRUD:** Interfaz mediante diálogos reutilizables para el alta (`POST`) y edición (`PUT`) de registros.
  * **Acciones por Fila:** Botones de edición rápida y borrado seguro con confirmación previa (`DELETE`).
  * **Valoración en Euros:** Formulario con `precioCompra`, `fechaCompra` y `precio` de Brickset, incluyendo consulta individual.
  * **Resumen de colección:** Valor total, contadores de figuras en `COLECCIÓN` y `BUSCADA`, y rankings dinámicos.
  * **Top 5:** Ranking de figuras en colección por precio y ranking de las más antiguas.
  * **Sincronización resiliente:** Actualización masiva desde Brickset con estados de carga, resultados parciales y errores mediante *Toasts*.
  * **Estados controlados:** Solo se permiten `COLECCIÓN` y `BUSCADA`; las nuevas figuras usan `COLECCIÓN` por defecto.
* **API REST Backend:**
  * Endpoints HTTP estructurados con respuestas JSON.
  * Consulta individual de precios mediante scraping de la URL pública de Brickset, sin credenciales ni API Key.
  * Actualización masiva aislada por minifigura, con timeout, reintentos y concurrencia limitada.
  * Manejo estandarizado de errores HTTP y códigos de negocio (`ID_DUPLICADO`, `ID_INVALIDO`, `MINIFIGURA_NO_ENCONTRADA`, `MINIFIGURA_INVALIDA`).
* **Autenticación y persistencia multiusuario (Supabase):**
  * Inicio de sesión con Google (Supabase Auth, flujo PKCE). La interfaz envía el token en `Authorization: Bearer` y la API responde `401 NO_AUTENTICADO` sin sesión válida.
  * Minifiguras y gamificación se guardan por usuario en las tablas `minifiguras` y `gamificacion` (`supabase/schema.sql`), protegidas por RLS. Las operaciones ordinarias usan la clave `anon` con el JWT del usuario. Un reconciliador backend aislado usa `service_role` únicamente para la RPC transaccional de recálculo global tras cambios del JSON de categorías; nunca expone esa clave al navegador ni a rutas de usuario.
  * Las categorías oficiales de Brickset siguen en `data/categorias-brickset.json`.

### Valoración y moneda

Todos los importes se expresan exclusivamente en Euros (€). Cada minifigura puede incluir en su raíz:

* `precioCompra`: precio pagado, opcional y no negativo.
* `fechaCompra`: fecha opcional con formato `YYYY-MM-DD`.
* `precio`: valor actual obtenido de Brickset, opcional y no negativo.

El valor total solo incluye figuras `COLECCIÓN`. Para cada una se prioriza `precio` y se usa `precioCompra` como alternativa cuando no hay precio de Brickset. Las figuras `BUSCADA` se contabilizan, pero no contribuyen al total ni a los rankings.

La consulta usa scraping/fetch directo de `https://brickset.com/minifigs/<ID>` y extrae `Current Value - New`. Si una consulta falla, se conserva el precio anterior.

---

## 🛠️ Tecnologías Utilizadas

* **Backend:** Node.js, Express.
* **Frontend:** HTML5 (semántico y `<dialog>`), CSS3 (Flexbox/Grid y variables CSS), JavaScript ES6+ (`fetch`, manipulación reactiva del DOM).
* **Testing:** Módulo nativo `node:test`/`node:assert` y `jsdom` para pruebas reales del DOM.
* **Metodología:** Spec-Driven Development (OpenSpec / SDD).

---

## 📦 Estructura del Proyecto

```text
mi-proyecto/
├── .github/                  # Configuración y prompts del flujo OpenSpec/IA
│   ├── prompts/
│   └── skills/
├── data/                     # Datos persistentes del proyecto
│   └── minifiguras.json      # Base local de minifiguras
├── openspec/                 # Especificaciones OpenSpec y cambios activos/archivados
│   ├── changes/
│   ├── config.yaml
│   └── specs/
├── public/                   # Aplicación web frontend estática
│   ├── app.js                # Filtros, CRUD, valoración, rankings y toasts
│   ├── index.html            # Estructura del dashboard y formularios
│   └── styles.css            # Estilos visuales, estados y diferencias
├── reviews/                  # Informes de revisión de cada iteración del proyecto
├── src/                      # Código fuente del backend
│   ├── brickset-scraper.js    # Scraping público y parseo de precios Brickset
│   ├── minifiguras-repository.js
│   └── server.js
├── test/                     # Pruebas automatizadas
│   ├── brickset-scraper.test.js
│   ├── minifiguras.test.js
│   └── web.test.js
├── AGENTS.md                 # Guía del flujo del proyecto
├── EFICIENCIA.md             # Informe de productividad y metodología SDD + IA
├── package.json              # Configuración del proyecto y scripts
├── package-lock.json         # Versiones bloqueadas de dependencias
├── README.md                 # Documentación general
└── .gitignore                # Archivos ignorados por Git
```

## ▶️ Ejecución

1. Aplica `supabase/schema.sql` en el SQL Editor de Supabase.
2. En Supabase › Authentication › Providers habilita **Google** (Client ID y Secret de Google Cloud).
3. En Supabase › Authentication › URL Configuration configura las URLs de retorno como se explica abajo.
4. Define `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` como variables de entorno o en `sup.env` (excluido de Git). La clave de servicio es obligatoria para el reconciliador, solo se lee en backend y nunca debe copiarse al navegador, logs o repositorio. El resto de las rutas sigue usando exclusivamente `anon` + JWT y RLS. `SUPABASE_URL` es la URL del proyecto Supabase, no la de Render.

```bash
npm install
npm test
npm start
```

Aplica `supabase/schema.sql` para instalar la RPC de recálculo y sus permisos antes de arrancar. La aplicación queda disponible en `http://localhost:3000`. Los tests no necesitan credenciales reales: las rutas de usuario usan `test-support/supabase-mock.js` y la RPC administrativa se valida con PGlite.

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