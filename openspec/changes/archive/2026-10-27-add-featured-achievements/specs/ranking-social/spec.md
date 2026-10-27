# Spec Delta

## MODIFIED Requirements

### Requirement: Consultar logros publicos de usuarios del ranking

El sistema SHALL exponer `GET /api/ranking/:userId/logros` para usuarios autenticados. Para un usuario del Top 10 vigente SHALL responder `200` con `userId`, `displayName`, `bricks`, `nivel` (objeto con `id` y `nombre`) y `logros`; cada logro SHALL contener exclusivamente `id`, `type` cuando exista, `nombre`, `descripcion` cuando exista, `bricks`, `repetible`, `cantidad`, `total` y el indicador booleano publico `destacado`. SHALL conservarse tambien la elegibilidad vigente del ranking semanal definida en `ranking-semanal`. La lista SHALL respetar el orden comun de `logros-destacados` usando la seleccion del usuario consultado. SHALL NOT incluir correo, metadatos privados, catalogo completo, donantes ni datos de compra. La consulta SHALL ser de solo lectura y SHALL NOT limpiar estrellas, recalcular, persistir ni incrementar gamificacion ajena. Las tablas privadas SHALL conservar su aislamiento por usuario, sin habilitar lectura general ni escrituras ajenas para este flujo.

#### Scenario: Consulta autenticada valida
- **WHEN** un usuario autenticado consulta los logros de otro usuario del Top 10
- **THEN** recibe sus logros, nivel, nombre publico y Bricks con la proyeccion definida
- **AND** ningun registro de gamificacion ni minifiguras cambia

#### Scenario: Usuario sin logros
- **WHEN** el usuario clasificado tiene una lista de logros vacia
- **THEN** la respuesta contiene `logros: []` y conserva el resto de su informacion publica

#### Scenario: Peticion sin sesion
- **WHEN** se consulta la ruta sin una sesion valida
- **THEN** el sistema responde `401` segun el contrato de autenticacion existente y no devuelve logros

#### Scenario: Identificador mal formado
- **WHEN** un usuario autenticado consulta un `userId` que no es un UUID valido
- **THEN** recibe `400` con `{ "error": "USUARIO_INVALIDO" }`

#### Scenario: Usuario inexistente o fuera del ranking
- **WHEN** el UUID no pertenece al Top 10 vigente ni es elegible por el ranking semanal, incluido un usuario que dejo ambos rankings desde su apertura
- **THEN** recibe `404` con `{ "error": "USUARIO_NO_ENCONTRADO" }` sin revelar informacion privada

#### Scenario: Persistencia no disponible
- **WHEN** falla la consulta de los logros publicos
- **THEN** recibe `500` con `{ "error": "LOGROS_NO_DISPONIBLES" }` sin detalles internos ni credenciales

#### Scenario: Estrellas del titular y acceso semanal conservado
- **WHEN** se consultan logros de un usuario elegible solo por el ranking semanal que tiene destacados diferentes de los del espectador
- **THEN** la consulta sigue autorizada y expone exclusivamente la seleccion del titular con el orden comun

### Requirement: Abrir logros desde cada fila del ranking

Cada fila del Ranking Global SHALL incluir un boton que contenga solo la imagen `/toast_images/75206.png`, con nombre accesible y tooltip `Ver logros`. El conjunto boton de logros, imagen del nivel, numero del nivel y nombre del nivel SHALL aparecer a la derecha del contador de figuras en coleccion, tanto en escritorio como en movil. Al activarlo SHALL abrir el modal de logros en solo lectura con titulo `Logros de [Nombre del Usuario]`, usando exactamente el mismo nombre abreviado mostrado en la fila del ranking durante la carga y tras recibir la respuesta. SHALL mostrar nivel, Bricks y logros del usuario seleccionado con el orden comun de `logros-destacados` e indicadores no editables en sus logros destacados, sin modificar el panel ni los logros propios, enviar regalos ni expandir o contraer la fila. La edicion de estrellas SHALL ofrecerse exclusivamente desde el modal propio de Logros, no desde consultas publicas del ranking aunque correspondan a la fila propia. Los botones SHALL ser acciones independientes, accesibles por teclado y sin anidarse dentro de otro boton.

#### Scenario: Ver logros de otro usuario
- **WHEN** el usuario activa `Ver logros` en una fila ajena
- **THEN** el modal muestra la cabecera y la informacion de esa fila en solo lectura, con sus destacados prioritarios e indicadores sin accion
- **AND** el panel propio conserva nivel, Bricks y progreso originales

#### Scenario: Ver logros propios desde el ranking
- **WHEN** activa el boton de su propia fila
- **THEN** se muestra `Logros de [Nombre del Usuario]` con sus datos en solo lectura
- **AND** abrir despues los logros desde el panel propio restaura su titulo habitual, datos propios y estrellas editables

#### Scenario: Carga, error y lista vacia
- **WHEN** la consulta esta pendiente, falla o devuelve una lista vacia
- **THEN** el modal muestra respectivamente carga, un error controlado o un estado sin logros
- **AND** no muestra logros de una consulta anterior ni los atribuye al usuario seleccionado

#### Scenario: Cerrar y devolver foco
- **WHEN** se cierra el modal mediante Cerrar o Escape
- **THEN** el foco vuelve al boton que lo abrio dentro del ranking y se conserva el estado del acordeon

#### Scenario: Sesion o seleccion cambia durante la carga
- **WHEN** la sesion termina o cambia, el modal se cierra o se selecciona otro usuario antes de recibir la respuesta
- **THEN** la respuesta obsoleta no modifica el modal ni los datos de la sesion actual
