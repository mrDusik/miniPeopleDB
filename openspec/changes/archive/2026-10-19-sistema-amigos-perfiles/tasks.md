# Tasks

## 1. Persistencia y migración

- [x] 1.1 Añadir solicitudes y amistades normalizadas, restricciones de pareja/estado, políticas RLS y RPC autenticadas para buscar, consultar y cambiar estados; verificar unicidad, aislamiento, autorización del actor y rollback con PGlite.
- [x] 1.2 Extender los tipos/payloads permitidos de notificación y crear proyecciones limitadas de búsqueda y perfil sin ampliar grants directos; verificar con PGlite que los campos privados y las lecturas cruzadas directas siguen bloqueados.
- [x] 1.3 Implementar el backfill transaccional de usernames `ColeccionistaN` para perfiles incompletos, ordenado por registro y saltando colisiones; verificar idempotencia, coincidencia con `perfiles_publicos` y preservación de perfiles no elegibles con `npm.cmd test -- test/supabase.test.js`.

## 2. API y contratos backend

- [x] 2.1 Extender `test-support/supabase-mock.js` con solicitudes, amistades, RPC sociales y notificaciones; verificar que los fixtures simulan identidad por JWT y resultados/fallos sin red.
- [x] 2.2 Añadir repositorio y rutas protegidas para búsqueda parcial, listas, envío, rechazo y aceptación; verificar mínimo de tres caracteres, errores de autorrelación/duplicado, alcance por sesión y estados con `npm.cmd test -- test/amigos-api.test.js`.
- [x] 2.3 Añadir la ruta autenticada de resumen ajeno con Tops, DNA agregado, colecciones recientes, contadores y logros limitados; verificar orden, campos permitidos, usuario inexistente, sesión ausente y errores con `npm.cmd test -- test/amigos-api.test.js`.
- [x] 2.4 Extender `src/notificaciones-repository.js` y sus rutas para representar solicitudes y aceptar desde una notificación de forma idempotente; verificar texto, destinatario, acción repetida y ausencia de cambios de lectura con `npm.cmd test -- test/notificaciones-api.test.js`.

## 3. Interfaz de amigos y perfil

- [x] 3.1 Añadir el launcher y el modal de cuatro pestañas, filas de amigos y estados de solicitudes, conservando navegación accesible; verificar estructura, filtros y botones en `npm.cmd test -- test/friends-web.test.js`.
- [x] 3.2 Implementar búsqueda con umbral de tres caracteres, envío, rechazo y aceptación posterior desde recibidas; verificar actualización de estado, no reenvío y cambios de sesión en `npm.cmd test -- test/friends-web.test.js`.
- [x] 3.3 Implementar el modal de perfil reutilizable con Tops, DNA, métricas, últimas figuras y cinco logros; enlazarlo desde búsqueda, amigos y solicitudes enviadas/recibidas, sin controles de perfil en rankings, verificando foco, carga/error y respuestas obsoletas con `npm.cmd test -- test/friends-web.test.js test/ranking-web.test.js`.
- [x] 3.4 Añadir la acción rápida `+` con corazón en notificaciones y su estado `Aceptada` deshabilitado; verificar que no marque como leída ni repita la aceptación con `npm.cmd test -- test/notifications-web.test.js`.

## 4. Verificación integrada

- [x] 4.1 Añadir pruebas PGlite de unicidad por pareja, transiciones pendiente/rechazada/aceptada, autorización, atomicidad de relaciones/notificaciones y backfill; verificar con `npm.cmd test -- test/supabase.test.js test/ranking-notifications.test.js`.
- [x] 4.2 Ejecutar la suite completa sin credenciales reales y resolver regresiones de API, UI y persistencia con `npm.cmd test`.
- [x] 4.3 Revisar los escenarios de búsqueda, perfiles, notificaciones, responsive y foco en navegador; confirmar que ninguna respuesta expone correo, preferencias, compra o ponderaciones DNA individuales.

## 5. Ajustes sociales confirmados

- [x] 5.1 Ampliar las proyecciones sociales con total de colección y resumen DNA equivalente al ranking global por defecto y añadir contadores propios derivados del JWT; verificar allowlists, orden global, estados incluidos e aislamiento con PGlite y mock.
- [x] 5.2 Implementar RPC y API protegidas para eliminar una amistad recíprocamente, borrando solicitud aceptada y notificaciones vinculadas en una transacción; incluir migración puntual idempotente para bases existentes y comprobar autorización, rollback, reintentos, aceptación tardía y nueva solicitud con PGlite y `test/amigos-api.test.js`.
- [x] 5.3 Reutilizar la información, iconos y disposición responsive de las filas del ranking en Amigos y Buscador, sin acordeón ni regalos; añadir eliminación accesible independiente del perfil en toda fila de amigo, con error recuperable y bloqueo de doble envío, y validar con `test/friends-web.test.js` y `test/ranking-web.test.js`.
- [x] 5.4 Sustituir el `375` estático del botón Amigos y añadir contadores `(N)` en Amigos, Enviadas y Recibidas; cargar y actualizar totales confirmados tras sesión, reapertura, acciones y eventos sociales, descartando respuestas de otra cuenta; probar con `test/friends-web.test.js`.
- [x] 5.5 Renderizar username en `strong` en ambas notificaciones sociales y sustituir el corazón de la aceptación rápida por `/status_images/friends.png`, manteniendo `Aceptada` deshabilitado y lectura intacta; verificar con `test/notifications-web.test.js`.
- [x] 5.6 Ejecutar la suite completa y validar en navegador filas, imágenes, contadores, eliminación recíproca y foco en Monitor, Smartphone y Tablet en ambas orientaciones; confirmar que la ampliación no expone datos privados y documentar la migración necesaria antes de probar contra Supabase existente.