# Tasks

## 1. Preparar la base de la aplicación

- [x] 1.1 Identificar el runtime, framework HTTP y runner de pruebas disponible o requerido por el proyecto; verificarlo con el comando de instalación o comprobación del proyecto y documentar la decisión en la configuración existente.
- [x] 1.2 Definir el modelo mínimo de minifigura y el contrato de respuesta (`id`, `nombre`, `descripcion`); verificarlo mediante una prueba o validación de tipos que rechace una colección con campos obligatorios ausentes.

## 2. Implementar persistencia local

- [x] 2.1 Crear el archivo JSON inicial con varias minifiguras válidas y resolver su ubicación desde configuración o una dependencia inyectable; verificar que el archivo se puede leer y analizar durante una prueba automatizada.
- [x] 2.2 Implementar el repositorio o servicio que lea y valide el arreglo JSON, conserve el orden y distinga archivo ausente, error de lectura y JSON o estructura inválida; verificar cada caso con archivos temporales o rutas aisladas.

## 3. Exponer el endpoint

- [x] 3.1 Registrar `GET /minifiguras` y conectarlo al repositorio o servicio, devolviendo `200` con el arreglo y el tipo de contenido JSON; verificarlo con una prueba HTTP que compruebe datos y catálogo vacío.
- [x] 3.2 Mapear los errores de persistencia a respuestas `500` con códigos o mensajes estables sin rutas, contenido bruto ni detalles sensibles; verificarlo con pruebas HTTP para archivo inexistente y catálogo inválido.

## 4. Completar la validación de LEGO-1

- [x] 4.1 Añadir o ajustar pruebas de lectura repetida para confirmar que dos solicitudes sin cambios en el archivo devuelven la misma colección y orden; verificarlo ejecutando el runner de pruebas.
- [x] 4.2 Ejecutar la suite automatizada, las comprobaciones de formato o tipos y una prueba manual o de integración del endpoint; verificar que todas pasan y que `GET /minifiguras` funciona con el archivo inicial.