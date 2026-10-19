# Proposal

## Why

MiniPeopleDB permite comparar colecciones y recibir notificaciones, pero no ofrece una red de contactos ni una vista consolidada para descubrir y conocer a otros coleccionistas. Este cambio habilita solicitudes de amistad y perfiles ajenos consultables, manteniendo las operaciones vinculadas a la sesión autenticada y los datos privados fuera de las proyecciones públicas.

## What Changes

- Añadir búsqueda parcial de usuarios, solicitudes de amistad, aceptación/rechazo, lista de amigos y estados persistentes de solicitudes.
- Añadir un modal de amigos con pestañas para amigos, buscador, solicitudes enviadas y recibidas; habilitar perfiles ajenos desde estas listas y desde rankings.
- Añadir un perfil ajeno de solo lectura con Top 5 por precio y antigüedad, DNA agregado, Bricks, resumen y últimas figuras de colección/búsqueda y cinco logros según el orden existente.
- Generar notificaciones al recibir y aceptar solicitudes, con aceptación rápida desde la bandeja; rechazar no notifica al emisor y una solicitud rechazada puede aceptarse posteriormente, sin permitir reenviarla.
- Asignar nombres únicos `ColeccionistaN` a las cuentas legadas sin onboarding que conserven el nombre predeterminado, ordenados por registro.
- Igualar las filas de Amigos y Buscador al resumen visual de los rankings, incluyendo imagen de nivel, DNA resumido y total de colección, sin acordeón ni regalos.
- Mostrar contadores reales de amistades y solicitudes en las pestañas y sustituir el contador estático del botón Amigos por el total de la sesión conectada.
- Destacar en negrita el username en las notificaciones de amistad y usar `friends.png` para su acción rápida de aceptación.
- Permitir eliminar una amistad desde las filas que representen amigos; eliminar recíprocamente la relación y la solicitud aceptada para permitir una nueva solicitud.

## Capabilities

### New Capabilities
- `amigos`: búsqueda de coleccionistas, relaciones y solicitudes de amistad, y consulta autenticada del resumen de perfil ajeno.

### Modified Capabilities
- `perfil-usuario`: migrar nombres predeterminados de cuentas legadas sin onboarding a nombres secuenciales únicos.
- `notificaciones`: incorporar eventos de amistad y acción rápida de aceptación con actualización de estado.
- `interfaz-web-minifiguras`: añadir el modal de amigos y perfiles ajenos, así como sus puntos de entrada desde rankings.
- `persistencia-supabase`: permitir consultas autenticadas de resultados de búsqueda y perfiles ajenos mediante proyecciones limitadas, y persistir amistades/solicitudes con aislamiento y cambios atómicos.

## Impact

- Backend: nuevas rutas y repositorio social junto a `src/server.js`, `src/ranking-repository.js`, `src/notificaciones-repository.js` y `src/user-profile-repository.js`.
- Supabase: migración de solicitudes/relaciones, operaciones atómicas de estado y notificaciones, y proyecciones autenticadas limitadas para búsqueda y perfiles ajenos; sin lectura directa de tablas privadas ni `service_role`.
- Frontend: `public/index.html`, `public/app.js` y `public/styles.css` para pestañas, filas, perfiles y acción de notificación.
- Validación: pruebas API con `test-support/supabase-mock.js`, cobertura de persistencia/autorización en PGlite y pruebas web de flujos, estados y navegación accesible.

## Assumptions

- Una solicitud rechazada permanece asociada a la pareja de usuarios: quien la recibió puede aceptarla más tarde, pero el emisor no puede crear otra solicitud para sortear ese estado. El rechazo no genera notificación.
- Todo usuario autenticado puede consultar el resumen de perfil ajeno solicitado. Las respuestas no incluyen correo, preferencias privadas ni ponderaciones DNA individuales.
- Si un nombre `ColeccionistaN` ya está ocupado, la migración continúa con el siguiente sufijo disponible; el orden de registro se desempata de forma determinista.
- “Últimas figuras” se ordenan por fecha de registro descendente; los Tops y los logros conservan sus criterios vigentes.
- El contador de enviados y recibidos incluye solicitudes pendientes y rechazadas, nunca aceptadas. El Buscador no añade contador.
- Eliminar una amistad borra en la misma transacción su solicitud aceptada y las notificaciones sociales vinculadas por cascada; no modifica colecciones, gamificación ni regalos y no genera notificaciones nuevas.