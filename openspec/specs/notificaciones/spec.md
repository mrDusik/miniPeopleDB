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

#### Scenario: Icono compacto de agradecimiento en monitor
- **WHEN** la bandeja se muestra con ancho minimo de 761px, hover y puntero fino
- **THEN** el icono brick del boton Gracias mide 1rem de alto y conserva su proporcion, igual que los botones de regalo de los rankings
- **AND** no cambia el comportamiento de los botones ni los estilos de movil y tablet tactil

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

#### Scenario: Iconos alineados en el resumen diario
- **WHEN** se despliegan las métricas de una notificación de Resumen diario
- **THEN** todos sus iconos, incluido Bricks, usan un tamaño de 22px por 22px y una columna de 24px
- **AND** las etiquetas y valores conservan la misma alineación sin deformar las imágenes

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

### Requirement: Entregar notificaciones Android en segundo plano
Una notificacion persistida SHALL generar una entrega FCM a cada instalacion Android activa y autorizada del destinatario cuando la app este en segundo plano o su proceso haya terminado normalmente. El titulo y cuerpo visibles SHALL representar la categoria de la notificacion sin incluir nombres ni datos de negocio, y la alerta nativa SHALL NOT incluir botones de accion. La bandeja persistida SHALL seguir siendo la fuente de verdad; la entrega FCM SHALL NOT reemplazar ni alterar el contrato web, la persistencia o la recepcion foreground mediante Realtime.

#### Scenario: Notificacion nueva con la app cerrada
- **WHEN** se confirma una notificacion y el destinatario tiene una instalacion Android activa con permiso
- **THEN** el servidor solicita a FCM una alerta para esa instalacion aunque el proceso de la app no este ejecutandose
- **AND** el texto visible identifica el tipo de aviso y la alerta no presenta botones de accion
- **AND** la fila persistida conserva su estado de lectura hasta una accion explicita

#### Scenario: Notificacion mientras la app esta visible
- **WHEN** la app esta en foreground y recibe la notificacion por Realtime o FCM
- **THEN** la interfaz actualiza el indicador y la bandeja sin mostrar una segunda alerta del sistema para el mismo evento

#### Scenario: Sin instalacion elegible
- **WHEN** no existe token activo o el permiso de notificaciones esta denegado
- **THEN** no se envia una alerta a esa instalacion y la notificacion permanece disponible en la bandeja

### Requirement: Registrar y revocar tokens FCM por cuenta e instalacion
El registro de un token FCM SHALL requerir una sesion autenticada; el servidor SHALL derivar la cuenta del JWT y SHALL NOT aceptar un `user_id` objetivo. Cada token SHALL pertenecer a una sola cuenta activa, y la app SHALL actualizar tokens rotados y revocar el registro al cerrar sesion o eliminar la cuenta.

#### Scenario: Registrar o renovar un token
- **WHEN** una cuenta autenticada autoriza notificaciones y Android emite o rota el token
- **THEN** el servidor asocia el token unicamente con esa cuenta e instalacion, sin exponerlo en respuestas publicas ni logs

#### Scenario: Cambio de cuenta o cierre de sesion
- **WHEN** el usuario cierra sesion o cambia de cuenta en la instalacion
- **THEN** la app revoca el registro anterior antes de registrar el nuevo propietario y el backend no conserva dos propietarios activos para el mismo token

#### Scenario: Eliminar cuenta o invalidar token
- **WHEN** se elimina la cuenta o FCM informa que un token ya no es valido
- **THEN** se elimina o desactiva el registro correspondiente y no se vuelve a intentar enviar a ese token

### Requirement: Respetar permiso Android y canal de notificaciones
La app SHALL crear un canal Android estable y solicitar `POST_NOTIFICATIONS` en Android 13 o posterior en un contexto comprensible. El estado concedido o denegado SHALL controlar las alertas del sistema sin impedir el uso de la bandeja ni de Realtime.

#### Scenario: Permiso concedido
- **WHEN** el usuario concede el permiso requerido
- **THEN** la app actualiza el estado del registro de esa instalacion y puede mostrar alertas en el canal configurado

#### Scenario: Permiso denegado o revocado en ajustes
- **WHEN** el usuario deniega el permiso o lo revoca en ajustes del sistema
- **THEN** la app no presenta alertas del sistema, conserva la bandeja y sincroniza el estado cuando vuelve a estar activa

### Requirement: Mostrar el estado real de notificaciones del sistema en Preferencias
En Android, el modal Preferencias SHALL mostrar un control llamado «Notificaciones del sistema» cuyo estado visual SHALL reflejar el permiso de notificaciones de la aplicación y el canal de notificaciones configurado en Android. El texto SHALL preceder visualmente al toggle y no SHALL mostrarse un texto adicional de estado junto a él. Este control SHALL NOT aparecer en el modal Notificaciones ni en clientes web. Al activar, la app SHALL solicitar el permiso nativo cuando sea necesario y registrar o renovar el token si Android permite las notificaciones. Al desactivar, la app SHALL abrir los ajustes nativos de notificaciones de la aplicación, ya que Android controla esa autorización; al volver, SHALL consultar de nuevo el estado real y sincronizar el registro del dispositivo. Si el usuario deniega el permiso o el canal está desactivado, el control SHALL permanecer apagado y la bandeja persistida SHALL seguir disponible.

#### Scenario: Abrir Preferencias con notificaciones activadas en Android
- **WHEN** la aplicación y el canal de notificaciones están habilitados en los ajustes de Android
- **THEN** el control en Preferencias aparece activado
- **AND** el modal Notificaciones no contiene el control

#### Scenario: Conservar el icono de ladrillo rojo en notificaciones
- **WHEN** Android muestra una notificación nativa
- **THEN** usa la silueta de ladrillo rojo definida por el favicon del cliente web, independientemente del icono del launcher

#### Scenario: Aviso push representativo sin acciones
- **WHEN** FCM entrega una notificación de cualquier categoría soportada
- **THEN** el título y el cuerpo describen esa categoría sin datos privados
- **AND** no se envían botones ni acciones; la interacción se realiza desde el modal de notificaciones

#### Scenario: Activar notificaciones desde Preferencias
- **WHEN** el usuario activa el control y el permiso aún no está concedido
- **THEN** la app solicita el permiso de Android y refleja el resultado concedido o denegado
- **AND** solo registra el token si el estado real de Android permite notificaciones

#### Scenario: Desactivar notificaciones desde Preferencias
- **WHEN** el usuario desactiva el control
- **THEN** la app abre los ajustes nativos de notificaciones de MiniPeopleDB
- **AND** al volver refleja el permiso y canal reales, sin simular que Android ya los revocó

### Requirement: Minimizar el payload y validar el destino al abrir
El payload FCM SHALL limitarse a un identificador opaco de notificacion, una categoria permitida y los campos genericos necesarios para presentar la alerta; SHALL NOT incluir nombres, mensajes, importes, payload de negocio, JWT ni tokens FCM. Al tocarla, la app SHALL consultar el registro propio mediante JWT antes de mostrar detalles o ejecutar una accion.

#### Scenario: Abrir una alerta valida
- **WHEN** el usuario toca una alerta y su sesion es valida
- **THEN** la app abre la bandeja en la notificacion identificada y obtiene su contenido actual desde la API autenticada
- **AND** abrirla no la marca automaticamente como leida

#### Scenario: Abrir sin sesion o con identificador no disponible
- **WHEN** el usuario toca la alerta sin sesion o la notificacion ya no puede consultarse
- **THEN** la app solicita autenticacion y reanuda solo el destino permitido tras validar la sesion, o abre la bandeja con un estado recuperable
- **AND** ignora destinos arbitrarios incluidos en el mensaje

### Requirement: Deduplicar y recuperar entregas push
El despacho SHALL identificar cada envio por notificacion e instalacion, reintentar fallos transitorios de FCM con backoff y detener los reintentos para tokens invalidos o mensajes expirados. La app SHALL evitar alertas duplicadas para el mismo identificador; la recuperacion SHALL consultar la bandeja persistida al reanudar o reconectar.

#### Scenario: Reintento o entrega repetida
- **WHEN** FCM reintenta o entrega mas de una vez el mismo identificador
- **THEN** la app presenta como maximo una alerta visible para esa notificacion y no duplica filas de la bandeja

#### Scenario: Dispositivo desconectado o entrega expirada
- **WHEN** el dispositivo esta offline mas alla del TTL configurado o FCM no confirma la entrega
- **THEN** el despacho no crea ni modifica la notificacion persistida y aplica la politica de reintento/expiracion
- **AND** la app recupera la notificacion desde la bandeja al reanudar con conectividad

#### Scenario: Error transitorio o permanente de FCM
- **WHEN** FCM devuelve un error transitorio o indica que el token es invalido
- **THEN** el servidor reintenta solo el error transitorio con backoff y desactiva el token invalido sin exponer detalles al usuario
