# Spec Delta

## ADDED Requirements

### Requirement: Mantener datos existentes con temas oficiales

El archivo inicial de minifiguras SHALL contener únicamente temas oficiales de Brickset y SHALL conservar los estados `COLECCIÓN` y `BUSCADA`. La migración SHALL sustituir nombres históricos por su categoría oficial equivalente, incluyendo `Series 5` por `Collectible Minifigures`.

#### Scenario: Validar la migración del archivo inicial
- **WHEN** se carga el archivo inicial después de la migración
- **THEN** todas sus minifiguras tienen una `tematica` presente en el catálogo oficial
- **AND** ninguna figura cambia su `estadoColeccion` por efecto de la migración

## MODIFIED Requirements

### Requirement: Listar minifiguras desde persistencia local

El sistema SHALL exponer `GET /minifiguras` y SHALL obtener la colección desde un archivo JSON local, sin depender de una base de datos ni de la disponibilidad de Brickset. Cada minifigura SHALL conservar en su raíz los campos opcionales `precioCompra`, `fechaCompra` y `precio`, todos expresados en Euros, y su `estadoColeccion` SHALL ser `COLECCIÓN` o `BUSCADA`. El valor de `tematica` SHALL coincidir exactamente con uno de los nombres del catálogo local de temas oficiales.

#### Scenario: Catálogo con minifiguras disponibles
- **WHEN** un cliente realiza `GET /minifiguras` y los archivos JSON contienen colecciones válidas
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo es JSON con un arreglo de minifiguras
- **AND** cada minifigura incluye al menos `id`, `nombre`, `descripcion` y una `tematica` oficial
- **AND** los campos planos de precio se devuelven sin consultar Brickset

#### Scenario: Catálogo con un tema no oficial
- **WHEN** un cliente realiza `GET /minifiguras` y una minifigura contiene una `tematica` ausente del catálogo oficial local
- **THEN** el sistema responde con HTTP `500`
- **AND** identifica el catálogo como inválido sin devolver la minifigura incompatible

#### Scenario: Catálogo vacío
- **WHEN** un cliente realiza `GET /minifiguras` y el archivo JSON contiene una colección vacía
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo contiene un arreglo vacío

### Requirement: Filtrar minifiguras por características

El sistema SHALL permitir filtrar `GET /minifiguras` por `tema`, `anio` y `estadoColeccion`, rechazando estados de filtro distintos de `COLECCIÓN` y `BUSCADA`. Cuando se proporciona `tema`, SHALL aceptar únicamente un nombre presente en el catálogo oficial local y SHALL rechazar cualquier otro valor.

#### Scenario: Filtro válido
- **WHEN** el cliente envía uno o más filtros válidos, incluido un tema oficial
- **THEN** el sistema devuelve solo las minifiguras coincidentes con HTTP `200`

#### Scenario: Tema de filtro inexistente
- **WHEN** el cliente envía un `tema` que no aparece en el catálogo oficial local
- **THEN** el sistema responde con HTTP `400`
- **AND** identifica `tema` como parámetro inválido

#### Scenario: Estado de filtro inválido
- **WHEN** el cliente envía un `estadoColeccion` distinto de los estados permitidos
- **THEN** el sistema responde con HTTP `400`
- **AND** identifica el parámetro inválido

### Requirement: Gestionar el catálogo mediante CRUD

El sistema SHALL permitir crear, reemplazar y eliminar minifiguras mediante `POST /minifiguras`, `PUT /minifiguras/:id` y `DELETE /minifiguras/:id`, manteniendo el orden y la persistencia atómica. Los campos planos enviados SHALL validarse contra el modelo permitido y `tematica` SHALL ser un nombre oficial presente en el catálogo local.

#### Scenario: Crear una minifigura válida
- **WHEN** el cliente envía una minifigura válida con un ID no usado y una `tematica` oficial
- **THEN** el sistema responde con HTTP `201` y persiste la figura

#### Scenario: Rechazar una minifigura con tema no oficial
- **WHEN** el cliente intenta crear o reemplazar una minifigura con una `tematica` ausente del catálogo oficial
- **THEN** el sistema responde con HTTP `400`
- **AND** no modifica el catálogo

#### Scenario: Rechazar ID duplicado
- **WHEN** el cliente intenta crear una minifigura con un ID existente
- **THEN** el sistema responde con HTTP `409`
- **AND** no modifica el catálogo

#### Scenario: Reemplazar una minifigura existente
- **WHEN** el cliente envía un reemplazo válido con el mismo ID de la ruta
- **THEN** el sistema responde con HTTP `200`
- **AND** conserva la posición de la figura

#### Scenario: Eliminar una minifigura existente
- **WHEN** el cliente solicita `DELETE /minifiguras/:id` para una figura existente
- **THEN** el sistema responde con HTTP `204`
- **AND** elimina la figura del catálogo
