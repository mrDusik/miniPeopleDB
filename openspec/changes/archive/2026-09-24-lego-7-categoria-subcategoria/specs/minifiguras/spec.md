# Spec Delta

## MODIFIED Requirements

### Requirement: Listar minifiguras desde persistencia local

El sistema SHALL exponer `GET /minifiguras` y SHALL obtener la colección desde un archivo JSON local, sin depender de una base de datos ni de la disponibilidad de Brickset. Cada minifigura SHALL conservar en su raíz los campos opcionales `precioCompra`, `fechaCompra` y `precio`, todos expresados en Euros, y su `estadoColeccion` SHALL ser `COLECCIÓN` o `BUSCADA`. Cada minifigura SHALL identificar su categoría oficial mediante el campo `categoria` y, opcionalmente, su subcategoría oficial mediante el campo `subcategoria`.

#### Scenario: Catálogo con minifiguras disponibles
- **WHEN** un cliente realiza `GET /minifiguras` y el archivo JSON contiene una colección válida
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo es JSON con un arreglo de minifiguras
- **AND** cada minifigura incluye al menos `id`, `nombre` y `descripcion`
- **AND** los campos planos de precio se devuelven sin consultar Brickset

#### Scenario: Catálogo vacío
- **WHEN** un cliente realiza `GET /minifiguras` y el archivo JSON contiene una colección vacía
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo contiene un arreglo vacío

### Requirement: Filtrar minifiguras por características

El sistema SHALL permitir filtrar `GET /minifiguras` por `id`, `categoria`, `subcategoria`, `anio` y `estadoColeccion`, rechazando estados de filtro distintos de `COLECCIÓN` y `BUSCADA`.

#### Scenario: Filtro válido
- **WHEN** el cliente envía uno o más filtros válidos
- **THEN** el sistema devuelve solo las minifiguras coincidentes con HTTP `200`

#### Scenario: Filtro por id
- **WHEN** el cliente envía un filtro `id` con un texto parcial o completo
- **THEN** el sistema devuelve solo las minifiguras cuyo `id` coincide

#### Scenario: Filtro por subcategoría sin categoría
- **WHEN** el cliente envía `subcategoria` sin `categoria`
- **THEN** el sistema devuelve solo las minifiguras cuya `subcategoria` coincide, sin exigir `categoria`

#### Scenario: Estado de filtro inválido
- **WHEN** el cliente envía un `estadoColeccion` distinto de los estados permitidos
- **THEN** el sistema responde con HTTP `400`
- **AND** identifica el parámetro inválido

## ADDED Requirements

### Requirement: Mantener la coherencia entre categoría y subcategoría

Cuando una minifigura declare `subcategoria`, el sistema SHALL validar que su `categoria` exista en el catálogo local de categorías y que la `subcategoria` indicada pertenezca a esa `categoria`. Una minifigura cuya `categoria` no tenga subcategorías registradas no SHALL declarar `subcategoria`.

#### Scenario: Categoría y subcategoría coherentes
- **WHEN** se crea o actualiza una minifigura con una `subcategoria` que pertenece a la `categoria` indicada
- **THEN** la operación se completa correctamente

#### Scenario: Subcategoría de otra categoría
- **WHEN** se crea o actualiza una minifigura cuya `subcategoria` no pertenece a la `categoria` indicada
- **THEN** el sistema responde con HTTP `400`
- **AND** no modifica el catálogo

#### Scenario: Subcategoría sin categoría con subcategorías registradas
- **WHEN** se crea o actualiza una minifigura sin `subcategoria` aunque su `categoria` tenga subcategorías registradas
- **THEN** la operación se completa correctamente, ya que `subcategoria` es siempre opcional
