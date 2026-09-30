# Design

## Context

See [proposal.md](proposal.md) for motivation and scope. La aplicación es un servidor Express pequeño con repositorio JSON local, persistencia atómica mediante archivo temporal y una interfaz estática que mantiene en `public/app.js` el catálogo cargado y el estado del modal. Las categorías oficiales ya se cargan desde `GET /categorias`; Brickset se consulta tanto para detalles individuales como para sincronización masiva.

El cambio toca el contrato del modelo, varias rutas y el flujo completo de la interfaz. La solución debe conservar el aislamiento de pruebas mediante rutas de archivos inyectables, no introducir base de datos y no mezclar el estado efímero del modal con los datos persistidos.

## Goals / Non-Goals

**Goals:**

- Mantener una representación canónica de IDs y una migración JSON idempotente para `observada`.
- Centralizar en el repositorio la validación del límite de 10 y la persistencia atómica del estado de observación.
- Hacer que los filtros y contadores se calculen sobre el catálogo actual, incluyendo la cascada categoría/subcategoría.
- Separar claramente los modos crear, editar y visualizar del modal, con una única función de actualización de permisos y validación de obligatorios.
- Reutilizar el endpoint de resumen para entregar observadas y preservar rankings y valoración actuales.
- Cubrir las reglas con pruebas de repositorio/API y pruebas DOM con JSDOM.

**Non-Goals:**

- No se añade autenticación, usuarios múltiples ni sincronización remota de la watchlist.
- No se cambia el scraper masivo para traer nuevos campos de Brickset; el fallback de año se aplica al resultado de detalles ya existente.
- No se permite editar manualmente categoría, subcategoría, año o precio Brickset en ningún modo.
- No se rediseñan gamificación, categorías oficiales ni la estrategia existente de carga de imágenes CDN.

## Decisions

### El repositorio será la autoridad de la watchlist

`observada` se añade a la lista blanca del modelo y se valida como booleano. La lectura normalizará registros antiguos y persistirá el resultado solo cuando haya cambios. Las operaciones de marcar/desmarcar se harán sobre el mismo repositorio y archivo atómico que el CRUD, de modo que el límite de 10 no dependa del cliente. Se considera una operación separada de reemplazo para evitar que un PUT accidental cambie el estado sin aplicar el límite.

Alternativa descartada: guardar los IDs observados en otro JSON. Duplicaría estado, complicaría eliminar figuras y podría dejar la galería desincronizada.

### Normalización en la frontera de persistencia y rutas

Se definirá una función única para `trim` y mayúsculas y se aplicará a payloads, identificadores de ruta, búsquedas exactas de actualización y sincronización de precios. El cliente mantendrá la función de imagen separada, convirtiendo el valor a minúsculas solo al construir la URL BrickLink.

Alternativa descartada: normalizar únicamente en el frontend. No protege escrituras directas a la API ni evita duplicados con variantes de casing.

### Filtros dinámicos a partir del catálogo cargado

El cliente cargará el catálogo completo para derivar las opciones de categoría y subcategoría que realmente existen, contando figuras de ambos estados. La consulta filtrada seguirá usando los parámetros del backend; después de cada carga se reconstruirá el mapa de opciones y se conservará una selección solo si sigue siendo válida. Nombre y observación se enviarán como parámetros API, evitando divergencias entre el contador visible y el resultado filtrado.

Alternativa descartada: usar los totales del archivo de categorías oficiales. Esos totales describen Brickset y no el subconjunto local, por lo que producirían contadores incorrectos.

### Modal con estado explícito por modo

Se mantendrá un solo formulario y un estado `create`/`edit`/`view`. La apertura rellenará datos, establecerá `readOnly` y `disabled` según una matriz de permisos, reiniciará la sincronización pendiente y actualizará la preview. Los campos Brickset usarán `.input-readonly` para conservar selección y copia; la consulta individual se disparará automáticamente cuando la imagen del ID cargue correctamente, mientras que la actualización masiva conservará su botón en el resumen. Los controles de guardar, observar y cerrar se controlarán por modo. La validación de campos obligatorios se ejecutará al cambiar ID, tras sincronizar y antes de enviar.

Alternativa descartada: tres diálogos HTML independientes. Repetiría markup y validaciones y haría más probable que los modos quedaran inconsistentes.

### Resumen extendido sin alterar los rankings

La valoración seguirá calculando total, contadores y los dos rankings existentes. Añadirá una colección `observadas` con precio Brickset descendente y ausentes al final. La interfaz la renderizará en una sección hermana de rankings con scroll horizontal; las tarjetas de ranking y observadas abrirán el modal unificado en modo visualización. Si el registro no está en el catálogo cargado, el cliente lo recuperará por ID antes de abrir el modal. El desplegable de gamificación también ofrecerá acceso a un modal de logros con el nivel y el detalle de cada logro.

Alternativa descartada: solicitar un endpoint separado por tarjeta. Aumentaría las peticiones y expondría más superficie API sin necesidad.

### Año actual como fallback de detalles

El servidor normalizará el resultado de Brickset antes de responder: solo un año entero positivo se conserva; en caso contrario se utiliza `new Date().getFullYear()`. El cliente aplicará la misma defensa al rellenar el formulario para que una respuesta antigua o incompleta no reactive un estado inválido.

## Risks / Trade-offs

- [Risk] Una migración automática puede reescribir el JSON durante la primera lectura. → Mitigation: usar la persistencia atómica existente, hacerla idempotente y probar contenido, orden y repetición.
- [Risk] Dos solicitudes concurrentes de marcado podrían observar el mismo cupo. → Mitigation: serializar las mutaciones del repositorio o aplicar una comprobación dentro de una sección de escritura coordinada; probar el límite con solicitudes concurrentes.
- [Risk] Derivar contadores desde el catálogo completo añade trabajo al cliente. → Mitigation: reutilizar el arreglo ya cargado, recalcular solo tras cargas exitosas y conservar la última vista válida en errores.
- [Risk] El modal unificado puede dejar controles de un modo anterior habilitados. → Mitigation: centralizar la matriz de permisos y añadir pruebas DOM para cada transición create/edit/view.
- [Risk] La API existente y tests antiguos esperan IDs en minúsculas o año vacío. → Mitigation: tratarlo como cambio incompatible documentado, actualizar fixtures y cubrir explícitamente la normalización y el fallback.

## Migration Plan

1. Añadir primero la migración idempotente de `data/minifiguras.json`, validación de `observada` y normalización de IDs.
2. Implementar API y valoración, manteniendo rutas y respuestas existentes salvo los nuevos campos y errores controlados.
3. Actualizar HTML, CSS y JavaScript para filtros, watchlist, modal y preview.
4. Ejecutar la suite completa y verificar que una segunda lectura no cambia el JSON migrado.
5. Rollback: restaurar el archivo JSON desde una copia previa y revertir el cambio completo; no hay migración irreversible fuera del propio archivo local.

## Open Questions

Ninguna. Los nombres de parámetros, mensajes Toast, límite y fallback de año están fijados por los requisitos.
