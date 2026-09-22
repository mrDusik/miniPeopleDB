# Spec Delta

## Purpose

Permite consultar y mantener el precio en Euros de las minifiguras mediante scraping de las páginas públicas de Brickset, con actualización individual y masiva resiliente.

## ADDED Requirements

### Requirement: Consultar el precio publico de Brickset

El sistema SHALL consultar mediante fetch la URL pública `https://brickset.com/minifigs/<ID>` y SHALL extraer el importe asociado a `Current Value - New` como un número en Euros. La consulta no SHALL requerir credenciales ni API Key.

#### Scenario: Precio disponible

- **WHEN** se solicita el precio de una minifigura con una página Brickset válida que contiene `Current Value - New`
- **THEN** el sistema responde con el precio normalizado como número en Euros
- **AND** no modifica el catálogo hasta que el cliente confirme o solicite su persistencia

#### Scenario: Precio no disponible

- **WHEN** la página no existe, no contiene `Current Value - New` o el importe no puede interpretarse
- **THEN** el sistema devuelve un error público controlado
- **AND** no devuelve HTML bruto ni modifica el precio previamente almacenado

### Requirement: Calcular el valor total y los contadores de la coleccion

El sistema SHALL exponer un resumen en Euros con el valor total, el número de minifiguras en colección y el número de minifiguras buscadas. Para cada minifigura en `COLECCIÓN` SHALL priorizar `precio` y SHALL usar `precioCompra` solo cuando `precio` no sea un número válido. Las minifiguras `BUSCADA` no SHALL contribuir al total.

#### Scenario: Colección con precios de mercado y compra

- **WHEN** se solicita el valor total y existen minifiguras con `precio` o `precioCompra`
- **THEN** el sistema responde con HTTP `200`
- **AND** suma un único importe en Euros aplicando la prioridad `precio` sobre `precioCompra`
- **AND** informa por separado los contadores de colección y búsqueda

#### Scenario: Colección sin precios

- **WHEN** se solicita el valor total y ninguna minifigura tiene un precio válido
- **THEN** el sistema responde con HTTP `200`
- **AND** devuelve un total de `0` Euros

#### Scenario: Colección con figuras buscadas

- **WHEN** se solicita el resumen y existen minifiguras `COLECCIÓN` y `BUSCADA` con precios
- **THEN** las figuras `BUSCADA` incrementan su contador
- **AND** sus precios no se incluyen en el total

### Requirement: Actualizar precios de Brickset de forma resiliente

El sistema SHALL ofrecer una operación de actualización individual y una operación masiva para consultar Brickset. La actualización masiva SHALL procesar cada minifigura de forma aislada, conservar los precios anteriores cuando una consulta falle y devolver el resultado de elementos actualizados y fallidos.

#### Scenario: Actualización masiva completada

- **WHEN** Brickset responde con precios válidos para las minifiguras consultadas
- **THEN** el sistema persiste los nuevos valores de `precio` de forma atómica
- **AND** devuelve el número o listado de elementos actualizados

#### Scenario: Brickset no disponible

- **WHEN** Brickset agota el tiempo de espera, devuelve un error o no contiene una página válida
- **THEN** el sistema conserva el `precio` anterior de cada minifigura afectada
- **AND** devuelve un resultado controlado que identifica los elementos fallidos
- **AND** las consultas locales del catálogo continúan funcionando

#### Scenario: Fallo aislado durante una actualización

- **WHEN** Brickset responde correctamente para unas minifiguras y falla para otras
- **THEN** el sistema persiste solo los precios válidos obtenidos
- **AND** informa por separado los elementos actualizados y fallidos
- **AND** no convierte el fallo parcial en un error global sin resultados

#### Scenario: Actualización de todas las figuras persistidas

- **WHEN** se inicia una actualización masiva con figuras `COLECCIÓN` y `BUSCADA`
- **THEN** el sistema consulta Brickset para cada figura persistida
- **AND** la exclusión de `BUSCADA` se aplica únicamente al valor total y a los rankings

### Requirement: Generar rankings de la colección

El sistema SHALL incluir en el resumen un top 5 de minifiguras `COLECCIÓN` por precio y un top 5 de las minifiguras `COLECCIÓN` más antiguas. El primer ranking SHALL ordenar por precio descendente, desempatar por `fechaCompra` más antigua y después por posición posterior en el JSON. El segundo SHALL ordenar por `anio` ascendente, desempatar por precio descendente y después por posición posterior en el JSON.

Las figuras `COLECCIÓN` sin un `precio` válido SHALL aparecer después de las figuras con precio en el primer ranking, manteniendo los desempates de fecha y posición JSON.

#### Scenario: Rankings con menos de cinco figuras

- **WHEN** existen menos de cinco minifiguras en `COLECCIÓN`
- **THEN** cada ranking devuelve únicamente las figuras disponibles
- **AND** ningún ranking incluye una figura `BUSCADA`

#### Scenario: Desempates de rankings

- **WHEN** dos figuras tienen el mismo precio o el mismo año según el ranking correspondiente
- **THEN** se aplican los criterios de fecha, precio y posición JSON definidos
- **AND** el resultado mantiene un orden determinista
