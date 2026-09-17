# Proposal

## Why

El catálogo actual de minifiguras solo permite listar toda la colección sin ningún criterio de búsqueda, lo que hace difícil encontrar figuras por tema, año de lanzamiento o estado de colección. Este cambio introduce filtrado funcional para que el API sea más útil en escenarios de exploración, validación y consulta de inventario.

## What Changes

- Se extenderá el endpoint `GET /minifiguras` para aceptar filtros opcionales por `tema`, `anio` y `estadoColeccion`.
- La respuesta filtrada conservará el orden original del catálogo cuando se apliquen criterios de búsqueda.
- La operación sin filtros seguirá devolviendo la colección completa, manteniendo compatibilidad con la API actual.
- Los datos de soporte para estas características se validarán en el catálogo local para evitar resultados inconsistentes.

## Capabilities

### New Capabilities
- Ninguna. La funcionalidad se incorpora a la capacidad existente de catálogo de minifiguras.

### Modified Capabilities
- `minifiguras`: se amplía el comportamiento de listado para soportar consultas por tema, año y estado de colección sin romper el contrato base del endpoint.

## Impact

- `src/server.js`: lectura de query params y manejo de la respuesta filtrada.
- `src/minifiguras-repository.js`: lógica de filtro sobre la colección local.
- `data/minifiguras.json`: enriquecimiento del conjunto inicial con metadatos de filtrado.
- `test/minifiguras.test.js`: pruebas de regresión y aceptación para los nuevos escenarios.
