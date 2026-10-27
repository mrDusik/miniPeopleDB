# Spec Delta

## Purpose

Permitir que cada coleccionista elija hasta cinco logros propios obtenidos como destacados y que esa seleccion determine la prioridad de sus listas de logros y su perfil, con persistencia segura entre dispositivos.

## ADDED Requirements

### Requirement: Seleccionar hasta cinco logros propios obtenidos

El usuario autenticado SHALL poder destacar y dejar de destacar sus propios logros obtenidos desde su modal propio de Logros. SHALL poder seleccionar cualquier ID obtenido, incluidos regalos; cada ID distinto SHALL ocupar un unico hueco independientemente de su cantidad. El maximo SHALL ser cinco. Intentar un sexto SHALL conservar los cinco anteriores y mostrar `Puedes destacar hasta 5 logros`, sin sustitucion automatica. Seleccionar un logro desconocido o no obtenido SHALL rechazarse sin cambios. Marcar un ID ya marcado o desmarcar uno ya desmarcado SHALL ser idempotente.

#### Scenario: Destacar un logro repetido o un regalo
- **WHEN** el usuario destaca un logro con cantidad veinte y un logro de tipo regalo disponiendo de cupo
- **THEN** quedan dos IDs destacados y dos huecos ocupados, no veintiuno

#### Scenario: Sexta seleccion
- **WHEN** ya existen cinco IDs destacados y se intenta destacar otro
- **THEN** se rechaza la seleccion y aparece `Puedes destacar hasta 5 logros`
- **AND** ninguna estrella anterior cambia y desmarcar una sigue permitido

#### Scenario: Logro no obtenido o peticion repetida
- **WHEN** se intenta destacar un ID desconocido o no obtenido, o repetir una seleccion confirmada
- **THEN** el ID invalido se rechaza sin cambios y la repeticion valida no duplica IDs ni consume otro hueco

### Requirement: Persistir la seleccion con identidad propia y limite atomico

La seleccion SHALL persistirse por cuenta en Supabase y estar disponible al iniciar sesion desde otro dispositivo. La mutacion SHALL derivar la identidad exclusivamente del JWT, rechazar selectores de otra identidad y usar permisos acotados sin `service_role`. Sin sesion SHALL responder `401`. El servidor SHALL imponer elegibilidad y maximo de cinco tambien ante peticiones simultaneas, sin depender de validaciones del navegador. La seleccion SHALL NOT modificar cantidades, Bricks, nivel, progreso, DNA, minifiguras, historial ni notificaciones. Una cuenta existente sin seleccion SHALL comenzar sin destacados; eliminar la cuenta SHALL eliminar su seleccion.

#### Scenario: Otro dispositivo y otra cuenta
- **WHEN** una cuenta guarda estrellas y posteriormente inicia sesion en otro dispositivo
- **THEN** obtiene la misma seleccion confirmada
- **AND** iniciar otra cuenta no muestra ni modifica las estrellas de la anterior

#### Scenario: Modificacion ajena o sin sesion
- **WHEN** se intenta modificar una seleccion sin sesion o eligiendo otra identidad
- **THEN** la peticion sin sesion responde `401` y la identidad ajena se rechaza sin alterar ninguna seleccion
- **AND** las tablas privadas no permiten lectura global ni escritura ajena

#### Scenario: Dos peticiones para el ultimo hueco
- **WHEN** existen cuatro destacados y dos peticiones simultaneas intentan destacar IDs distintos
- **THEN** solo una ocupa el quinto hueco y la otra se rechaza por limite
- **AND** nunca se confirma un estado de seis destacados ni se pierde un destacado previo

#### Scenario: Fallo atomico o eliminacion de cuenta
- **WHEN** falla una escritura de seleccion o se elimina la cuenta propietaria
- **THEN** el fallo conserva el estado anterior completo y la eliminacion retira la seleccion de esa cuenta

### Requirement: Mantener estrellas solo mientras se conserve el logro

Cada cambio confirmado de logros vigentes SHALL conservar las estrellas de IDs que siguen obtenidos y retirar las de IDs perdidos, liberando sus huecos en la misma confirmacion. Esto SHALL aplicarse a cambios de coleccion, acciones sociales, eliminaciones de cuenta relacionadas y recalculos autorizados por categorias u objetivos. Una recuperacion posterior SHALL NOT restaurar automaticamente una estrella perdida. Reducir cantidad sin perder el logro SHALL conservarla. Las lecturas publicas SHALL NOT ejecutar limpieza ni recalcular o escribir gamificacion ajena.

#### Scenario: Perdida y recuperacion
- **WHEN** un logro destacado deja de obtenerse y posteriormente vuelve a obtenerse
- **THEN** su perdida elimina su estrella y libera un hueco, y su recuperacion lo muestra sin destacar

#### Scenario: Disminucion de cantidad y recalcule estable
- **WHEN** la cantidad de un logro destacado baja de veinte a uno, o un recalcule conserva el ID obtenido
- **THEN** permanece destacado y ocupa el mismo unico hueco

#### Scenario: Seleccion concurrente con perdida
- **WHEN** una seleccion coincide con una mutacion que retira ese logro
- **THEN** el estado final no contiene estrellas de logros ausentes ni permite restaurarlas automaticamente despues
- **AND** un fallo de la mutacion no deja una retirada parcial de estrellas

### Requirement: Aplicar un orden comun a listas de logros obtenidos

Todas las listas de logros obtenidos SHALL priorizar los destacados del titular de los logros, nunca los del espectador. Dentro de destacados y no destacados SHALL situar no-regalos antes que regalos, aplicar `total` descendente y conservar el orden de origen para empates de tipo y total. Un regalo destacado SHALL preceder a todo no destacado. Sin destacados SHALL conservar el orden del modal propio anterior. SHALL NOT existir orden manual ni prioridad por fecha de seleccion. Los toasts de nuevos logros SHALL conservar su orden por Bricks nuevos ascendentes y SHALL NOT aplicar esta prioridad. Las listas truncadas SHALL ordenar antes de recortar.

#### Scenario: Regalo destacado con menos Bricks
- **WHEN** un regalo destacado tiene menos Bricks que un logro no destacado
- **THEN** el regalo aparece antes que ese logro en las listas del titular
- **AND** dentro de cada grupo los regalos quedan detras de sus no-regalos

#### Scenario: Empates y ausencia de seleccion
- **WHEN** dos logros del mismo grupo y tipo tienen igual total, o ningun logro esta destacado
- **THEN** los empatados conservan su orden de origen y sin seleccion se reproduce el orden anterior del modal propio

#### Scenario: Separar espectadores y eventos
- **WHEN** A consulta los logros de B y se generan toasts de nuevos logros
- **THEN** las listas de B usan exclusivamente las estrellas de B y los toasts conservan su orden anterior

### Requirement: Guardar desde una estrella accesible sin cerrar el modal

Cada fila del modal propio de Logros SHALL incorporar al final una estrella toggle con estados activo e inactivo equivalentes al patron visual del ojo, nombre accesible, estado presionado, foco visible y tooltip `Destacar` o `Quitar destacado`. Activarla mediante raton, tactil o teclado SHALL guardar inmediatamente sin boton Guardar ni cierre. Mientras haya un guardado en curso SHALL impedir envios duplicados desde el modal. Tras confirmacion SHALL actualizar estrellas y orden conservando el foco sobre el mismo logro cuando siga visible. Un fallo SHALL mantener estado y orden anteriores, mostrar error y permitir reintento. Los logros ajenos y el perfil SHALL mostrar un indicador de estrella solo en destacados, sin controles editables. Respuestas antiguas SHALL NOT reabrir modales, reemplazar una seleccion mas reciente ni actualizar otra cuenta o usuario consultado.

#### Scenario: Guardado confirmado o fallido
- **WHEN** se activa una estrella y el servidor confirma o rechaza el cambio
- **THEN** solo una confirmacion cambia el estado visible y reordena sin cerrar el modal
- **AND** ante fallo se conservan seleccion y orden anteriores con error recuperable

#### Scenario: Teclado y foco tras reordenar
- **WHEN** el usuario activa la estrella mediante teclado y el logro cambia de posicion
- **THEN** el foco permanece en su estrella y su nombre accesible, tooltip y estado presionado reflejan el resultado confirmado

#### Scenario: Consulta ajena o cambio de sesion
- **WHEN** se ven logros ajenos, o una respuesta llega tras cerrar el modal, cambiar el usuario consultado o cambiar de cuenta
- **THEN** los ajenos solo exponen indicadores sin acciones y la respuesta tardia no cambia la nueva vista ni atribuye estrellas a otra cuenta

### Requirement: Adaptar el modal de logros a los dispositivos existentes

El modal SHALL aumentar ligeramente su ancho disponible en Monitor y Tablet para alojar la columna de estrella sin modificar otros modales. Smartphone SHALL adaptar las filas al espacio disponible sin scroll horizontal. Monitor, Smartphone, Tablet portrait y Tablet landscape SHALL conservar legibilidad de nombre, descripcion, cantidad y Bricks, areas de interaccion estables y cierre accesible; SHALL NOT presentar solapamientos ni contenido fuera del viewport. SHALL conservarse el scroll vertical interno y el bloqueo de scroll de fondo existentes.

#### Scenario: Monitor y las dos orientaciones de Tablet
- **WHEN** se abre el modal en Monitor, Tablet portrait o Tablet landscape
- **THEN** la estrella dispone de una columna propia al final de cada fila y el ancho se amplia dentro del viewport
- **AND** las cabeceras, Bricks y cierre no se solapan

#### Scenario: Smartphone estrecho y tactil landscape
- **WHEN** se abre el modal en Smartphone estrecho o en su orientacion horizontal
- **THEN** todas las acciones y datos caben sin scroll horizontal, con texto largo ajustado y desplazamiento vertical interno cuando es necesario
