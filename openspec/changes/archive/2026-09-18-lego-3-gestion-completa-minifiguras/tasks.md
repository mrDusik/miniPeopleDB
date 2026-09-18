# Tasks

## 1. Datos y repositorio

- [x] 1.1 Migrar el catálogo inicial y los fixtures de prueba de `tema` a `tematica`, conservando valores y registros existentes.
- [x] 1.2 Extender la validación del catálogo y de minifiguras para exigir `id`, `nombre`, `descripcion`, `tematica` y `anio`, validar `estadoColeccion` opcional y detectar `id` duplicados.
- [x] 1.3 Implementar en `MinifigurasRepository` las operaciones de crear, reemplazar y eliminar, con errores de dominio para duplicados y elementos inexistentes.
- [x] 1.4 Persistir los cambios mediante archivo temporal y renombrado en el mismo directorio, limpiando temporales ante error y conservando el orden definido por la especificación.
- [x] 1.5 Actualizar el filtrado existente para que el parámetro `tema` consulte `tematica` sin distinción de mayúsculas.

## 2. API HTTP

- [x] 2.1 Añadir un lector de cuerpos JSON que rechace cuerpo ausente, mal formado o que no sea un objeto antes de invocar el repositorio.
- [x] 2.2 Implementar `POST /minifiguras` con respuesta `201`, cuerpo de la minifigura creada y manejo de `400` y `409`.
- [x] 2.3 Implementar `PUT /minifiguras/:id` con coincidencia obligatoria entre el `id` de ruta y cuerpo, respuesta `200` y manejo de `400` y `404`.
- [x] 2.4 Implementar `DELETE /minifiguras/:id` con respuesta `204` sin cuerpo y manejo de `404`.
- [x] 2.5 Conservar las respuestas actuales de `GET`, rutas no encontradas y métodos no permitidos, actualizando el encabezado `Allow` por ruta cuando corresponda.

## 3. Pruebas y verificación

- [x] 3.1 Añadir pruebas HTTP para creación, reemplazo y eliminación exitosos que además lean el archivo temporal y confirmen la persistencia y el orden.
- [x] 3.2 Añadir pruebas para `tematica` y `anio` obligatorios, cuerpos JSON inválidos, `id` duplicado, discrepancia entre `id` de ruta y cuerpo, y recurso inexistente, verificando que el archivo no cambia.
- [x] 3.3 Actualizar las pruebas de listado y filtros para el campo `tematica` y confirmar la compatibilidad del parámetro `tema`.
- [x] 3.4 Ejecutar `npm test` y `openspec validate lego-3-gestion-completa-minifiguras --strict`.