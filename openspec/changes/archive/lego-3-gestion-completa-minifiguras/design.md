# Design

## Context

El servidor HTTP nativo solo enruta `GET /minifiguras` y delega la lectura y validación del arreglo JSON a `MinifigurasRepository`. Las pruebas crean un catálogo temporal por caso, por lo que pueden verificar tanto la respuesta HTTP como el contenido persistido sin modificar `data/minifiguras.json`.

El catálogo existente usa `tema`, mientras que la validación acordada exige `tematica` y `anio`. El filtro público `tema` ya está definido por la capacidad existente y debe seguir funcionando.

## Goals / Non-Goals

**Goals:**
- Incorporar altas, reemplazos y eliminaciones sobre el mismo archivo JSON que consulta el servidor.
- Validar antes de mutar que cada minifigura tenga `id`, `nombre`, `descripcion`, `tematica` y `anio` válidos, y que los identificadores sean únicos.
- Migrar el JSON inicial de `tema` a `tematica` y mantener `GET ?tema=` como alias de consulta sobre el campo normalizado.
- Evitar que una operación o una escritura fallida deje el catálogo truncado o inválido.
- Cubrir resultados HTTP y persistencia mediante los catálogos temporales existentes en las pruebas.

**Non-Goals:**
- No añadir autenticación, autorización, paginación, operaciones parciales `PATCH` ni búsqueda adicional.
- No sustituir el archivo JSON por una base de datos ni añadir dependencias externas.
- No ofrecer recuperación para ediciones concurrentes de procesos independientes; el servicio actual se ejecuta como una única instancia local.

## Decisions

### Modelo y validación centralizados en el repositorio

`MinifigurasRepository` incorporará operaciones de creación, reemplazo y eliminación. Reutilizará una única validación del catálogo leído y de los candidatos de escritura: textos no vacíos para `id`, `nombre`, `descripcion` y `tematica`; entero para `anio`; `estadoColeccion` opcional de texto no vacío; e `id` sin duplicados en toda la colección. Así, el servidor traduce errores de dominio a HTTP y el repositorio protege la integridad incluso si recibe llamadas futuras fuera del enrutador.

### Rutas y resultados HTTP explícitos

El servidor reconocerá `POST /minifiguras`, `PUT /minifiguras/:id` y `DELETE /minifiguras/:id`, además del `GET` existente. Un lector de cuerpo JSON verificará que el cuerpo sea un objeto y convertirá contenido ausente, mal formado o de forma inválida en `MINIFIGURA_INVALIDA` con `400`. `POST` devuelve `201`, un duplicado devuelve `409` con `ID_DUPLICADO`, `PUT` devuelve `200` únicamente si el `id` de ruta y cuerpo son iguales, y `DELETE` exitoso devuelve `204` sin cuerpo. Reemplazos y eliminaciones de recursos ausentes devolverán `404` con `MINIFIGURA_NO_ENCONTRADA`.

### Escritura segura y orden estable

Para mutar, el repositorio leerá y validará el arreglo actual, construirá un nuevo arreglo en memoria y lo serializará primero en un archivo temporal del mismo directorio. Solo después reemplazará el archivo destino mediante renombrado. Las altas se agregan al final, los reemplazos se hacen por índice y las eliminaciones conservan el orden de los demás elementos. El temporal se limpiará cuando falle la escritura antes del reemplazo.

### Migración de la clave temática

La implementación actualizará `data/minifiguras.json` y los datos de prueba para usar `tematica`. La lógica de filtros conservará el parámetro `tema` y lo comparará, sin distinción de mayúsculas, contra `minifigura.tematica`. No se aceptará `tema` como alternativa en los cuerpos de escritura, para impedir que vuelvan a persistirse dos representaciones de la misma información.

## Risks / Trade-offs

- El cambio del campo de salida de `tema` a `tematica` modifica los documentos JSON almacenados; se mitiga conservando el nombre del parámetro de filtro existente y actualizando el archivo inicial en la misma implementación.
- El renombrado atómico depende del sistema de archivos, pero usar un temporal en el mismo directorio ofrece la mejor garantía disponible sin dependencias adicionales.
- El servidor HTTP nativo requiere manejar explícitamente tamaño, eventos y errores del cuerpo de solicitud; las pruebas cubrirán cuerpo vacío, JSON inválido y desconexiones o errores de lectura cuando sea viable.