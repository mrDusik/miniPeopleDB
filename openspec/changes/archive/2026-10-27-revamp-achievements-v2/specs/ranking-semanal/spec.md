# Spec Delta

## MODIFIED Requirements

### Requirement: Activar el semanal el lunes acordado

El ranking semanal SHALL permanecer inactivo hasta el lunes estrictamente posterior a la fecha del despliegue efectivo V2 en produccion, segun Europe/Madrid. Un despliegue en lunes SHALL activar el lunes de la semana siguiente. El backend SHALL fijar y persistir la fecha una sola vez al activar V2, sin depender del navegador, fecha de propuesta, merge pendiente de desplegar ni cada reinicio del servidor. SHALL sustituirse la fecha fija V1 de 2026-10-12.

Desde availableFrom SHALL estar disponible solo con al menos un candidato con snapshot del domingo inmediatamente anterior y una medicion de la semana actual, ambas V2, sin reutilizar capturas V1 ni base cero. Sin candidatos comparables SHALL mostrar exactamente No disponible y entries vacio. El reset unico de snapshots pertenece a la migracion V2; los cambios de semana ordinarios SHALL NOT borrar Bricks, editar snapshots ni ejecutar resets. Las nuevas diferencias SHALL proceder de la captura nocturna vigente.

#### Scenario: Consulta antes del estreno
- **WHEN** se despliega V2 el viernes 2026-10-23 y se consulta antes del lunes 2026-10-26
- **THEN** aparece No disponible, availableFrom es 2026-10-26 y no hay filas

#### Scenario: Primera captura semanal
- **WHEN** llega el lunes acordado y hay capturas V2 del domingo anterior y de ese lunes
- **THEN** se muestra la diferencia sin contar el reset ni cambiar Bricks globales

#### Scenario: Lunes antes de disponer de captura
- **WHEN** llega el lunes pero falta base dominical o medicion semanal V2
- **THEN** muestra No disponible sin reutilizar otra semana ni inventar ceros

#### Scenario: Despliegue en lunes y reinicio
- **WHEN** V2 se activa el lunes 2026-10-26 y se reinicia el servidor el martes
- **THEN** availableFrom se mantiene en 2026-11-02, sin recalcularla desde el reinicio

### Requirement: Consultar solo una proyeccion publica autorizada

El sistema SHALL conservar GET /api/ranking/semanal con JWT ordinario, sin parametros de usuario, fecha, semana o criterio. Sin sesion SHALL responder 401; otro metodo 405 con Allow GET; query no permitida 400 PARAMETRO_INVALIDO. La respuesta correcta SHALL ser 200 con `{ available, availableFrom, weekStart, weekEnd, entries }`. availableFrom SHALL ser la fecha persistida de activacion V2 en YYYY-MM-DD, no una constante V1; weekStart/weekEnd SHALL ser fechas reales de la semana Madrid. Con available false entries SHALL estar vacio; con true SHALL incluir de uno a diez candidatos comparables.

Cada entrada SHALL conservar la proyeccion publica del global por Nivel mas bricksSemanales y snapshotDate; bricks SHALL seguir siendo el saldo global y la UI SHALL usar bricksSemanales como cifra principal. SHALL NOT exponer base privada, snapshots completos, correos, datos de compra ni DNA completo. Los fallos SHALL responder 500 RANKING_SEMANAL_NO_DISPONIBLE, sin detalles internos ni falsa no disponibilidad. SHALL usar anon mas JWT, nunca service_role, manteniendo RLS historico.

#### Scenario: Proyeccion publica sin abrir historicos
- **WHEN** un usuario autenticado consulta el semanal
- **THEN** recibe hasta diez proyecciones autorizadas y la fecha V2 sin acceso directo a snapshots ajenos

#### Scenario: Intento de elegir usuario o semana
- **WHEN** la URL incluye userId, fecha, semana o criterio
- **THEN** se rechaza sin una consulta global arbitraria

#### Scenario: Fallo real de almacenamiento
- **WHEN** falla la consulta
- **THEN** devuelve 500 RANKING_SEMANAL_NO_DISPONIBLE y la UI distingue error de No disponible

### Requirement: Regalar 5 Bricks una vez por semana

Cada fila ajena del semanal SHALL conservar el boton +5, nombre accesible Enviar 5 Bricks, endpoint POST /api/ranking/semanal/regalar y cuerpo solo receptorId. SHALL usar JWT, validar destinatario en el Top 10 semanal disponible y derivar donante y semana Madrid, sin service_role. SHALL permitir una concesion por pareja y semana, independiente del regalo global; SHALL rechazar autorregalos, destinatarios no clasificados, duplicados y carreras sin efectos parciales. regaloEnviado SHALL referirse a esa semana y se renovara al cambiar de semana sin borrar regalos V2 anteriores.

El regalo SHALL conceder 5 Bricks directos y actualizar los hitos V2 de contador combinado, no conceder You're on fire this week! ni ningun logro repetible V1. SHALL crear notificacion gift_received con importe directo 5 y permitir un agradecimiento con las reglas V2 del global. Los recalculos SHALL preservar sus fuentes V2 y las lecturas de logros de usuarios solo clasificados en el semanal SHALL seguir autorizadas. Sus Bricks semanales SHALL cambiar solo cuando una nueva captura refleje el regalo.

#### Scenario: Regalo semanal y global independientes
- **WHEN** se regala a un participante que ya recibio el regalo global del mismo donante
- **THEN** suma 5 Bricks directos, un regalo al contador unificado y los hitos nuevos que correspondan, sin logro V1
- **AND** repetirlo en esa semana responde 409 REGALO_YA_ENVIADO

#### Scenario: Renovacion semanal
- **WHEN** comienza otra semana y el receptor sigue clasificado
- **THEN** puede recibir otro regalo de esa pareja y se mantienen fuentes y recompensas V2 de semanas anteriores