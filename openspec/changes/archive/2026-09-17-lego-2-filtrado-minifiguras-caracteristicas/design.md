# Design

## Context

El servicio actual expone `GET /minifiguras` directamente sobre un archivo JSON local y devuelve la colección completa sin ningún criterio de consulta. La capacidad de catálogo ya existe y se mantiene en la ruta `minifiguras`; este cambio amplía esa misma capacidad para soportar un conjunto de filtros opcionales que hagan más útil la búsqueda y la exploración del inventario.

## Goals / Non-Goals

**Goals:**
- Soportar filtros opcionales por `tema`, `anio` y `estadoColeccion` desde el endpoint HTTP.
- Mantener el comportamiento sin filtros como caso compatible por defecto.
- Aplicar filtros con lógica AND y conservar el orden del catálogo original.

**Non-Goals:**
- No se añadirá paginación ni ordenamiento dinámico.
- No se cambiará la persistencia a una base de datos ni se romperá la API existente sin parámetros.
- No se definirá un sistema de autenticación ni permisos por usuario.

## Decisions

### 1. Filtros en la capa HTTP y de repositorio
La capa HTTP será responsable de leer los query params y transformarlos en un objeto de filtros. La lógica de selección se aplicará en `MinifigurasRepository` para mantener la validación del catálogo y centralizar la operación de filtrado en un único punto.

**Rationale:** esto conserva una separación clara entre la entrada HTTP, la validación del catálogo y la lógica de negocio del filtrado, y minimiza cambios en las rutas existentes.

**Alternatives considered:**
- Aplicar el filtrado directamente en `server.js`. Se descartó porque mezcla la lógica de consulta con la capa de transporte y hace más compleja la reutilización en pruebas.
- Cambiar la firma del repositorio para aceptar un objeto complejo en todas partes. Se descartó como una ampliación innecesaria del alcance actual.

### 2. Filtros opcionales con semántica AND
Cuando se envían varios filtros, todos deben cumplirse al mismo tiempo. Si el cliente usa `tema` y `anio`, el sistema devolverá solo las minifiguras que coincidan con ambos.

**Rationale:** esta semántica es predecible y se alinea con patrones comunes de consulta por atributos en APIs REST.

**Alternatives considered:**
- OR entre filtros: se descartó porque genera resultados demasiado amplios y no encaja con una búsqueda de detalle por características.
- Aplicar solo un filtro a la vez: se descartó porque limita la utilidad del endpoint.

### 3. Metadatos normalizados en el catálogo
El catálogo local deberá soportar metadatos de búsqueda para `tema`, `anio` y `estadoColeccion`, con comparación insensible a mayúsculas/minúsculas para valores textuales.

**Rationale:** hace que el filtro sea estable y compatible con entradas semánticas consistentes en el archivo JSON.

**Alternatives considered:**
- Filtrar únicamente sobre `nombre` o `descripcion`. Se descartó porque no cubre una búsqueda estructurada por año o estado de colección.

### 4. Parámetros numéricos inválidos
Un parámetro `anio` presente y no entero se rechaza con HTTP `400` y el código `PARAMETRO_INVALIDO`, en lugar de ignorarse silenciosamente.

**Rationale:** evita que una petición aparentemente filtrada devuelva resultados como si el criterio no se hubiera enviado.

## Risks / Trade-offs

- [Metadatos faltantes en algunos registros] → Mitigación: validar que cada registro pueda manejar valores ausentes sin romper el filtrado; las entradas sin el campo solicitado no coinciden con ese criterio y no rompen la respuesta.
- [Ambigüedad en los valores de `estadoColeccion`] → Mitigación: normalizar a cadenas consistentes y utilizar comparación insensible a mayúsculas/minúsculas, con definición clara de los valores aceptados durante la implementación.
- [Compatibilidad con el catálogo previo] → Mitigación: mantener la respuesta sin filtros idéntica al comportamiento actual y solo aplicar filtros cuando existan query params.

## Migration Plan

No requiere migración de datos ni cambio de despliegue complejo. La implementación se hará de forma compatible: el endpoint actual sigue funcionando sin parámetros y los nuevos filtros se activan solo cuando el cliente los envía.

## Open Questions

- ¿Cuál será el conjunto exacto de valores válidos para `estadoColeccion` en el catálogo real? La implementación puede asumir una normalización por texto y definir la enumeración final al poblar los datos.
