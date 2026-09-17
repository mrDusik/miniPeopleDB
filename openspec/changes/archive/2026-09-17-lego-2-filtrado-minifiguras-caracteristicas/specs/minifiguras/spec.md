# Spec Delta

## MODIFIED Requirements

### Requirement: Filtrar minifiguras por características
El sistema SHALL permitir consultar `GET /minifiguras` con filtros opcionales por `tema`, `anio` y `estadoColeccion`, y SHALL devolver únicamente las minifiguras que coinciden con todos los criterios presentes.

#### Scenario: Catálogo sin filtros
- **WHEN** un cliente realiza `GET /minifiguras` sin parámetros de consulta
- **THEN** el sistema responde con HTTP `200`
- **AND** devuelve la colección completa en el mismo orden en que aparece en el archivo JSON

#### Scenario: Filtrado por tema
- **WHEN** un cliente realiza `GET /minifiguras?tema=espacio`
- **THEN** el sistema responde con HTTP `200`
- **AND** devuelve solo las minifiguras cuyo campo `tema` coincida con el valor solicitado, sin alterar el orden del catálogo original

#### Scenario: Filtrado por año
- **WHEN** un cliente realiza `GET /minifiguras?anio=2023`
- **THEN** el sistema responde con HTTP `200`
- **AND** devuelve solo las minifiguras cuyo campo `anio` coincida con el valor solicitado

#### Scenario: Filtrado por estado de colección
- **WHEN** un cliente realiza `GET /minifiguras?estadoColeccion=coleccion`
- **THEN** el sistema responde con HTTP `200`
- **AND** devuelve solo las minifiguras cuyo estado de colección coincida con el valor solicitado

#### Scenario: Filtros combinados
- **WHEN** un cliente realiza una solicitud con varios filtros a la vez, por ejemplo `?tema=espacio&anio=2023&estadoColeccion=coleccion`
- **THEN** el sistema responde con HTTP `200`
- **AND** aplica una intersección lógica entre los criterios presentes
- **AND** devuelve solo las minifiguras que cumplen todos los filtros simultáneamente

#### Scenario: Año inválido
- **WHEN** un cliente realiza `GET /minifiguras` con un parámetro `anio` que no representa un número entero
- **THEN** el sistema responde con HTTP `400`
- **AND** el cuerpo identifica `anio` como un parámetro inválido

### Requirement: Mantener compatibilidad con el listado base
La implementación SHALL conservar el comportamiento existente de `GET /minifiguras` cuando no se proporcionan parámetros de filtro y SHALL no introducir cambios de ruptura en el contrato del catálogo actual.

#### Scenario: Compatibilidad de la lectura base
- **WHEN** se consulta el catálogo sin ningún parámetro de filtro
- **THEN** la respuesta sigue siendo un arreglo JSON válido de minifiguras
- **AND** el contenido y el orden coinciden con la colección persistida en disco
