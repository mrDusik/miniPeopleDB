# Spec Delta

## MODIFIED Requirements

### Requirement: Filtrar el catálogo desde el panel de búsqueda
La interfaz SHALL mostrar controles para `id`, `nombre`, `categoria`, `subcategoria`, `anio`, `estadoColeccion` y observación, y SHALL ofrecer `Buscar` y `Mostrar todo`. El estado SHALL filtrarse con dos toggles de icono `📦` y `🔍`: activar solo uno filtra por ese estado; activar ambos o ninguno no restringe por estado. En escritorio los controles SHALL conservar la disposición en una sola fila cuando el ancho lo permita. Las opciones de categoría y subcategoría SHALL derivarse de las figuras presentes en el catálogo, incluir el contador actual con formato `Nombre (X)`, y subcategoría SHALL depender de la categoría seleccionada. `Mostrar todo` SHALL restaurar `Todas (Total)`, limpiar nombre y desactivar los toggles.

#### Scenario: Buscar por nombre
- **WHEN** el usuario introduce parte del nombre y activa `Buscar`
- **THEN** la interfaz solicita el filtro `nombre`
- **AND** actualiza la tabla con las coincidencias

#### Scenario: Buscar con filtros
- **WHEN** el usuario completa filtros y activa `Buscar`
- **THEN** la interfaz solicita `GET /minifiguras` con los parámetros correspondientes
- **AND** actualiza la tabla

#### Scenario: Filtrar por estado con iconos
- **WHEN** el usuario activa solo `📦` o solo `🔍` y selecciona `Buscar`
- **THEN** la interfaz solicita el estado correspondiente
- **WHEN** ambos iconos están activos o ambos inactivos
- **THEN** la interfaz no restringe los resultados por estado

#### Scenario: Selectores con contadores
- **WHEN** se carga o cambia el catálogo
- **THEN** categoría y subcategoría muestran únicamente opciones presentes con sus contadores
- **AND** al seleccionar categoría la subcategoría se limita a esa categoría

#### Scenario: Restablecer filtros
- **WHEN** el usuario activa `Mostrar todo`
- **THEN** se limpian nombre, categoría, subcategoría y observación
- **AND** los selectores vuelven a sus opciones totales

#### Scenario: Mostrar todo
- **WHEN** el usuario activa `Mostrar todo`
- **THEN** limpia los filtros
- **AND** solicita `GET /minifiguras` sin filtros
- **AND** muestra todo el catálogo

#### Scenario: Cambiar la categoría del filtro
- **WHEN** el usuario selecciona una `categoria` en el panel de filtros
- **THEN** el control `subcategoria` se actualiza para mostrar solo las subcategorías de esa categoría
- **AND** cualquier subcategoría seleccionada previamente que no pertenezca a la nueva categoría se limpia

### Requirement: Mostrar resultados en una tabla dinámica
La interfaz SHALL representar cada minifigura en una fila y SHALL mostrar una acción de observación, `id`, `nombre`, `categoria`, `subcategoria`, `anio`, `estadoColeccion`, `Precio` y `Diferencia`. La columna ID SHALL ser un control `.id-link` que abra el modal unificado en modo visualización. La URL de imagen SHALL usar siempre el ID en minúsculas, aunque el ID persistido se muestre en mayúsculas.

#### Scenario: ID abre visualización
- **WHEN** el usuario hace clic en el ID de una fila
- **THEN** se abre el modal en modo visualización
- **AND** todos sus campos, el toggle de observación y sus acciones de modificación permanecen deshabilitados

#### Scenario: Catálogo con resultados
- **WHEN** una consulta devuelve figuras válidas
- **THEN** la tabla contiene una fila por figura y conserva el orden recibido
- **AND** `Precio` se muestra en Euros cuando existe
- **AND** `Diferencia` muestra `precio - precioCompra` para `COLECCIÓN`, `?` si falta un precio y `N/A` para `BUSCADA`

#### Scenario: Imagen usa ID minúsculo
- **WHEN** se renderiza la miniatura o preview de una figura con ID mayúsculo
- **THEN** la petición al CDN usa el ID en minúsculas

#### Scenario: Consulta sin resultados
- **WHEN** la consulta devuelve un arreglo vacío
- **THEN** conserva los encabezados
- **AND** muestra un estado visible sin resultados

#### Scenario: El ID no abre la vista previa
- **WHEN** el usuario hace click en el `id` de una fila
- **THEN** se abre el modal de visualización sin abrir directamente la vista previa de imagen

### Requirement: Gestionar datos de compra y precio Brickset
La interfaz SHALL incluir `precioCompra` y `fechaCompra` editables cuando el modo lo permita, y `categoria`, `subcategoria`, `anio` y `precio` como campos provenientes de Brickset con estilo `.input-readonly`. SHALL ofrecer sincronización individual y masiva, y la sincronización individual SHALL aplicar el año actual como fallback cuando Brickset devuelva `0` o no lo devuelva.

#### Scenario: Fallback de año visible
- **WHEN** la consulta individual a Brickset devuelve año `0` o ausente
- **THEN** el campo Año muestra el año actual
- **AND** el botón Guardar puede habilitarse si se cumplen los demás obligatorios

#### Scenario: Consulta individual
- **WHEN** el usuario solicita los datos de Brickset con un ID válido
- **THEN** solicita los datos individuales a la API
- **AND** rellena categoría, subcategoría cuando aplica, año y precio

#### Scenario: Actualización masiva
- **WHEN** el usuario activa `Actualizar precios desde Brickset`
- **THEN** inicia la actualización masiva de `precio` únicamente
- **AND** refresca tabla y resumen al terminar
- **AND** no modifica categoría, subcategoría ni año

## ADDED Requirements

### Requirement: Mostrar y administrar la watchlist en la interfaz
La interfaz SHALL mostrar un toggle con icono de ojo por fila, distinguir estados activo e inactivo mediante `.eye-icon.active` y `.eye-icon.inactive`, y mostrar un Toast de tipo `warning` con el texto `Límite alcanzado: Máximo 10 minifiguras en observación` cuando el backend rechace el undécimo elemento. Debajo de los rankings SHALL mostrar una galería horizontal de observadas ordenada por `precioBrickset` descendente, colocando las figuras sin precio al final y mostrando bajo cada imagen `ICONO ID PRECIO`, sin guiones. Los estados SHALL representarse visualmente en toda la interfaz con `📦` y `🔍`, conservando sus valores internos para API y persistencia.

#### Scenario: Alternar observación
- **WHEN** el usuario activa el ojo de una fila no observada dentro del cupo
- **THEN** la interfaz persiste el cambio y actualiza el estado visual y la galería

#### Scenario: Límite de observación
- **WHEN** el usuario intenta activar una undécima figura
- **THEN** la interfaz deja el ojo inactivo
- **AND** muestra el Toast de advertencia exacto

#### Scenario: Abrir una tarjeta observada
- **WHEN** el usuario hace clic en una tarjeta o imagen de la galería
- **THEN** se abre el modal unificado en modo visualización con todos los datos de la minifigura
- **AND** sus campos y acciones de modificación permanecen deshabilitados

### Requirement: Centrar y jerarquizar los elementos de la interfaz
La interfaz SHALL centrar horizontal y verticalmente el contenido de rankings, seguimiento, filtros y tabla. Los textos azules SHALL conservar alineación a la izquierda. El crédito `BY MRDUSIK` SHALL aparecer inmediatamente después del nombre de la aplicación, no al extremo derecho del encabezado. La fila de resumen SHALL contener tres paneles: nivel, recuento y valor total. El panel del nivel SHALL conservar su ancho actual; el panel de recuento SHALL mostrar únicamente los iconos 📦 y 🔍 con sus cifras; el panel de valor total SHALL incluir el botón `🔄` a la derecha del importe. El total SHALL conservar la tipografía y tamaño de Bricks. Los rankings SHALL titularse `Top 5 por precio` y `Top 5 por antiguedad`; SHALL eliminarse la línea amarilla horizontal de ancho completo situada sobre ellos. La ubicación del mensaje `Catálogo actualizado.`, el recuento de figuras y el botón `+` SHALL conservarse como en la interfaz previa.

#### Scenario: Mostrar el resumen de colección
- **WHEN** se presenta el resumen de valoración
- **THEN** aparecen los paneles de nivel, recuento y valor total en ese orden
- **AND** el recuento muestra únicamente los iconos 📦 y 🔍 con sus cifras
- **AND** el botón `🔄` queda a la derecha del total en el tercer panel
- **AND** la actualización de precios se acciona mediante `🔄`
- **AND** el total comparte tipografía y tamaño con el valor de Bricks

#### Scenario: Mostrar los rankings
- **WHEN** se carga la interfaz
- **THEN** los rankings muestran los títulos `Top 5 por precio` y `Top 5 por antiguedad`
- **AND** no aparece una línea amarilla de ancho completo sobre los rankings

#### Scenario: Mostrar la vista previa de una imagen
- **WHEN** se hace clic en la foto de una minifigura de la tabla
- **THEN** el modal muestra únicamente el ID como título y el nombre debajo
- **AND** no incluye el prefijo `Minifigura:`

#### Scenario: Centrar el contenido
- **WHEN** se muestran los rankings, seguimiento, filtros o tabla
- **THEN** su contenido queda centrado horizontal y verticalmente
- **AND** los textos azules quedan alineados a la izquierda

### Requirement: Unificar el modal por modo de apertura
La interfaz SHALL usar un modal de dos columnas con formulario a la izquierda y preview de 250px a la derecha, sin fondo gris detrás de la imagen, con el rótulo `Preview` y centrado vertical respecto al modal. El modal SHALL ajustarse al viewport sin scroll horizontal ni vertical. ID, su campo, el botón de sincronización cuando aparezca, Nombre y su campo SHALL compartir una fila dentro de la columna del formulario, que tendrá el mismo ancho que el campo de Descripción; el botón SHALL mostrar solo `🔄`. Los rótulos ID y Nombre SHALL alinearse a la izquierda. Los asteriscos de campos obligatorios SHALL ocultarse en visualización. La descripción SHALL quedar centrada verticalmente respecto a su área de texto. El estado SHALL controlarse mediante botones de icono mutuamente excluyentes, con `📦` seleccionado por defecto; Seguir SHALL ser un toggle visual con los estados activo/inactivo de la tabla. En creación solo ID estará habilitado inicialmente; sincronizar y guardar permanecerán deshabilitados hasta obtener datos y completar ID, Nombre, Estado, Categoría, Año y Precio Brickset. En edición ID y campos Brickset serán solo lectura y se conservará `FechaRegistro`; en visualización todos los campos e iconos estarán deshabilitados, sincronizar estará oculto y solo Cerrar estará activo.

#### Scenario: Crear o editar una minifigura
- **WHEN** se abre el modal en modo creación o edición
- **THEN** ID, su campo, Nombre, su campo y el botón `🔄` comparten una fila
- **AND** esa fila tiene el mismo ancho que el campo de Descripción
- **AND** Descripción queda centrada verticalmente respecto al área de texto
- **AND** el modal no muestra barras de scroll
- **AND** la preview queda centrada verticalmente junto al formulario

#### Scenario: Visualizar una minifigura
- **WHEN** se abre el modal en modo visualización
- **THEN** ID, su campo, Nombre y su campo comparten una fila
- **AND** la fila no reserva espacio para el botón de sincronización
- **AND** los asteriscos obligatorios no aparecen
- **AND** todos los campos y toggles están deshabilitados y no aparece el título del modal
- **AND** los campos deshabilitados aparecen sombreados
- **AND** el modal no muestra barras de scroll
- **AND** la preview queda centrada verticalmente junto al formulario

#### Scenario: Mostrar el estado real en visualización
- **WHEN** se visualiza una minifigura
- **THEN** los toggles muestran seleccionados el estado de colección y el valor real de observada
- **AND** ambos toggles permanecen deshabilitados y no pueden modificarse

#### Scenario: Encabezar la preview del modal
- **WHEN** se abre el modal en cualquier modo
- **THEN** el título del modal y el rótulo `Preview` comparten contenedor y centro horizontal
- **AND** el título queda alineado arriba, encima de `Preview`

#### Scenario: Crear y sincronizar
- **WHEN** el usuario abre alta, introduce un ID y sincroniza correctamente
- **THEN** se autocompletan los datos Brickset y la imagen
- **AND** se habilitan únicamente los campos manuales permitidos y Guardar cuando los obligatorios sean válidos

#### Scenario: Error de sincronización en alta
- **WHEN** la sincronización de un ID falla
- **THEN** los campos dependientes permanecen bloqueados
- **AND** se muestra `No se encontraron datos en Brickset para el ID especificado` como Toast de error

#### Scenario: Editar sin alterar fecha
- **WHEN** se guarda una figura desde el modo edición
- **THEN** se mantienen los campos Brickset no editables
- **AND** la fecha original de registro no cambia

#### Scenario: Visualizar solo lectura
- **WHEN** se abre una figura desde `.id-link`, una tarjeta de ranking o una tarjeta de observadas
- **THEN** el modal muestra todos los datos y preview sin permitir edición, observación ni sincronización
- **AND** solo Cerrar permanece activo

#### Scenario: Visualizar una tarjeta fuera del catálogo filtrado
- **WHEN** se abre una tarjeta cuya figura no está en el catálogo actualmente cargado
- **THEN** la interfaz obtiene la figura por su ID antes de abrir el modal
- **AND** muestra el registro completo en modo visualización
- **AND** muestra el registro completo en modo visualización

### Requirement: Aplicar los colores y alineaciones de paneles solicitados
La interfaz SHALL mostrar el botón Eliminar con el mismo fondo rojo que los botones principales. La línea superior del panel Seguimiento SHALL ser roja. Los tres paneles de resumen SHALL tener línea inferior azul y el panel Valor Total SHALL alinear su información a la derecha junto al botón de sincronización. La barra de progreso de gamificación SHALL mostrar el porcentaje de avance hacia el nivel siguiente. Los Toasts de tareas completadas SHALL ser azules, los Toasts de subida de nivel SHALL ser rojos y los demás Toasts SHALL tener fondo blanco. El modal SHALL ajustar su altura al contenido; Nombre SHALL aparecer en la columna izquierda, alineado con Fecha de compra, Precio de compra y los demás campos.

#### Scenario: Colorear notificaciones Toast
- **WHEN** se completa una tarea, se sube de nivel o se muestra otra notificación
- **THEN** la notificación es azul para una tarea completada
- **AND** es roja al subir de nivel
- **AND** es blanca para los demás eventos

#### Scenario: Colores y alineación del resumen
- **WHEN** se muestra la pantalla principal
- **THEN** Eliminar usa el fondo rojo principal y Seguimiento tiene línea superior roja
- **AND** Nivel, recuento y Valor Total presentan línea inferior azul
- **AND** importe y 🔄 aparecen alineados a la derecha dentro de Valor Total

#### Scenario: Mostrar avance
- **WHEN** se calcula el porcentaje de progreso hacia el siguiente nivel
- **THEN** el valor numérico aparece dentro de la barra de progreso

#### Scenario: Adaptar altura del modal
- **WHEN** se abre el modal en creación, edición o visualización
- **THEN** su altura se ajusta al contenido sin altura fija
- **AND** Nombre aparece en la columna de campos alineado con los otros controles
