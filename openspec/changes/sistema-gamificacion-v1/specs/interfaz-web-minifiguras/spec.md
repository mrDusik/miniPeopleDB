# Interfaz Web Minifiguras

## MODIFIED Requirements

### Requirement: Paginar los resultados del catalogo

La tabla SHALL mostrar como maximo 10 minifiguras por pagina y SHALL ofrecer controles accesibles para navegar a la pagina anterior y siguiente. La paginacion SHALL aplicarse sobre el resultado filtrado y ordenado localmente. Al cargar una nueva consulta o cambiar los filtros, la interfaz SHALL volver a la primera pagina.

#### Scenario: Navegar por varias paginas
- **WHEN** una consulta devuelve mas de 10 minifiguras
- **THEN** la tabla muestra 10 filas en la primera pagina
- **AND** informa la pagina actual y el total de paginas
- **AND** permite avanzar y retroceder sin perder el orden aplicado

#### Scenario: Resultado final incompleto
- **WHEN** la ultima pagina contiene menos de 10 minifiguras
- **THEN** muestra solo las filas restantes
- **AND** deshabilita el control para avanzar

### Requirement: Mostrar el valor de coleccion con un boton compacto

El panel de valoracion SHALL mostrar el valor total, la cantidad de minifiguras y el total de figuras buscadas agrupados como informacion principal. El boton `Actualizar precios desde Brickset` SHALL ser compacto y aparecer a la derecha de ese texto en escritorio; en movil podrá ocupar una fila propia.

#### Scenario: Accion de precios junto al resumen
- **WHEN** se muestra el resumen de la coleccion en escritorio
- **THEN** el boton de actualizacion aparece a la derecha del texto de valoracion
- **AND** no ocupa toda la altura ni el ancho principal del panel

### Requirement: Mostrar los paneles de gamificacion y valoracion en una fila

La pantalla principal SHALL mostrar el panel del nivel y progreso de gamificacion a la izquierda del panel de valoracion de la coleccion, que contiene el valor total, los contadores y el boton de actualizacion de precios desde Brickset. En anchos reducidos los paneles SHALL poder apilarse verticalmente sin solaparse.

#### Scenario: Ordenar los paneles principales
- **WHEN** la pantalla se carga en un ancho de escritorio
- **THEN** el panel de gamificacion aparece primero a la izquierda
- **AND** el panel de valoracion aparece a su derecha en la misma fila

#### Scenario: Adaptar los paneles en movil
- **WHEN** la pantalla se carga en un ancho reducido
- **THEN** los paneles se apilan verticalmente
- **AND** ambos conservan sus contenidos y controles legibles

### Requirement: Mostrar el estado de gamificacion y el detalle de logros

La interfaz SHALL mostrar el nivel actual, los Bricks acumulados, el porcentaje de progreso dentro del nivel y el siguiente nivel. Al activar el nombre del nivel SHALL abrir un modal accesible con cada logro, su cantidad y la multiplicacion cantidad por valor de Bricks. El modal SHALL poder cerrarse mediante su control de cierre y los mecanismos nativos disponibles.

#### Scenario: Renderizar progreso y desglose
- **WHEN** la API devuelve un estado de gamificacion valido
- **THEN** la cabecera muestra el nivel y los Bricks
- **AND** la barra refleja el progreso del nivel actual
- **AND** el modal lista el desglose persistido

### Requirement: Mostrar Toasts de logros en cola

Tras una alta o edicion exitosa, la interfaz SHALL crear un Toast por cada logro informado por la API. SHALL ordenar la cola de menor a mayor valor de Bricks y SHALL esperar 300 ms entre la aparicion de Toasts consecutivos. El texto SHALL incluir el nombre del logro y los Bricks obtenidos.

#### Scenario: Ordenar y espaciar varios Toasts
- **WHEN** una operacion completa objetivos de 1, 10 y 100 Bricks
- **THEN** aparecen en ese orden
- **AND** la aparicion de cada Toast se separa por 300 ms
- **AND** cada Toast muestra el nombre y la ganancia correspondiente

#### Scenario: No mostrar logros inexistentes
- **WHEN** una operacion no completa ningun logro nuevo
- **THEN** no se añade ningun Toast de logro

### Requirement: Describir los logros en el modal

Cada logro mostrado en el modal SHALL incluir su descripción completa. Cuando el puntero se sitúe sobre un logro, la interfaz SHALL exponer esa descripción mediante la ayuda contextual del elemento, sin que el usuario tenga que consultar otra pantalla.

#### Scenario: Consultar la descripción de un logro
- **WHEN** el usuario coloca el puntero sobre un logro del modal
- **THEN** el elemento expone la descripción correspondiente como texto de ayuda contextual