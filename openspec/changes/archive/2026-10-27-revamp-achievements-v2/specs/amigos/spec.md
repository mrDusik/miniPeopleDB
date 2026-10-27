# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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