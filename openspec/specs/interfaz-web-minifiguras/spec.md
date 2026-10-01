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

La interfaz SHALL mostrar controles para `id`, `nombre`, `categoria`, `subcategoria`, `anio`, `estadoColeccion` y observación, y SHALL ofrecer `Buscar` y `Mostrar todo`. El filtrado SHALL resolverse en el navegador sobre la caché local del catálogo, sin realizar peticiones al servidor, y SHALL producir los mismos resultados que `GET /minifiguras` con los mismos filtros: coincidencia parcial sin distinguir mayúsculas ni acentos para `id` y `nombre`, y coincidencia exacta sin distinguir mayúsculas ni acentos para `categoria`, `subcategoria` y `estadoColeccion`, y exacta para `anio` y observación. El estado SHALL filtrarse con dos toggles de icono `📦` y `🔍`: activar solo uno filtra por ese estado; activar ambos o ninguno no restringe por estado. En escritorio los controles SHALL conservar la disposición en una sola fila cuando el ancho lo permita. Las opciones de categoría y subcategoría SHALL derivarse de las figuras presentes en el catálogo, incluir el contador actual con formato `Nombre (X)`, y subcategoría SHALL depender de la categoría seleccionada. `Mostrar todo` SHALL restaurar `Todas (Total)`, limpiar nombre y desactivar los toggles.

#### Scenario: Buscar con filtros
- **WHEN** el usuario completa filtros y activa `Buscar`
- **THEN** la interfaz no realiza ninguna petición a `GET /minifiguras`
- **AND** actualiza la tabla solo con las figuras de la caché que cumplen todos los filtros

#### Scenario: Buscar por nombre
- **WHEN** el usuario introduce parte del nombre y activa `Buscar`
- **THEN** la tabla muestra las figuras cuyo nombre normalizado contiene el texto normalizado

#### Scenario: Filtrar por estado con iconos
- **WHEN** el usuario activa solo `📦` o solo `🔍` y selecciona `Buscar`
- **THEN** la interfaz solicita el estado correspondiente
- **WHEN** ambos iconos están activos o ambos inactivos
- **THEN** la interfaz no restringe los resultados por estado

#### Scenario: Mostrar todo
- **WHEN** el usuario activa `Mostrar todo`
- **THEN** limpia los filtros
- **AND** muestra todo el catálogo de la caché sin realizar peticiones al servidor

#### Scenario: Filtrado sin coincidencias
- **WHEN** ninguna figura de la caché cumple los filtros
- **THEN** la tabla conserva los encabezados y muestra el estado `No hay minifiguras que coincidan con la consulta.`

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

La interfaz SHALL incluir `precioCompra` y `fechaCompra` editables cuando el modo lo permita, y `categoria`, `subcategoria`, `anio` y `precio` como campos provenientes de Brickset con estilo `.input-readonly`. SHALL sincronizar individualmente de forma automática al cargar correctamente la imagen de un ID introducido y SHALL ofrecer sincronización masiva en segundo plano; la sincronización individual SHALL aplicar el año actual como fallback cuando Brickset devuelva `0` o no lo devuelva.

#### Scenario: Consulta individual
- **WHEN** se carga correctamente la imagen del ID válido introducido en el modal de alta o edición
- **THEN** solicita los datos individuales a la API
- **AND** rellena categoría, subcategoría cuando aplica, año y precio

#### Scenario: Actualización masiva
- **WHEN** el usuario activa `Actualizar precios desde Brickset`
- **THEN** inicia la actualización masiva de `precio` únicamente
- **AND** al terminar refresca tabla y resumen
- **AND** no modifica `categoria`, `subcategoria` ni `anio` de ninguna minifigura

#### Scenario: Error al iniciar la actualización masiva
- **WHEN** la API rechaza el inicio de la actualización masiva o no responde
- **THEN** la interfaz muestra un Toast de error
- **AND** el botón `🔄` vuelve a estar habilitado

#### Scenario: Fallback de año visible
- **WHEN** la consulta individual a Brickset devuelve año `0` o ausente
- **THEN** el campo Año muestra el año actual
- **AND** el botón Guardar puede habilitarse si se cumplen los demás obligatorios

### Requirement: Mostrar el progreso de la actualización masiva

Mientras la actualización masiva del usuario esté en curso, la interfaz SHALL mantener deshabilitado el botón `🔄`, SHALL mostrar en el panel desplegable del resumen una barra de progreso con el avance `procesados / total` y SHALL consultar periódicamente el estado de la tarea. El resto de la interfaz SHALL permanecer usable. Al completarse, la interfaz SHALL ocultar la barra, habilitar el botón, refrescar tabla y resumen, y mostrar un Toast blanco (estilo de éxito) indicando que la actualización ha terminado con el número de figuras actualizadas y fallidas. Si la tarea termina en la respuesta de inicio, no SHALL mostrarse la barra y solo SHALL mostrarse el Toast final.

#### Scenario: Tarea en curso
- **WHEN** la respuesta de inicio indica `estado: "en_curso"`
- **THEN** el botón `🔄` queda deshabilitado
- **AND** el panel desplegable muestra la barra de progreso con `procesados` de `total`
- **AND** los filtros, la tabla y las acciones de fila siguen habilitados

#### Scenario: Avance de la tarea
- **WHEN** una consulta periódica devuelve un `procesados` mayor
- **THEN** la barra de progreso refleja el nuevo avance

#### Scenario: Fin de la tarea
- **WHEN** una consulta periódica devuelve `estado: "completada"`
- **THEN** la barra de progreso se oculta
- **AND** el botón `🔄` se habilita
- **AND** se muestra un Toast blanco con el texto `Actualización de precios terminada: X actualizadas, Y fallidas.`
- **AND** la tabla y el resumen se refrescan

#### Scenario: Tarea instantánea
- **WHEN** la respuesta de inicio ya indica `estado: "completada"`
- **THEN** no se muestra la barra de progreso
- **AND** se muestra el Toast blanco de fin

#### Scenario: Retomar al cargar la página
- **WHEN** el usuario inicia sesión o recarga la página con una tarea en curso
- **THEN** la interfaz muestra la barra de progreso y deshabilita el botón `🔄` sin iniciar otra tarea

#### Scenario: Cierre de sesión
- **WHEN** el usuario cierra sesión con una tarea en curso
- **THEN** la interfaz deja de consultar el estado y oculta la barra de progreso

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

La interfaz SHALL ofrecer creación, edición y eliminación mediante formularios y confirmación explícita, mostrando Toasts tras cada operación. Tras una confirmación del servidor, la interfaz SHALL aplicar el resultado a la caché local y volver a renderizar inmediatamente, y SHALL revalidar en segundo plano el catálogo, el resumen y la gamificación sin bloquear los controles. La caché SHALL modificarse únicamente con datos confirmados por el servidor.

#### Scenario: Alta, edición o eliminación exitosa
- **WHEN** la API confirma la operación
- **THEN** refresca la tabla desde la caché local conservando filtros
- **AND** muestra un Toast de éxito

#### Scenario: Alta exitosa
- **WHEN** la API confirma la creación de una minifigura
- **THEN** la figura devuelta por el servidor se añade a la caché
- **AND** la tabla se vuelve a renderizar conservando filtros y orden activos sin esperar a otra petición
- **AND** muestra un Toast de éxito

#### Scenario: Edición exitosa
- **WHEN** la API confirma la edición de una minifigura
- **THEN** la figura de la caché con ese `id` se sustituye por la devuelta por el servidor
- **AND** la tabla se vuelve a renderizar conservando filtros, orden y página cuando siga existiendo
- **AND** muestra un Toast de éxito

#### Scenario: Eliminación exitosa
- **WHEN** la API confirma la eliminación de una minifigura
- **THEN** la figura se elimina de la caché
- **AND** la tabla se vuelve a renderizar conservando filtros y orden
- **AND** muestra un Toast de éxito

#### Scenario: Revalidación en segundo plano
- **WHEN** se ha aplicado una mutación confirmada a la caché
- **THEN** la interfaz solicita en segundo plano `GET /minifiguras` sin filtros, el resumen y la gamificación
- **AND** sustituye la caché por el catálogo recibido y vuelve a renderizar con los filtros activos
- **AND** los controles de filtrado permanecen habilitados durante la revalidación

#### Scenario: Revalidación fallida
- **WHEN** la revalidación en segundo plano falla
- **THEN** la interfaz conserva la caché y la tabla actualizadas localmente
- **AND** no muestra el error bloqueante de carga del catálogo

#### Scenario: Operación rechazada
- **WHEN** la API devuelve un error
- **THEN** la caché y la tabla no se modifican
- **AND** muestra un mensaje o Toast de error

### Requirement: Mantener una caché local del catálogo por sesión

La interfaz SHALL cargar el catálogo completo del usuario autenticado mediante una única petición `GET /minifiguras` sin parámetros al iniciar la sesión y SHALL mantenerlo en memoria como fuente para filtrado, ordenación, paginación, apertura de detalles y opciones dinámicas de filtros. La caché SHALL mantenerse solo en memoria, SHALL vaciarse al cerrar o expirar la sesión y SHALL revalidarse tras mutaciones, cambios de observación y sincronización masiva de precios. Si una revalidación anterior responde después de otra más reciente, su resultado SHALL descartarse.

#### Scenario: Carga inicial
- **WHEN** el usuario inicia sesión
- **THEN** la interfaz solicita `GET /minifiguras` sin parámetros una sola vez
- **AND** renderiza la tabla y las opciones de filtros a partir de esa respuesta

#### Scenario: Ordenar y paginar sin red
- **WHEN** el usuario ordena por `Año` o `Precio` o cambia de página
- **THEN** la interfaz no realiza peticiones al servidor

#### Scenario: Alternar observación
- **WHEN** la API confirma el cambio de observación de una figura
- **THEN** la caché refleja el nuevo valor de `observada`
- **AND** un filtro de observación activo se reaplica sobre la caché actualizada

#### Scenario: Cerrar sesión
- **WHEN** la sesión se cierra o expira
- **THEN** la caché se vacía
- **AND** ningún dato del usuario anterior se muestra al iniciar otra sesión

#### Scenario: Respuesta obsoleta
- **WHEN** una revalidación iniciada antes responde después que otra iniciada más tarde
- **THEN** la interfaz ignora la respuesta más antigua

### Requirement: Renderizar imágenes y tarjetas de forma eficiente

La interfaz SHALL minimizar el trabajo de renderizado al mostrar la colección: las miniaturas de la tabla y las imágenes de las tarjetas de rankings y watchlist SHALL declarar carga diferida (`loading="lazy"`), decodificación asíncrona (`decoding="async"`) y dimensiones explícitas; las tarjetas de rankings y watchlist SHALL usar `content-visibility: auto` con un tamaño intrínseco reservado; y cada renderizado de página SHALL insertar las filas en el DOM en una única operación.

#### Scenario: Atributos de imagen
- **WHEN** se renderiza una miniatura de tabla o una imagen de tarjeta de ranking o watchlist
- **THEN** la imagen tiene `loading="lazy"`, `decoding="async"` y atributos `width` y `height`

#### Scenario: Estilos de contención
- **WHEN** se cargan los estilos de la interfaz
- **THEN** las tarjetas de rankings y watchlist declaran `content-visibility: auto` y `contain-intrinsic-size`

#### Scenario: Inserción única por página
- **WHEN** se renderiza una página del catálogo
- **THEN** el cuerpo de la tabla se reemplaza en una sola operación con todas las filas de la página

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
