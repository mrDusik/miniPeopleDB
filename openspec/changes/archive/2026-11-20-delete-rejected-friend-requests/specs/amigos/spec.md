# Spec Delta

## MODIFIED Requirements

### Requirement: Gestionar solicitudes de amistad

Una persona autenticada SHALL poder enviar una solicitud a otro usuario, pero SHALL NOT poder enviársela a sí misma, duplicar una solicitud pendiente ni solicitar a un amigo confirmado. La persona receptora SHALL poder rechazar una solicitud pendiente; el rechazo SHALL eliminar la solicitud de amistad, pero conservar la notificación histórica en la bandeja del receptor, desvinculada y sin acción para aceptar. Tras el rechazo, el emisor SHALL poder enviar una nueva solicitud, que tendrá una referencia nueva y creará una nueva notificación para el receptor. Rechazar SHALL NOT alterar una amistad ya aceptada. La aceptación SHALL crear una única relación de amistad bidireccional y actualizar la solicitud a aceptada de forma atómica. Las operaciones SHALL ejecutarse con la identidad JWT autenticada y SHALL NOT usar `service_role`.

#### Scenario: Rechazar una solicitud
- **WHEN** la persona receptora rechaza una solicitud pendiente
- **THEN** la solicitud deja de existir y desaparece de ambas listas y de los contadores
- **AND** la notificación original permanece en su bandeja como historial y ya no permite aceptar la solicitud

#### Scenario: Reenviar después de un rechazo
- **WHEN** el emisor vuelve a enviar una solicitud después de que la anterior haya sido rechazada
- **THEN** se crea una solicitud pendiente con un identificador nuevo
- **AND** el receptor recibe una nueva notificación
- **AND** la notificación anterior sigue disponible sin estar vinculada a la solicitud nueva

#### Scenario: Rechazar una solicitud aceptada
- **WHEN** se intenta rechazar una solicitud ya aceptada
- **THEN** la operación falla y la amistad permanece intacta

### Requirement: Consultar listas de amistades y solicitudes

El usuario autenticado SHALL poder consultar sus amistades confirmadas, solicitudes enviadas pendientes y solicitudes recibidas pendientes. Los rechazos no SHALL persistir ni aparecer en listas, resultados de búsqueda o contadores. Las consultas SHALL derivar la identidad del JWT y SHALL NOT aceptar un identificador de usuario objetivo.

#### Scenario: Consultar después de un rechazo
- **WHEN** cualquiera de las personas consulta listas, búsqueda o contadores después del rechazo
- **THEN** no aparece una solicitud para esa pareja y la relación aparece como `none`
- **AND** el emisor puede enviar una solicitud nueva
