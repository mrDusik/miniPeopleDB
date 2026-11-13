# Spec Delta

## MODIFIED Requirements

### Requirement: Gestionar solicitudes de amistad

Una persona autenticada SHALL poder enviar una solicitud a otro usuario, pero SHALL NOT poder enviársela a sí misma, duplicar una solicitud activa, solicitar a un amigo confirmado ni reenviar directamente una solicitud rechazada. Tras revocar una solicitud propia pendiente o rechazada, SHALL poder iniciar una solicitud nueva al mismo usuario. El sistema SHALL conservar el emisor, receptor y estado de cada solicitud mientras exista. El emisor SHALL poder revocar sus solicitudes pendientes o rechazadas; la revocación SHALL retirar la solicitud de las listas de enviadas y recibidas, SHALL NOT permitir revocar una solicitud aceptada y SHALL NOT alterar amistades ni datos de colección. Una persona distinta del emisor SHALL NOT poder revocarla. La persona receptora SHALL poder rechazar una solicitud pendiente sin notificar al emisor; el rechazo SHALL permanecer consultable y la persona receptora SHALL poder aceptar más tarde esa misma solicitud. La aceptación desde la pestaña recibida o una notificación SHALL crear una única relación de amistad bidireccional y actualizar la solicitud a aceptada de forma atómica. Una misma acción repetida SHALL NOT duplicar relaciones ni notificaciones.

#### Scenario: Enviar una solicitud válida
- **WHEN** una persona envía una solicitud a otro usuario sin relación ni solicitud previa
- **THEN** queda una solicitud pendiente y el receptor recibe una notificación

#### Scenario: Impedir autorrelación y reenvío
- **WHEN** se intenta solicitar amistad consigo mismo, con un amigo, con una solicitud existente o con una solicitud rechazada que no se ha revocado
- **THEN** la operación se rechaza sin crear otra solicitud ni alterar el estado existente

#### Scenario: Revocar una solicitud enviada pendiente o rechazada
- **WHEN** el emisor revoca una de sus solicitudes pendientes o rechazadas
- **THEN** la solicitud deja de aparecer en sus solicitudes enviadas y en las solicitudes recibidas del destinatario
- **AND** una consulta posterior del destinatario ya no muestra esa solicitud

#### Scenario: Volver a solicitar después de revocar
- **WHEN** una persona envía una solicitud nueva después de revocar la anterior, incluso si esta se había rechazado
- **THEN** se crea una solicitud pendiente nueva y el destinatario recibe una notificación

#### Scenario: Impedir revocaciones ajenas o de solicitudes aceptadas
- **WHEN** otra persona intenta revocar la solicitud o el emisor intenta revocar una solicitud aceptada
- **THEN** la operación falla sin modificar la solicitud, la amistad, las notificaciones ni la gamificación

#### Scenario: Rechazar y aceptar posteriormente
- **WHEN** el receptor rechaza una solicitud pendiente y después decide aceptarla
- **THEN** la misma solicitud pasa de rechazada a aceptada y ambos usuarios aparecen como amigos
- **AND** el rechazo no genera una notificación para el emisor

#### Scenario: Botón para rechazar una solicitud
- **WHEN** el modal Amigos muestra una solicitud recibida pendiente
- **THEN** la acción de rechazo se muestra como un botón con el emoji ✖, no como un enlace de texto
- **AND** conserva una etiqueta accesible y un título que identifican la acción y el username del emisor

#### Scenario: Aceptación duplicada
- **WHEN** una solicitud aceptada vuelve a aceptarse desde otra vista o una respuesta tardía
- **THEN** la amistad permanece única y no se duplica la notificación de aceptación

### Requirement: Compartir la distribucion interna de filas con los rankings

Las filas de Amigos, Buscador y solicitudes SHALL reutilizar la estructura y estilos internos de las filas de Ranking Global y Semanal en monitor, movil y tablet. Posicion, avatar, nombre, nivel, DNA, Bricks y coleccion SHALL conservar las mismas columnas, dimensiones, tipografia, altura de linea, distancias, padding y reglas responsive para un mismo ancho disponible. La columna lateral SHALL adaptarse a las acciones de cada modal sin imponer un ancho comun. La reserva interna del indicador de despliegue SHALL conservarse aunque Amigos no muestre dicho indicador.

#### Scenario: Filas equivalentes en cualquier vista
- **WHEN** se muestran filas de Amigos y de los rankings con el mismo ancho disponible
- **THEN** sus elementos comunes tienen la misma distribucion y espaciado, sin overrides exclusivos de Amigos
- **AND** Amigos abre el perfil con clic o teclado sin atributos de acordeon, mientras los rankings conservan su indicador y expansion de destacados
- **AND** las acciones laterales de amistad y regalo siguen siendo independientes

#### Scenario: Ancho de filas y acciones al borde del modal
- **WHEN** se muestran filas en cualquiera de las cuatro pestañas del modal Amigos
- **THEN** las filas ocupan todo el ancho disponible del listado
- **AND** las solicitudes enviadas que permiten revocacion muestran una columna lateral estrecha para ✖, y su resumen ocupa el ancho restante
- **AND** las solicitudes enviadas que no muestran acción SHALL NOT reservar una columna lateral vacía
- **AND** los botones de aceptar y rechazar se alinean al borde derecho del listado sin reservar columnas vacías
- **AND** en móvil portrait y Android, las acciones de una solicitud recibida pendiente se apilan en una columna; ambos botones tienen el mismo ancho de 60px y una altura minima tactil de 44px
- **AND** el resumen del usuario aprovecha el espacio liberado y las solicitudes rechazadas conservan su estado junto al botón de aceptar

#### Scenario: Listar solicitudes por dirección y estado
- **WHEN** el usuario consulta solicitudes enviadas o recibidas
- **THEN** cada pestaña devuelve únicamente las solicitudes propias de esa dirección con estado pendiente o rechazado
- **AND** una solicitud aceptada desaparece de ambas listas de solicitudes y aparece en ambas listas de amigos

#### Scenario: Contar relaciones propias
- **WHEN** un usuario consulta los contadores sociales
- **THEN** obtiene solo sus totales de amigos, enviadas y recibidas, incluyendo solicitudes rechazadas y excluyendo aceptadas
- **AND** una sesión ausente recibe `401` y los selectores de otra identidad se rechazan
