# persistencia-supabase Specification

## Purpose

Almacena el catálogo de minifiguras y el estado de gamificación de cada usuario en Supabase, protegido por RLS, con errores controlados y un cliente sustituible en pruebas.

## Requirements

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

### Requirement: Conservar el contrato de la API

El sistema SHALL mantener el formato JSON de las respuestas existentes (`id`, `nombre`, `descripcion`, `categoria`, `subcategoria`, `anio`, `estadoColeccion`, `precioCompra`, `fechaCompra`, `precio`, `FechaRegistro`, `observada` para minifiguras; `bricks`, `nivel`, `siguienteNivel`, `progreso`, `logros` para gamificación), omitiendo los campos opcionales sin valor en lugar de devolverlos como `null`, y SHALL devolver el catálogo ordenado por `FechaRegistro` ascendente.

#### Scenario: Minifigura sin campos opcionales
- **WHEN** una minifigura almacenada no tiene `descripcion`, `subcategoria`, `precioCompra`, `fechaCompra` ni `precio`
- **THEN** `GET /minifiguras` la devuelve sin esas propiedades

#### Scenario: Orden estable del catálogo
- **WHEN** se realizan dos `GET /minifiguras` consecutivos sin cambios
- **THEN** ambas respuestas contienen la misma colección en el mismo orden por `FechaRegistro`

### Requirement: Reportar errores de persistencia de forma controlada

Los fallos de comunicación o de consulta con Supabase SHALL traducirse a respuestas HTTP consistentes sin exponer mensajes, códigos internos, URLs ni claves de Supabase. Una violación de clave primaria en el alta SHALL traducirse en `409 ID_DUPLICADO`.

#### Scenario: Supabase no disponible
- **WHEN** Supabase devuelve un error al leer el catálogo
- **THEN** el sistema responde `500` con `{ "error": "CATALOGO_NO_DISPONIBLE" }`

#### Scenario: Id duplicado en base de datos
- **WHEN** el alta falla por clave primaria duplicada para el mismo usuario
- **THEN** el sistema responde `409` con `{ "error": "ID_DUPLICADO" }`

#### Scenario: Registro almacenado inválido
- **WHEN** una fila leída de `minifiguras` no cumple el modelo de dominio
- **THEN** el sistema responde `500` con `{ "error": "CATALOGO_INVALIDO" }` sin incluir el contenido de la fila

### Requirement: Permitir sustituir el cliente de persistencia en pruebas

La implementación SHALL permitir inyectar el cliente de Supabase, incluido su resultado de verificación mediante `auth.getUser`, de modo que la suite automatizada se ejecute sin red ni credenciales reales.

#### Scenario: Ejecución de la suite sin credenciales
- **WHEN** se ejecuta `npm test` sin `sup.env` ni variables `SUPABASE_*`
- **THEN** todas las pruebas se ejecutan contra un cliente simulado en memoria y pasan

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
