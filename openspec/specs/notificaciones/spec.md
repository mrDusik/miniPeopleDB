# notificaciones Specification

## Purpose

Keep users informed about social interactions, ranking membership changes, and daily collection progress through a private, durable inbox that remains current across sessions and reconnects.

## Requirements

### Requirement: Consultar una bandeja privada de notificaciones

El sistema SHALL ofrecer `GET /api/notificaciones` mediante JWT Supabase valido y RLS, sin aceptar una identidad objetivo. Cada respuesta SHALL incluir como maximo 15 notificaciones propias ordenadas de mas reciente a mas antigua, `unreadCount` propio y un cursor para la pagina siguiente o `null`. El cursor SHALL mantener un orden estable por fecha e identificador. Cada notificacion SHALL exponer solo `id`, `type`, `createdAt`, `isRead` y los datos publicos necesarios para representarla. Sin sesion SHALL responder `401`; los fallos de almacenamiento SHALL devolver un error controlado sin detalles internos.

#### Scenario: Cargar la primera pagina
- **WHEN** un usuario autenticado consulta su bandeja
- **THEN** recibe hasta 15 notificaciones propias, su cantidad no leida y el cursor siguiente
- **AND** no recibe notificaciones de otra cuenta

#### Scenario: Continuar la paginacion
- **WHEN** el usuario solicita la pagina siguiente con el cursor recibido
- **THEN** recibe las 15 notificaciones siguientes como maximo, sin duplicados ni saltos aunque haya fechas iguales
- **AND** el cursor es `null` cuando no quedan resultados

#### Scenario: Solicitud sin sesion o almacenamiento no disponible
- **WHEN** la consulta no tiene JWT valido o falla la persistencia
- **THEN** responde respectivamente `401` o un error controlado sin incluir datos privados ni detalles internos

### Requirement: Mantener estado no leido hasta una accion explicita

El sistema SHALL ofrecer `POST /api/notificaciones/:id/leer` para marcar como leida exclusivamente una notificacion propia y `POST /api/notificaciones/leer-todas` para marcarlas todas como leidas. Ambas operaciones SHALL devolver el nuevo `unreadCount` y SHALL ser idempotentes. Consultar, abrir, paginar, recibir en tiempo real o ejecutar la accion de agradecimiento SHALL NOT marcar notificaciones como leidas.

#### Scenario: Marcar una notificacion individual
- **WHEN** el usuario autenticado marca como leida una notificacion propia
- **THEN** solo cambia esa notificacion y se devuelve el nuevo `unreadCount`
- **AND** las notificaciones de otras cuentas no cambian

#### Scenario: Marcar todas como leidas
- **WHEN** el usuario autenticado activa la accion global
- **THEN** todas sus notificaciones quedan leidas y `unreadCount` pasa a cero
- **AND** las notificaciones de otras cuentas no cambian

#### Scenario: Abrir y recorrer notificaciones
- **WHEN** el usuario abre la bandeja, carga mas resultados o agradece un regalo
- **THEN** el estado de lectura permanece sin cambios hasta que marque la notificacion individual o active `Marcar todas como leídas`

### Requirement: Entregar eventos sociales y cambios de pertenencia a rankings

El sistema SHALL crear notificaciones duraderas para regalos recibidos, agradecimientos y transiciones de entrada o salida del Top 10 de Ranking Global o Ranking Semanal. Las notificaciones de regalo SHALL identificar al donante por su nombre visible y el importe efectivamente concedido. Las de agradecimiento SHALL indicar quien agradecio al donante original. Una transicion de ranking SHALL producir un solo evento por usuario, ranking y transicion; la lectura de rankings SHALL NOT volver a emitir el mismo evento. El Ranking Semanal SHALL respetar su fecha de disponibilidad vigente.

#### Scenario: Recibir un regalo
- **WHEN** una donacion de Ranking Global se confirma
- **THEN** el receptor recibe una notificacion no leida con el texto `El usuario {user} vio tus tops en el Ranking Global y te regaló {amount} Bricks 🧱`
- **AND** el importe coincide con los Bricks confirmados por la donacion

#### Scenario: Entrar o salir de un Top 10
- **WHEN** una actualizacion valida cambia la pertenencia de un usuario al Top 10 global o semanal
- **THEN** se crea una notificacion no leida con el ranking y la posicion de entrada, o con el aviso de salida
- **AND** consultar repetidamente el ranking no duplica esa transicion

#### Scenario: Agradecer un regalo una sola vez
- **WHEN** el receptor agradece una notificacion de regalo todavia no agradecida
- **THEN** el donante original recibe 5 Bricks y una notificacion con el texto `{user} te dio las gracias por tu regalo.`
- **AND** el donante original recibe un logro separado de tipo `regalo` llamado `Gratitude is the sign of noble souls` que concede otros 5 Bricks y se conserva al recalcular su gamificacion
- **AND** el usuario que agradece no recibe el logro ni sus Bricks
- **AND** la misma donacion no puede volver a generar recompensas ni agradecimientos

### Requirement: Crear un resumen diario desde snapshots confirmados

El sistema SHALL generar como maximo una notificacion de progreso diaria por usuario y fecha de snapshot, solo despues de confirmar el snapshot del proceso `daily-sync`. La notificacion SHALL contener las diferencias entre el snapshot confirmado y el snapshot previo existente mas reciente, sin fabricar valores para dias ausentes: figuras, valor EUR, Bricks, nivel y cada rasgo DNA. El nivel SHALL admitir variaciones positivas, nulas y negativas. SHALL incluir variaciones de posicion global o semanal solo cuando el usuario pertenecia a ese ranking en ambas mediciones comparadas. Reintentar el mismo dia SHALL actualizar el resumen existente sin duplicarlo ni cambiar su estado de lectura.

#### Scenario: Resumen con cambios positivos y negativos
- **WHEN** se confirma un snapshot posterior al snapshot previo existente
- **THEN** la notificacion informa cada diferencia con signo, incluyendo descensos de valor, Bricks, nivel o porcentajes DNA
- **AND** las posiciones de ranking solo aparecen si el usuario era miembro en ambas mediciones

#### Scenario: Primer snapshot o dias sin medicion
- **WHEN** no existe un snapshot anterior o faltan fechas intermedias
- **THEN** el sistema no inventa una base cero ni snapshots intermedios
- **AND** el resumen inicial omite diferencias no calculables

#### Scenario: Reintentar el mismo snapshot
- **WHEN** `daily-sync` vuelve a confirmar al mismo usuario y fecha
- **THEN** existe una unica notificacion diaria con los valores actualizados
- **AND** se conserva su estado leido/no leido

### Requirement: Recibir notificaciones nuevas en tiempo real

El usuario autenticado SHALL recibir eventos de nuevas notificaciones en tiempo real unicamente para su propia cuenta, respetando RLS. Si una conexion se interrumpe, al abrir o reanudar la bandeja SHALL poder recuperar eventos persistidos mediante la consulta paginada. La entrega en tiempo real SHALL NOT marcar notificaciones como leidas ni sustituir la persistencia.

#### Scenario: Nueva notificacion durante una sesion
- **WHEN** se crea una notificacion para el usuario conectado
- **THEN** la interfaz recibe el evento propio y actualiza el indicador no leido
- **AND** no recibe eventos de otros usuarios

#### Scenario: Reconectar
- **WHEN** el cliente pierde y recupera la conexion en tiempo real
- **THEN** vuelve a consultar el estado persistido y recupera notificaciones que no recibio durante la desconexion