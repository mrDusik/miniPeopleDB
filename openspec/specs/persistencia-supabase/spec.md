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

Las operaciones ordinarias SHALL seguir usando JWT y RLS; ranking, regalos, amistades, agradecimientos e historico propio SHALL NOT usar service_role. El proceso backend de recalcule tras un cambio valido de categorias, anios de serie o definiciones completas V2 SHALL usar exclusivamente las RPC administrativas allowlisted existentes para obtener fuentes minimas y aplicar el lote de estados y su fingerprint. Solo service_role SHALL poder invocarlas; lote y fingerprint SHALL persistirse atomicamente y las claves SHALL permanecer fuera de HTTP y navegador. La huella SHALL incluir categorias, metadatos de series, catalogo y pesos V2. Las fuentes SHALL incluir relaciones y ledger V2 necesarios para recalcular todos los usuarios afectados, incluso cuentas solo sociales, sin otorgar lectura global directa a tablas.

El worker diario SHALL conservar su acceso global limitado a RPC allowlisted, trabajo reclamado, fuentes minimas y escrituras protegidas por lease y version vigente. Estas excepciones SHALL NOT permitir una ruta ordinaria de reset ni RPC genericas para leer o escribir identidades elegidas por el cliente. La migracion puntual V2 SHALL ejecutarse por el operador propietario de la base de datos, fuera de las rutas web y del arranque habitual, sin introducir otra excepcion permanente de acceso global.

#### Scenario: Intento de llamar al recálculo administrativo con sesión de usuario
- **WHEN** anon o authenticated invocan una RPC administrativa
- **THEN** se rechaza sin obtener fuentes globales ni modificar filas

#### Scenario: Recalcular después de cambiar categorías
- **WHEN** el backend aplica una huella valida nueva
- **THEN** el lote usa inventarios, relaciones y ledger V2 vigentes y la siguiente lectura refleja el estado confirmado

#### Scenario: Recalcular usuarios actuales al desplegar nuevos logros
- **WHEN** arranca el backend con una huella V2 nueva tras completar la migracion
- **THEN** recalcula usuarios con fuentes vigentes sin nuevas altas, preserva regalos V2 y no repite una huella aplicada ni el reset

#### Scenario: Intento de llamar al cron administrativo con JWT ordinario
- **WHEN** anon o authenticated intentan gestionar un trabajo o capturar snapshots
- **THEN** se rechaza sin leer fuentes globales ni escribir filas

#### Scenario: Cron autorizado sin ampliar rutas ordinarias
- **WHEN** un trigger valido inicia el worker V2
- **THEN** solo sus RPC allowlisted usan service_role y las lecturas personales conservan JWT y RLS

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

Las tablas de perfiles públicos y donaciones SHALL tener RLS habilitado. Un usuario SHALL poder insertar y actualizar únicamente su propio perfil público; los datos de otros perfiles SHALL ser accesibles únicamente mediante las consultas limitadas del ranking o las proyecciones de búsqueda y perfil ajeno definidas por `amigos`, siempre con JWT autenticado. Cada proyección SHALL devolver exclusivamente los campos públicos definidos por ese contrato y SHALL NOT conceder lectura directa general de `perfiles_publicos`, `user_profiles`, minifiguras o gamificación. Un donante SHALL poder conocer si ya regaló a cada destinatario, pero ningún cliente SHALL poder alterar o eliminar directamente el historial de regalos.

#### Scenario: Modificar un perfil ajeno
- **WHEN** un usuario intenta actualizar directamente el perfil público de otro usuario
- **THEN** Supabase rechaza la operación mediante RLS

#### Scenario: Leer metadatos no públicos
- **WHEN** un usuario consulta el ranking, la búsqueda social o el resumen autenticado de perfil ajeno
- **THEN** no recibe correos, identidades de proveedor ni metadatos privados de autenticación
- **AND** la respuesta contiene únicamente la proyección permitida por el contrato correspondiente

#### Scenario: Evitar lectura directa general
- **WHEN** un cliente consulta directamente perfiles privados, minifiguras o gamificación de otra cuenta
- **THEN** RLS no devuelve filas ajenas y la autorización del resumen de perfil no amplía los grants directos

### Requirement: Garantizar una donación única y atómica

La persistencia SHALL imponer unicidad por pareja donante-receptor en regalos globales y por pareja-semana en regalos semanales. El registro, importe directo de 50 o 5 respectivamente, actualizacion de hitos V2, nivel, progreso y notificacion SHALL confirmarse en una unica transaccion; todo fallo SHALL revertir todos los pasos. Los hitos SHALL usar el contador combinado de regalos V2 recibidos y no sumar otra vez el importe directo como logro repetible. Los duplicados SHALL conservar los errores vigentes. El reset unico V2 SHALL retirar el ledger V1 y su elegibilidad consumida, sin borrar regalos nuevos en futuros arranques.

#### Scenario: Dos solicitudes concurrentes del mismo regalo
- **WHEN** dos peticiones intentan regalar la misma pareja y alcance
- **THEN** solo una tiene exito, aporta una vez el importe directo y evalua una vez los hitos vigentes

#### Scenario: Fallo al actualizar la gamificación
- **WHEN** falla la actualizacion de gamificacion o notificacion despues de registrar el regalo
- **THEN** no queda ledger, saldo ni notificacion parcialmente confirmados

### Requirement: Conservar regalos durante el recálculo de gamificación

El recalcule SHALL combinar logros V2 derivados del estado vigente, importes directos de regalos V2 y recompensas directas de agradecimientos que mantenga el contrato, sin duplicarlos ni convertirlos en logros V1. Las operaciones de coleccion SHALL NOT eliminar ni multiplicar 50 Bricks por regalo global ni 5 por semanal. Los regalos semanales SHALL conservar su semana y notificacion agradecible. Los hitos por numero de regalos SHALL usar una cuenta conjunta; los de agradecimientos SHALL corresponder a quien los emite. El reset inicial SHALL excluir las fuentes V1 y posteriores recalculos SHALL conservar solo fuentes V2 vigentes.

#### Scenario: Recalcular tras recibir un regalo
- **WHEN** una cuenta con un regalo global V2 y ningun otro requisito modifica su coleccion sin cumplir nuevos hitos
- **THEN** conserva 50 Bricks directos y 20 del primer regalo, sin el logro repetible V1

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

### Requirement: Persistir notificaciones privadas y recompensas de agradecimiento

Las notificaciones SHALL persistir por propietario con fecha y lectura. RLS SHALL permitir consultar y marcar solo las propias; clientes ordinarios SHALL NOT insertar, editar contenido, borrar notificaciones ni otorgarse recompensas. Realtime SHALL mantener ese aislamiento. Agradecer SHALL validar que el regalo V2 pertenece al actor, registrar una sola accion por regalo y confirmar atomicamente ledger, importe directo vigente al donante, notificacion y recalcule de hitos del emisor de las gracias. El donante SHALL NOT recibir el antiguo logro repetible de otros 5 Bricks. Los hitos V2 por agradecer SHALL ser 5 Bricks al primero y 30 al decimo, no un premio por cada agradecimiento.

El importe directo existente de **5 Bricks al donante original por agradecimiento** SHALL mantenerse como efecto no ligado a un logro; el catalogo V2 sustituye los logros anteriores, no este pago directo. El ledger V1 y todas sus recompensas SHALL desaparecer en la migracion unica. Los resumenes diarios SHALL escribirse solo desde RPC allowlisted del worker, sin cambiar la lectura de una notificacion al agradecer.

#### Scenario: Lectura y cambio de estado propios
- **WHEN** un usuario consulta o marca su bandeja
- **THEN** solo se accede a sus filas y se rechazan escrituras directas de contenido

#### Scenario: Intento de acceso a notificaciones ajenas
- **WHEN** un cliente consulta, modifica o se suscribe a notificaciones ajenas
- **THEN** RLS no revela ni modifica filas de otra cuenta

#### Scenario: Atomicidad del agradecimiento
- **WHEN** falla un paso al agradecer
- **THEN** se revierten ledger, importe directo, hitos, nivel y notificaciones de ambos participantes

#### Scenario: Worker diario autorizado
- **WHEN** el worker confirma una captura V2
- **THEN** puede escribir el resumen solo mediante RPC allowlisted y anon, authenticated y rutas ordinarias no acceden a esa escritura privilegiada

### Requirement: Resolver Username únicamente con prueba de contraseña

La RPC `resolver_acceso_username` SHALL ser la única excepción de acceso global para login: ejecutable por `anon`, con `SECURITY DEFINER` y search path fijo, SHALL resolver el email solo tras comprobar la contraseña contra el hash existente de Supabase Auth. SHALL NOT conceder lectura directa a `auth.users`, perfiles ni contadores privados, ni usar `service_role`. La limitación de cinco intentos por cuenta en ventanas de un minuto SHALL ser atómica, compartida entre instancias del servidor y case-insensitive. Los contadores SHALL eliminarse en cascada con la identidad. Supabase Auth SHALL seguir siendo la autoridad de emisión de sesiones.

#### Scenario: Resolución protegida y límite de intentos
- **WHEN** se invoca la RPC sin una contraseña válida o tras agotar cinco intentos de la cuenta en un minuto
- **THEN** devuelve null sin revelar si el Username existe
- **AND** la llamada no concede acceso a las tablas privadas
- **AND** una nueva ventana permite volver a autenticar sin guardar contraseñas ni hashes adicionales

### Requirement: Persistir perfiles privados y favoritos con RLS

El sistema SHALL almacenar username, estado de onboarding, avatar y preferencias de idioma y moneda en una tabla relacional `user_profiles` ligada por clave foránea a `auth.users`. Las categorías favoritas SHALL almacenarse como filas relacionales separadas y no como JSON. SHALL imponerse en la base de datos la unicidad del username sin distinguir mayúsculas/minúsculas y la validación del formato `/^[a-zA-Z0-9_]{3,20}$/`. RLS SHALL permitir a cada usuario consultar y modificar únicamente su perfil y sus favoritos. Por autorización explícita, `perfiles_publicos.display_name` SHALL contener el username guardado; la proyección SHALL conservar su esquema limitado para ranking y regalos y SHALL NOT exponer email ni preferencias privadas.

#### Scenario: Guardar perfil propio
- **WHEN** un usuario autenticado guarda su perfil y preferencias
- **THEN** los datos quedan asociados exclusivamente a `auth.uid()` en `user_profiles`
- **AND** las categorías favoritas quedan en filas relacionales separadas

#### Scenario: Rechazar username duplicado ignorando mayúsculas
- **WHEN** dos usuarios intentan guardar usernames iguales salvo por mayúsculas/minúsculas
- **THEN** la base de datos acepta como máximo uno
- **AND** el perfil rechazado no queda marcado como onboarding completo

#### Scenario: Rechazar username con formato inválido
- **WHEN** una escritura intenta guardar un username fuera del formato permitido
- **THEN** la base de datos la rechaza incluso si evita la validación de interfaz

#### Scenario: Aislar perfiles y favoritos por propietario
- **WHEN** un usuario consulta o modifica perfiles o favoritos de otro usuario
- **THEN** RLS no devuelve ni modifica filas ajenas

#### Scenario: Rechazar más de tres favoritas
- **WHEN** se intenta guardar más de tres favoritas o insertar directamente una cuarta fila
- **THEN** API, RPC y trigger rechazan el exceso sin reemplazar parcialmente los datos
- **AND** el trigger bloquea la fila padre para serializar cambios y permite sustituir una categoría existente cuando ya hay tres

#### Scenario: Conservar la proyección pública existente
- **WHEN** el perfil se crea o modifica
- **THEN** las respuestas actuales de ranking y regalos siguen exponiendo únicamente los campos permitidos por sus contratos
- **AND** el nombre público es el username autorizado, sin añadir correo, idioma, moneda ni categorías favoritas

#### Scenario: Eliminar identidad
- **WHEN** se elimina una fila de `auth.users`
- **THEN** se eliminan en cascada su perfil privado y sus categorías favoritas

### Requirement: Borrar únicamente la identidad del JWT

La RPC sin parámetros `eliminar_cuenta_usuario()` SHALL ser ejecutable solo por `authenticated`, con `SECURITY DEFINER` y search path vacío. SHALL exigir `auth.uid()` no nulo y rol autenticado; su única identidad objetivo SHALL ser ese UID. SHALL NOT aceptar un usuario objetivo, usar `service_role` ni conceder acceso directo a `auth.users`. El borrado y sus cascadas SHALL ser una sola transacción y cualquier fallo SHALL revertirla por completo.

#### Scenario: Aislamiento y atomicidad del borrado
- **WHEN** una cuenta autenticada invoca la RPC
- **THEN** solo se elimina su fila de Auth y las filas relacionadas por las cascadas existentes
- **AND** las identidades y datos propios de otras cuentas permanecen
- **AND** si una cascada o trigger falla, la cuenta y sus datos se conservan
- **AND** llamadas anónimas o sin un UID autenticado se rechazan

### Requirement: Persistir avatares con permisos por carpeta

El bucket público `profile-avatars` SHALL limitar archivos a 2 MiB y MIME PNG/JPEG/WebP. Las políticas SHALL permitir insertar únicamente en `<auth.uid()>/<uuid>.png|jpg|webp` y listar/borrar solo objetos de la carpeta del JWT, sin sobrescritura ni service_role. El perfil SHALL guardar solo la URL, nunca el archivo ni una imagen base64. El borrado de cuenta SHALL limpiar su carpeta mediante Storage antes de invocar la RPC de Auth; un fallo de Storage SHALL impedir eliminar la identidad. La eliminación física de archivos no forma parte del rollback SQL posterior.

#### Scenario: Rechazar accesos a archivos ajenos
- **WHEN** una cuenta intenta subir o borrar en otra carpeta o subir SVG/rutas anidadas
- **THEN** la política rechaza la operación
- **AND** la lectura pública de imágenes no concede lectura de preferencias ni perfiles privados

### Requirement: Persistir solicitudes y amistades con aislamiento por usuario

La persistencia SHALL garantizar una solicitud por pareja y una amistad canonica bidireccional, impidiendo autorrelaciones, duplicados y reenvios tras rechazo. Cada participante SHALL consultar solo sus solicitudes y amistades. Enviar, rechazar y aceptar SHALL validar JWT y confirmar atomicamente relacion, fuentes de logros V2, gamificacion y notificaciones correspondientes, sin service_role, selectores arbitrarios ni acceso general ajeno. Los datos de emisor y receptor SHALL mantenerse mientras la solicitud/amistad siga vigente para reconstruir First contact y Handshake.

Cualquiera de los amigos SHALL poder eliminar la amistad por RPC derivada de auth.uid(). SHALL borrar relacion, solicitud aceptada y notificaciones vinculadas por cascada y recalcular las consecuencias V2 para ambos en una sola transaccion. SHALL liberar la pareja, bloquear terceros y no eliminar solicitudes pendientes/rechazadas ni colecciones o regalos. Aceptar y eliminar SHALL serializarse sobre la solicitud, ser idempotentes y revertir todo ante fallo. Las cascadas por eliminacion de cuenta SHALL actualizar tambien al superviviente afectado.

Las proyecciones limitadas de busqueda/listas SHALL conservar total de coleccion y resumen DNA del ranking por defecto, sin revelar entradas ni pesos. Los contadores SHALL derivarse del JWT sin selector de identidad, con pendientes/rechazadas para las listas; dichos contadores de UI SHALL NOT confundirse con las condiciones mas restringidas de First contact.

#### Scenario: Aislar consultas y mutaciones
- **WHEN** un usuario intenta leer o modificar relaciones de terceros
- **THEN** la operacion se rechaza sin revelar fuentes ni recalcular cuentas arbitrarias

#### Scenario: Aceptar una solicitud rechazada
- **WHEN** el receptor acepta una solicitud antes rechazada
- **THEN** hay una amistad y una notificacion de aceptacion y se recalculan los hitos de ambos

#### Scenario: Revertir una operación incompleta
- **WHEN** falla relacion, gamificacion o evento asociado
- **THEN** se revierten conjuntamente todos los cambios de la operacion

#### Scenario: Eliminar atómicamente y solicitar de nuevo
- **WHEN** un participante elimina una amistad
- **THEN** desaparecen relacion, solicitud y notificaciones ligadas y se actualiza la gamificacion de ambos
- **AND** puede solicitarse de nuevo sin alterar colecciones, regalos ni relaciones de terceros

#### Scenario: Aislar contadores y resúmenes
- **WHEN** se consultan contadores y resumenes con un JWT
- **THEN** solo se devuelven los contadores propios y la proyeccion publica autorizada, sin nuevos grants directos

### Requirement: Migrar a V2 una sola vez y sin efectos historicos ficticios

La migracion SHALL conservar Auth, usernames, perfiles privados/publicos, avatares, preferencias, favoritos, minifiguras con sus estados/datos y solicitudes/amistades actuales. Como unica normalizacion de referencias de inventario SHALL canonicalizar los dos aliases de subcategoria `Collectible Minifigures` enumerados en `categorias-brickset`; SHALL actualizar solo `minifiguras.subcategoria` de filas con coincidencia exacta y conservar todos los demas campos y totales manuales. SHALL resetear regalos globales/semanales V1, agradecimientos V1, sus restricciones consumidas, todas las notificaciones, snapshots completos V1 y estado derivado de logros, Bricks, nivel, progreso y pertenencia a ranking. SHALL reconstruir todos los usuarios existentes con reglas V2, incluidas cuentas sin actividad, sin conservar recompensas V1. La captura diaria posterior SHALL empezar un historico V2 nuevo, sin backfill ni diferencias contra V1.

El reset SHALL ser una operacion de despliegue explicita, con confirmacion del proyecto, backup previo y una marca de version durable. Solo para la base desechable de pruebas con project ref `wvcnftjhvcdxmuqpjqda`, el propietario MAY omitir el backup mediante la confirmacion explicita `--test-no-backup`; este bypass SHALL rechazarse para cualquier otro project ref. Produccion y los demas proyectos SHALL requerir backup restaurable. El reset SHALL bloquear escrituras ordinarias y detener o invalidar workers activos durante la transicion, incluyendo cron y recalcule global, para impedir estados mixtos y escrituras tardias V1. Fallar SHALL conservar o recuperar el estado anterior sin publicar una migracion parcial. Repetir la operacion tras exito SHALL NOT borrar datos V2, notificaciones nuevas ni recompensas nuevas. Arrancar, redesplegar o cambiar categorias SHALL NOT ejecutar el reset otra vez.

El recalcule inicial SHALL ser silencioso: sin nuevas notificaciones, toasts pendientes de logros/nivel, resumenes diarios ni avisos de entrada/salida sinteticos. La nueva pertenencia global SHALL establecerse como base sin eventos. El semanal SHALL respetar la activacion V2 acordada. No SHALL existir una ruta HTTP ordinaria de reset ni una ampliacion permanente de service_role fuera de las excepciones existentes.

#### Scenario: Cuenta con inventario y relaciones V1
- **WHEN** se confirma la migracion V2
- **THEN** conserva identidad, inventario y relaciones, obtiene solo recompensas V2 derivadas de esas fuentes y no conserva regalos, agradecimientos, notificaciones ni snapshots V1

#### Scenario: Reconciliar aliases aprobados
- **WHEN** una fila de minifiguras usa exactamente uno de los dos aliases locales aprobados
- **THEN** la transaccion V2 conserva la fila y sustituye solo `subcategoria` por su ruta canonica
- **AND** la reconstruccion de logros usa la nueva referencia y no duplica ni elimina la figura

#### Scenario: Reintento despues de regalos nuevos
- **WHEN** la migracion ya confirmada se solicita de nuevo tras recibir un regalo V2
- **THEN** detecta la marca aplicada y no borra ni recalcula como V1 el regalo nuevo

#### Scenario: Fallo o worker tardio
- **WHEN** falla una escritura de la transicion o llega un checkpoint de un worker V1 invalidado
- **THEN** no se publica un estado parcial ni se recrean snapshots, notificaciones o recompensas V1

#### Scenario: Proteccion por rol
- **WHEN** anon, authenticated o una ruta ordinaria intenta iniciar el reset o elegir usuarios a resetear
- **THEN** se deniega sin cambios y sin acceso a fuentes globales
