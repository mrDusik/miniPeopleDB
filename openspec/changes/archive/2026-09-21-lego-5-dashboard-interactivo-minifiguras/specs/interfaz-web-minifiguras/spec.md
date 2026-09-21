# Spec Delta

## ADDED Requirements

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
