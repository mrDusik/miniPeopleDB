# Spec Delta

## MODIFIED Requirements

### Requirement: Terminologia visible minipersona

En espanol, la interfaz SHALL usar `minipersona` y `minipersonas` en lugar de `minifigura` y `minifiguras` en textos propios de acciones, dialogos, estados vacios, errores, confirmaciones, accesibilidad, descripciones de logros, notificaciones y toasts. En ingles SHALL usar `miniperson` y `minipeople` como equivalentes de producto. SHALL conservar mayusculas y plurales adecuados a cada idioma. Los mensajes de sistema y las descripciones de logros recibidos del backend SHALL adaptarse exclusivamente al renderizar, sin mutar los objetos originales.

Esta terminologia SHALL NOT renombrar rutas API, identificadores DOM, campos, codigos de error, datos persistidos ni contratos internos. SHALL NOT aplicarse al contenido extraido de Brickset ni a los nombres originales de los logros, que se conservan conforme a `internacionalizacion-interfaz`.

#### Scenario: Renderizar terminología de minipersonas
- **WHEN** la interfaz muestra textos propios, mensajes de sistema o descripciones de logros recibidos del backend
- **THEN** presenta `minipersona` o `minipersonas` en espanol y `miniperson` o `minipeople` en ingles con las mayusculas y plurales correspondientes
- **AND** adapta los mensajes del backend solo al renderizarlos, sin modificar los objetos originales ni contratos internos
- **AND** conserva literalmente los nombres de logros y los textos procedentes de Brickset

### Requirement: Filtrar el catálogo desde el panel de búsqueda

El icono de ojo del filtro de observacion SHALL ser vectorial y simetrico, centrado horizontal y verticalmente en su recuadro, tanto en movil como en escritorio, sin depender de los margenes del emoji o de la altura de linea. Las imagenes de los accesos a Notificaciones y Amigos SHALL ajustarse al espacio interior disponible de sus botones para mantener el centrado sin desbordar por padding y bordes.

Todos los controles de seguimiento (filtro, tabla y modal) SHALL reutilizar el mismo simbolo SVG `observation-eye-icon`, nunca el emoji de ojo. En tabla y modal, `aria-pressed` y el aspecto pulsado SHALL reflejar `observada` del registro cargado; el estado confirmado SHALL actualizarse tras respuesta correcta y conservarse ante errores. En creacion/edicion el toggle SHALL reflejar el valor del formulario que se enviara al guardar. El filtro SHALL conservar su estado local de seleccion, sin modificar registros.

El ojo SHALL mostrarse negro al estar pulsado y gris atenuado al no estarlo, sin recuadro, fondo de color ni sombra en ninguno de los controles de seguimiento. El contorno de foco por teclado SHALL conservarse.

Los filtros de icono de Consulta SHALL permanecer sin borde ni fondo tanto seleccionados como deseleccionados. Los iconos de Coleccion y Busqueda SHALL distinguir la seleccion mediante opacidad completa al activarse y atenuada al desactivarse, conservando el foco visible por teclado y la semantica de checkbox.

Los campos Nombre e Id de Consulta SHALL mostrarse vacios sin ejemplos como placeholder, conservando sus etiquetas visibles.

Los botones del acordeon del panel de nivel SHALL centrar iconos y textos vertical y horizontalmente. Los dos botones de ranking SHALL compartir una misma fila y sus etiquetas SHALL permanecer en una sola linea, con tipografia y espaciado compactos para no desbordar el panel.

En los rankings global y semanal, el emoji de coleccion SHALL tener las mismas dimensiones que la imagen de Bricks y ajustar su fuente a la columna reservada. El contador de Bricks SHALL desplazarse visualmente 19px a la derecha en las filas. Ambos indicadores SHALL mantener 8px de separacion respecto al numero, tambien en movil, sin superposiciones.

Los campos del modal de minifigura SHALL compartir el mismo borde de 1px y color `--line`, incluidos los deshabilitados en creacion, edicion y consulta. El fondo y texto SHALL conservar la distincion de campos no editables.

La interfaz SHALL mostrar controles para `id`, `nombre`, `categoria`, `subcategoria`, `anio`, `estadoColeccion` y observación, y SHALL ofrecer las acciones Buscar y Mostrar todo con etiquetas traducidas al idioma activo. El filtrado SHALL resolverse en el navegador sobre la caché local del catálogo, sin realizar peticiones al servidor, y SHALL producir los mismos resultados que `GET /minifiguras` con los mismos filtros: coincidencia parcial sin distinguir mayúsculas ni acentos para `id` y `nombre`, y coincidencia exacta sin distinguir mayúsculas ni acentos para `categoria`, `subcategoria` y `estadoColeccion`, y exacta para `anio` y observación. El estado SHALL filtrarse con dos toggles de icono `📦` y `🔍`: activar solo uno filtra por ese estado; activar ambos o ninguno no restringe por estado. En escritorio los controles SHALL conservar la disposición en una sola fila cuando el ancho lo permita. Las opciones de categoría y subcategoría SHALL derivarse de las figuras presentes en el catálogo y subcategoría SHALL depender de la categoría seleccionada. Cuando exista un total conocido positivo de Brickset, la etiqueta SHALL mostrar `Nombre: X de Total (P%)` en espanol y `Name: X of Total (P%)` en ingles, manteniendo el nombre externo original. P SHALL ser X por 100 dividido por Total, con formato del idioma activo y como máximo un decimal. El denominador SHALL ser el total conocido, no el inventario del usuario ni la suma visible del desplegable. Para totales cero o desconocidos SHALL conservar `Nombre (X)` sin inventar porcentajes. Mostrar todo SHALL restaurar la opcion de todas las figuras con su total y etiqueta localizada, limpiar nombre y desactivar los toggles. Cambiar el idioma SHALL conservar filtros, valores canonicos y resultados.

#### Scenario: Buscar con filtros
- **WHEN** el usuario completa filtros y activa Buscar en cualquiera de los idiomas soportados
- **THEN** la interfaz no realiza ninguna petición a `GET /minifiguras`
- **AND** actualiza la tabla solo con las figuras de la caché que cumplen todos los filtros

#### Scenario: Buscar por nombre
- **WHEN** el usuario introduce parte del nombre y activa Buscar
- **THEN** la tabla muestra las figuras cuyo nombre normalizado contiene el texto normalizado

#### Scenario: Filtrar por estado con iconos
- **WHEN** el usuario activa solo `📦` o solo `🔍` y selecciona Buscar
- **THEN** la interfaz solicita el estado correspondiente
- **WHEN** ambos iconos están activos o ambos inactivos
- **THEN** la interfaz no restringe los resultados por estado

#### Scenario: Mostrar todo
- **WHEN** el usuario activa Mostrar todo
- **THEN** limpia los filtros
- **AND** muestra todo el catálogo de la caché sin realizar peticiones al servidor

#### Scenario: Filtrado sin coincidencias
- **WHEN** ninguna figura de la caché cumple los filtros
- **THEN** la tabla conserva los encabezados y muestra el estado sin resultados traducido al idioma activo y con la terminologia de producto correspondiente

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
- **THEN** se muestra un desplegable con los años de las minifiguras registradas, en orden descendente y con formato de anio y recuento `Año (X)`
- **AND** los años y sus totales reflejan los iconos y la categoría y subcategoría seleccionadas
- **AND** la opción de todos los anios con su total y etiqueta localizada elimina la restricción de año
- **AND** restablecer los filtros restaura los años y totales del catálogo completo

#### Scenario: Mostrar progreso sobre el total conocido de Brickset
- **WHEN** el filtro muestra 53 figuras de una categoría cuyo total conocido es 500
- **THEN** su etiqueta incluye `53 de 500 (10,6%)` en espanol o `53 of 500 (10.6%)` en ingles
- **AND** una subcategoría con 53 figuras y total conocido 100 incluye `53 de 100 (53%)` en espanol o `53 of 100 (53%)` en ingles
- **AND** cambiar los iconos recalcula el parcial y porcentaje sin modificar el total conocido ni solicitar datos adicionales
- **AND** años y otras opciones sin total conocido conservan el recuento simple, nunca un porcentaje sobre el inventario como sustituto

#### Scenario: Cambiar idioma con filtros activos
- **WHEN** se aplica un idioma distinto mientras existen filtros seleccionados
- **THEN** cambian las etiquetas y formatos sin limpiar selecciones ni alterar las figuras resultantes
- **AND** se conservan los nombres originales de categoria y subcategoria y sus alias CMF autorizados

### Requirement: Representar las acciones de alta, edición y eliminación como iconos

Los controles Nueva minipersona, Editar y Eliminar, o sus equivalentes en ingles, SHALL mostrarse como botones de solo icono (sin texto visible), cada uno con un `aria-label` que identifique la accion en el idioma activo para que permanezcan accesibles a lectores de pantalla.

#### Scenario: Botones de icono con nombre accesible
- **WHEN** se renderiza la tabla de resultados o la cabecera de resultados
- **THEN** las acciones de alta, edicion y eliminacion se muestran como iconos sin texto visible
- **AND** cada una expone mediante `aria-label` el nombre localizado de la accion que realiza
