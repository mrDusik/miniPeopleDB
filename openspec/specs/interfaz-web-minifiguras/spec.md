# interfaz-web-minifiguras Specification

## Purpose

Esta capacidad permite consultar y gestionar el catálogo desde un navegador mediante una interfaz estática, con valoración en Euros, rankings y estados de interacción comprensibles.

## Requirements

### Requirement: Servir la interfaz web estática

El sistema SHALL servir una interfaz web estática desde la ruta raíz del servidor Express, incluyendo HTML, CSS y JavaScript.

#### Scenario: Cargar la página principal
- **WHEN** un usuario solicita `GET /`
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo contiene el documento HTML
- **AND** la respuesta identifica un tipo de contenido HTML

#### Scenario: Cargar recursos
- **WHEN** el navegador solicita CSS y JavaScript referenciados
- **THEN** cada recurso responde con HTTP `200` y su tipo de contenido correspondiente

### Requirement: Filtrar el catálogo desde el panel de búsqueda

La interfaz SHALL mostrar controles para `id`, `nombre`, `categoria`, `subcategoria`, `anio`, `estadoColeccion` y observación, y SHALL ofrecer `Buscar` y `Mostrar todo`. El estado SHALL filtrarse con dos toggles de icono `📦` y `🔍`: activar solo uno filtra por ese estado; activar ambos o ninguno no restringe por estado. En escritorio los controles SHALL conservar la disposición en una sola fila cuando el ancho lo permita. Las opciones de categoría y subcategoría SHALL derivarse de las figuras presentes en el catálogo, incluir el contador actual con formato `Nombre (X)`, y subcategoría SHALL depender de la categoría seleccionada. `Mostrar todo` SHALL restaurar `Todas (Total)`, limpiar nombre y desactivar los toggles.

#### Scenario: Buscar con filtros
- **WHEN** el usuario completa filtros y activa `Buscar`
- **THEN** la interfaz solicita `GET /minifiguras` con los parámetros correspondientes
- **AND** actualiza la tabla

#### Scenario: Buscar por nombre
- **WHEN** el usuario introduce parte del nombre y activa `Buscar`
- **THEN** la interfaz solicita el filtro `nombre`
- **AND** actualiza la tabla con las coincidencias

#### Scenario: Filtrar por estado con iconos
- **WHEN** el usuario activa solo `📦` o solo `🔍` y selecciona `Buscar`
- **THEN** la interfaz solicita el estado correspondiente
- **WHEN** ambos iconos están activos o ambos inactivos
- **THEN** la interfaz no restringe los resultados por estado

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

#### Scenario: Catálogo con resultados
- **WHEN** una consulta devuelve figuras válidas
- **THEN** la tabla contiene una fila por figura y conserva el orden recibido
- **AND** `Precio` se muestra en Euros cuando existe
- **AND** `Diferencia` muestra `precio - precioCompra` para `COLECCIÓN`, `?` si falta un precio y `N/A` para `BUSCADA`
- **AND** la columna `subcategoria` se muestra vacía cuando la minifigura no tiene subcategoría asignada

#### Scenario: Consulta sin resultados
- **WHEN** la consulta devuelve un arreglo vacío
- **THEN** conserva los encabezados
- **AND** muestra un estado visible sin resultados

#### Scenario: El ID no abre la vista previa
- **WHEN** el usuario hace click en el `id` de una fila
- **THEN** se abre el modal de visualización sin abrir directamente la vista previa de imagen

#### Scenario: ID abre visualización
- **WHEN** el usuario hace clic en el ID de una fila
- **THEN** se abre el modal en modo visualización
- **AND** todos sus campos, el toggle de observación y sus acciones de modificación permanecen deshabilitados

#### Scenario: Imagen usa ID minúsculo
- **WHEN** se renderiza la miniatura o preview de una figura con ID mayúsculo
- **THEN** la petición al CDN usa el ID en minúsculas

### Requirement: Comunicar estados de carga y error

La interfaz SHALL comunicar cargas, errores locales y errores de Brickset sin borrar datos válidos ni bloquear la página.

#### Scenario: Consulta en curso
- **WHEN** se inicia una consulta o actualización de precios
- **THEN** muestra carga mediante estado o Toast
- **AND** deshabilita los botones relevantes
- **AND** evita solicitudes concurrentes

#### Scenario: Error de consulta
- **WHEN** la API devuelve un error o resultado parcial
- **THEN** conserva filas y precios anteriores
- **AND** muestra un Toast o resumen identificando los fallos

### Requirement: Gestionar datos de compra y precio Brickset

La interfaz SHALL incluir `precioCompra` y `fechaCompra` editables cuando el modo lo permita, y `categoria`, `subcategoria`, `anio` y `precio` como campos provenientes de Brickset con estilo `.input-readonly`. SHALL sincronizar individualmente de forma automática al cargar correctamente la imagen de un ID introducido y SHALL ofrecer sincronización masiva; la sincronización individual SHALL aplicar el año actual como fallback cuando Brickset devuelva `0` o no lo devuelva.

#### Scenario: Consulta individual
- **WHEN** se carga correctamente la imagen del ID válido introducido en el modal de alta o edición
- **THEN** solicita los datos individuales a la API
- **AND** rellena categoría, subcategoría cuando aplica, año y precio

#### Scenario: Actualización masiva
- **WHEN** el usuario activa `Actualizar precios desde Brickset`
- **THEN** inicia la actualización masiva de `precio` únicamente
- **AND** muestra Toasts de carga, éxito o error
- **AND** refresca tabla y resumen al terminar
- **AND** no modifica `categoria`, `subcategoria` ni `anio` de ninguna minifigura

#### Scenario: Fallback de año visible
- **WHEN** la consulta individual a Brickset devuelve año `0` o ausente
- **THEN** el campo Año muestra el año actual
- **AND** el botón Guardar puede habilitarse si se cumplen los demás obligatorios

### Requirement: Ordenar la tabla por año y precio

La interfaz SHALL permitir ordenar por `Año` y `Precio`, alternando ascendente y descendente.

#### Scenario: Ordenar por año
- **WHEN** el usuario activa `Año`
- **THEN** las filas se ordenan por año
- **AND** una activación posterior invierte el orden

#### Scenario: Ordenar por precio
- **WHEN** el usuario activa `Precio`
- **THEN** las filas se ordenan por precio
- **AND** una activación posterior invierte el orden

### Requirement: Mostrar resumen, contadores y rankings

La interfaz SHALL mostrar el `Valor Total de la Colección` en Euros, priorizando `precio` y usando `precioCompra` como fallback, junto con los contadores de `COLECCIÓN` y `BUSCADA`, un top 5 por precio y un top 5 de figuras más antiguas.

#### Scenario: Cabecera con resumen
- **WHEN** la API devuelve el resumen
- **THEN** muestra el valor total y ambos contadores
- **AND** muestra los rankings sin figuras `BUSCADA`
- **AND** muestra menos de cinco elementos cuando no hay más disponibles

### Requirement: Crear, editar y eliminar minifiguras

La interfaz SHALL ofrecer creación, edición y eliminación mediante formularios y confirmación explícita, mostrando Toasts tras cada operación.

#### Scenario: Alta, edición o eliminación exitosa
- **WHEN** la API confirma la operación
- **THEN** refresca la tabla conservando filtros
- **AND** muestra un Toast de éxito

#### Scenario: Operación rechazada
- **WHEN** la API devuelve un error
- **THEN** conserva los datos existentes
- **AND** muestra un mensaje o Toast de error

### Requirement: Rellenar Categoría, Subcategoría y Año desde Brickset en el formulario

El formulario de alta y edición SHALL mostrar `categoria`, `subcategoria` y `anio` como campos no editables, igual que `precio`. Ninguno de estos cuatro campos SHALL aceptar edición manual: SHALL rellenarse únicamente al consultar los datos de Brickset con un `id` válido, mediante un único botón cuyo texto SHALL reflejar que consulta datos generales de Brickset y no solo el precio.

#### Scenario: Consulta de datos rellena los cuatro campos
- **WHEN** el usuario solicita los datos de Brickset con un `id` válido
- **THEN** la interfaz solicita los datos a la API
- **AND** rellena `categoria`, `subcategoria` (cuando Brickset la resuelve dentro del catálogo local), `anio` y `precio`
- **AND** los cuatro campos permanecen no editables

#### Scenario: Categoría no reconocida en el catálogo local
- **WHEN** la API no puede resolver la categoría de Brickset contra el catálogo local de categorías
- **THEN** la interfaz muestra un Toast de error
- **AND** conserva los valores previos de `categoria`, `subcategoria`, `anio` y `precio`

#### Scenario: Alta de una minifigura nueva
- **WHEN** el usuario abre el formulario para crear una minifigura
- **THEN** `categoria`, `subcategoria`, `anio` y `precio` aparecen vacíos y no editables hasta que se consulten los datos de Brickset

### Requirement: Representar las acciones de alta, edición y eliminación como iconos

Los controles `Nueva minifigura`, `Editar` y `Eliminar` SHALL mostrarse como botones de solo icono (sin texto visible), cada uno con un `aria-label` que identifique la acción en español para que permanezcan accesibles a lectores de pantalla.

#### Scenario: Botones de icono con nombre accesible
- **WHEN** se renderiza la tabla de resultados o la cabecera de resultados
- **THEN** `Nueva minifigura`, `Editar` y `Eliminar` se muestran como iconos sin texto visible
- **AND** cada uno expone mediante `aria-label` el nombre de la acción que realiza

### Requirement: Mostrar los dos rankings en una fila, uno junto al otro

Los rankings `Top 5 minifiguras en colección por precio` y `Top 5 minifiguras más antiguas` SHALL mostrarse lado a lado en una misma fila, con el mismo ancho combinado que los paneles `Consulta` (`search-panel`) y `Resultados` (`results-panel`), y SHALL estar claramente diferenciados visualmente entre sí (por ejemplo, mediante cajas o bordes independientes). Dentro de cada ranking, sus tarjetas SHALL mostrarse siempre en una única fila sin desplazamiento horizontal, reduciendo su tamaño y el espacio entre ellas si fuera necesario para caber en el ancho disponible.

#### Scenario: Rankings lado a lado con el ancho de los paneles
- **WHEN** se carga la página en un ancho de escritorio
- **THEN** ambos rankings ocupan, entre los dos, el mismo ancho que `search-panel`/`results-panel`
- **AND** cada ranking aparece en su propia caja claramente diferenciada de la otra

#### Scenario: Las tarjetas de un ranking no requieren desplazamiento horizontal
- **WHEN** un ranking muestra sus 5 tarjetas dentro de su columna
- **THEN** las 5 tarjetas se muestran en una sola fila sin scroll horizontal
- **AND** el tamaño de las tarjetas y el espacio entre ellas se reduce lo necesario para que quepan

### Requirement: Mostrar y administrar la watchlist en la interfaz

La interfaz SHALL mostrar un toggle con icono de ojo por fila, distinguir estados activo e inactivo mediante `.eye-icon.active` y `.eye-icon.inactive`, y mostrar un Toast de tipo `warning` con el texto `Límite alcanzado: Máximo 10 minifiguras en observación` cuando el backend rechace el undécimo elemento. Debajo de los rankings SHALL mostrar una galería horizontal de observadas ordenada por `precioBrickset` descendente, colocando las figuras sin precio al final y mostrando bajo cada imagen `ICONO ID PRECIO`, sin guiones. El encabezado SHALL mostrar el número de observadas y el máximo permitido con el formato `Seguimiento (X / 10)`. Las tarjetas SHALL usar el mismo tooltip `ID - nombre` que las tarjetas de rankings y resaltar su borde en rojo al pasar el cursor. Cada emoji SHALL mostrar su significado al pasar el cursor: `👁️` como `Seguimiento`, `📦` como `Colección` y `🔍` como `Búsqueda`. Los estados SHALL representarse visualmente en toda la interfaz con `📦` y `🔍`, conservando sus valores internos para API y persistencia.

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

#### Scenario: Mostrar el cupo de seguimiento
- **WHEN** se carga o actualiza la lista de observadas
- **THEN** el encabezado muestra el número actual y el máximo de diez con el formato `Seguimiento (X / 10)`

### Requirement: Centrar y jerarquizar los elementos de la interfaz

La interfaz SHALL centrar horizontal y verticalmente el contenido de rankings, seguimiento, filtros y tabla. Los textos azules SHALL conservar alineación a la izquierda. El crédito `BY MRDUSIK` SHALL aparecer debajo del nombre de la aplicación, alineado a su derecha. El panel del nivel SHALL situarse a la derecha del nombre de la aplicación, en la misma fila, mostrando nivel y Bricks, e incluir una flecha desplegable a su derecha. Los rankings SHALL titularse `Top 5 por precio` y `Top 5 por antiguedad` y agruparse en un panel con título azul `Rankings`, con el mismo estilo que el panel `Seguimiento`.

#### Scenario: Mostrar los rankings
- **WHEN** se carga la interfaz
- **THEN** los rankings muestran los títulos `Top 5 por precio` y `Top 5 por antiguedad`
- **AND** no aparece una línea amarilla de ancho completo sobre los rankings

#### Scenario: Centrar el contenido
- **WHEN** se muestran los rankings, seguimiento, filtros o tabla
- **THEN** su contenido queda centrado horizontal y verticalmente
- **AND** los textos azules quedan alineados a la izquierda

### Requirement: Unificar el modal por modo de apertura

La interfaz SHALL usar un modal de dos columnas con formulario a la izquierda y preview de 250px a la derecha, sin fondo gris detrás de la imagen. El modal SHALL ajustarse al viewport sin scroll horizontal ni vertical. La fila de identidad SHALL ocupar el ancho de la columna del formulario y distribuir en dos áreas iguales una columna apilada de ID y Nombre y el campo de Descripción. La consulta individual SHALL iniciarse automáticamente al cargar la imagen tras introducir un ID; no habrá un botón individual de sincronización. Los asteriscos de campos obligatorios SHALL ocultarse en visualización. El estado SHALL controlarse mediante botones de icono mutuamente excluyentes, con `📦` seleccionado por defecto; Seguir SHALL ser un toggle visual con los estados activo/inactivo de la tabla. En creación solo ID estará habilitado inicialmente; los campos dependientes y Guardar permanecerán deshabilitados hasta obtener datos y completar ID, Nombre, Estado, Categoría, Año y Precio Brickset. En edición ID y campos Brickset serán solo lectura y se conservará `FechaRegistro`; en visualización todos los campos e iconos estarán deshabilitados y solo Cerrar estará activo.

#### Scenario: Crear y sincronizar
- **WHEN** el usuario abre alta, introduce un ID y sincroniza correctamente
- **THEN** se autocompletan los datos Brickset y la imagen
- **AND** se habilitan únicamente los campos manuales permitidos y Guardar cuando los obligatorios sean válidos

#### Scenario: Visualizar solo lectura
- **WHEN** se abre una figura desde `.id-link`, una tarjeta de ranking o una tarjeta de observadas
- **THEN** el modal muestra todos los datos y preview sin permitir edición, observación ni sincronización
- **AND** solo Cerrar permanece activo

#### Scenario: Visualizar una tarjeta fuera del catálogo filtrado
- **WHEN** se abre una tarjeta cuya figura no está en el catálogo actualmente cargado
- **THEN** la interfaz obtiene la figura por su ID antes de abrir el modal
- **AND** muestra el registro completo en modo visualización

### Requirement: Aplicar los colores y alineaciones de paneles solicitados

La interfaz SHALL mostrar el botón Eliminar con el mismo fondo rojo que los botones principales. Las líneas superiores de los paneles Rankings y Seguimiento SHALL ser rojas. El panel principal de gamificación SHALL tener línea inferior azul y su desplegable SHALL separar visualmente progreso, recuentos y valor total con líneas azules. La barra de progreso de gamificación SHALL mostrar el porcentaje de avance hacia el nivel siguiente. Los Toasts de tareas completadas SHALL ser azules, los Toasts de subida de nivel SHALL ser rojos y los demás Toasts SHALL tener fondo blanco. El modal SHALL ajustar su altura al contenido; Nombre SHALL aparecer en la columna izquierda, alineado con los otros controles.

#### Scenario: Colorear notificaciones Toast
- **WHEN** se completa una tarea, se sube de nivel o se muestra otra notificación
- **THEN** la notificación es azul para una tarea completada
- **AND** es roja al subir de nivel
- **AND** es blanca para los demás eventos

### Requirement: Igualar la tipografía del nivel a la marca

El número y el nombre del nivel en el panel principal SHALL usar la misma pila tipográfica que el título `MiniPeopleDB`.

#### Scenario: Mostrar el nombre del nivel
- **WHEN** se muestra el panel de nivel
- **THEN** el número y el nombre del nivel usan la tipografía de `MiniPeopleDB`
