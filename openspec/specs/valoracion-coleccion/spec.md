## Purpose

Permite consultar y mantener el precio en Euros de las minifiguras mediante scraping de las páginas públicas de Brickset, con actualización individual y masiva resiliente.

## Requirements

### Requirement: Consultar el precio público de Brickset

El sistema SHALL consultar mediante fetch la URL pública `https://brickset.com/minifigs/<ID>` y SHALL extraer el importe asociado a `Current Value - New` como un número en Euros. La consulta no SHALL requerir credenciales ni API Key.

#### Scenario: Precio disponible
- **WHEN** se solicita el precio de una minifigura con una página Brickset válida que contiene `Current Value - New`
- **THEN** el sistema responde con el precio normalizado como número en Euros
- **AND** no modifica el catálogo hasta que el cliente confirme o solicite su persistencia

#### Scenario: Precio no disponible
- **WHEN** la página no existe, no contiene `Current Value - New` o el importe no puede interpretarse
- **THEN** el sistema devuelve un error público controlado
- **AND** no devuelve HTML bruto ni modifica el precio previamente almacenado

### Requirement: Calcular el valor total y los contadores de la colección

El sistema SHALL exponer un resumen en Euros con el valor total, el número de minifiguras en colección y el número de minifiguras buscadas. Para cada minifigura en `COLECCIÓN` SHALL priorizar `precio` y SHALL usar `precioCompra` solo cuando `precio` no sea válido. Las minifiguras `BUSCADA` no SHALL contribuir al total.

#### Scenario: Resumen de colección
- **WHEN** se solicita el resumen con figuras que tienen precio de mercado o compra
- **THEN** el sistema responde con HTTP `200`
- **AND** suma los importes aplicando la prioridad `precio` sobre `precioCompra`
- **AND** informa por separado los contadores de colección y búsqueda

#### Scenario: Figuras buscadas excluidas
- **WHEN** el resumen contiene figuras `COLECCIÓN` y `BUSCADA` con precios
- **THEN** las figuras `BUSCADA` incrementan su contador
- **AND** sus precios no se incluyen en el total

### Requirement: Actualizar precios de Brickset de forma resiliente

El sistema SHALL ofrecer una operación individual y una operación masiva para consultar Brickset. La actualización masiva SHALL procesar cada figura persistida de forma aislada, con concurrencia limitada, conservar precios anteriores cuando falle una consulta y persistir únicamente valores válidos de forma atómica.

#### Scenario: Actualización masiva completada
- **WHEN** Brickset responde con precios válidos
- **THEN** el sistema persiste los nuevos valores de `precio`
- **AND** devuelve los elementos actualizados

#### Scenario: Fallo parcial
- **WHEN** Brickset responde correctamente para unas figuras y falla para otras
- **THEN** el sistema persiste solo los precios válidos
- **AND** informa por separado elementos actualizados y fallidos
- **AND** las consultas locales continúan funcionando

#### Scenario: Actualización de todas las figuras persistidas
- **WHEN** se inicia una actualización masiva con figuras `COLECCIÓN` y `BUSCADA`
- **THEN** el sistema consulta Brickset para cada figura persistida
- **AND** `BUSCADA` solo se excluye del valor total y de los rankings

### Requirement: Generar rankings de la colección

El sistema SHALL incluir un top 5 de figuras `COLECCIÓN` por precio y un top 5 de figuras `COLECCIÓN` más antiguas. El primer ranking ordenará precio descendente, fecha de compra más antigua y posición posterior en el JSON; las figuras sin precio aparecerán al final. El segundo ordenará año ascendente, precio descendente y posición posterior en el JSON.

#### Scenario: Rankings con menos de cinco figuras
- **WHEN** existen menos de cinco figuras `COLECCIÓN`
- **THEN** cada ranking devuelve únicamente las figuras disponibles
- **AND** ningún ranking incluye `BUSCADA`

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
