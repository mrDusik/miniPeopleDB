# Proposal

## Why

El campo `tematica` acepta actualmente valores libres y el catálogo puede quedar desalineado con las categorías oficiales de minifiguras de Brickset. Esto dificulta filtrar y crear datos consistentes, y no existe una fuente local mantenible para conocer las categorías y el número de minifiguras de cada una.

## What Changes

- Añadir un JSON local con todas las categorías de minifiguras de Brickset y el total publicado para cada tema.
- Añadir un agente o comando manual que consulte `https://brickset.com/browse/minifigs` y actualice ese JSON cuando cambien las categorías o sus totales.
- Validar que las minifiguras nuevas y editadas usen únicamente temas presentes en el JSON oficial, tanto en la API como en los filtros.
- Exponer los temas oficiales para que la interfaz los use como opciones cerradas en el formulario y en la búsqueda.
- Migrar las minifiguras existentes de `COLECCIÓN` y `BUSCADA` a nombres oficiales de Brickset, incluyendo `Series 5` → `Collectible Minifigures`.
- Incluir tests para el formato del JSON, la sincronización, la validación, la migración, la API y la interfaz.

## Capabilities

### New Capabilities

- `temas-brickset`: Catálogo local de categorías Brickset, sus totales y mecanismo manual de sincronización.

### Modified Capabilities

- `minifiguras`: El campo `tematica` debe pertenecer al catálogo oficial y los filtros deben rechazar temas inexistentes.
- `interfaz-web-minifiguras`: Los controles de tema deben ofrecer exclusivamente categorías oficiales tanto al buscar como al crear o editar.

## Impact

- Afecta al repositorio JSON de minifiguras, al modelo de validación y a los endpoints de listado y CRUD.
- Añade un recurso JSON de temas y un agente/comando de sincronización con dependencia de la página pública de Brickset, ejecutable manualmente y aislado de las operaciones normales del servidor.
- Cambia los datos iniciales existentes para normalizar nombres de temas.
- Afecta a `public/index.html`, `public/app.js` y a los tests de API, scraping y navegador.