# Spec Delta

## ADDED Requirements

### Requirement: Consultar categoría, subcategoría, año y precio individuales de Brickset

El sistema SHALL exponer `GET /minifiguras/:id/brickset` que consulte la misma página pública `https://brickset.com/minifigs/<ID>` y extraiga en una sola consulta la categoría oficial, la subcategoría (cuando la página la publique), el año de lanzamiento y el precio asociado a `Current Value - New`. El sistema SHALL resolver la categoría y, si aplica, la subcategoría extraídas contra el catálogo local de categorías (`data/categorias-brickset.json`) antes de responder.

#### Scenario: Datos completos y categoría reconocida
- **WHEN** se consultan los datos de una minifigura con una página Brickset válida cuya categoría existe en el catálogo local
- **THEN** el sistema responde con HTTP `200` y devuelve `categoria`, `anio` y `precio`
- **AND** incluye `subcategoria` únicamente si la subcategoría extraída pertenece a las subcategorías registradas localmente para esa categoría

#### Scenario: Categoría no reconocida en el catálogo local
- **WHEN** la categoría extraída de Brickset no coincide con ninguna categoría del catálogo local
- **THEN** el sistema responde con HTTP `502`
- **AND** identifica un error controlado sin exponer HTML bruto

#### Scenario: Página sin categoría o año
- **WHEN** la página no existe o no contiene una categoría o un año interpretables
- **THEN** el sistema responde con HTTP `502`
- **AND** no modifica el catálogo de minifiguras

### Requirement: Mantener la actualización masiva de precios sin afectar categoría, subcategoría o año

La actualización masiva de precios SHALL seguir consultando y persistiendo únicamente el precio de cada minifigura persistida, sin leer ni modificar `categoria`, `subcategoria` ni `anio`.

#### Scenario: Actualización masiva no toca categoría, subcategoría ni año
- **WHEN** se ejecuta la actualización masiva de precios
- **THEN** el sistema persiste solo el campo `precio` de las minifiguras actualizadas
- **AND** conserva sin cambios `categoria`, `subcategoria` y `anio` de todas las minifiguras
