# Spec Delta

## ADDED Requirements

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