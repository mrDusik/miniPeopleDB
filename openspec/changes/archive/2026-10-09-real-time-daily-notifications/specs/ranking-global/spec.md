# Spec Delta

## ADDED Requirements

### Requirement: Notificar regalos y procesar agradecimientos

Una donacion confirmada por el contrato existente de Ranking Global SHALL crear una notificacion para el receptor. El receptor SHALL poder agradecer cada donacion como maximo una vez. El agradecimiento SHALL otorgar 5 Bricks directos al donante original, notificarlo y concederle un logro adicional repetible de tipo `regalo` por recibir las gracias, independiente del logro existente de 50 Bricks por regalo recibido. El usuario que agradece SHALL NOT recibir ese logro ni sus Bricks.

#### Scenario: Donacion confirmada
- **WHEN** `POST /api/ranking/regalar` confirma una donacion valida
- **THEN** el receptor obtiene una notificacion que incluye el nombre visible del donante y los 50 Bricks concedidos
- **AND** un fallo al crear la notificacion no deja una donacion confirmada sin su evento asociado

#### Scenario: Recompensar un agradecimiento
- **WHEN** el receptor agradece una donacion valida no agradecida
- **THEN** el donante recibe exactamente 5 Bricks y una notificacion de agradecimiento
- **AND** el donante original obtiene una concesion separada de tipo `regalo` por recibir las gracias, por 5 Bricks adicionales
- **AND** quien agradece no obtiene esa concesion

#### Scenario: Solicitud duplicada o ajena
- **WHEN** se repite el agradecimiento o se intenta agradecer una donacion que no fue recibida por la sesion
- **THEN** la operacion no concede Bricks ni altera logros o notificaciones