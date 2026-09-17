# Tasks

## 1. Definir el contrato de filtrado

- [x] 1.1 Documentar los parámetros de consulta soportados (`tema`, `anio`, `estadoColeccion`) y confirmar la semántica AND para filtros combinados; verificar con pruebas de API representativas.
- [x] 1.2 Ajustar el catálogo local y la validación de registros para soportar metadatos opcionales de filtrado sin romper la estructura existente.

## 2. Implementar la lógica de filtrado

- [x] 2.1 Extender `src/server.js` para leer los query params y pasar el filtro a la capa de repositorio; verificar que `GET /minifiguras` sin parámetros mantenga el comportamiento actual.
- [x] 2.2 Implementar la función de filtrado en `src/minifiguras-repository.js` y asegurar que el orden original del catálogo se conserve.

## 3. Probar aceptación y regresión

- [x] 3.1 Añadir pruebas para cada filtro individual (`tema`, `anio`, `estadoColeccion`) y para combinaciones múltiples.
- [x] 3.2 Ejecutar la suite de pruebas y verificar que `npm test` pasa sin regresiones.
