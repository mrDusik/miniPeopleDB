# amigos Specification

## Purpose

Permite a los coleccionistas descubrirse, gestionar solicitudes y amistades, y consultar un resumen limitado del perfil de cualquier otro usuario autenticado.

## Requirements

### Requirement: Buscar coleccionistas por username

El sistema SHALL permitir a una persona autenticada buscar usuarios por coincidencia parcial, sin distinguir mayúsculas y minúsculas, sobre el username. SHALL exigir al menos tres caracteres no vacíos después de recortar espacios y SHALL excluir siempre a la persona autenticada. Cada resultado SHALL limitarse a `userId`, username, avatar, Bricks, nivel, posición global, total de colección, resumen DNA equivalente al ranking global por defecto (rasgo principal y como máximo dos rasgos agregados) y estado de relación o solicitud; SHALL NOT exponer correo, identidad OAuth, preferencias privadas, entradas de colección, DNA completo ni ponderaciones DNA individuales. La posición global SHALL usar el orden del ranking global por defecto sin limitar la búsqueda al Top 10. Una sesión ausente SHALL recibir `401`; una consulta menor de tres caracteres SHALL recibir `400` sin ejecutar una búsqueda.

#### Scenario: Coincidencia parcial
- **WHEN** un usuario autenticado busca una cadena de al menos tres caracteres
- **THEN** recibe los usernames que contienen la cadena sin distinguir mayúsculas y minúsculas
- **AND** no recibe su propio usuario ni campos privados

#### Scenario: Consulta demasiado corta o sin sesión
- **WHEN** la búsqueda tiene menos de tres caracteres o no hay sesión válida
- **THEN** el sistema responde respectivamente `400` o `401` y no revela resultados

### Requirement: Gestionar solicitudes de amistad

Una persona autenticada SHALL poder enviar una solicitud a otro usuario, pero SHALL NOT poder enviársela a sí misma, duplicar una solicitud, solicitar a un amigo confirmado ni reenviar una solicitud rechazada. El sistema SHALL conservar el emisor, receptor y estado de cada solicitud. La persona receptora SHALL poder rechazar una solicitud pendiente sin notificar al emisor; el rechazo SHALL permanecer consultable y la persona receptora SHALL poder aceptar más tarde esa misma solicitud. La aceptación desde la pestaña recibida o una notificación SHALL crear una única relación de amistad bidireccional y actualizar la solicitud a aceptada de forma atómica. Una misma acción repetida SHALL NOT duplicar relaciones ni notificaciones.

#### Scenario: Enviar una solicitud válida
- **WHEN** una persona envía una solicitud a otro usuario sin relación o solicitud previa
- **THEN** queda una solicitud pendiente y el receptor recibe una notificación

#### Scenario: Impedir autorrelación y reenvío
- **WHEN** se intenta solicitar amistad consigo mismo, con un amigo, con una solicitud ya existente o con una solicitud rechazada
- **THEN** la operación se rechaza sin crear otra solicitud ni alterar el estado existente

#### Scenario: Rechazar y aceptar posteriormente
- **WHEN** el receptor rechaza una solicitud pendiente y después decide aceptarla
- **THEN** la misma solicitud pasa de rechazada a aceptada y ambos usuarios aparecen como amigos
- **AND** el rechazo no genera una notificación para el emisor

#### Scenario: Aceptación duplicada
- **WHEN** una solicitud aceptada vuelve a aceptarse desde otra vista o una respuesta tardía
- **THEN** la amistad permanece única y no se duplica la notificación de aceptación

### Requirement: Consultar listas de amistades y solicitudes

El usuario autenticado SHALL poder consultar sus amistades confirmadas, solicitudes enviadas pendientes o rechazadas y solicitudes recibidas pendientes o rechazadas. La lista recibida SHALL conservar las rechazadas para permitir su aceptación posterior. Las consultas SHALL derivar la identidad del JWT y SHALL NOT aceptar un identificador de usuario objetivo. Un usuario SHALL aparecer como amigo de ambas partes solo después de aceptar la solicitud.

Las filas devueltas SHALL incluir la misma proyección limitada de identidad y resumen de ranking que el Buscador, además del estado y referencia de solicitud cuando corresponda. Los totales de amistades, solicitudes enviadas y solicitudes recibidas SHALL consultarse mediante una operación autenticada sin selector de identidad; SHALL contar únicamente las relaciones de `auth.uid()` y, para solicitudes, estados pendiente y rechazado.

#### Scenario: Listar amistades confirmadas
- **WHEN** el usuario consulta su lista de amigos
- **THEN** recibe cada amistad confirmada una sola vez y el otro usuario aparece en la lista recíproca

#### Scenario: Listar solicitudes por dirección y estado
- **WHEN** el usuario consulta solicitudes enviadas o recibidas
- **THEN** cada pestaña devuelve únicamente las solicitudes propias de esa dirección con estado pendiente o rechazado
- **AND** una solicitud aceptada desaparece de ambas listas de solicitudes y aparece en ambas listas de amigos

#### Scenario: Contar relaciones propias
- **WHEN** un usuario consulta los contadores sociales
- **THEN** obtiene solo sus totales de amigos, enviadas y recibidas, incluyendo solicitudes rechazadas y excluyendo aceptadas
- **AND** una sesión ausente recibe `401` y los selectores de otra identidad se rechazan

### Requirement: Eliminar una amistad recíprocamente

Cualquiera de los dos amigos SHALL poder eliminar una amistad confirmada mediante su JWT. La operacion SHALL eliminar atomicamente la relacion canonica y su solicitud aceptada, con sus notificaciones vinculadas por cascada; SHALL permitir nuevas solicitudes entre ambos despues. SHALL NOT eliminar solicitudes pendientes o rechazadas, modificar colecciones ni regalos, generar una nueva notificacion de eliminacion ni permitir que terceros alteren la relacion. A diferencia de V1, SHALL actualizar la gamificacion de ambos participantes conforme a los requisitos vigentes de logros V2. Repetir la eliminacion SHALL ser idempotente y aceptar tarde la antigua solicitud SHALL NOT recrear la amistad.

#### Scenario: Eliminar desde cualquiera de las dos cuentas
- **WHEN** uno de los amigos confirma la eliminacion
- **THEN** ambos desaparecen de sus listas reciprocas, actualizan contadores y pierden los logros que dejen de cumplir
- **AND** una nueva busqueda permite enviar una solicitud nueva

#### Scenario: Eliminar sin autorización o con fallo de persistencia
- **WHEN** un tercero intenta eliminar la amistad o falla una escritura necesaria de la transaccion
- **THEN** relacion, solicitud, notificaciones y gamificacion permanecen coherentes sin cambios parciales

#### Scenario: Reintento y aceptación tardía
- **WHEN** se repite una eliminacion o se intenta aceptar su antigua solicitud
- **THEN** no hay efectos adicionales ni restauracion de amistad o Bricks

### Requirement: Consultar el resumen de perfil de otro coleccionista

Todo usuario autenticado SHALL poder consultar el perfil resumido de otro usuario, sin requerir amistad. La respuesta SHALL incluir username y avatar, Top 5 de figuras de colección por precio y antigüedad, los cuatro porcentajes DNA agregados, Bricks y nivel, número total de figuras de colección y las cinco añadidas más recientemente, número total de figuras buscadas y las cinco añadidas más recientemente, y hasta cinco logros. Los logros SHALL ordenarse como el modal existente: logros no relacionados con regalos por `total` descendente y logros de regalos al final; se conservará el orden de origen en empates. Las figuras recientes SHALL ordenarse por fecha de registro descendente. La respuesta SHALL ser de solo lectura y SHALL NOT incluir correo, identidad OAuth, preferencias privadas, datos de compra, ponderaciones DNA individuales ni información de relaciones con terceros.

#### Scenario: Perfil con datos completos
- **WHEN** una persona autenticada abre el perfil de otro coleccionista
- **THEN** recibe los Tops, cuatro proporciones DNA agregadas, métricas, últimas figuras y hasta cinco logros según los órdenes definidos
- **AND** ninguna minifigura, gamificación o perfil del usuario consultado cambia

#### Scenario: Colección, búsqueda o logros vacíos
- **WHEN** el perfil consultado carece de figuras en una sección o de logros
- **THEN** los totales son cero y las listas correspondientes son vacías sin inventar elementos

#### Scenario: Consultar perfil propio o usuario inexistente
- **WHEN** se consulta el perfil propio o un identificador inexistente o mal formado
- **THEN** el sistema rechaza la autorconsulta o devuelve el error controlado correspondiente sin revelar datos de otra cuenta

#### Scenario: Fallo o cambio de sesión
- **WHEN** falla la lectura del perfil o cambia la sesión durante la consulta
- **THEN** el sistema devuelve un error controlado y la interfaz no conserva ni atribuye datos de otra cuenta

### Requirement: Reflejar las relaciones vigentes en los logros V2

Cada envio, rechazo, aceptacion o eliminacion confirmado SHALL actualizar las fuentes y consecuencias de gamificacion V2 de los participantes afectados antes de exponer la operacion como completada. SHALL distinguir emisor y receptor de solicitudes aceptadas para First contact y Handshake; no SHALL contar rechazadas como pendientes a efectos de logros aunque las listas existentes las conserven. Los hitos de amigos SHALL contar relaciones aceptadas actuales. Los reintentos y las operaciones concurrentes SHALL NOT duplicar cantidades, Bricks ni notificaciones. La eliminacion de cuenta SHALL retirar tambien las contribuciones de amistad a la cuenta superviviente cuando proceda, sin borrar sus otros datos.

Estas mutaciones SHALL seguir usando JWT y operaciones acotadas a la relacion autorizada; recalcular los efectos sobre el otro participante SHALL NOT conceder acceso global ni permitir elegir cuentas arbitrarias. Los fallos SHALL conservar un estado coherente de relacion y gamificacion, no confirmar parcialmente recompensas.

#### Scenario: Solicitud enviada y rechazada
- **WHEN** se envia la unica solicitud de A y B la rechaza
- **THEN** A obtiene First contact al enviarla y lo pierde al rechazarse si no tiene otra fuente vigente
- **AND** la solicitud rechazada sigue consultable y aceptable conforme al contrato existente

#### Scenario: Aceptacion desde cualquier vista
- **WHEN** B acepta desde Amigos o Notificaciones una solicitud de A
- **THEN** A conserva First contact, B obtiene Handshake y ambos actualizan su numero de amigos
- **AND** repetir la aceptacion no concede recompensas adicionales

#### Scenario: Cuenta eliminada
- **WHEN** se elimina una cuenta que era la unica amistad que justificaba Handshake de otra cuenta
- **THEN** la cuenta superviviente pierde ese logro y sus Bricks y ajusta su nivel sin perder su coleccion
