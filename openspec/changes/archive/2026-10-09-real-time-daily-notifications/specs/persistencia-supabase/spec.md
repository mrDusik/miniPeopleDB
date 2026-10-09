# Spec Delta

## ADDED Requirements

### Requirement: Persistir notificaciones privadas y recompensas de agradecimiento

Las notificaciones SHALL persistirse por usuario con fecha de creacion y estado de lectura. RLS SHALL permitir a cada usuario consultar y marcar como leidas unicamente sus notificaciones; clientes ordinarios SHALL NOT insertar, editar ni borrar directamente notificaciones ni otorgarse recompensas. La entrega en tiempo real SHALL respetar el mismo aislamiento. La operacion de agradecimiento SHALL validar la identidad autenticada y actualizar atomicamente el ledger, los 5 Bricks directos del donante original, su notificacion y su logro repetible de 5 Bricks por recibir las gracias. El usuario que da las gracias SHALL NOT recibir ese logro ni su recompensa. Las notificaciones diarias SHALL escribirse solo desde las RPC allowlisted del trabajador cron existente, bajo sus restricciones de rol y trabajo reclamado.

#### Scenario: Lectura y cambio de estado propios
- **WHEN** un usuario consulta o marca todas sus notificaciones como leidas
- **THEN** solo se devuelven o actualizan filas cuyo propietario coincide con `auth.uid()`
- **AND** las escrituras directas de contenido por clientes ordinarios son rechazadas

#### Scenario: Intento de acceso a notificaciones ajenas
- **WHEN** un cliente consulta, modifica o se suscribe a notificaciones de otra cuenta
- **THEN** RLS no revela ni modifica filas ajenas

#### Scenario: Atomicidad del agradecimiento
- **WHEN** falla cualquier paso de una recompensa por agradecimiento
- **THEN** se revierten tanto los Bricks y el logro del donante como los cambios de agradecimiento y sus notificaciones

#### Scenario: Worker diario autorizado
- **WHEN** el worker cron confirma un snapshot diario
- **THEN** puede escribir el resumen solo mediante las RPC allowlisted existentes o ampliadas
- **AND** `anon`, `authenticated` y las rutas ordinarias no pueden invocar esa escritura privilegiada