# ranking-social Specification

## Purpose

Permite consultar los logros publicos y el caracter DNA principal de los coleccionistas del Ranking Global y agregar sus destacados a las buscadas propias sin modificar datos ajenos ni duplicar figuras.

## Requirements

### Requirement: Mostrar solo el caracter DNA principal en ranking

La consulta autenticada del ranking SHALL calcular el caracter principal desde cantidades y ponderaciones privadas V2 vigentes. SHALL usar Newbie con contribucion cero, incluidos usuarios con solo logros de coleccion o sociales de pesos cero, y Explorer > Collector > Fan > Rarity Hunter para empates exactos antes del redondeo. Ningun logro de pesos cero ni pago directo SHALL diluir el denominador. La lectura SHALL NOT escribir porcentajes ni recalcular gamificacion ajena.

La proyeccion de rasgos SHALL respetar el contrato vigente de `ranking-global`: principal y como maximo dos rasgos agregados en Nivel/Coleccion, o solo el rasgo seleccionado al ordenar por DNA. Este requisito SHALL NOT restaurar la restriccion antigua de ocultar todos los porcentajes, ya superada por ese contrato. El texto DNA SHALL seguir sin accion para abrir un modal DNA ajeno; expansion, logros, regalos, miembros Top 10 y destacados SHALL conservar su comportamiento. Las respuestas publicas de logros SHALL NOT incluir pesos ni distribucion completa.

#### Scenario: Caracter principal de usuarios clasificados
- **WHEN** se carga el ranking tras la migracion V2
- **THEN** cada fila usa el DNA vigente y solo los rasgos publicos permitidos por el criterio seleccionado

#### Scenario: Usuario clasificado solo por regalos
- **WHEN** una cuenta tiene Bricks de regalos y solo logros de pesos cero
- **THEN** muestra Newbie, conservando Bricks, nivel y posicion derivados V2

#### Scenario: Empates consistentes con el panel propio
- **WHEN** hay empate exacto en el DNA del usuario activo clasificado
- **THEN** panel y ranking usan el mismo caracter principal segun la prioridad vigente

#### Scenario: Texto sin accion DNA
- **WHEN** se interactua con el texto DNA de una fila
- **THEN** no abre el modal DNA ajeno ni concede acceso a sus pesos, y siguen disponibles las acciones existentes

### Requirement: Consultar logros publicos de usuarios del ranking

El sistema SHALL exponer `GET /api/ranking/:userId/logros` para usuarios autenticados. Para un usuario del Top 10 vigente SHALL responder `200` con `userId`, `displayName`, `bricks`, `nivel` (objeto con `id` y `nombre`) y `logros`; cada logro SHALL contener exclusivamente `id`, `type` cuando exista, `nombre`, `descripcion` cuando exista, `bricks`, `repetible`, `cantidad` y `total`. SHALL NOT incluir correo, metadatos privados, catalogo completo, donantes ni datos de compra. La consulta SHALL ser de solo lectura y SHALL NOT recalcular, persistir ni incrementar gamificacion ajena. Las tablas privadas SHALL conservar su aislamiento por usuario, sin habilitar lectura general ni escrituras ajenas para este flujo.

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
- **WHEN** el UUID no pertenece al Top 10 vigente, incluido un usuario que dejo el ranking desde su apertura
- **THEN** recibe `404` con `{ "error": "USUARIO_NO_ENCONTRADO" }` sin revelar informacion privada

#### Scenario: Persistencia no disponible
- **WHEN** falla la consulta de los logros publicos
- **THEN** recibe `500` con `{ "error": "LOGROS_NO_DISPONIBLES" }` sin detalles internos ni credenciales

### Requirement: Abrir logros desde cada fila del ranking

Cada fila del Ranking Global SHALL incluir un boton que contenga solo la imagen `/toast_images/75206.png`, con nombre accesible y tooltip `Ver logros`. El conjunto boton de logros, imagen del nivel, numero del nivel y nombre del nivel SHALL aparecer a la derecha del contador de figuras en coleccion, tanto en escritorio como en movil. Al activarlo SHALL abrir el modal de logros en solo lectura con titulo `Logros de [Nombre del Usuario]`, usando exactamente el mismo nombre abreviado mostrado en la fila del ranking durante la carga y tras recibir la respuesta. SHALL mostrar nivel, Bricks y logros del usuario seleccionado, sin modificar el panel ni los logros propios, enviar regalos ni expandir o contraer la fila. Los botones SHALL ser acciones independientes, accesibles por teclado y sin anidarse dentro de otro boton.

#### Scenario: Ver logros de otro usuario
- **WHEN** el usuario activa `Ver logros` en una fila ajena
- **THEN** el modal muestra la cabecera y la informacion de esa fila en solo lectura
- **AND** el panel propio conserva nivel, Bricks y progreso originales

#### Scenario: Ver logros propios desde el ranking
- **WHEN** activa el boton de su propia fila
- **THEN** se muestra `Logros de [Nombre del Usuario]` con sus datos
- **AND** abrir despues los logros desde el panel propio restaura su titulo habitual y datos propios

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

### Requirement: Ofrecer alta de buscadas solo para destacados ausentes

Las tarjetas de los Top 3 por precio y antiguedad de otros usuarios SHALL mostrar un boton compacto de lupa con mas, equivalente a `+ lupa`, solo cuando el ID no exista en el catalogo completo de la cuenta autenticada, ni en `COLECCIÓN` ni en `BUSCADA`. La comprobacion SHALL usar el ID canonico sin distinguir mayusculas y espacios exteriores, con independencia de filtros, orden y pagina visibles. SHALL NOT mostrar el boton en tarjetas de la fila propia ni mientras se desconozca el catalogo completo. El boton SHALL tener nombre accesible y tooltip `Añadir a buscadas` y SHALL NOT activar acciones de la tarjeta o del acordeon.

#### Scenario: Figura ausente
- **WHEN** una tarjeta ajena representa un ID ausente del catalogo propio completamente cargado
- **THEN** muestra el boton de alta en ambos Top 3 donde aparezca ese ID

#### Scenario: Figura propia fuera de los resultados visibles
- **WHEN** el ID existe en la cuenta en cualquiera de los dos estados, aunque filtros o paginacion lo oculten
- **THEN** ninguna tarjeta ajena de ese ID muestra el boton

#### Scenario: Fila propia o catalogo pendiente
- **WHEN** se renderiza una tarjeta propia o aun no se conoce el catalogo completo
- **THEN** no se ofrece el boton de alta

### Requirement: Crear una buscada desde un destacado ajeno

Al activar el boton de alta SHALL abrirse el modal unificado con apariencia de edicion y metadatos de la figura precargados: ID deshabilitado y sombreado, Categoria, Subcategoria cuando exista, Año, Precio Brickset e Imagen. Nombre y Descripcion SHALL estar vacios, Nombre SHALL ser obligatorio y Descripcion opcional. El Precio Brickset SHALL ser opcional si Brickset indica `Not known`. BUSCADA SHALL estar seleccionado y fijo; seguimiento SHALL ser editable, inicialmente desactivado y sujeto al limite vigente. Los datos de compra SHALL permanecer vacios y deshabilitados. Guardar SHALL crear un nuevo registro de la cuenta autenticada mediante `POST /minifiguras`, nunca editar la figura ajena; SHALL NOT copiar nombre, descripcion, seguimiento, compras ni fecha de registro del propietario. Si faltan metadatos obligatorios, SHALL obtenerlos por el ID antes de permitir Guardar, sin pedir al usuario que complete campos Brickset.

#### Scenario: Apertura y validacion
- **WHEN** el usuario activa el boton de una figura ajena ausente
- **THEN** ve sus metadatos e imagen, Nombre y Descripcion vacios y BUSCADA fijo
- **AND** Guardar permanece deshabilitado hasta completar un Nombre no vacio y disponer de los metadatos obligatorios
- **AND** puede modificar seguimiento pero no ID, estado ni campos Brickset

#### Scenario: Metadatos incompletos
- **WHEN** los datos del destacado no bastan para un alta valida
- **THEN** la aplicacion completa los datos desde Brickset por el mismo ID y aplica las reglas vigentes de categorias y fallback de año
- **AND** si falla conserva el formulario, muestra error y no permite un alta incompleta

#### Scenario: Precio Brickset todavía desconocido
- **WHEN** Brickset indica `Not known` para el precio de un destacado
- **THEN** el alta rápida puede guardarse sin precio si Nombre y los demás metadatos obligatorios están disponibles
- **AND** los datos privados del propietario siguen sin copiarse

#### Scenario: Alta confirmada
- **WHEN** el servidor confirma la creacion de la buscada
- **THEN** el registro propio contiene el Nombre y Descripcion introducidos, BUSCADA y el seguimiento elegido
- **AND** conserva filtros y orden, actualiza cache y contadores y retira el boton de todas las tarjetas del mismo ID
- **AND** ningun dato del propietario original cambia

#### Scenario: Duplicado detectado al abrir o guardar
- **WHEN** la figura ya existe al abrir el formulario o el servidor rechaza el alta con `409 ID_DUPLICADO`
- **THEN** no se crea ni se sobrescribe ningun registro
- **AND** se comunica el duplicado y se actualiza la presencia propia sin alterar datos ajenos

#### Scenario: Seguimiento sin cupo
- **WHEN** el alta con seguimiento activo supera el limite vigente de diez observadas
- **THEN** se conserva el tratamiento de error y advertencia vigente sin crear un registro invalido

#### Scenario: Cancelacion y doble envio
- **WHEN** el usuario cancela o pulsa Guardar varias veces durante un envio
- **THEN** cancelar no persiste datos y un envio en curso no genera peticiones de alta duplicadas
- **AND** al cerrar el formulario el foco regresa al ranking, usando un destino accesible si el boton ya desaparecio
