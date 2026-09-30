# Spec Delta

## ADDED Requirements

### Requirement: Exponer la galería de minifiguras observadas
El resumen de valoración SHALL exponer las minifiguras con `observada: true` para que la interfaz pueda construir la galería "En Observación". La lista SHALL ordenar primero por `precioBrickset` descendente y SHALL colocar después las figuras sin precio, conservando un orden estable entre empates. Debe incluir como mínimo `id`, `estadoColeccion`, `precioBrickset` y los datos necesarios para la tarjeta.

#### Scenario: Observadas ordenadas por precio
- **WHEN** el catálogo contiene varias figuras observadas con y sin precio Brickset
- **THEN** el resumen devuelve las observadas con precio de mayor a menor
- **AND** las que no tienen precio aparecen después

#### Scenario: Sin observadas
- **WHEN** ninguna figura está marcada como observada
- **THEN** el resumen devuelve una lista vacía
- **AND** no altera los contadores ni los rankings existentes
