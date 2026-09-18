# Design

## Context

`public/app.js` ya gestiona la carga y el renderizado del catalogo (`loadCatalog`, `renderCatalog`) contra `GET /minifiguras` sin dependencias externas (vanilla JS, sin framework). El servidor (`src/server.js`) ya expone `POST /minifiguras`, `PUT /minifiguras/:id` y `DELETE /minifiguras/:id` con los codigos de error `MINIFIGURA_INVALIDA` (400), `ID_DUPLICADO` (409) y `MINIFIGURA_NO_ENCONTRADA` (404). Ver proposal.md - Why/What Changes para la motivacion.

## Goals / Non-Goals

**Goals:**
- Reutilizar un unico modal de formulario para alta y edicion, minimizando duplicacion de markup y validacion.
- Aislar el modal de confirmacion de borrado del modal de formulario para evitar confirmaciones accidentales.
- Mantener el estilo vanilla JS + CSS existente, sin introducir dependencias de build ni frameworks de UI.
- Mantener la tabla como fuente visual unica: tras cualquier mutacion exitosa, se vuelve a pedir el catalogo con los filtros activos en vez de mutar el DOM manualmente, para evitar inconsistencias.

**Non-Goals:**
- No se rediseña el panel de filtros ni la paginacion (fuera de alcance de LEGO-5).
- No se anaden atajos de teclado avanzados ni gestion de foco WCAG mas alla de cerrar el modal con `Escape` y devolver el foco al control que lo abrio.
- No se cambia el contrato de la API (`src/server.js`, `src/minifiguras-repository.js`).

## Decisions

**Modal unico reutilizable para alta/edicion**: un solo `<dialog>` (elemento nativo HTML) con un formulario, alternando entre modo "crear" y modo "editar" mediante un estado (`currentEditId`). Alternativa descartada: dos modales separados — se descarta por duplicar markup y logica de validacion sin beneficio, ya que ambos comparten los mismos campos.

**`<dialog>` nativo en vez de un modal implementado a mano**: usa `showModal()`/`close()` del elemento `<dialog>`, que ya maneja el backdrop, el foco inicial y el cierre con `Escape` sin JS adicional. Alternativa descartada: un `div` posicionado con CSS y gestion manual de foco - mas codigo y mas riesgo de errores de accesibilidad.

**Refresco por recarga (`loadCatalog`) en vez de actualizacion optimista del DOM**: tras un `POST`/`PUT`/`DELETE` exitoso, se vuelve a invocar `loadCatalog(filtrosActuales)` para pedir el estado real del servidor. Alternativa descartada: insertar/actualizar/eliminar la fila localmente - mas rapido pero puede desincronizarse si otro cliente modifico el catalogo; se prioriza consistencia sobre latencia percibida, ya que el catalogo es local y la respuesta es practicamente instantanea.

**Toasts como cola simple en un contenedor `aria-live`**: un contenedor fijo (`#toast-region`) donde cada notificacion se añade como un elemento con una clase de variante (`toast-success` / `toast-error`) y se retira con `setTimeout`. Alternativa descartada: libreria de terceros - innecesaria para el volumen de notificaciones esperado y anadiria una dependencia externa no justificada.

**Badges de estado por mapeo de clase CSS**: el valor de `estadoColeccion` se normaliza (minusculas, sin acentos) para elegir una clase de badge (`badge-coleccion`, `badge-deseada`, `badge-vendida`, con una clase por defecto `badge-otro` para valores no reconocidos), evitando que un valor inesperado rompa el renderizado.

**Mapeo de errores HTTP a mensajes**: los codigos de error del servidor (`MINIFIGURA_INVALIDA`, `ID_DUPLICADO`, `MINIFIGURA_NO_ENCONTRADA`) se traducen a mensajes en español mediante un diccionario simple en el cliente; un codigo no reconocido cae en un mensaje generico de error.

## Risks / Trade-offs

- [Recargar todo el catalogo tras cada mutacion puede sentirse mas lento que una actualizacion optimista] → Mitigado por el tamaño reducido del catalogo local y la ausencia de latencia de red real (persistencia en archivo local).
- [El `<dialog>` nativo tiene soporte variable en navegadores muy antiguos] → Aceptado como riesgo conocido; el proyecto ya asume un "navegador compatible" segun el spec de LEGO-4.
- [Reusar un solo modal para alta y edicion puede filtrar estado entre usos si no se resetea correctamente] → Mitigado reseteando explicitamente el formulario y el estado `currentEditId` al abrir y al cerrar el modal.
