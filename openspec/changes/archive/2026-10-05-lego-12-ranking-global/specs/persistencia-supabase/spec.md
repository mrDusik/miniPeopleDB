# Spec Delta

## MODIFIED Requirements

### Requirement: Persistir los datos por usuario en Supabase

El sistema SHALL leer y escribir el catálogo de minifiguras en la tabla `minifiguras` y el estado de gamificación en la tabla `gamificacion` de Supabase, usando la identidad del usuario autenticado para que las políticas RLS se apliquen en cada operación. El sistema SHALL almacenar por separado la proyección pública de perfiles y las donaciones. Las consultas globales y la mutación de regalo SHALL exponer únicamente los campos y operaciones definidos por `ranking-global`, SHALL derivar al donante de la sesión y SHALL NOT usar claves de servicio que omitan RLS ni aceptar un `user_id` de donante proporcionado por el cliente.

#### Scenario: Alta asociada al usuario autenticado
- **WHEN** un usuario autenticado crea una minifigura
- **THEN** el registro se guarda en `minifiguras` con el `user_id` del usuario del token

#### Scenario: Cuerpo con user_id ajeno
- **WHEN** un cliente envía una minifigura que incluye `user_id`
- **THEN** el sistema responde `400` con `MINIFIGURA_INVALIDA` y no persiste nada

#### Scenario: Estado de gamificación inexistente
- **WHEN** un usuario autenticado sin fila en `gamificacion` consulta `GET /gamificacion`
- **THEN** el sistema calcula el estado a partir de su catálogo, lo guarda en `gamificacion` y lo devuelve

#### Scenario: Intento de suplantar al donante
- **WHEN** un cliente incluye un identificador de donante en una petición de regalo
- **THEN** el sistema ignora o rechaza ese valor y usa exclusivamente el usuario del token

## ADDED Requirements

### Requirement: Proteger perfiles públicos y donaciones con RLS

Las tablas de perfiles públicos y donaciones SHALL tener RLS habilitado. Un usuario SHALL poder insertar y actualizar únicamente su propio perfil público; los datos de otros perfiles solo SHALL ser accesibles mediante la consulta limitada del ranking. Un donante SHALL poder conocer si ya regaló a cada destinatario, pero ningún cliente SHALL poder alterar o eliminar directamente el historial de regalos.

#### Scenario: Modificar un perfil ajeno
- **WHEN** un usuario intenta actualizar directamente el perfil público de otro usuario
- **THEN** Supabase rechaza la operación mediante RLS

#### Scenario: Leer metadatos no públicos
- **WHEN** un usuario consulta el ranking
- **THEN** no recibe correos, identidades de proveedor ni metadatos privados de autenticación

### Requirement: Garantizar una donación única y atómica

La persistencia SHALL imponer unicidad sobre `(donante_id, receptor_id)` y SHALL ejecutar el alta de la donación, el incremento de 50 Bricks, el recálculo del nivel y la actualización del logro del receptor en una única transacción. Si cualquier paso falla, SHALL revertir todos los pasos.

#### Scenario: Dos solicitudes concurrentes del mismo regalo
- **WHEN** dos solicitudes concurrentes intentan regalar del mismo donante al mismo receptor
- **THEN** solo una transacción tiene éxito
- **AND** el receptor recibe un único incremento de 50 Bricks

#### Scenario: Fallo al actualizar la gamificación
- **WHEN** se puede insertar la relación de regalo pero falla la actualización del receptor
- **THEN** no permanece ningún registro de regalo ni cambio parcial de Bricks

### Requirement: Conservar regalos durante el recálculo de gamificación

El recálculo de gamificación SHALL combinar los Bricks y logros derivados de la colección con los regalos persistidos, de modo que crear, editar o eliminar minifiguras no elimine ni duplique los 50 Bricks y logros recibidos.

#### Scenario: Recalcular tras recibir un regalo
- **WHEN** un receptor modifica su colección después de recibir regalos
- **THEN** su nuevo estado conserva exactamente 50 Bricks y una unidad del logro por cada donación registrada

### Requirement: Simular el ranking y los regalos en pruebas

El cliente simulado de Supabase SHALL admitir perfiles públicos, regalos y las operaciones globales controladas necesarias para probar ranking y donaciones sin red ni credenciales reales.

#### Scenario: Suite sin Supabase real
- **WHEN** se ejecutan las pruebas de ranking y regalos sin variables `SUPABASE_*`
- **THEN** las consultas, restricciones de identidad, unicidad y atomicidad se validan contra el cliente simulado