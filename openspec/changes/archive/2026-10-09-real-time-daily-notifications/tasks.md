# Tasks

## 1. Persistencia y contratos de seguridad

- [x] 1.1 Añadir las tablas, índices, constraints, políticas RLS, grants y publicación Realtime para notificaciones, agradecimientos y estado de pertenencia a rankings; verificar aislamiento y permisos con pruebas PGlite.
- [x] 1.2 Ampliar las RPC de regalos y gamificación para registrar notificaciones y recompensas de agradecimiento atómicas y duraderas; verificar duplicados, rollback y recálculos con `node --test test/supabase.test.js`.
- [x] 1.3 Ampliar las RPC allowlisted del worker diario para emitir resúmenes y reconciliar el ranking semanal al finalizar; verificar reintentos, fallos y rechazo de roles ordinarios con `node --test test/supabase-daily-analytics.test.js`.
- [x] 1.4 Extender `test-support/supabase-mock.js` con la bandeja, RLS/RPC de agradecimientos y persistencia diaria necesaria; verificar contratos simulados con `node --test test/supabase.test.js test/supabase-daily-analytics.test.js`.

## 2. API y eventos de dominio

- [x] 2.1 Implementar el repositorio autenticado de notificaciones con cursor estable, página máxima de 15, conteo no leído y marcado global idempotente; verificar identidad, paginación y errores en pruebas API con `test-support/supabase-mock.js`.
- [x] 2.2 Añadir las rutas autenticadas de lectura, marcar todas como leídas y agradecer un regalo, y enlazar la creación de notificaciones al regalo confirmado; verificar `401`, `405`, duplicados, autorización y respuestas controladas en pruebas API.
- [x] 2.3 Reconciliar la pertenencia al Top 10 Global tras cambios de sus datos, emitir transiciones sin duplicados y sembrar el estado actual sin alertas durante el despliegue; verificar entrada, salida, reentrada y orden de desempate en pruebas de RPC/PGlite.
- [x] 2.4 Derivar deltas de snapshots y posiciones de ranking durante la finalización diaria, conservando el estado leído ante reintentos; verificar variaciones negativas, base ausente, fallo parcial e idempotencia en pruebas de analítica diaria.

## 3. Interfaz

- [x] 3.1 Añadir el botón accesible del sobre entre logo y panel de nivel, su badge de no leídas y el modal de estilo Logros; verificar orden de cabecera, foco de apertura/cierre y visibilidad del badge en pruebas web.
- [x] 3.2 Implementar carga inicial y scroll infinito en páginas de 15, acción global de lectura, suscripción Realtime por sesión y recuperación tras reconexión; verificar ausencia de duplicados, aislamiento al cerrar sesión y que solo la acción global limpia el badge en pruebas web.
- [x] 3.3 Renderizar tipos sociales y tarjeta diaria desplegable con variaciones firmadas, cuadrícula DNA 2x2 y acción de agradecimiento; verificar colores, textos, estados de carga/error y bloqueo de doble envío en pruebas web.
- [x] 3.4 Calcular los grupos temporales al abrir y añadir `title` exacto `DD/MM/YYYY HH:mm`; verificar límites de fechas con reloj fijo y formato en pruebas web.

## 4. Integración y validación

- [x] 4.1 Ejecutar las pruebas focalizadas de API, rankings, gamificación y daily-sync, y corregir cualquier regresión de contratos existentes; verificar con los comandos `node --test` de las suites tocadas.
- [x] 4.2 Ejecutar `npm.cmd test -- --test-reporter=dot` y `openspec validate "real-time-daily-notifications" --strict`; confirmar que ambas validaciones terminan correctamente antes de habilitar Realtime en despliegue.

## 5. Ajustes de bandeja y rankings solicitados

- [x] 5.1 Añadir `POST /api/notificaciones/:id/leer` autenticado, actualizar unread count y probar aislamiento e idempotencia.
- [x] 5.2 Ajustar sobre, toolbar y tarjetas; añadir boton individual, formato de mensajes por tipo y toast verde Realtime.
- [x] 5.3 Limitar destacados de Global y Semanal a tres en landscape, manteniendo cinco en portrait.
- [x] 5.4 Añadir pruebas API/web y ejecutar la validacion completa del repositorio.