# Proposal

## Why

La interfaz web solo permite consultar el catalogo (LEGO-4), aunque el servidor ya expone `POST`, `PUT` y `DELETE` sobre `/minifiguras` (LEGO-3). Sin un dashboard interactivo, cualquier alta, edicion o baja exige llamar a la API manualmente, lo que hace la gestion inaccesible para un usuario no tecnico.

## What Changes

- Anadir acciones por fila (`Editar`, `Eliminar`) en la tabla de resultados, ademas de una accion `Nueva minifigura` en el panel de resultados.
- Anadir un modal de alta/edicion con un formulario que cubra los campos gestionables de la minifigura (`id`, `nombre`, `descripcion`, `tematica`, `anio`, `estadoColeccion`), reutilizado tanto para crear (`POST /minifiguras`) como para editar (`PUT /minifiguras/:id`).
- Anadir un modal de confirmacion independiente antes de ejecutar `DELETE /minifiguras/:id`, que identifique la minifigura afectada y permita cancelar sin efectos.
- Anadir badges visuales de `estadoColeccion` en cada fila de la tabla para distinguir el estado de coleccion de un vistazo.
- Anadir notificaciones toast que confirmen el resultado de cada operacion de creacion, edicion y eliminacion, y que comuniquen errores devueltos por la API sin bloquear la interfaz.
- Refrescar la tabla de resultados tras cada creacion, edicion o eliminacion exitosa, conservando los filtros activos.
- Validar en el cliente los campos obligatorios del formulario (`id`, `nombre`, `tematica`, `anio`) antes de enviar la peticion, y mostrar los errores de validacion devueltos por la API (400/404/409) en el modal o en un toast segun corresponda.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `interfaz-web-minifiguras`: ampliar la interfaz con acciones de gestion (alta, edicion, eliminacion), modales, badges de estado y notificaciones toast integradas con los endpoints `POST`/`PUT`/`DELETE` existentes.

## Impact

- Afecta a `public/index.html` para incorporar los modales, badges y contenedor de notificaciones toast.
- Afecta a `public/app.js` para las acciones por fila, el envio de `POST`/`PUT`/`DELETE`, la validacion de formulario y el ciclo de vida de los toasts.
- Afecta a `public/styles.css` para el estilo de modales, badges y toasts.
- Afecta a `test/web.test.js` para cubrir los nuevos flujos de alta, edicion y eliminacion desde la interfaz.
- No requiere cambios en `src/server.js` ni en `src/minifiguras-repository.js`: los endpoints `POST`, `PUT` y `DELETE` ya existen (LEGO-3).
