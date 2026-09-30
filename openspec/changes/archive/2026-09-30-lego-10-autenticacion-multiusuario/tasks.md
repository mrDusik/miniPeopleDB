# Tasks

## 1. Configuración y soporte de pruebas

- [x] 1.1 Añadir `.gitignore` con `sup.env`, `.env*` y `node_modules/`; verificar con `git check-ignore sup.env` que queda excluido
- [x] 1.2 Refactorizar `src/services/supabase.js` a `getSupabaseConfig()` (variables de entorno con fallback a `sup.env`, `null` si no hay configuración, sin lanzar al importar); verificar con un test unitario que importar el módulo sin `sup.env` no falla y que las variables de entorno tienen prioridad
- [x] 1.3 Crear `test-support/supabase-mock.js` con cliente en memoria (query builder `from/select/insert/update/upsert/delete/eq/order/maybeSingle`, `auth.getUser` por token, aislamiento por `user_id`, inyección de errores y código `23505`); verificar con un test propio del mock

## 2. Repositorios sobre Supabase

- [x] 2.1 Reescribir `MinifigurasRepository` para usar `{ client, userId }` con mapeo fila↔dominio, orden por `fecha_registro` y traducción de errores (`23505`→`IdDuplicadoError`, resto→`CatalogoNoDisponibleError`, fila inválida→`CatalogoInvalidoError`); verificar con pruebas de repositorio en `test/minifiguras.test.js` contra el mock (listado, filtros, alta, duplicado, edición, borrado, no encontrada, observadas y límite 10, `updatePrices`, campos opcionales omitidos)
- [x] 2.2 Reescribir `GamificacionRepository` para leer/`upsert` en `gamificacion` con mapeo `siguienteNivel`↔`siguiente_nivel`; verificar con `test/gamificacion-repository.test.js` (estado inexistente → cálculo inicial persistido, recálculo tras mutación, estado inválido → error)

## 3. API autenticada

- [x] 3.1 Añadir `GET /config/supabase` y servir `/vendor/supabase.js` desde el build UMD; verificar con pruebas HTTP (`200` con solo `url` y `anonKey`, `500 CONFIGURACION_NO_DISPONIBLE` sin configuración, script servido)
- [x] 3.2 Implementar middleware de autenticación (Bearer → cliente por petición → `auth.getUser` → repositorios por petición) aplicado a `/minifiguras*`, `/gamificacion`, `/valoracion`, `/valor-total` y `/sincronizacion/brickset`; `createServer()` acepta `createSupabaseClient` y `supabaseConfig`; verificar con pruebas de `401 NO_AUTENTICADO` sin cabecera y con token inválido, y que `/categorias` sigue público
- [x] 3.3 Adaptar los handlers existentes a los repositorios por petición y actualizar `test/minifiguras.test.js`, `test/gamificacion-api.test.js` y `test/filters-repro.test.js` para sembrar el mock y enviar `Authorization`; verificar que todos los escenarios previos siguen pasando y añadir prueba de aislamiento entre dos usuarios con el mismo `id` y de cuerpo con `user_id` → `400`

## 4. Frontend: sesión con Google

- [x] 4.1 Añadir en `public/index.html` la carga de `/vendor/supabase.js`, la pantalla de acceso con botón "Iniciar sesión con Google" y la zona de usuario con "Cerrar sesión"; estilos en `public/styles.css`; verificar con prueba JSDOM que sin sesión solo se ve la pantalla de acceso y no se piden endpoints de datos
- [x] 4.2 Implementar en `public/app.js` la inicialización del cliente (`/config/supabase`, PKCE), `signInWithOAuth` con `redirectTo` al origen, restauración con `getSession`, `onAuthStateChange` y `signOut` con limpieza de estado; verificar con pruebas JSDOM (clic en login llama al proveedor `google`, sesión existente muestra colección y correo, cerrar sesión vacía datos y muestra acceso, error de OAuth muestra aviso)
- [x] 4.3 Introducir `apiFetch` que añade `Authorization: Bearer` a todas las llamadas de datos y gestiona `401` cerrando sesión; verificar con pruebas JSDOM que las peticiones llevan la cabecera y que un `401` devuelve a la pantalla de acceso
- [x] 4.4 Actualizar `test/web.test.js` y `test/gamificacion-web.test.js` para inyectar `window.supabase` simulado con sesión activa y responder a `/config/supabase`; verificar que las pruebas web existentes pasan sin cambios de comportamiento

## 5. Cierre

- [x] 5.1 Actualizar `AGENTS.md` (persistencia de minifiguras/gamificación en Supabase; categorías en JSON local) y `README.md` (variables `SUPABASE_*`, configuración del proveedor Google y Redirect URLs); verificar revisando el diff
- [x] 5.2 Ejecutar `npm test` completo sin `sup.env` ni variables `SUPABASE_*` y verificar que todo pasa; ejecutar `git diff --check`
- [ ] 5.3 Prueba manual: arrancar el servidor con credenciales reales, iniciar sesión con Google, crear/editar/borrar una minifigura y comprobar en Supabase que las filas llevan el `user_id` del usuario
