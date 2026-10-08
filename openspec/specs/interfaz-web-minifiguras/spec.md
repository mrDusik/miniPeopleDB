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

La interfaz SHALL mostrar controles para `id`, `nombre`, `categoria`, `subcategoria`, `anio`, `estadoColeccion` y observación, y SHALL ofrecer `Buscar` y `Mostrar todo`. El filtrado SHALL resolverse en el navegador sobre la caché local del catálogo, sin realizar peticiones al servidor, y SHALL producir los mismos resultados que `GET /minifiguras` con los mismos filtros: coincidencia parcial sin distinguir mayúsculas ni acentos para `id` y `nombre`, y coincidencia exacta sin distinguir mayúsculas ni acentos para `categoria`, `subcategoria` y `estadoColeccion`, y exacta para `anio` y observación. El estado SHALL filtrarse con dos toggles de icono `📦` y `🔍`: activar solo uno filtra por ese estado; activar ambos o ninguno no restringe por estado. En escritorio los controles SHALL conservar la disposición en una sola fila cuando el ancho lo permita. Las opciones de categoría y subcategoría SHALL derivarse de las figuras presentes en el catálogo y subcategoría SHALL depender de la categoría seleccionada. Cuando exista un total conocido positivo de Brickset, la etiqueta SHALL mostrar `Nombre: X de Total (P%)`, con P igual a X por 100 dividido por Total, formato español y como máximo un decimal. El denominador SHALL ser el total conocido, no el inventario del usuario ni la suma visible del desplegable. Para totales cero o desconocidos SHALL conservar `Nombre (X)` sin inventar porcentajes. `Mostrar todo` SHALL restaurar `Todas (Total)`, limpiar nombre y desactivar los toggles.

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

#### Scenario: Actualizar los contadores con los iconos del filtro
- **WHEN** el usuario marca o desmarca colección, buscada o seguimiento
- **THEN** los desplegables de categoría, subcategoría y año recalculan inmediatamente sus totales sobre la caché local, sin peticiones al servidor
- **AND** colección y buscada conservan su lógica de ambos o ninguno sin restricción de estado, y seguimiento restringe a las figuras observadas
- **AND** las opciones con total cero se ocultan y cualquier selección que desaparezca se limpia
- **AND** la opción de todas las figuras permanece disponible incluso si su total es cero

#### Scenario: Elegir un año registrado
- **WHEN** el usuario abre el filtro Año
- **THEN** se muestra un desplegable con los años de las minifiguras registradas, en orden descendente y con formato `Año (X)`
- **AND** los años y sus totales reflejan los iconos y la categoría y subcategoría seleccionadas
- **AND** la opción `Todos (Total)` elimina la restricción de año
- **AND** restablecer los filtros restaura los años y totales del catálogo completo

#### Scenario: Mostrar progreso sobre el total conocido de Brickset
- **WHEN** el filtro muestra 53 figuras de una categoría cuyo total conocido es 500
- **THEN** su etiqueta incluye `53 de 500 (10,6%)`
- **AND** una subcategoría con 53 figuras y total conocido 100 incluye `53 de 100 (53%)`
- **AND** cambiar los iconos recalcula el parcial y porcentaje sin modificar el total conocido ni solicitar datos adicionales
- **AND** años y otras opciones sin total conocido conservan el recuento simple, nunca un porcentaje sobre el inventario como sustituto

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

La interfaz SHALL incluir `precioCompra` y `fechaCompra` editables cuando el modo lo permita, y `categoria`, `subcategoria`, `anio` y `precio` como campos provenientes de Brickset con estilo `.input-readonly`. SHALL sincronizar individualmente de forma automática al cargar correctamente la imagen de un ID introducido. El backend SHALL conservar la sincronización masiva autenticada mediante `/sincronizacion/brickset`, pero el dashboard SHALL NOT mostrar un disparador manual; la lógica y el endpoint se conservan para reactivarlos en el futuro. La sincronización individual SHALL aplicar el año actual como fallback cuando Brickset devuelva `0` o no lo devuelva.

#### Scenario: Consulta individual
- **WHEN** se carga correctamente la imagen del ID válido introducido en el modal de alta o edición
- **THEN** solicita los datos individuales a la API
- **AND** rellena categoría, subcategoría cuando aplica, año y precio

#### Scenario: Actualización masiva
- **WHEN** un cliente autenticado inicia una actualización mediante `POST /sincronizacion/brickset`
- **THEN** inicia la actualización masiva de `precio` únicamente
- **AND** al terminar refresca tabla y resumen
- **AND** no modifica `categoria`, `subcategoria` ni `anio` de ninguna minifigura
- **AND** el dashboard no muestra un botón para iniciarla manualmente

#### Scenario: Error al iniciar la actualización masiva
- **WHEN** un cliente autenticado inicia una actualización masiva y el backend rechaza el inicio o no responde
- **THEN** la API devuelve un error controlado y no crea otra tarea

#### Scenario: Fallback de año visible
- **WHEN** la consulta individual a Brickset devuelve año `0` o ausente
- **THEN** el campo Año muestra el año actual
- **AND** el botón Guardar puede habilitarse si se cumplen los demás obligatorios

### Requirement: Mostrar el progreso de la actualización masiva

Mientras una actualización masiva esté en curso, la interfaz SHALL mostrar en el panel desplegable del resumen una barra de progreso con el avance `procesados / total` y SHALL consultar periódicamente el estado de la tarea. El resto de la interfaz SHALL permanecer usable. Al completarse, la interfaz SHALL ocultar la barra, refrescar tabla y resumen, y mostrar un Toast blanco (estilo de éxito) indicando que la actualización ha terminado con el número de figuras actualizadas y fallidas. Si la tarea termina en la respuesta de inicio, no SHALL mostrarse la barra y solo SHALL mostrarse el Toast final.

#### Scenario: Tarea en curso
- **WHEN** `GET /sincronizacion/brickset` indica `estado: "en_curso"`
- **THEN** el panel desplegable muestra la barra de progreso con `procesados` de `total`
- **AND** los filtros, la tabla y las acciones de fila siguen habilitados

#### Scenario: Avance de la tarea
- **WHEN** una consulta periódica devuelve un `procesados` mayor
- **THEN** la barra de progreso refleja el nuevo avance

#### Scenario: Fin de la tarea
- **WHEN** una consulta periódica devuelve `estado: "completada"`
- **THEN** la barra de progreso se oculta
- **AND** se muestra un Toast blanco con el texto `Actualización de precios terminada: X actualizadas, Y fallidas.`
- **AND** la tabla y el resumen se refrescan

#### Scenario: Tarea instantánea
- **WHEN** la respuesta de inicio ya indica `estado: "completada"`
- **THEN** no se muestra la barra de progreso
- **AND** se muestra el Toast blanco de fin

#### Scenario: Retomar al cargar la página
- **WHEN** el usuario inicia sesión o recarga la página con una tarea en curso
- **THEN** la interfaz muestra la barra de progreso sin iniciar otra tarea ni mostrar un disparador manual

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
- **AND** sus campos y acciones de modificación permanecen deshabilitados, salvo el botón Seguimiento (ojo)

#### Scenario: Alternar seguimiento desde el modal de visualización
- **WHEN** el usuario pulsa el botón Seguimiento (ojo) del modal de visualización
- **THEN** la interfaz persiste el cambio y actualiza el ojo, la tabla y la galería sin cerrar el modal
- **AND** el botón permanece deshabilitado mientras se guarda el cambio
- **AND** si el guardado falla, conserva el estado anterior y muestra el Toast de error o de límite de observación

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

La interfaz SHALL usar un modal de dos columnas con formulario a la izquierda y preview de 250px a la derecha, sin fondo gris detrás de la imagen. El modal SHALL ajustarse al viewport sin scroll horizontal ni vertical. La fila de identidad SHALL ocupar el ancho de la columna del formulario y distribuir en dos áreas iguales una columna apilada de ID y Nombre y el campo de Descripción. La consulta individual SHALL iniciarse automáticamente al cargar la imagen tras introducir un ID en alta ordinaria; no habrá un botón individual de sincronización. Los asteriscos de campos obligatorios SHALL ocultarse en visualización. El estado SHALL controlarse mediante botones de icono mutuamente excluyentes, con `📦` seleccionado por defecto en alta ordinaria; Seguir SHALL ser un toggle visual con los estados activo/inactivo de la tabla. En creación ordinaria solo ID estará habilitado inicialmente; los campos dependientes y Guardar permanecerán deshabilitados hasta obtener datos y completar ID, Nombre, Estado, Categoría, Año y Precio Brickset. En edición ID SHALL estar deshabilitado, sombreado y no editable, los campos Brickset serán solo lectura y se conservará `FechaRegistro`; Nombre y Descripción, estado, seguimiento y datos de compra SHALL mantener las posibilidades de edición vigentes, con compra deshabilitada para BUSCADA. El alta rápida desde ranking SHALL reutilizar el modal con aspecto de edición, ID deshabilitado y sombreado, metadatos precargados, Nombre y Descripción vacíos, BUSCADA fijo, seguimiento editable y datos de compra deshabilitados; guardar SHALL crear una figura propia, no editar una ajena. En visualización todos los campos e iconos estarán deshabilitados y solo Cerrar estará activo.

#### Scenario: Crear y sincronizar
- **WHEN** el usuario abre alta ordinaria, introduce un ID y sincroniza correctamente
- **THEN** se autocompletan los datos Brickset y la imagen
- **AND** se habilitan únicamente los campos manuales permitidos y Guardar cuando los obligatorios sean válidos

#### Scenario: Visualizar solo lectura
- **WHEN** se abre una figura desde `.id-link`, una tarjeta de ranking propio o una tarjeta de observadas
- **THEN** el modal muestra todos los datos y preview sin permitir edición, observación ni sincronización
- **AND** solo Cerrar permanece activo

#### Scenario: Visualizar una tarjeta fuera del catálogo filtrado
- **WHEN** se abre una tarjeta cuya figura no está en el catálogo actualmente cargado
- **THEN** la interfaz obtiene la figura por su ID antes de abrir el modal
- **AND** muestra el registro completo en modo visualización

#### Scenario: Editar una figura existente
- **WHEN** se abre una figura propia en edición
- **THEN** ID está deshabilitado y sombreado y los campos Brickset no admiten edición manual
- **AND** Nombre, Descripción, estado, seguimiento y datos de compra siguen las reglas vigentes
- **AND** guardar conserva el ID y `FechaRegistro`

#### Scenario: Alta rápida desde ranking
- **WHEN** se abre una figura ajena mediante el botón de añadir a buscadas
- **THEN** el modal muestra ID y metadatos bloqueados, Nombre y Descripción vacíos y BUSCADA seleccionado sin posibilidad de cambiar estado
- **AND** seguimiento permanece editable y guardar crea un registro propio

#### Scenario: Restaurar los modos ordinarios
- **WHEN** tras cerrar el alta rápida se abre alta ordinaria, edición propia o visualización
- **THEN** el modal restaura los valores y permisos propios de ese modo sin conservar restricciones o datos del destacado anterior

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

### Requirement: Abrir el Ranking Global desde el panel de nivel

La cabecera SHALL usar la imagen local de `public/logo_images/` en lugar del texto de marca y autor, con un ancho menor que el texto anterior y el panel de nivel ampliado a su derecha en escritorio. El panel de nivel SHALL mostrar los iconos y recuentos de colección y búsqueda sin abrir el desplegable. El menú desplegable SHALL mostrar el progreso en su primera fila; `Logros`, `DNA` y `Progreso` como botones del mismo tamaño en su segunda fila; y `Ranking Global` en una fila posterior. El dashboard SHALL NOT mostrar el disparador manual de sincronización de precios, aunque el endpoint autenticado y el wiring se conserven para posible reactivación futura. Al activar `Ranking Global` SHALL abrir un modal visualmente consistente con la aplicación y solicitar el ranking autenticado.

#### Scenario: Abrir el modal
- **WHEN** el usuario activa `Ranking Global`
- **THEN** se abre un modal accesible con el Top 10 recibido de la API

#### Scenario: Fallo al cargar el ranking
- **WHEN** la API de ranking no está disponible
- **THEN** el modal muestra un estado de error controlado sin conservar datos obsoletos

### Requirement: Mostrar las filas del Top 10

Cada fila del modal SHALL mostrar avatar de Google, nombre visible, Bricks, imagen de nivel, número de nivel, nombre del nivel, número de minifiguras en `COLECCIÓN`, un control de despliegue y, salvo para el usuario autenticado, el control para regalar 50 Bricks.

#### Scenario: Renderizar un usuario clasificado
- **WHEN** el ranking contiene un usuario
- **THEN** su fila presenta todos los datos definidos sin permitir editar su perfil o colección

#### Scenario: Fila del usuario autenticado
- **WHEN** una fila corresponde al usuario de la sesión
- **THEN** la fila no muestra un control para regalarse Bricks

### Requirement: Indicar la presencia del usuario autenticado en el Top 10

Si el usuario autenticado figura en el Top 10, la interfaz SHALL mostrar un botón con icono de globo junto a su avatar en el panel de nivel principal y SHALL NOT mostrar una estrella junto a su fila del ranking. El botón SHALL abrir el modal Ranking Global y SHALL mostrar el tooltip `En Top Global`. Debajo del globo SHALL mostrar la medalla 🥇, 🥈 o 🥉 para las posiciones 1, 2 o 3 respectivamente, o la posición con formato `#4` desde la cuarta posición. Si no figura, el botón SHALL estar ausente.

#### Scenario: Usuario dentro del Top 10
- **WHEN** la respuesta del ranking contiene el `userId` de la sesión
- **THEN** se muestra el icono de globo en el panel de nivel y no se muestra ninguna estrella junto a la fila del ranking

#### Scenario: Usuario fuera del Top 10
- **WHEN** la respuesta del ranking no contiene el `userId` de la sesión
- **THEN** no se muestra el icono de globo en el panel de nivel ni una estrella junto a la fila del ranking

#### Scenario: Abrir el ranking desde el globo
- **WHEN** el usuario activa el globo del panel de nivel
- **THEN** se abre el modal Ranking Global sin abrir el menú de usuario
- **AND** al cerrar el modal el foco vuelve al globo si sigue visible

#### Scenario: Mostrar posición en el panel de nivel
- **WHEN** el usuario figura en el ranking
- **THEN** debajo del globo se muestra la medalla correspondiente si ocupa una de las tres primeras posiciones, o su posición con prefijo `#` en los demás casos
- **AND** el tooltip del globo indica `En Top Global`

### Requirement: Desplegar destacados en acordeón exclusivo

Al activar una fila o su flecha, la interfaz SHALL desplegar solo sus Top 3 por precio y antigüedad, tomando los tres primeros elementos de cada Top 5 recibido de la API sin alterar su orden. Las tarjetas SHALL reutilizar la presentación, imagen y tooltip de las tarjetas equivalentes de la pantalla principal, pero SHALL ser no interactivas. Solo una fila SHALL permanecer desplegada a la vez.

#### Scenario: Abrir una fila
- **WHEN** el usuario activa una fila cerrada
- **THEN** se muestran sus dos grupos de destacados y la fila se anuncia como expandida

#### Scenario: Limitar el tamaño de los destacados
- **WHEN** la API devuelve cinco destacados por precio y cinco por antigüedad
- **THEN** el modal muestra solo los tres primeros de cada grupo con los títulos `Top 3 por precio` y `Top 3 por antigüedad`

#### Scenario: Abrir una segunda fila
- **WHEN** una fila está abierta y el usuario activa otra
- **THEN** la primera se cierra automáticamente y solo la segunda permanece abierta

#### Scenario: Activar una tarjeta del ranking
- **WHEN** el usuario pulsa o hace clic sobre una tarjeta de minifigura dentro del ranking
- **THEN** no se abre el detalle ni se ejecuta ninguna acción sobre la colección

### Requirement: Regalar Bricks desde el ranking

El control de regalo SHALL indicar que envía 50 Bricks y SHALL quedar permanentemente deshabilitado para un destinatario cuando la API indique que ya existe una donación o confirme una nueva. Durante el envío SHALL impedir activaciones duplicadas y, tras completarse, SHALL actualizar los datos visibles afectados.

#### Scenario: Enviar un regalo
- **WHEN** el usuario activa el regalo de una fila habilitada y la API confirma la donación
- **THEN** el control de ese destinatario queda deshabilitado
- **AND** el ranking refleja los Bricks y nivel actualizados del receptor

#### Scenario: Regalo previamente enviado
- **WHEN** una entrada del ranking tiene `regaloEnviado` igual a `true`
- **THEN** su control de regalo aparece deshabilitado desde el primer renderizado

### Requirement: Diferenciar los logros de regalo

El modal de Logros SHALL mostrar un icono de regalo `🎁` para los logros de tipo `regalo` y SHALL conservar la copa habitual para los demás logros.

#### Scenario: Mostrar un logro de regalo
- **WHEN** el estado de gamificación contiene un logro con tipo `regalo`
- **THEN** el logro se representa con `🎁` en lugar de la copa

### Requirement: Mostrar en rojo los indicadores de obligatoriedad

La interfaz SHALL mostrar en rojo cada asterisco visible que identifica un campo obligatorio en cualquier formulario de la aplicación. El color SHALL aplicarse al asterisco, no a toda la etiqueta, y SHALL NOT cambiar las reglas de validación ni añadir obligatoriedad a campos opcionales. En visualización SHALL mantenerse la ocultación de estos indicadores.

#### Scenario: Formularios con campos requeridos
- **WHEN** se muestra un formulario con etiquetas de campos obligatorios, incluida el alta rápida desde ranking
- **THEN** todos sus asteriscos visibles aparecen en rojo y el texto de las etiquetas conserva su color habitual

#### Scenario: Visualización y campos opcionales
- **WHEN** se abre un formulario en modo visualización o se muestra un campo opcional
- **THEN** visualización no muestra asteriscos y los campos opcionales no reciben indicadores de obligatoriedad

### Requirement: Derivar todos los logros de colección del estado vigente

Todos los logros de colección SHALL representar requisitos cumplidos por las minifiguras actuales en `COLECCIÓN` y los totales conocidos actuales, no concesiones históricas permanentes. El recálculo SHALL reconstruir cantidades y Bricks de todos los objetivos y ajustar nivel y progreso tanto al alza como a la baja. SHALL ganar, perder o recuperar logros tras altas, ediciones, eliminaciones, cambios entre `COLECCIÓN` y `BUSCADA`, cambios válidos de totales de categorías/subcategorías y despliegues de nuevos objetivos. Las siguientes consultas de DNA y ranking SHALL reflejar el estado recalculado. `repetible: false` SHALL limitar a una concesión vigente, sin impedir su pérdida y recuperación. Los regalos persistidos SHALL conservarse independientemente del inventario y SHALL NOT contribuir al DNA.

#### Scenario: Aumento del total conocido
- **WHEN** el total de una categoría o subcategoría aumenta y la colección deja de alcanzar un umbral de completitud
- **THEN** el recálculo automático retira o reduce el logro correspondiente y sus Bricks, ajusta nivel y progreso y conserva regalos

#### Scenario: Pérdida y recuperación por estado de figura
- **WHEN** una figura necesaria pasa de `COLECCIÓN` a `BUSCADA`
- **THEN** pierde las contribuciones y logros cuyos requisitos ya no cumple, incluidos los no repetibles
- **AND** al volver a `COLECCIÓN` recupera los que vuelve a cumplir

#### Scenario: Concesión retroactiva sin nueva adquisición
- **WHEN** baja un total conocido o se despliega un nuevo objetivo cuyos requisitos ya cumple el inventario
- **THEN** el recálculo concede automáticamente los logros correspondientes sin exigir una nueva alta de figura

### Requirement: Conceder nuevos logros de categorías, figuras y completitud

El sistema SHALL conceder los siguientes logros desde las figuras actuales en `COLECCIÓN`, excluyendo `BUSCADA`. Las descripciones SHALL ser `Añadir la primera minifigura de la categoría <categoría>.` para los cuatro primeros y `Añadir la minifigura <ID>.` para los tres siguientes.

| ID | Nombre | Condición | Bricks | Repetible |
| --- | --- | --- | --- | --- |
| the-legend | The Legend. | Primera figura de The Legend of Zelda | 10 | false |
| heh-there-is-another-one-for-you | Heh! There is another one for you! | Primera figura de Pokémon | 10 | false |
| change-will-not-come-in-a-single-sunrise | Change will not come in a single sunrise. | Primera figura de Horizon | 10 | false |
| start-poetry | Start Poetry. | Primera figura de Minecraft | 10 | false |
| mental-breakdown | Mental Breakdown. | SH0129 | 3000 | false |
| the-dark-plastic | The Dark Plastic. | SH0002 | 1000 | false |
| concrete-savanna | Concrete Savanna. | SH0604 | 700 | false |
| youre-shooting-for-the-stars | You're shooting for the stars. | Al menos 50% del total conocido de una categoría | 500 | true |
| strike | Strike!! | Al menos 100% del total conocido de una categoría | 1200 | true |

Los dos hitos SHALL tener como descripción `Añadir una minifigura que suponga el 50% del total conocido de minifiguras de una categoría.` y `Añadir una minifigura que suponga el 100% del total conocido de minifiguras de una categoría.`, respectivamente. SHALL contar una concesión por categoría con total conocido positivo, acumular ambos al completar una categoría y no multiplicarse por figuras adicionales en esa misma categoría. Un recálculo SHALL retirar los hitos que ya no cumplan el umbral.

#### Scenario: Superar la mitad de una categoría con total impar
- **WHEN** la colección contiene dos figuras de una categoría con total conocido de tres
- **THEN** obtiene una concesión de You're shooting for the stars. y ninguna de Strike!!

#### Scenario: Completar varias categorías
- **WHEN** la colección alcanza el total conocido positivo de dos categorías
- **THEN** obtiene dos concesiones de cada hito, sin contar categorías con total cero o desconocido

### Requirement: Calcular DNA propio dinamico y retroactivo

El sistema SHALL calcular DNA actual en Supabase mediante una consulta dinamica sobre los logros obtenidos y sus cantidades actuales, sin almacenar porcentajes derivados como fuente del estado actual ni calcular pesos en el cliente. La unica excepcion de almacenamiento SHALL ser la medicion diaria privada de `analitica-historica`, que conserva porcentajes agregados a la fecha de captura, no sustituye la consulta dinamica y no se reescribe retroactivamente por cambios de ponderaciones. Cada contribucion SHALL ser cantidad por peso del caracter, sin multiplicar por Bricks o total de Bricks. Las proporciones SHALL ser 100 por la suma de contribuciones de un caracter dividida por la suma de contribuciones de los cuatro caracteres. Los logros de coleccion SHALL tener los siguientes pesos privados, con suma 100 por fila; `someone-liked-your-collection` SHALL ser la unica excepcion confirmada con pesos cero y SHALL NOT contribuir a sumas ni denominador. Un identificador desconocido SHALL NOT recibir pesos inventados ni diluir el denominador. Nuevos logros de coleccion SHALL requerir una ponderacion de suma 100 antes de habilitarse para DNA.

| Logro | Rarity Hunter | Collector | Explorer | Fan |
| --- | --- | --- | --- | --- |
| new-mini-person | 0 | 80 | 10 | 10 |
| woah | 50 | 20 | 10 | 20 |
| deal-master | 80 | 10 | 0 | 10 |
| masterpiece | 90 | 5 | 0 | 5 |
| holy-grail | 80 | 10 | 0 | 10 |
| omgold | 95 | 5 | 0 | 0 |
| lets-go | 0 | 5 | 90 | 5 |
| collector | 5 | 90 | 0 | 5 |
| step-by-step | 5 | 45 | 50 | 0 |
| bricky-potter | 0 | 10 | 20 | 70 |
| bricky-mouse | 0 | 10 | 20 | 70 |
| its-a-me-mario | 0 | 10 | 20 | 70 |
| green-hill-zone | 0 | 10 | 20 | 70 |
| dimensional | 60 | 10 | 20 | 10 |
| warsie | 0 | 10 | 20 | 70 |
| in-ny-i-was | 80 | 10 | 0 | 10 |
| welcome-to-the-upsidedown | 60 | 30 | 0 | 10 |
| chill-nancy-im-fine | 80 | 10 | 0 | 10 |
| the-legend | 0 | 10 | 20 | 70 |
| heh-there-is-another-one-for-you | 0 | 10 | 20 | 70 |
| change-will-not-come-in-a-single-sunrise | 0 | 10 | 20 | 70 |
| start-poetry | 0 | 10 | 20 | 70 |
| mental-breakdown | 90 | 5 | 0 | 5 |
| the-dark-plastic | 90 | 5 | 0 | 5 |
| concrete-savanna | 90 | 5 | 0 | 5 |
| youre-shooting-for-the-stars | 20 | 40 | 0 | 40 |
| strike | 20 | 40 | 0 | 40 |
| someone-liked-your-collection | 0 | 0 | 0 | 0 |

El resultado SHALL reflejar los registros historicos de pruebas y produccion desde la primera consulta tras aplicar el esquema, sin requerir nuevas altas ni reotorgar logros. Las consultas posteriores y los refrescos tras mutaciones confirmadas de la coleccion SHALL reflejar las cantidades vigentes. La lectura DNA SHALL NOT modificar logros, Bricks, nivel ni minifiguras.

#### Scenario: Cantidades sin ponderacion por Bricks
- **WHEN** hay dos `new-mini-person` y un `woah`
- **THEN** DNA contiene Rarity Hunter 50/3%, Collector 60%, Explorer 10% y Fan 40/3%, con tolerancia de representacion numerica
- **AND** el caracter principal es Collector aunque `woah` conceda mas Bricks por unidad

#### Scenario: Retroactividad
- **WHEN** se instala el esquema DNA en pruebas o produccion con logros historicos existentes
- **THEN** la primera consulta calcula DNA desde sus cantidades sin nuevas acciones del usuario
- **AND** no cambia los registros historicos ni concede notificaciones de nuevos logros

#### Scenario: Regalos no alteran personalidad
- **WHEN** aumenta la cantidad de `someone-liked-your-collection` sin cambios de logros de coleccion
- **THEN** sus Bricks y nivel mantienen las reglas de regalos vigentes y su DNA no cambia

#### Scenario: Actualizar cantidades
- **WHEN** una alta, edicion, eliminacion, cambio de estado o sincronizacion modifica logros de coleccion y se confirma el recalculo
- **THEN** el siguiente refresco muestra el DNA correspondiente sin reutilizar porcentajes calculados previamente como fuente del estado actual

#### Scenario: Cambios en las ponderaciones
- **WHEN** se inserta, modifica o elimina una fila de `dna_ponderaciones`
- **THEN** la siguiente consulta DNA y Ranking Global de todos los usuarios refleja las ponderaciones vigentes sin backfill ni recalculo de logros
- **AND** las mediciones de dias anteriores conservan los porcentajes capturados

### Requirement: Seleccionar caracter principal sin ambiguedad

El sistema SHALL mostrar `Newbie` y cuatro proporciones cero cuando la suma de contribuciones es cero, incluidos usuarios sin logros o con solo regalos. En otro caso SHALL elegir el caracter de mayor contribucion exacta, aplicando en empate Explorer > Collector > Fan > Rarity Hunter. El redondeo de presentacion SHALL NOT intervenir en la seleccion. El panel propio SHALL mostrar debajo del conjunto numero y nombre de nivel el porcentaje seguido del nombre del caracter principal y el porcentaje seguido del nombre del segundo rasgo de mayor proporcion. El segundo rasgo SHALL usar el orden estable de la leyenda del modal en caso de empate. El resumen SHALL conservar la tipografia en cursiva, negrita, mayusculas y color originales; el porcentaje de progreso hacia el siguiente nivel SHALL conservarse. Newbie y DNA no disponible SHALL mostrarse sin porcentajes ni segundo rasgo.

#### Scenario: Resumen de los dos rasgos principales
- **WHEN** el DNA propio contiene Fan 40%, Collector 30%, Explorer 20% y Rarity Hunter 10%
- **THEN** bajo el nivel aparece `40% Fan / 30% Collector` con el estilo visual original y acceso al modal DNA
- **AND** los rasgos se alinean horizontalmente con el numero de nivel, con numero y nombre en la primera fila y rasgos en la segunda, compartiendo la altura reservada para la imagen que abarca ambas filas
- **AND** ambas filas tienen una separacion de 4px y la linea de rasgos conserva su propio destino de clic, se ilumina en rojo al pasar el raton y abre el modal DNA sin abrir el modal de nivel
- **AND** las filas del ranking muestran los dos rasgos publicos con sus porcentajes y el mismo estilo tipografico y color, conservando su tamaño de 0.68rem, y el numero y nombre de nivel aparecen en negro

#### Scenario: Usuario Newbie
- **WHEN** el usuario no tiene logros de coleccion que contribuyan a DNA
- **THEN** el panel muestra `Newbie` y el resultado DNA contiene cuatro ceros sin division por cero

#### Scenario: Empate de todos los caracteres
- **WHEN** las cuatro contribuciones son iguales y positivas
- **THEN** el caracter principal es Explorer

#### Scenario: Empates parciales
- **WHEN** el maximo corresponde a Collector, Fan y Rarity Hunter sin Explorer, o solo a Fan y Rarity Hunter
- **THEN** se elige respectivamente Collector o Fan

#### Scenario: Redondeo no genera empates
- **WHEN** dos proporciones distintas parecen iguales tras redondearse para presentacion
- **THEN** se elige la mayor contribucion original sin aplicar desempate artificial

### Requirement: Mantener privadas las ponderaciones individuales

Las ponderaciones por logro SHALL NOT ser accesibles desde API de logros, respuestas de mutaciones, recursos estaticos, datos del DOM, tooltips, modales propios o ajenos ni consultas directas del cliente Supabase. El usuario autenticado SHALL poder consultar exclusivamente sus cuatro proporciones DNA agregadas y caracter principal; SHALL NOT elegir un usuario ajeno como objetivo de esa consulta. La unica excepcion publica SHALL ser el ranking, que expone el caracter principal y exclusivamente los nombres y porcentajes de los dos rasgos principales, sin distribucion completa ni pesos. Las tablas privadas SHALL conservar RLS por usuario. Una peticion propia sin sesion SHALL recibir `401`; un fallo de consulta SHALL producir un estado de error, no fingir `Newbie`.

#### Scenario: Pesos fuera del cliente
- **WHEN** se consultan logros propios o publicos, ranking o resultados de operaciones de coleccion
- **THEN** ninguna respuesta incluye la matriz ni propiedades de pesos por logro
- **AND** los recursos HTML, CSS y JavaScript servidos no contienen la matriz de ponderaciones

#### Scenario: Consulta DNA propia autenticada
- **WHEN** un usuario autenticado consulta su DNA
- **THEN** recibe solo las cuatro proporciones agregadas y su caracter principal
- **AND** no puede consultar proporciones ajenas ni leer o escribir la tabla de pesos

#### Scenario: Error y sesion
- **WHEN** falta sesion o no esta disponible la consulta DNA
- **THEN** sin sesion se rechaza la peticion y ante fallo la interfaz muestra un error controlado con posibilidad de reintentar
- **AND** no muestra DNA de una cuenta previa ni trata el fallo como personalidad Newbie

### Requirement: Abrir DNA desde el panel propio

Debajo del nivel y nombre del usuario activo SHALL aparecer un boton de icono DNA junto al nombre de su caracter principal, con estilo equivalente al boton de Ranking, tooltip y nombre accesible `DNA`. El icono SHALL abrir el modal DNA propio. El desplegable SHALL incluir `DNA` a la derecha de `Ver Logros`, con el mismo estilo, en un contenedor flex distribuido en dos mitades iguales. El acceso existente a Ranking Global SHALL conservarse en una fila separada. Los botones SHALL ser controles independientes sin anidarse dentro del boton de nivel y utilizables por teclado.

#### Scenario: Accesos equivalentes
- **WHEN** el usuario activa el icono DNA bajo el nivel o el boton DNA del desplegable
- **THEN** se abre el mismo modal con el DNA del usuario activo, nunca el del ultimo usuario cuyos logros se consultaron
- **AND** ambos controles conservan nombres accesibles y no abren logros ni ranking

#### Scenario: Distribucion responsive
- **WHEN** se muestra el desplegable en escritorio o movil
- **THEN** Ver Logros ocupa la mitad izquierda y DNA la mitad derecha, sin solapamientos ni scroll horizontal
- **AND** Ranking Global sigue disponible sin compartir ese reparto

### Requirement: Visualizar DNA propio en modal de tarta

El modal DNA SHALL conservar la linea grafica de los modales existentes y representar las proporciones agregadas mediante una tarta con Rarity Hunter amarillo, Explorer rojo, Collector azul y Fan verde. SHALL incluir una leyenda con los cuatro nombres, sus colores y descripciones: Rarity Hunter busca piezas raras y valiosas; Explorer descubre categorias y subcategorias; Collector amplia y completa la coleccion; Fan muestra afinidad por tematicas y personajes. La leyenda SHALL ofrecer tambien las proporciones agregadas propias de forma accesible, sin pesos individuales. Un usuario Newbie SHALL ver un estado neutro con ese texto, sin segmentos inventados. SHALL manejar carga, error, cierre por boton o Escape y retorno de foco al disparador, sin cambiar logros propios o ajenos. Al cerrar o cambiar sesion SHALL descartar respuestas obsoletas y limpiar datos privados.

#### Scenario: DNA disponible
- **WHEN** el usuario abre DNA con contribuciones positivas
- **THEN** ve una tarta proporcional con los cuatro colores y una leyenda descriptiva accesible
- **AND** los cuatro porcentajes agregados aparecen solo en el modal propio; el panel propio y el ranking muestran exclusivamente los dos rasgos principales y sus porcentajes

#### Scenario: Tarta sin contribuciones
- **WHEN** se abre DNA para un Newbie
- **THEN** se muestra una representacion neutra y cuatro proporciones cero, sin un sector completo asignado a ningun caracter

#### Scenario: Cerrar y cambiar sesion
- **WHEN** se cierra DNA con Cerrar o Escape, o termina la sesion durante una consulta
- **THEN** el cierre devuelve foco al disparador valido y el cambio de sesion limpia el modal
- **AND** una respuesta obsoleta no modifica el DNA de la nueva cuenta ni la vista de logros abierta

### Requirement: Consultar evolucion propia en un modal historico

La interfaz SHALL ofrecer al usuario autenticado un boton `📈 Progreso` con tooltip accesible, del mismo ancho y altura que `Logros` y `DNA`, en la misma fila que esos controles; SHALL NOT mostrar un panel historico independiente en la pantalla principal. El boton SHALL abrir un modal consistente con los actuales titulado `Progreso`, con selector segmentado de 30, 90 o 365 dias, 90 por defecto, sin selectores Desde/Hasta ni boton Aplicar. SHALL consultar solo la API historica propia al abrir o cambiar rango, representar carga, error con reintento y estado vacio, descartar respuestas obsoletas y limpiar datos y graficos al terminar la sesion. Cerrar por boton o Escape SHALL devolver foco al disparador valido. SHALL ajustarse a escritorio y movil sin solapamientos ni scroll horizontal, permitiendo scroll vertical interno. Los valores ausentes en tooltips y tablas SHALL mostrarse como `Sin datos`, conservando huecos y sin convertirlos en ceros.

#### Scenario: Abrir y cambiar rango
- **WHEN** el usuario abre Progreso y cambia de 90 a 30 dias
- **THEN** el modal consulta el rango seleccionado y una respuesta anterior tardia no sustituye la vista nueva

#### Scenario: Historico vacio o fallido
- **WHEN** la API devuelve cero snapshots o falla
- **THEN** el modal muestra respectivamente estado vacio o error con reintento, sin inventar datos ni conservar los de una cuenta previa

#### Scenario: Cerrar o cambiar cuenta
- **WHEN** se cierra el modal o finaliza la sesion durante la carga
- **THEN** se invalidan respuestas pendientes, se liberan los graficos y al cerrar se restaura el foco cuando corresponde

### Requirement: Representar valor y cambio neto de coleccion

El modal SHALL mostrar linea de valor total EUR y barras de cambio neto de figuras en ejes separados y etiquetados. El cambio SHALL ser total actual menos total del dia inmediatamente anterior, usando `baseline` para el inicio del rango cuando corresponda; SHALL admitir valores negativos. Sin snapshot del dia anterior SHALL mostrar cambio no disponible, no cero ni una incorporacion ficticia. Las fechas ausentes SHALL mostrarse como huecos, sin interpolar ni repartir cambios entre dias. SHALL permitir inspeccionar fecha, EUR, total de figuras y cambio neto mediante tooltip y alternativa tabular accesible.

#### Scenario: Perdida de figuras
- **WHEN** dos dias consecutivos tienen 12 y 9 figuras
- **THEN** el segundo muestra barra de cambio neto -3 y su valor EUR correspondiente

#### Scenario: Baseline y huecos
- **WHEN** el rango tiene un baseline del dia anterior al primero, y mas adelante falta un dia
- **THEN** la primera barra usa ese baseline y el dia posterior al hueco no inventa un cambio diario

### Requirement: Representar evolucion historica de DNA

El modal SHALL mostrar areas apiladas sobre un eje fijo de 0 a 100 para Collector azul, Explorer rojo, Rarity Hunter amarillo y Fan verde, conservando colores actuales y nombres en leyenda accesible. SHALL usar exclusivamente porcentajes historicos devueltos, sin exponer pesos ni recalcularlos en el cliente. Cuatro ceros SHALL representar ausencia de contribuciones, no normalizarse a una personalidad inventada. Dias ausentes SHALL cortar las series. La inspeccion por fecha SHALL informar los cuatro porcentajes guardados y SHALL tolerar el redondeo de captura sin modificar los valores.

#### Scenario: Composicion historica y Newbie
- **WHEN** hay un snapshot con cuatro porcentajes positivos y otro con cuatro ceros
- **THEN** el primero muestra areas proporcionales con los colores definidos y el segundo muestra ausencia de contribuciones

### Requirement: Representar Bricks y nivel historicos

El modal SHALL mostrar Bricks y nivel en series temporales con escalas independientes, etiquetas claras y nivel entero escalonado. SHALL permitir descensos conforme a las reglas vigentes, nivel inicial cero y un unico punto cuando solo exista una medicion, sin imponer crecimiento monotono ni inventar estados intermedios. Fechas, Bricks y nivel SHALL estar disponibles mediante tooltip y alternativa tabular accesible.

#### Scenario: Progresion no monotona
- **WHEN** el historico registra descenso de Bricks y nivel tras retirar una figura
- **THEN** ambas series reflejan el descenso y mantienen las fechas originales

#### Scenario: Una sola medicion
- **WHEN** el rango contiene un unico snapshot
- **THEN** los tres graficos muestran una medicion inspeccionable sin errores ni puntos ficticios
