# Spec Delta

## MODIFIED Requirements

### Requirement: Gestionar datos de compra y precio Brickset

La interfaz SHALL incluir `precioCompra` y `fechaCompra` editables, y `categoria`, `subcategoria`, `anio` y `precio` como campos no editables en el formulario de alta y edición. SHALL ofrecer un único botón para consultar los datos de Brickset por `id` que rellena `categoria`, `subcategoria`, `anio` y `precio` a la vez, y SHALL ofrecer por separado una actualización masiva de precios desde el header, que solo actualiza `precio` y no modifica `categoria`, `subcategoria` ni `anio`.

#### Scenario: Consulta individual
- **WHEN** el usuario solicita los datos de Brickset con un ID válido
- **THEN** solicita los datos individuales a la API
- **AND** rellena `categoria`, `subcategoria` (cuando aplica), `anio` en Euros y `precio` en Euros
- **AND** mantiene los cuatro campos no editables

#### Scenario: Actualización masiva
- **WHEN** el usuario activa `Actualizar precios desde Brickset`
- **THEN** inicia la actualización masiva de `precio` únicamente
- **AND** muestra Toasts de carga, éxito o error
- **AND** refresca tabla y resumen al terminar
- **AND** no modifica `categoria`, `subcategoria` ni `anio` de ninguna minifigura

### Requirement: Filtrar el catálogo desde el panel de búsqueda

La interfaz SHALL mostrar controles para `id`, `categoria`, `subcategoria`, `anio` y `estadoColeccion`, y SHALL ofrecer `Buscar` y `Mostrar todo`, todos ellos en una sola fila en anchos de escritorio. El control `subcategoria` SHALL listar únicamente las subcategorías de la `categoria` seleccionada y SHALL deshabilitarse o limpiarse cuando no haya `categoria` seleccionada o esta no tenga subcategorías. Las opciones "todas/todos" de `categoria`, `subcategoria` y `estadoColeccion` SHALL mostrarse con las etiquetas breves "Todas", "Todas" y "Todos" respectivamente.

#### Scenario: Buscar con filtros
- **WHEN** el usuario completa filtros y activa `Buscar`
- **THEN** la interfaz solicita `GET /minifiguras` con los parámetros correspondientes
- **AND** actualiza la tabla

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

La interfaz SHALL representar cada minifigura en una fila y SHALL mostrar `id`, `nombre`, `categoria`, `subcategoria`, `anio`, `estadoColeccion`, `Precio` y `Diferencia`. La interfaz no SHALL mostrar una columna de `descripcion`. La columna `id` SHALL mostrarse como texto plano, sin abrir la vista previa de imagen; únicamente la miniatura de la columna `Imagen` SHALL abrir la vista previa.

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
- **THEN** no ocurre ninguna acción
- **AND** solo hacer click en la miniatura de la columna `Imagen` abre el modal de vista previa

## ADDED Requirements

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
