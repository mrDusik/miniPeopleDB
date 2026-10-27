# Spec Delta

## MODIFIED Requirements

### Requirement: Enviar un regalo único de Bricks

El sistema SHALL conservar `POST /api/ranking/regalar` con JWT y cuerpo `{ "receptorId": <uuid> }`. Una donacion valida SHALL registrar atomicamente pareja, fecha, 50 Bricks directos del receptor, hitos V2 resultantes, nivel, progreso y notificacion, sin reducir el saldo del donante. El saldo final SHALL incluir ademas los hitos V2 que se crucen, sin duplicar el importe directo. La unicidad por pareja SHALL regir dentro del ledger vigente V2; las parejas consumidas V1 SHALL resetearse una sola vez.

#### Scenario: Regalo válido
- **WHEN** un usuario autenticado regala a un receptor existente distinto de si mismo sin regalo previo en el ledger V2
- **THEN** recibe 200 y se registra una donacion con fecha
- **AND** el receptor suma exactamente 50 Bricks directos mas los nuevos hitos que correspondan, sin alterar el saldo del donante

#### Scenario: Autorregalo
- **WHEN** receptorId es el usuario autenticado
- **THEN** responde 400 AUTORREGALO_NO_PERMITIDO sin cambios

#### Scenario: Regalo repetido
- **WHEN** ya existe regalo V2 de la misma pareja
- **THEN** responde 409 REGALO_YA_ENVIADO sin incrementar saldo ni hitos

#### Scenario: Receptor inexistente
- **WHEN** receptorId no identifica un usuario con gamificacion
- **THEN** responde 404 RECEPTOR_NO_ENCONTRADO sin registrar donacion

### Requirement: Registrar el logro de regalo

Cada regalo global V2 SHALL incrementar el contador unificado de regalos recibidos, junto con los semanales, y reevaluar los dos hitos no repetibles de `logros-v2`: primer regalo por 20 Bricks y diez regalos por 100, acumulativos. Los 50 Bricks directos SHALL mantenerse aparte; SHALL NOT recrearse Your collection is top! ni su ID V1. Un recalcule SHALL preservar ledger V2 e hitos vigentes sin convertir cada regalo en una concesion repetible. Las fuentes V1 SHALL eliminarse durante la migracion, no retitularse como V2.

#### Scenario: Primer regalo recibido
- **WHEN** una cuenta sin otras recompensas recibe el primer regalo V2 global
- **THEN** obtiene 70 Bricks, un hito tipo regalo de cantidad 1 y total 20, y ningun logro repetible V1

#### Scenario: Regalos de distintos donantes
- **WHEN** una cuenta recibe dos regalos globales V2 de donantes diferentes
- **THEN** conserva el primer hito con cantidad 1 y 20 Bricks, mas 100 Bricks directos
- **AND** el hito de diez solo se obtiene al alcanzar diez regalos combinados

### Requirement: Notificar regalos y procesar agradecimientos

Una donacion confirmada SHALL crear atomicamente una notificacion agradecible para el receptor, identificando al donante por username y el importe directo de 50. El receptor SHALL poder agradecer cada regalo V2 una sola vez. SHALL mantenerse el pago directo existente de 5 Bricks al donante y su notificacion, pero SHALL eliminarse el logro V1 adicional repetible por recibir las gracias. Los nuevos hitos por agradecer SHALL corresponder al emisor de las gracias, segun `logros-v2`, por la primera y decima accion confirmada. Esta regla SHALL aplicarse tambien al agradecimiento de regalos semanales, sin premios por accion adicionales no definidos en V2.

#### Scenario: Donacion confirmada
- **WHEN** POST /api/ranking/regalar confirma un regalo
- **THEN** hay una notificacion con username e importe directo 50
- **AND** un fallo del evento revierte el regalo y sus consecuencias

#### Scenario: Recompensar un agradecimiento
- **WHEN** el receptor agradece por primera vez un regalo V2 valido
- **THEN** el donante obtiene 5 Bricks directos y una notificacion, sin logro repetible V1
- **AND** quien agradece obtiene su hito V2 de 5 Bricks si aun no lo tenia

#### Scenario: Solicitud duplicada o ajena
- **WHEN** se repite el agradecimiento o pertenece a un regalo ajeno
- **THEN** no se conceden Bricks, hitos ni notificaciones adicionales