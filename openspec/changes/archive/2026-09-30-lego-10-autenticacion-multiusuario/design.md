# Design

## Context

- `src/server.js` crea en `createServer()` los repositorios de minifiguras y gamificación por petición autenticada, ligados al cliente Supabase y al `userId` del token. Toda la validación de dominio (`isMinifigura`, categorías oficiales, límite de 10 observadas, `FechaRegistro`) y el recálculo de gamificación (`onCatalogPersisted` → `recalculate`) viven en esos repositorios.
- `supabase/schema.sql` ya define `minifiguras` (PK `(user_id, id)`, columnas snake_case, `user_id default auth.uid()`) y `gamificacion` (PK `user_id`, columnas `jsonb`), con RLS `auth.uid() = user_id` para `authenticated`.
- `src/services/supabase.js` debe resolver la configuración bajo demanda y devolver `null` cuando no existe; de ese modo importar el módulo no rompe la suite en entornos sin credenciales. `sup.env` debe quedar ignorado por git.
- `public/app.js` es un script clásico sin bundler que usa `fetch` directamente contra rutas relativas. Las pruebas web lo cargan en JSDOM con un `fetch` simulado.
- `@supabase/supabase-js` ya está instalado e incluye un build UMD en `dist/umd/supabase.js`.

## Goals / Non-Goals

**Goals:**
- RLS como barrera real: el servidor nunca usa claves privilegiadas; cada petición usa un cliente con el JWT del usuario.
- Cambios mínimos en el contrato HTTP y en la lógica de dominio existente.
- Suite ejecutable sin red ni credenciales.

**Non-Goals:**
- Cachear catálogos entre peticiones o usuarios.
- Transacciones multi-tabla entre `minifiguras` y `gamificacion` (el estado de gamificación es derivado y se recalcula).

## Decisions

### 1. Autenticación en el navegador con supabase-js UMD servido localmente
Express sirve `node_modules/@supabase/supabase-js/dist/umd/supabase.js` en `/vendor/supabase.js`; `index.html` lo carga antes de `app.js`. `app.js` obtiene `GET /config/supabase`, crea el cliente con `auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }` y usa `signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } })`, `getSession()`, `onAuthStateChange()` y `signOut()`.
- *Alternativa*: CDN (`esm.sh`/jsDelivr) → descartada por dependencia externa en tiempo de ejecución y cadena de suministro; bundler → excesivo para un script único.
- La URL y la clave `anon` se entregan vía endpoint en lugar de incrustarlas en HTML para no duplicar configuración.

### 2. Envoltorio `apiFetch` en el frontend
Todas las llamadas a endpoints de datos pasan por `apiFetch(url, init)` que añade `Authorization: Bearer <access_token>` desde la sesión actual; ante `401` ejecuta `signOut()` y muestra la pantalla de acceso con aviso. `/categorias` puede seguir usando `fetch` directo. El arranque de la app (carga de categorías, catálogo, gamificación, valoración) se mueve a una función `startApp()` invocada solo al tener sesión; al cerrar sesión se limpia el estado en memoria y el DOM de datos.

### 3. Middleware de autenticación en Express
Un middleware aplicado a las rutas de datos:
1. Extrae el token de `Authorization: Bearer`; si falta → `401 NO_AUTENTICADO`.
2. Crea un cliente por petición: `createClient(url, anonKey, { global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false, autoRefreshToken: false } })`.
3. Verifica con `client.auth.getUser(token)`; error o sin usuario → `401`.
4. Construye `request.context = { userId, client, repository, gamificacionRepository }` con repositorios nuevos por petición.

`createServer()` acepta `createSupabaseClient` (por defecto `createClient` de supabase-js) y `supabaseConfig` (por defecto la de `src/services/supabase.js`) para inyección en pruebas. La verificación del token se sustituye inyectando un cliente cuyo `auth.getUser` sea simulado; no existe una función de verificación independiente en el contrato del servidor.
- *Alternativa*: verificar el JWT localmente con el secreto JWT → requiere manejar un secreto adicional en el servidor; `getUser` es más simple y detecta revocaciones.
- *Alternativa*: service role + filtrar por `user_id` en código → descartada: anula RLS.

### 4. Repositorios respaldados por Supabase conservando su API pública
`MinifigurasRepository({ client, userId, categoriasRepository, onCatalogPersisted })` mantiene `readCatalog`, `list`, `findById`, `create`, `replace`, `delete`, `setObserved`, `updatePrices`, `valuationSummary`, etc.
- `readCatalog`: `select(columnas).order('fecha_registro')` → mapeo fila→dominio (snake→camel, `null`→propiedad omitida, `numeric` a `Number`) → `validateCatalogo` existente. La consulta queda limitada por RLS al `userId` del cliente autenticado.
- `create`: valida como hoy, `insert` sin `user_id` (lo rellena `default auth.uid()`); error `23505` → `IdDuplicadoError`.
- `replace`: valida; `update(...).eq('id', id).select()`; 0 filas → `MinifiguraNoEncontradaError`. No se envía `fecha_registro`.
- `delete`: `delete().eq('id', id).select('id')`; 0 filas → no encontrada.
- `setObserved`: lee el catálogo para comprobar el límite de 10 y actualiza una fila. La cola `observationMutation` se mantiene dentro de la instancia (por petición).
- `updatePrices`: `upsert` de las filas completas con `onConflict: 'user_id,id'`, incluyendo `user_id` del contexto (RLS lo verifica).
- Tras cada mutación se lee el catálogo actualizado y se invoca `onCatalogPersisted` como hoy.
- Errores de Supabase distintos de los anteriores → `CatalogoNoDisponibleError`. Se eliminan `persist()` a fichero y las normalizaciones de migración de JSON (`addMissingRegistrationDates`), que ahora garantiza la base de datos.

`GamificacionRepository({ client, userId, categoriasRepository })`: `read` = `select().maybeSingle()` y devuelve `null` si no hay fila; `ensure` interpreta ese caso como estado inexistente, calcula el estado inicial desde el catálogo y lo persiste. `persist` = `upsert({ user_id, bricks, nivel, siguiente_nivel, progreso, logros, updated_at }, { onConflict: 'user_id' })`, mapeando `siguienteNivel`.

### 5. Configuración
`src/services/supabase.js` exporta `getSupabaseConfig()` que devuelve `{ url, anonKey }` desde `process.env.SUPABASE_URL/SUPABASE_ANON_KEY` o, si faltan, desde `sup.env`; devuelve `null` si no hay configuración (sin lanzar al importar). Se añade `.gitignore` con `sup.env` y `.env*`.

### 6. Pruebas con cliente simulado
`test-support/supabase-mock.js` implementa en memoria el subconjunto usado del query builder (`from`, `select`, `insert`, `update`, `upsert`, `delete`, `eq`, `order`, `maybeSingle`, respuesta `{ data, error }` thenable), `auth.getUser` con un mapa token→usuario, y aplica el filtro por `user_id` simulando RLS. Permite inyectar fallos (`failNext`) y códigos (`23505`). Las pruebas de servidor siembran el mock y envían `Authorization`; las pruebas web inyectan `window.supabase.createClient` simulado y responden a `/config/supabase` en su `fetch` falso.

## Risks / Trade-offs

- [Una llamada extra a Supabase Auth por petición (`getUser`)] → Aceptable para el volumen de una colección personal; se podría cachear por token más adelante.
- [Límite de 10 observadas comprobado en dos pasos (leer + actualizar) sin transacción] → La cola por instancia mitiga dentro de una petición; entre peticiones concurrentes del mismo usuario el riesgo es bajo. Se podría mover a una restricción/trigger SQL si fuera necesario.
- [`recalculate` tras cada mutación relee el catálogo completo] → Mantiene el comportamiento existente; aceptable para el volumen de una colección personal.
- [Token almacenado en `localStorage` por supabase-js] → Comportamiento estándar del SDK; mitigado por no introducir `innerHTML` con datos no escapados y mantener `textContent` en el render.
- [Pérdida de acceso a los datos de `data/minifiguras.json` y `data/gamificacion.json`] → Los ficheros se conservan en el repositorio como datos heredados, pero dejan de usarse en tiempo de ejecución; la importación queda fuera de alcance.

## Migration Plan

1. Configurar en Supabase: habilitar proveedor Google (Client ID/Secret de Google Cloud) y añadir `http://localhost:3000` (y dominios de despliegue) a *Redirect URLs*.
2. Asegurar que `schema.sql` está aplicado (RLS ya verificado).
3. Desplegar con `SUPABASE_URL` y `SUPABASE_ANON_KEY` definidos.
4. Rollback: volver al commit anterior; los ficheros JSON siguen intactos.
