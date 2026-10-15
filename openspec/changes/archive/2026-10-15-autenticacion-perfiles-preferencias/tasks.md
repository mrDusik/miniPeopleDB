# Tasks

## 1. Modelo relacional y seguridad

- [x] 1.1 Añadir `user_profiles` y la relación de categorías favoritas con referencias a `auth.users`, restricciones de username, unicidad case-insensitive, borrado en cascada y políticas RLS; verificar migración e idempotencia con las pruebas PGlite del esquema.
- [x] 1.2 Implementar la operación SQL autenticada que guarda perfil y conjunto de favoritos atómicamente, impide cambiar username después del onboarding y actualiza el avatar de `perfiles_publicos`; probar aislamiento, conflictos, atomicidad y roles permitidos con PGlite.
- [x] 1.3 Actualizar scripts de reset/fixtures y el mock de Supabase para las tablas y operaciones de perfil; verificar la suite de persistencia sin credenciales reales.

## 2. API de perfil

- [x] 2.1 Añadir lectura y guardado del perfil mediante endpoints autenticados que usen el JWT del usuario, validen favoritos contra el catálogo local y traduzcan errores a respuestas controladas; cubrir éxito, sesión ausente, categoría inválida y username ocupado con `test-support/supabase-mock.js`.
- [x] 2.2 Actualizar la sincronización pública para usar el username autorizado como nombre público, preferir avatar personalizado y conservar el fallback de Google sin exponer email ni preferencias; verificar ranking, regalos y avatar mediante sus pruebas de repositorio/API.
- [x] 2.3 Añadir DELETE autenticado del perfil propio sin parámetros de identidad ni service_role, con RPC SQL restringida a auth.uid(); probar aislamiento, cascada, rollback, errores genéricos y rechazo de selectores mediante API y PGlite.

- [x] 2.4 Usar usernames guardados al crear regalos/agradecimientos y migrar los avisos históricos mediante referencias fiables, sin alterar IDs, lectura, fechas ni recompensas; probar proyección obsoleta, idempotencia, autor desconocido y referencia interna no expuesta.

## 3. Autenticación clásica

- [x] 3.1 Añadir registro con email/Username/contraseña e inicio de sesión solo con Username/contraseña, validación del username y recuperación/cambio de contraseña con Supabase Auth; verificar flujos válidos, errores controlados y ausencia de llamadas de inventario en `test/auth-web.test.js`.
- [x] 3.2 Mantener Google OAuth PKCE y unificar los estados de sesión para proveedores clásicos y Google; verificar restauración, cierre de sesión, expiración y callback de recuperación en las pruebas web de autenticación.
- [x] 3.3 Añadir repetición obligatoria de contraseña, toggle de visibilidad conjunta y reglas dinámicas de cinco caracteres, mayúscula, minúscula y número con estados rojo/verde; verificar rechazo, coincidencia y cambio de modo mediante pruebas web.
- [x] 3.4 Implementar la excepción autorizada de resolución privada de Username con comprobación de contraseña, límite SQL atómico de intentos y cliente anon, seguida de autenticación Supabase; probar API con el mock y RPC con PGlite/pgcrypto, sin permisos de lectura global ni service_role.

## 4. Onboarding y preferencias

- [x] 4.1 Bloquear la inicialización de colección y datos protegidos hasta cargar un perfil completo, evitando que respuestas tardías de otra sesión desbloqueen la aplicación; verificar perfiles completos/incompletos, errores y cambio de usuario en pruebas web.
- [x] 4.2 Implementar el modal obligatorio y la configuración accesible desde el menú con username bloqueado, URL de avatar, Euro/Español activos, opciones futuras deshabilitadas y selección de categorías; verificar validaciones, guardado, reintento y actualización visual.
- [x] 4.3 Asegurar que los cambios de perfil/favoritos se presentan como una sola operación y que errores conservan el formulario sin marcar onboarding completo; verificar fallos parciales con API y pruebas de persistencia.
- [x] 4.4 Reducir el menú de usuario a 190.5px y mostrar el username del perfil en lugar de nombre OAuth/email, conservando dimensiones responsive y tooltip.
- [x] 4.5 Añadir Eliminar cuenta al final de Preferencias con estilo de cierre de sesión y confirmación accesible; probar cancelación, éxito, error/reintento, doble clic y respuesta 401 tardía de otra sesión.

- [x] 4.6 Compactar el modal en Username/avatar, Idioma/Moneda y favoritas; mostrar selección independiente de la búsqueda y contador 0/3 a 3/3 con validación en navegador, API y SQL.
- [x] 4.7 Añadir Cargar, vista previa local y subida JWT al guardar, con PNG/JPEG/WebP hasta 2 MiB; probar formatos/tamaños, cancelación y limpieza tras fallos.
- [x] 4.8 Configurar el bucket y políticas por carpeta, comprobarlas con PGlite y limpiar avatares propios en el borrado de cuenta sin acceso a archivos ajenos.

## 5. Integración

- [x] 5.1 Ejecutar las pruebas focalizadas de auth web, API de perfil, persistencia y ranking, y corregir regresiones del contrato Google/OAuth y del acceso al inventario.
- [x] 5.2 Ejecutar `npm.cmd test` y verificar que todos los criterios de aceptación están cubiertos sin requerir credenciales Supabase reales.