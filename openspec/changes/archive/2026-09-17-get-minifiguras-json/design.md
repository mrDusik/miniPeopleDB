# Design

## Context

LEGO-1 introduce el primer endpoint del catálogo en un repositorio sin implementación existente. La persistencia inicial debe ser local y basada en JSON, por lo que el diseño debe mantener separadas la exposición HTTP, la lectura/validación del archivo y el contrato de datos. No hay una base de datos, framework ni estructura de servidor preexistente que preservar.

## Goals / Non-Goals

### Goals

- Exponer `GET /minifiguras` con un contrato JSON estable.
- Leer y validar el catálogo desde un archivo local.
- Entregar errores HTTP previsibles sin filtrar detalles internos.
- Hacer la ubicación del archivo configurable o inyectable para las pruebas.
- Incluir datos iniciales y pruebas automatizadas del camino feliz y de fallos.

### Non-Goals

- Crear operaciones de alta, modificación o eliminación.
- Añadir una base de datos, autenticación, paginación o filtros.
- Definir todavía un contrato de despliegue o de almacenamiento compartido.

## Decisions

### Contrato y capas

La ruta HTTP delegará en un servicio o repositorio de minifiguras. El repositorio leerá el archivo con la API de archivos del runtime, analizará el JSON y validará que sea un arreglo de objetos con `id`, `nombre` y `descripcion`. El controlador transformará los resultados válidos a HTTP `200` y mapeará los fallos conocidos a `500` con un cuerpo de error estable.

### Archivo local configurable

El archivo se ubicará en una ruta de datos del proyecto y su resolución se centralizará en configuración o en el constructor del repositorio. Las pruebas podrán proporcionar un archivo temporal o una ruta alternativa, evitando depender del archivo de desarrollo y evitando mutaciones globales.

### Errores y consistencia

Los errores de archivo ausente, lectura y JSON inválido se registrarán con el mecanismo estándar de la aplicación, pero la respuesta no incluirá rutas ni contenido del archivo. La lectura será síncrona o asíncrona según el framework elegido, manteniendo el contrato observable y el orden del arreglo tal como aparece en el JSON.

### Datos iniciales y pruebas

El archivo inicial contendrá varias minifiguras representativas y será válido contra el mismo esquema que usa el repositorio. Las pruebas cubrirán `200` con datos, `200` vacío, archivo ausente, JSON inválido o estructura incorrecta y repetibilidad del orden.

## Risks / Trade-offs

- Un archivo local no ofrece concurrencia, bloqueo ni escalabilidad; se acepta porque el objetivo es persistencia inicial y se deja el repositorio aislado para una migración futura.
- Responder `500` ante un catálogo ausente o inválido simplifica el contrato inicial, aunque más adelante podría distinguirse configuración faltante de fallo temporal.
- Validar solo los campos mínimos mantiene flexible el modelo, pero no evita duplicados de `id`; esa regla queda fuera de LEGO-1 salvo que el dominio la requiera después.
- La ausencia de framework existente obliga a decidir durante la implementación la tecnología concreta del servidor; las tareas deben comenzar identificando el runtime y sus convenciones antes de añadir dependencias.