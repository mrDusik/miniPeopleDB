# Proposal

## Why

La aplicación persiste un único catálogo y un único estado de gamificación en `data/minifiguras.json` y `data/gamificacion.json`, por lo que no puede servir a varios usuarios ni proteger sus datos. Supabase ya tiene las tablas `minifiguras` y `gamificacion` con RLS activo por `user_id`, así que ahora es posible identificar al usuario con Google OAuth y aislar su colección en la base de datos.

## What Changes

- Añadir inicio y cierre de sesión con Google OAuth (Supabase Auth, flujo PKCE) en la interfaz web, con gestión del estado de sesión (restauración al recargar, refresco de token y reacción a expiración o cierre de sesión).
- La interfaz SHALL enviar el access token de la sesión en `Authorization: Bearer <token>` en todas las llamadas a la API de datos.
- **BREAKING**: Los endpoints de datos (`/minifiguras*`, `/gamificacion`, `/valoracion`, `/valor-total`, `/sincronizacion/brickset`) exigen un usuario autenticado y responden `401` sin token válido. `/categorias` y los estáticos siguen siendo públicos.
- **BREAKING**: `MinifigurasRepository` y `GamificacionRepository` dejan de leer/escribir ficheros JSON locales y pasan a operaciones CRUD contra Supabase usando un cliente por petición autenticado con el JWT del usuario, de modo que RLS aplica en cada consulta. La validación de dominio, el límite de observadas y el recálculo de gamificación permanecen en el servidor.
- Nuevo endpoint público `GET /config/supabase` que expone solo la URL del proyecto y la clave `anon` (públicas por diseño) para inicializar el cliente del navegador.
- La configuración de Supabase se lee de variables de entorno (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) con `sup.env` como alternativa local, y `sup.env` queda excluido del control de versiones.
- La suite de tests sustituye los ficheros temporales de catálogo/gamificación por un cliente Supabase simulado en memoria e inyectable, y añade pruebas de autenticación en API y en la interfaz.
- `AGENTS.md` se actualiza: la persistencia de minifiguras y gamificación pasa a Supabase; las categorías de Brickset siguen en JSON local.

### Non-goals

- Migrar automáticamente el contenido actual de `data/minifiguras.json` / `data/gamificacion.json` a una cuenta concreta.
- Otros proveedores de identidad, roles o compartición de colecciones entre usuarios.
- Mover `data/categorias-brickset.json` a Supabase.

## Capabilities

### New Capabilities

- `autenticacion-usuarios`: Inicio/cierre de sesión con Google, gestión del estado de sesión en la interfaz, envío del token a la API y rechazo de peticiones no autenticadas.
- `persistencia-supabase`: Almacenamiento por usuario del catálogo y del estado de gamificación en Supabase con RLS, mapeo de modelo, errores controlados y cliente inyectable para pruebas.

### Modified Capabilities

- `minifiguras`: La lectura y las mutaciones del catálogo dejan de depender de un archivo JSON local y operan sobre la colección del usuario autenticado; se sustituyen los requisitos de persistencia local y de reproducibilidad basada en archivo.

## Impact

- Código: `src/server.js`, `src/minifiguras-repository.js`, `src/gamificacion-repository.js`, `src/services/supabase.js`, nuevo middleware/módulo de autenticación, `public/app.js`, `public/index.html`, `public/styles.css`.
- API: cabecera `Authorization` obligatoria en endpoints de datos; nuevo `GET /config/supabase`; nuevo error `401 NO_AUTENTICADO`.
- Dependencias: `@supabase/supabase-js` (ya instalada) en servidor; su build UMD servido localmente para el navegador.
- Configuración externa: proveedor Google habilitado en Supabase Auth y URL(s) de redirección de la app registradas.
- Pruebas: `test/minifiguras.test.js`, `test/gamificacion-api.test.js`, `test/gamificacion-repository.test.js`, `test/filters-repro.test.js`, `test/web.test.js`, `test/gamificacion-web.test.js` y nuevo soporte `test-support/supabase-mock.js`.
- Datos: `data/minifiguras.json` y `data/gamificacion.json` dejan de usarse en tiempo de ejecución.
