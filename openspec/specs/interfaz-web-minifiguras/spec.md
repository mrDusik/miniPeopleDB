# interfaz-web-minifiguras Specification

## Purpose

Esta capacidad permite consultar el catálogo de minifiguras desde un navegador mediante una interfaz estática, con filtros explícitos, resultados tabulares y estados de interacción comprensibles.

## Requirements

### Requirement: Servir la interfaz web estática

El sistema SHALL servir una interfaz web estática desde la ruta raíz del servidor Express, incluyendo los recursos HTML, CSS y JavaScript necesarios para renderizarla en un navegador compatible.

#### Scenario: Cargar la página principal

- **WHEN** un usuario solicita `GET /`
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo contiene el documento HTML de la interfaz
- **AND** la respuesta identifica un tipo de contenido HTML

#### Scenario: Cargar recursos de la interfaz

- **WHEN** el navegador solicita los recursos CSS y JavaScript referenciados por la página principal
- **THEN** el sistema responde con HTTP `200`
- **AND** cada recurso se entrega con su tipo de contenido correspondiente

### Requirement: Filtrar el catálogo desde el panel de búsqueda

La interfaz SHALL mostrar un panel con controles para `tema`, `anio` y `estadoColeccion`, y SHALL ofrecer las acciones `Buscar` y `Mostrar todo`.

#### Scenario: Buscar con filtros

- **WHEN** el usuario completa uno o más filtros y activa `Buscar`
- **THEN** la interfaz solicita `GET /minifiguras` con los parámetros correspondientes
- **AND** actualiza la tabla con la colección devuelta por el servidor

#### Scenario: Mostrar todo

- **WHEN** el usuario activa `Mostrar todo`
- **THEN** la interfaz limpia los filtros activos
- **AND** solicita `GET /minifiguras` sin filtros
- **AND** actualiza la tabla con todo el catálogo devuelto

### Requirement: Mostrar resultados en una tabla dinámica

La interfaz SHALL representar cada minifigura recibida en una fila de tabla y SHALL mostrar, como mínimo, `id`, `nombre`, `descripcion`, `tematica`, `anio` y `estadoColeccion`.

#### Scenario: Catálogo con resultados

- **WHEN** una consulta devuelve una o más minifiguras válidas
- **THEN** la tabla contiene una fila por minifigura
- **AND** las filas conservan el orden recibido por la API

#### Scenario: Consulta sin resultados

- **WHEN** una consulta devuelve un arreglo vacío
- **THEN** la interfaz conserva los encabezados de la tabla
- **AND** muestra un estado visible que indica que no hay resultados

### Requirement: Comunicar estados de carga y error

La interfaz SHALL comunicar que una consulta está en curso y SHALL mostrar un mensaje visible cuando la API no responde correctamente o devuelve datos que no pueden representarse como una colección.

#### Scenario: Consulta en curso

- **WHEN** se inicia una consulta al catálogo
- **THEN** la interfaz muestra un estado de carga
- **AND** evita que una acción repetida produzca una actualización incoherente mientras la consulta está pendiente

#### Scenario: Error de consulta

- **WHEN** la API devuelve un estado HTTP de error o la solicitud falla
- **THEN** la interfaz muestra un mensaje visible de error
- **AND** no presenta datos parciales como si fueran resultados correctos

### Requirement: Crear una minifigura desde la interfaz

La interfaz SHALL ofrecer una accion `Nueva minifigura` en el panel de resultados que abra un modal con un formulario para `id`, `nombre`, `descripcion`, `tematica`, `anio` y `estadoColeccion`, y SHALL enviar los datos mediante `POST /minifiguras`.

#### Scenario: Alta exitosa

- **WHEN** el usuario completa los campos obligatorios (`id`, `nombre`, `tematica`, `anio`) y confirma el formulario de alta
- **THEN** la interfaz solicita `POST /minifiguras` con los datos ingresados
- **AND** al recibir una respuesta exitosa cierra el modal, refresca la tabla conservando los filtros activos y muestra una notificacion toast de exito

#### Scenario: Alta con datos invalidos rechazada por el servidor

- **WHEN** el usuario confirma el formulario de alta y la API responde con un estado de error (400 o 409)
- **THEN** la interfaz mantiene el modal abierto con los datos ingresados
- **AND** muestra un mensaje de error visible dentro del modal o mediante un toast que identifique el problema

#### Scenario: Validacion de campos obligatorios antes de enviar

- **WHEN** el usuario intenta confirmar el formulario de alta sin completar `id`, `nombre`, `tematica` o `anio`
- **THEN** la interfaz no envia la peticion a la API
- **AND** muestra un mensaje de validacion visible junto al campo incompleto

### Requirement: Editar una minifigura existente desde la interfaz

Cada fila de la tabla SHALL incluir una accion `Editar` que abra el mismo modal de formulario precargado con los datos de la minifigura seleccionada, y SHALL enviar los cambios mediante `PUT /minifiguras/:id`.

#### Scenario: Edicion exitosa

- **WHEN** el usuario modifica uno o mas campos del formulario de edicion y confirma
- **THEN** la interfaz solicita `PUT /minifiguras/:id` con el identificador de la fila seleccionada y los datos actualizados
- **AND** al recibir una respuesta exitosa cierra el modal, refresca la tabla conservando los filtros activos y muestra una notificacion toast de exito

#### Scenario: Edicion sobre una minifigura ya no disponible

- **WHEN** el usuario confirma el formulario de edicion y la API responde `404`
- **THEN** la interfaz muestra un mensaje de error visible indicando que la minifigura ya no existe
- **AND** no aplica cambios locales a la fila como si la operacion hubiera tenido exito

### Requirement: Eliminar una minifigura mediante confirmacion explicita

Cada fila de la tabla SHALL incluir una accion `Eliminar` que abra un modal de confirmacion independiente identificando la minifigura afectada, y solo tras confirmar SHALL la interfaz enviar `DELETE /minifiguras/:id`.

#### Scenario: Confirmar eliminacion

- **WHEN** el usuario activa `Eliminar` en una fila y confirma la accion en el modal de confirmacion
- **THEN** la interfaz solicita `DELETE /minifiguras/:id` con el identificador de la fila
- **AND** al recibir una respuesta exitosa cierra el modal, refresca la tabla conservando los filtros activos y muestra una notificacion toast de exito

#### Scenario: Cancelar eliminacion

- **WHEN** el usuario activa `Eliminar` en una fila y cancela el modal de confirmacion
- **THEN** la interfaz cierra el modal sin enviar ninguna peticion a la API
- **AND** la fila permanece sin cambios en la tabla

#### Scenario: Eliminacion rechazada por el servidor

- **WHEN** el usuario confirma la eliminacion y la API responde con un estado de error
- **THEN** la interfaz muestra una notificacion toast de error que identifique el problema
- **AND** conserva la fila en la tabla como si la eliminacion no hubiera ocurrido

### Requirement: Mostrar el estado de coleccion como badge visual

Cada fila de la tabla SHALL representar el valor de `estadoColeccion` mediante un badge visual que distinga los distintos estados posibles.

#### Scenario: Renderizado de badge por fila

- **WHEN** la tabla renderiza una fila con un valor de `estadoColeccion`
- **THEN** la celda correspondiente muestra un badge con el texto del estado
- **AND** el badge aplica una variante visual dependiente del valor del estado

### Requirement: Notificar el resultado de las operaciones de gestion mediante toasts

La interfaz SHALL mostrar una notificacion toast tras cada operacion de creacion, edicion o eliminacion, distinguiendo visualmente entre exito y error, y SHALL retirar cada toast automaticamente sin requerir interaccion del usuario.

#### Scenario: Toast de exito

- **WHEN** una operacion de creacion, edicion o eliminacion se completa correctamente
- **THEN** la interfaz muestra un toast con un mensaje de confirmacion
- **AND** el toast desaparece automaticamente tras un tiempo determinado

#### Scenario: Toast de error

- **WHEN** una operacion de creacion, edicion o eliminacion falla por un error de la API o de red
- **THEN** la interfaz muestra un toast con un mensaje de error visible
- **AND** el toast no impide que el usuario continue interactuando con la tabla o los modales
