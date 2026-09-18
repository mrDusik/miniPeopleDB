# Tasks

## 1. Markup base: modales, badges y toasts

- [x] 1.1 Anadir a `public/index.html` un `<dialog>` de formulario (alta/edicion) con campos `id`, `nombre`, `descripcion`, `tematica`, `anio`, `estadoColeccion`, y verificar que el HTML es valido y los campos tienen `name`/`id` unicos
- [x] 1.2 Anadir a `public/index.html` un `<dialog>` de confirmacion de borrado independiente que muestre el nombre/id de la minifigura afectada, y verificar que no comparte markup con el modal de formulario
- [x] 1.3 Anadir a `public/index.html` un contenedor de toasts (`#toast-region`) con `aria-live="polite"` y verificar que existe fuera de los `<dialog>`
- [x] 1.4 Anadir la accion `Nueva minifigura` en el panel de resultados y una celda de acciones (`Editar`, `Eliminar`) por fila en la cabecera/estructura de la tabla, y verificar mediante inspeccion manual que los botones se renderizan

## 2. Estilos de modales, badges y toasts

- [x] 2.1 Anadir estilos en `public/styles.css` para los `<dialog>` (backdrop, tamano, formulario) siguiendo la paleta existente, y verificar visualmente que los modales son legibles en escritorio y movil
- [x] 2.2 Anadir estilos de badge por variante de `estadoColeccion` (`badge-coleccion`, `badge-deseada`, `badge-vendida`, `badge-otro`) y verificar que cada variante tiene contraste suficiente
- [x] 2.3 Anadir estilos de toast (`toast-success`, `toast-error`) con transicion de entrada/salida y verificar que no bloquean la interaccion con el resto de la pagina

## 3. Logica de alta y edicion (`public/app.js`)

- [x] 3.1 Implementar apertura del modal en modo alta (formulario vacio, `currentEditId = null`) desde `Nueva minifigura`, y verificar con una prueba en `test/web.test.js` que el boton esta presente y referenciado por el script
- [x] 3.2 Implementar apertura del modal en modo edicion (formulario precargado con los datos de la fila, `currentEditId = id`) desde el boton `Editar` de cada fila
- [x] 3.3 Implementar validacion de campos obligatorios (`id`, `nombre`, `tematica`, `anio`) antes de enviar, evitando la peticion si falta alguno, y mostrando el mensaje de validacion junto al campo
- [x] 3.4 Implementar el envio del formulario: `POST /minifiguras` en modo alta o `PUT /minifiguras/:id` en modo edicion, usando `currentEditId` para distinguir el modo
- [x] 3.5 Al recibir una respuesta exitosa, cerrar el modal, refrescar la tabla con `loadCatalog` conservando los filtros activos, y mostrar un toast de exito
- [x] 3.6 Al recibir una respuesta de error (400/404/409), mantener el modal abierto con los datos ingresados y mostrar el mensaje de error correspondiente segun el codigo devuelto por la API

## 4. Logica de eliminacion (`public/app.js`)

- [x] 4.1 Implementar apertura del modal de confirmacion desde el boton `Eliminar` de una fila, identificando la minifigura afectada
- [x] 4.2 Implementar el cierre del modal de confirmacion sin peticion a la API cuando el usuario cancela
- [x] 4.3 Implementar el envio de `DELETE /minifiguras/:id` al confirmar, y verificar que en caso de exito se cierra el modal, se refresca la tabla y se muestra un toast de exito
- [x] 4.4 Implementar el manejo de error de la eliminacion (mostrar un toast de error y conservar la fila) cuando la API responde con un estado de error

## 5. Badges y toasts en el renderizado

- [x] 5.1 Modificar `renderCatalog` para renderizar el `estadoColeccion` de cada fila como badge con la variante correspondiente, y verificar con una prueba que la tabla contiene el marcado de badge esperado
- [x] 5.2 Implementar una funcion `showToast(mensaje, tipo)` reutilizada por las operaciones de alta, edicion y eliminacion, que anada y retire el toast automaticamente tras un tiempo determinado

## 6. Pruebas automatizadas

- [x] 6.1 Anadir pruebas en `test/web.test.js` que verifiquen que la pagina referencia los modales, las acciones por fila y el contenedor de toasts
- [x] 6.2 Anadir pruebas que verifiquen que `app.js` invoca `POST`, `PUT` y `DELETE` sobre `/minifiguras` con los datos esperados (via inspeccion del codigo fuente o pruebas de integracion con `fetch` simulado, segun el patron ya usado en el proyecto)
- [x] 6.3 Ejecutar `npm test` y verificar que toda la suite (incluidas las pruebas existentes de `test/minifiguras.test.js` y `test/web.test.js`) pasa sin errores
