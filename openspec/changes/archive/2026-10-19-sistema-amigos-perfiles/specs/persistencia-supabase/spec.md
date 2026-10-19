# Spec Delta

## MODIFIED Requirements

### Requirement: Proteger perfiles públicos y donaciones con RLS

Las tablas de perfiles públicos y donaciones SHALL tener RLS habilitado. Un usuario SHALL poder insertar y actualizar únicamente su propio perfil público; los datos de otros perfiles SHALL ser accesibles únicamente mediante las consultas limitadas del ranking o las proyecciones de búsqueda y perfil ajeno definidas por `amigos`, siempre con JWT autenticado. Cada proyección SHALL devolver exclusivamente los campos públicos definidos por ese contrato y SHALL NOT conceder lectura directa general de `perfiles_publicos`, `user_profiles`, minifiguras o gamificación. Un donante SHALL poder conocer si ya regaló a cada destinatario, pero ningún cliente SHALL poder alterar o eliminar directamente el historial de regalos.

#### Scenario: Modificar un perfil ajeno
- **WHEN** un usuario intenta actualizar directamente el perfil público de otro usuario
- **THEN** Supabase rechaza la operación mediante RLS

#### Scenario: Leer metadatos no públicos
- **WHEN** un usuario consulta el ranking, la búsqueda social o el resumen autenticado de perfil ajeno
- **THEN** solo recibe la proyección permitida por el contrato correspondiente
- **AND** no recibe correos, identidades de proveedor ni metadatos privados de autenticación

#### Scenario: Evitar lectura directa general
- **WHEN** un cliente consulta directamente perfiles privados, minifiguras o gamificación de otra cuenta
- **THEN** RLS no devuelve filas ajenas y la autorización del resumen de perfil no amplía los grants directos

## ADDED Requirements

### Requirement: Persistir solicitudes y amistades con aislamiento por usuario

La persistencia SHALL garantizar como máximo una solicitud por pareja de usuarios y una sola relación de amistad confirmada, con los mismos datos de amistad visibles a ambas partes. SHALL impedir autorrelaciones, solicitudes duplicadas y reenvíos tras un rechazo. El emisor y receptor SHALL poder consultar únicamente las solicitudes en las que participan; cada usuario SHALL poder consultar sus amistades. Las operaciones de enviar, rechazar y aceptar SHALL validar al usuario autenticado, actualizar los estados y crear las notificaciones correspondientes de forma atómica. Las operaciones SHALL NOT usar `service_role`, aceptar un usuario objetivo para eludir la sesión ni otorgar acceso general a filas ajenas.

La persistencia SHALL permitir que cualquiera de los amigos elimine la amistad mediante una RPC autenticada que derive al actor de `auth.uid()`. SHALL eliminar en una única transacción la amistad, su solicitud aceptada y las notificaciones sociales vinculadas por cascada, liberando la pareja para una nueva solicitud. SHALL bloquear la eliminación por terceros y la eliminación de solicitudes pendientes o rechazadas mediante esta operación, mantener idempotencia y revertir todo si falla cualquier borrado. Las operaciones de aceptar y eliminar SHALL serializarse sobre la solicitud para que una aceptación tardía no restaure una amistad eliminada.

Las proyecciones limitadas de búsqueda y listas SHALL incluir total de colección y el mismo resumen DNA del ranking global por defecto, sin entradas de colección ni ponderaciones individuales. La consulta de contadores SHALL aceptar únicamente el JWT del actor, sin selector de otra identidad, y devolver totales de amigos y solicitudes propias pendientes/rechazadas sin ampliar grants directos.

#### Scenario: Aislar consultas y mutaciones
- **WHEN** un usuario intenta leer o modificar solicitudes o amistades en las que no participa
- **THEN** la persistencia rechaza la operación y no revela ni cambia datos ajenos

#### Scenario: Aceptar una solicitud rechazada
- **WHEN** el receptor acepta una solicitud previamente rechazada
- **THEN** la solicitud cambia a aceptada, ambos usuarios consultan la amistad y se crea una sola notificación de aceptación

#### Scenario: Revertir una operación incompleta
- **WHEN** falla la escritura de una relación o de su notificación asociada
- **THEN** se revierten conjuntamente los cambios de estado, la relación y el evento

#### Scenario: Eliminar atómicamente y solicitar de nuevo
- **WHEN** cualquiera de los participantes elimina una amistad existente
- **THEN** la amistad desaparece para ambos junto con su solicitud aceptada y notificaciones vinculadas
- **AND** puede crearse una nueva solicitud entre ambos sin modificar colecciones, gamificación, regalos ni relaciones de terceros

#### Scenario: Aislar contadores y resúmenes
- **WHEN** se consultan contadores y filas sociales con un JWT autenticado
- **THEN** los contadores corresponden únicamente al actor y las filas contienen solo el resumen público autorizado
- **AND** no se habilitan lecturas directas cruzadas ni escrituras directas sobre amistades