# Spec Delta

## MODIFIED Requirements

### Requirement: Filtrar el catálogo desde el panel de búsqueda

La interfaz SHALL mostrar controles para `id`, `nombre`, `categoria`, `subcategoria`, `anio`, `estadoColeccion` y observación, y SHALL ofrecer `Buscar` y `Mostrar todo`. El filtrado SHALL resolverse en el navegador sobre la caché local del catálogo, sin realizar peticiones al servidor, y SHALL producir los mismos resultados que `GET /minifiguras` con los mismos filtros: coincidencia parcial sin distinguir mayúsculas ni acentos para `id` y `nombre`, y coincidencia exacta sin distinguir mayúsculas ni acentos para `categoria`, `subcategoria` y `estadoColeccion`, y exacta para `anio` y observación. El estado SHALL filtrarse con dos toggles de icono `📦` y `🔍`: activar solo uno filtra por ese estado; activar ambos o ninguno no restringe por estado. En escritorio los controles SHALL conservar la disposición en una sola fila cuando el ancho lo permita. Las opciones de categoría y subcategoría SHALL derivarse de las figuras presentes en el catálogo, incluir el contador actual con formato `Nombre (X)`, y subcategoría SHALL depender de la categoría seleccionada. `Mostrar todo` SHALL restaurar `Todas (Total)`, limpiar nombre y desactivar los toggles.

#### Scenario: Buscar con filtros
- **WHEN** el usuario completa filtros y activa `Buscar`
- **THEN** la interfaz no realiza ninguna petición a `GET /minifiguras`
- **AND** actualiza la tabla solo con las figuras de la caché que cumplen todos los filtros

#### Scenario: Buscar por nombre
- **WHEN** el usuario introduce parte del nombre, con o sin acentos ni mayúsculas, y activa `Buscar`
- **THEN** la tabla muestra las figuras cuyo nombre normalizado contiene el texto normalizado

#### Scenario: Filtrar por estado con iconos
- **WHEN** el usuario activa solo `📦` o solo `🔍` y selecciona `Buscar`
- **THEN** la tabla muestra únicamente las figuras con el estado correspondiente
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

## ADDED Requirements

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
