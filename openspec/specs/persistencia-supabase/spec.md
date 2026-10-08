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

### Requirement: Limitar el acceso privilegiado al recálculo automático de categorías

Las operaciones ordinarias de usuario SHALL seguir usando el JWT autenticado y RLS, y las consultas de ranking, mutaciones de regalos y lecturas historicas propias SHALL NOT usar `service_role`. Se permite la excepcion existente para el proceso backend que recalcula gamificacion despues de un cambio valido en `data/categorias-brickset.json` o al arrancar con definiciones de objetivos nuevas sobre categorias validas: SHALL llamar unicamente a la RPC administrativa definida para aplicar el lote de estados y su fingerprint, SHALL requerir `service_role`, y SHALL mantener la clave fuera de respuestas HTTP y codigo de navegador. La RPC SHALL rechazar roles distintos de `service_role` y SHALL persistir lote y fingerprint en una sola transaccion. La huella SHALL incluir categorias y definiciones de objetivos para actualizar usuarios existentes sin nuevas altas de figuras. Se permite adicionalmente el trabajador backend de analitica diaria iniciado por el cron autenticado: su acceso global SHALL limitarse a RPC allowlisted para gestionar ejecuciones, obtener fuentes minimas, aplicar precios/recalculos y capturar snapshots. Las RPC diarias SHALL rechazar `anon` y `authenticated`, limitar escrituras al trabajo reclamado y conservar la privacidad de datos de Auth y ponderaciones; SHALL NOT ser accesibles desde rutas ordinarias ni navegador.

#### Scenario: Intento de llamar al recálculo administrativo con sesión de usuario
- **WHEN** un rol `anon` o `authenticated` invoca la RPC de recálculo global
- **THEN** la base de datos rechaza la operación sin modificar filas

#### Scenario: Recalcular después de cambiar categorías
- **WHEN** el proceso backend aplica la huella nueva del catálogo
- **THEN** cada fila de gamificación se calcula desde las minifiguras actuales y los regalos recibidos
- **AND** la siguiente lectura de DNA y Ranking Global refleja los valores persistidos

#### Scenario: Recalcular usuarios actuales al desplegar nuevos logros
- **WHEN** arranca el backend con nuevos objetivos y categorías válidas aunque su JSON no haya cambiado
- **THEN** recalcula los logros, Bricks, nivel y progreso de todos los usuarios con gamificación, figuras o regalos existentes
- **AND** conserva los regalos recibidos y una huella ya aplicada no vuelve a escribir los estados

#### Scenario: Intento de llamar al cron administrativo con JWT ordinario
- **WHEN** `anon` o `authenticated` intenta gestionar un trabajo diario o capturar snapshots mediante RPC
- **THEN** la base de datos rechaza la llamada sin leer fuentes globales ni modificar filas

#### Scenario: Cron autorizado sin ampliar rutas ordinarias
- **WHEN** un trigger valido activa el trabajador diario backend
- **THEN** solo ese trabajador usa las RPC diarias con `service_role`, y consultar el historico propio sigue usando JWT y RLS

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

### Requirement: Proteger snapshots y checkpoints de analitica

La tabla historica SHALL tener RLS habilitado y permitir a `authenticated` unicamente SELECT de filas con `user_id = auth.uid()`. Clientes ordinarios SHALL NOT poder insertar, actualizar ni eliminar mediciones, ni acceder a ejecuciones, leases, checkpoints o la cache privada global de precios. Las tablas internas del trabajo y `private.daily_sync_figure_prices` SHALL carecer de grants para `public`, `anon` y `authenticated`; las RPC administrativas SHALL comprobar rol ademas de restringir EXECUTE. La cache global SHALL guardar solo IDs canonicos, precios Brickset no negativos y `fetched_at`; su lectura/escritura ocurrira exclusivamente dentro de RPC allowlisted del worker. El historial SHALL borrarse en cascada al eliminar la cuenta y SHALL NOT publicarse mediante ranking o perfiles.

#### Scenario: Lectura y escritura directas
- **WHEN** un cliente autenticado intenta leer snapshots ajenos, cambiar propios o consultar checkpoints
- **THEN** no obtiene filas ajenas ni checkpoints y las escrituras son rechazadas

#### Scenario: Borrar cuenta
- **WHEN** se elimina una cuenta de `auth.users`
- **THEN** se eliminan sus snapshots sin afectar historicos de otras cuentas

#### Scenario: Cache de precios inaccesible a clientes
- **WHEN** roles `anon` o `authenticated` consultan o mutan `private.daily_sync_figure_prices`
- **THEN** Postgres deniega el acceso directo; solo RPC allowlisted con `service_role` pueden utilizarla
