# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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