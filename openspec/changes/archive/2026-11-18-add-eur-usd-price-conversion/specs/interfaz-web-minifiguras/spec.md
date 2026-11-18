# Spec Delta

## MODIFIED Requirements

### Requirement: Mostrar resultados en una tabla dinámica

La interfaz SHALL representar cada minifigura en una fila y SHALL mostrar una acción de observación, `id`, `nombre`, `categoria`, `subcategoria`, `anio`, `estadoColeccion`, `Precio` y `Diferencia`. La columna ID SHALL ser un control `.id-link` que abra el modal unificado en modo visualización. La URL de imagen SHALL usar siempre el ID en minúsculas, aunque el ID persistido se muestre en mayúsculas. Los precios SHALL presentarse en la moneda seleccionada por el usuario autenticado.

#### Scenario: Catálogo con resultados
- **WHEN** una consulta devuelve figuras válidas
- **THEN** la tabla contiene una fila por figura y conserva el orden recibido
- **AND** `Precio` se muestra en la moneda seleccionada cuando existe
- **AND** `Diferencia` muestra `precio - precioCompra` convertido a la moneda seleccionada para `COLECCIÓN`, `?` si falta un precio y `N/A` para `BUSCADA`
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

## ADDED Requirements

### Requirement: Presentar y editar precios según la moneda del perfil

La moneda EUR o USD guardada en el perfil autenticado SHALL determinar la moneda de presentación de todos los importes de colección, incluidos precios Brickset, precios de compra, diferencias, resumen total, rankings, perfiles, historiales, gráficos, tooltips y avisos propios. Los campos `precio` y `precioCompra`, sus contratos de API y los resúmenes de valoración SHALL continuar expresados y persistidos en EUR. Los datos del perfil de otra persona SHALL NOT cambiar la moneda de presentación propia.

La interfaz SHALL obtener la cotización EUR/USD del servidor autenticado y SHALL usar la misma cotización para ambas direcciones: `EUR × tasa` para USD y `USD ÷ tasa` para EUR, donde la tasa representa USD por EUR. Las conversiones presentadas SHALL redondearse a dos decimales. El campo Precio de compra SHALL mostrar y aceptar importes en la moneda seleccionada; antes de crear o editar una figura, un importe USD SHALL convertirse a EUR, mientras que un importe EUR SHALL conservar su valor. Abrir una figura existente en otra moneda SHALL convertir solo su valor de formulario para mostrarlo y no SHALL modificar el registro hasta guardar.

Un cambio del perfil a USD SHALL comprobar que existe una cotización utilizable antes de confirmar la preferencia. Si la cotización necesaria no está disponible, la interfaz SHALL mostrar un error reintentable, conservar la preferencia y los valores anteriores, y SHALL NOT mostrar importes EUR con símbolo USD ni guardar un precio sin conversión. Los precios ya persistidos en EUR SHALL conservar sus valores.

#### Scenario: Mostrar precios en USD
- **WHEN** el perfil activo tiene moneda `USD` y el servidor proporciona la cotización BCE
- **THEN** los importes EUR de la colección se presentan en USD mediante esa cotización
- **AND** los valores persistidos y las respuestas de la API permanecen en EUR

#### Scenario: Introducir precio de compra en EUR
- **WHEN** el perfil activo tiene moneda `EUR` y el usuario guarda un precio de compra
- **THEN** el mismo importe numérico en EUR se envía y persiste como `precioCompra`

#### Scenario: Introducir precio de compra en USD
- **WHEN** el perfil activo tiene moneda `USD` y el usuario guarda un precio de compra
- **THEN** la interfaz convierte el importe a EUR con la cotización BCE vigente antes de enviarlo
- **AND** la API y la persistencia reciben únicamente el importe canónico en EUR

#### Scenario: Editar un precio con otra moneda de presentación
- **WHEN** una figura guardada en EUR se abre con perfil USD
- **THEN** el formulario muestra el precio convertido a USD
- **AND** abrir o cerrar el formulario sin guardar no modifica el precio persistido

#### Scenario: Cambiar de moneda sin reescribir precios
- **WHEN** el usuario cambia su preferencia de EUR a USD o de USD a EUR
- **THEN** la interfaz actualiza los importes visibles usando la cotización BCE
- **AND** los valores EUR persistidos no se reescriben ni acumulan conversiones

#### Scenario: Cotización no disponible durante una conversión
- **WHEN** no se puede obtener una cotización BCE válida para cambiar a USD o guardar un importe que requiere conversión
- **THEN** la interfaz informa el fallo y permite reintentar
- **AND** conserva la moneda confirmada, los valores del formulario y los importes persistidos
- **AND** no presenta una cantidad bajo un símbolo de moneda incorrecto

#### Scenario: Aislar la preferencia de moneda
- **WHEN** se muestran precios de un perfil público ajeno
- **THEN** se presentan en la moneda elegida por el usuario que consulta
- **AND** no se expone ni aplica la preferencia privada de moneda del perfil consultado
