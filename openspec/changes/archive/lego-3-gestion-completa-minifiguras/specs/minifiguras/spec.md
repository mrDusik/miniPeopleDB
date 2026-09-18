# Spec Delta

## MODIFIED Requirements

### Requirement: Listar minifiguras desde persistencia local
El sistema SHALL exponer `GET /minifiguras` y SHALL obtener la colección desde un archivo JSON local, sin depender de una base de datos o servicio externo. Cada minifigura del catalogo valido SHALL incluir `id`, `nombre`, `descripcion`, `tematica` y `anio`; `estadoColeccion` puede estar ausente. El parámetro de consulta `tema` SHALL filtrar por el campo `tematica`.

#### Scenario: Catálogo con minifiguras disponibles
- **WHEN** un cliente realiza `GET /minifiguras` y el archivo JSON contiene una colección válida
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo es JSON con un arreglo de minifiguras
- **AND** cada minifigura incluye `id`, `nombre`, `descripcion`, `tematica` y `anio`

#### Scenario: Catálogo vacío
- **WHEN** un cliente realiza `GET /minifiguras` y el archivo JSON contiene una colección vacía
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo contiene un arreglo vacío

#### Scenario: Filtrado por temática compatible
- **WHEN** un cliente realiza `GET /minifiguras?tema=espacio`
- **THEN** el sistema responde con HTTP `200`
- **AND** devuelve solo las minifiguras cuyo campo `tematica` coincide con el valor solicitado

### Requirement: Gestionar minifiguras en persistencia local
El sistema SHALL permitir crear, reemplazar y eliminar minifiguras mediante `POST /minifiguras`, `PUT /minifiguras/:id` y `DELETE /minifiguras/:id`, respectivamente. Cada operación exitosa SHALL persistir su resultado en el archivo JSON local y las lecturas posteriores SHALL observar el estado actualizado.

#### Scenario: Crear una minifigura válida
- **WHEN** un cliente envía `POST /minifiguras` con un cuerpo JSON que contiene un `id` no usado y valores válidos para `id`, `nombre`, `descripcion`, `tematica` y `anio`
- **THEN** el sistema responde con HTTP `201`
- **AND** el cuerpo contiene la minifigura creada
- **AND** la minifigura se agrega al final del catalogo persistido

#### Scenario: Reemplazar una minifigura existente
- **WHEN** un cliente envía `PUT /minifiguras/:id` con una minifigura válida cuyo `id` coincide exactamente con el identificador de la ruta
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo contiene la minifigura de reemplazo
- **AND** la minifigura conserva su posición relativa en el catalogo persistido

#### Scenario: Eliminar una minifigura existente
- **WHEN** un cliente envía `DELETE /minifiguras/:id` para un identificador existente
- **THEN** el sistema responde con HTTP `204`
- **AND** la respuesta no incluye cuerpo
- **AND** el identificador deja de aparecer en las lecturas posteriores del catalogo

### Requirement: Validar escrituras y conflictos de minifiguras
El sistema SHALL aceptar cuerpos de escritura únicamente como objetos JSON con `id`, `nombre`, `descripcion` y `tematica` de texto no vacío, y `anio` como número entero. El sistema SHALL rechazar identificadores duplicados al crear, identificadores de cuerpo distintos al de la ruta al reemplazar y recursos inexistentes al reemplazar o eliminar. El catalogo persistido SHALL conservar identificadores únicos y JSON válido tras una operación fallida.

#### Scenario: Cuerpo JSON ausente, mal formado o datos inválidos
- **WHEN** un cliente intenta crear o reemplazar una minifigura sin un objeto JSON válido o sin alguno de los campos obligatorios válidos
- **THEN** el sistema responde con HTTP `400`
- **AND** el cuerpo JSON contiene `{ "error": "MINIFIGURA_INVALIDA" }`
- **AND** el catalogo persistido no cambia

#### Scenario: Identificador duplicado al crear
- **WHEN** un cliente envía `POST /minifiguras` con un `id` ya presente en el catalogo
- **THEN** el sistema responde con HTTP `409`
- **AND** el cuerpo JSON contiene `{ "error": "ID_DUPLICADO" }`
- **AND** el catalogo persistido no cambia

#### Scenario: Identificador de cuerpo distinto al de la ruta
- **WHEN** un cliente envía `PUT /minifiguras/:id` con un `id` de cuerpo distinto
- **THEN** el sistema responde con HTTP `400`
- **AND** el cuerpo JSON contiene `{ "error": "MINIFIGURA_INVALIDA" }`
- **AND** el catalogo persistido no cambia

#### Scenario: Minifigura inexistente
- **WHEN** un cliente intenta reemplazar o eliminar un `id` que no aparece en el catalogo
- **THEN** el sistema responde con HTTP `404`
- **AND** el cuerpo JSON contiene `{ "error": "MINIFIGURA_NO_ENCONTRADA" }`
- **AND** el catalogo persistido no cambia