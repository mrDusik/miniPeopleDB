# Proposal

## Why

El catálogo ya está disponible mediante una API HTTP, pero no ofrece una forma directa de explorarlo desde un navegador. Se necesita una interfaz web estática servida por Express para que una persona pueda consultar las minifiguras, aplicar filtros y volver rápidamente a todo el catálogo sin editar URLs ni JSON manualmente.

## What Changes

- Incorporar una interfaz web estática accesible desde la ruta raíz del servidor.
- Servir los activos HTML, CSS y JavaScript desde Express junto con la API existente.
- Añadir un panel de filtros para `tema`, `anio` y `estadoColeccion`, con acciones `Buscar` y `Mostrar todo`.
- Consultar `GET /minifiguras` desde el navegador y actualizar una tabla dinámica con los resultados sin recargar la página.
- Mostrar estados de carga, resultados vacíos y errores de consulta de forma comprensible.
- Mantener el contrato y la persistencia JSON local de la API existente.
- Añadir pruebas automatizadas del servicio de archivos estáticos y del comportamiento principal de consulta de la interfaz.

## Capabilities

### New Capabilities

- `interfaz-web-minifiguras`: interfaz de navegador para filtrar y visualizar el catálogo de minifiguras.

### Modified Capabilities

<!-- No se modifican los requisitos del catálogo API existente. -->

## Impact

- Afecta a `src/server.js` para servir la aplicación estática junto con las rutas API existentes.
- Añade archivos de presentación HTML, CSS y JavaScript para la consulta del catálogo.
- Afecta a `test/minifiguras.test.js` o a pruebas web separadas para verificar rutas, carga de datos, filtros, tabla, estados vacíos y errores.
- Añade Express como dependencia de ejecución, manteniendo `data/minifiguras.json` como fuente de datos y sin incorporar una base de datos.