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

El sistema SHALL crear notificaciones duraderas para regalos V2, agradecimientos y transiciones reales de entrada/salida del Top 10 global/semanal. El regalo SHALL identificar donante por username e importe directo confirmado de 50 o 5. El agradecimiento SHALL identificar al emisor y el importe directo vigente, sin anunciar el logro repetible V1 por recibir las gracias. Los nuevos hitos por agradecer SHALL concederse al emisor, no al donante receptor de las gracias. Una transicion SHALL generar un solo evento por usuario/ranking/transicion; leer rankings SHALL NOT emitir ni duplicar eventos. El semanal SHALL respetar su activacion V2.

#### Scenario: Recibir un regalo
- **WHEN** se confirma una donacion V2 global o semanal
- **THEN** el receptor recibe una notificacion no leida con username y el importe directo correcto
- **AND** el texto no confunde ese importe con los Bricks adicionales de un hito

#### Scenario: Entrar o salir de un Top 10
- **WHEN** una mutacion ordinaria V2 cambia pertenencia a un ranking disponible
- **THEN** se crea una sola notificacion de entrada con posicion o de salida sin posicion inventada
- **AND** consultar de nuevo no duplica el evento

#### Scenario: Agradecer un regalo una sola vez
- **WHEN** un receptor agradece un regalo V2 propio no agradecido
- **THEN** el donante recibe la notificacion y 5 Bricks directos, sin el logro repetible V1
- **AND** el emisor actualiza los hitos por su primera o decima accion, sin marcar la notificacion como leida
- **AND** un reintento no genera nuevos premios ni eventos

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

### Requirement: Notificar solicitudes y aceptaciones de amistad

El sistema SHALL crear notificaciones duraderas para las nuevas solicitudes recibidas y para las solicitudes aceptadas. La notificación de solicitud SHALL mostrar exactamente `{NombreUsuario} quiere ser tu amigo.` y SHALL incluir una acción rápida accesible para aceptar, representada por `+` y la imagen `/status_images/friends.png`, sustituyendo el corazón anterior. La notificación de aceptación SHALL mostrar `{NombreUsuario} ha aceptado tu solicitud de amistad.` En ambos mensajes el username SHALL estar en negrita mediante un elemento `strong`, sin interpretar contenido de usuario como HTML. El rechazo SHALL NOT notificar al emisor. La creación de una notificación SHALL ocurrir una sola vez por evento confirmado.

#### Scenario: Recibir una solicitud
- **WHEN** se crea una solicitud de amistad para el usuario autenticado
- **THEN** su bandeja recibe una notificación no leída con el username del emisor y la acción rápida de aceptación
- **AND** ninguna otra cuenta recibe esa notificación

#### Scenario: Username destacado y acción con imagen de amigos
- **WHEN** se renderiza una notificación de solicitud o aceptación de amistad
- **THEN** el username aparece en negrita y el resto del mensaje conserva su texto exacto
- **AND** la acción de una solicitud muestra `/status_images/friends.png` con nombre accesible y sin el corazón anterior

#### Scenario: Aceptar una solicitud
- **WHEN** una persona acepta una solicitud recibida
- **THEN** el emisor recibe una notificación no leída con el username de quien aceptó
- **AND** reintentar la aceptación no genera una segunda notificación

#### Scenario: Rechazar una solicitud
- **WHEN** una persona rechaza una solicitud recibida
- **THEN** no se crea ni entrega una notificación al emisor

### Requirement: Aceptar amistad desde una notificación

La acción rápida de una notificación de solicitud SHALL aceptar la misma solicitud y SHALL crear la amistad bidireccional conforme al contrato de `amigos`. Tras confirmarse, la notificación SHALL mostrar el estado `Aceptada` y deshabilitar la acción. La respuesta SHALL actualizar la bandeja sin marcar automáticamente la notificación como leída. Si la solicitud ya fue aceptada desde otra vista, la acción SHALL reflejar `Aceptada` sin duplicar la relación o el evento de aceptación; si ya no puede aceptarse, la interfaz SHALL mostrar un error controlado y mantener un estado recuperable. Eliminar una amistad SHALL borrar por cascada sus notificaciones sociales ligadas a la solicitud eliminada, sin alterar lectura ni contenido de notificaciones ajenas a esa relación.

#### Scenario: Aceptación rápida confirmada
- **WHEN** el usuario activa `+` con `friends.png` en una solicitud aún aceptable
- **THEN** se crea una única amistad bidireccional y el control pasa a `Aceptada` deshabilitado
- **AND** el estado de lectura de la notificación no cambia

#### Scenario: Solicitud ya aceptada o no disponible
- **WHEN** la solicitud se aceptó desde otro lugar o dejó de ser aceptable
- **THEN** la bandeja muestra respectivamente `Aceptada` deshabilitado o un error controlado sin duplicar efectos

### Requirement: Empezar V2 con bandeja vacia y migracion silenciosa

La migracion unica SHALL eliminar todas las notificaciones existentes y su estado de lectura. SHALL establecer la pertenencia a ranking recalculada como base silenciosa y SHALL NOT emitir avisos de logros, subidas/bajadas de nivel, progreso diario ni entradas/salidas causadas exclusivamente por el reset. Los primeros accesos SHALL devolver bandeja vacia y unreadCount cero, salvo eventos ordinarios V2 realmente posteriores. Workers invalidados, reconexiones Realtime y caches de cliente SHALL NOT reintroducir notificaciones V1. Las acciones sociales conservadas SHALL seguir siendo gestionables desde Amigos aunque sus notificaciones antiguas se hayan borrado.

#### Scenario: Migracion de usuarios de prueba
- **WHEN** termina el reset y la reconstruccion V2
- **THEN** no quedan notificaciones V1 ni avisos sinteticos del recalcule y el indicador no leido se limpia

#### Scenario: Primer evento ordinario posterior
- **WHEN** llega un regalo nuevo V2 despues de la migracion
- **THEN** se genera la notificacion normal una vez y sucesivos reinicios no la borran

### Requirement: Avisar de la disponibilidad semanal una vez por semana
Cuando una sincronizacion diaria completada produzca por primera vez candidatos validos para el Ranking Semanal de una semana ISO en Europe/Madrid, el sistema SHALL crear una notificacion duradera y no leida para cada cuenta registrada. La notificacion SHALL identificar `weekStart` y ofrecer una accion para abrir el Ranking Semanal. SHALL existir como maximo una notificacion por cuenta y semana. Los reintentos, capturas posteriores y lecturas del ranking SHALL NOT duplicarla; abrir el ranking SHALL NOT marcarla como leida. Sin candidatos comparables SHALL NOT crearse la notificacion.

#### Scenario: Primera medicion valida de la semana
- **WHEN** la sincronizacion diaria confirma la primera captura que hace disponible el Ranking Semanal
- **THEN** cada cuenta registrada recibe una notificacion no leida con el inicio de semana y una accion para abrir el ranking

#### Scenario: Reintento o medicion diaria posterior
- **WHEN** se reintenta la sincronizacion o se confirma otra captura de la misma semana
- **THEN** no se duplica la notificacion de disponibilidad de esa semana

#### Scenario: Sin ranking disponible
- **WHEN** la sincronizacion no encuentra candidatos con base y medicion semanal validas
- **THEN** no crea notificaciones de disponibilidad

#### Scenario: Abrir el ranking desde la bandeja
- **WHEN** el usuario activa la accion de una notificacion de disponibilidad
- **THEN** se abre el dialogo Ranking Semanal y la notificacion conserva su estado leido/no leido

#### Scenario: Nueva semana
- **WHEN** una semana ISO posterior se vuelve disponible por primera vez
- **THEN** se crea una nueva notificacion por cuenta para esa semana
