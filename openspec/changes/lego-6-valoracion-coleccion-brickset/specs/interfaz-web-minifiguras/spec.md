# Spec Delta

## MODIFIED Requirements

### Requirement: Mostrar resultados en una tabla dinámica

La interfaz SHALL representar cada minifigura recibida en una fila de tabla y SHALL mostrar, como mínimo, `id`, `nombre`, `descripcion`, `tematica`, `anio`, `estadoColeccion`, la columna `Precio` correspondiente al campo raíz `precio` y la columna `Diferencia`, expresada en Euros.

#### Scenario: Catálogo con resultados

- **WHEN** una consulta devuelve una o más minifiguras válidas
- **THEN** la tabla contiene una fila por minifigura
- **AND** las filas conservan el orden recibido por la API
- **AND** la columna `Precio` muestra el valor en Euros cuando existe
- **AND** `Diferencia` muestra `precio - precioCompra` para `COLECCIÓN`, `?` si falta algún precio y `N/A` para `BUSCADA`

#### Scenario: Consulta sin resultados

- **WHEN** una consulta devuelve un arreglo vacío
- **THEN** la interfaz conserva los encabezados de la tabla
- **AND** muestra un estado visible que indica que no hay resultados

### Requirement: Comunicar estados de carga y error

La interfaz SHALL comunicar que una consulta o actualización de precios está en curso y SHALL mostrar un mensaje visible cuando la API no responde correctamente. Los fallos individuales de Brickset SHALL diferenciarse de un fallo de lectura del catálogo local y no SHALL borrar las filas o precios existentes.

#### Scenario: Consulta en curso

- **WHEN** el usuario inicia una consulta o actualización de precios desde Brickset
- **THEN** la interfaz muestra un estado de carga mediante Toast o estado equivalente
- **AND** deshabilita los botones relevantes para evitar solicitudes concurrentes
- **AND** la interfaz permanece utilizable sin quedar bloqueada

#### Scenario: Error de consulta

- **WHEN** la API devuelve un resultado parcial, un error de proveedor o la solicitud falla
- **THEN** la interfaz conserva las filas y precios anteriores
- **AND** muestra un Toast de error o resumen que identifica los elementos fallidos
- **AND** no presenta datos parciales como si fueran resultados correctos cuando falla la consulta local

## ADDED Requirements

### Requirement: Gestionar datos de compra y consultar precios desde el formulario

La interfaz SHALL incluir en el formulario los campos raíz `precioCompra`, `fechaCompra` y `precio`, mostrando `precio` como solo lectura. SHALL ofrecer un botón para consultar el precio individual en Brickset y SHALL incluir un botón `Actualizar precios desde Brickset` para iniciar la actualización masiva.

#### Scenario: Consulta individual desde el formulario

- **WHEN** el usuario solicita consultar el precio de una minifigura con un identificador válido
- **THEN** la interfaz solicita el precio individual a la API
- **AND** rellena `precio` con el resultado en Euros
- **AND** mantiene `precio` no editable manualmente

#### Scenario: Actualización masiva desde el header

- **WHEN** el usuario activa `Actualizar precios desde Brickset`
- **THEN** la interfaz inicia la actualización masiva
- **AND** muestra Toasts de carga, éxito o error sin bloquear la página
- **AND** refresca la tabla y el valor total al terminar

### Requirement: Ordenar la tabla por año y precio

La interfaz SHALL permitir ordenar la tabla por las columnas `Año` y `Precio`, alternando entre orden ascendente y descendente al activar sus controles.

#### Scenario: Ordenar por año

- **WHEN** el usuario activa el control de la columna `Año`
- **THEN** las filas se muestran ordenadas por año
- **AND** una activación posterior invierte la dirección del orden

#### Scenario: Ordenar por precio

- **WHEN** el usuario activa el control de la columna `Precio`
- **THEN** las filas se muestran ordenadas por precio
- **AND** una activación posterior invierte la dirección del orden

### Requirement: Mostrar el valor total de la colección

La interfaz SHALL mostrar en el header el texto `Valor Total de la Colección` y el total en Euros devuelto por la API, calculado priorizando `precio` y usando `precioCompra` como fallback.

#### Scenario: Total visible

- **WHEN** se carga o actualiza el catálogo
- **THEN** el header muestra el valor total de la colección en Euros
- **AND** el total se actualiza después de una actualización masiva

### Requirement: Mostrar contadores y rankings en la cabecera

La interfaz SHALL mostrar junto al valor total los contadores de figuras en `COLECCIÓN` y `BUSCADA`, un top 5 de figuras en colección por precio y un top 5 de figuras en colección más antiguas. Cada elemento de los rankings SHALL mostrar al menos ID, nombre y precio cuando exista.

#### Scenario: Cabecera con contadores y rankings

- **WHEN** la API devuelve el resumen de la colección
- **THEN** la cabecera muestra ambos contadores
- **AND** muestra los rankings recibidos sin incluir figuras `BUSCADA`
- **AND** muestra menos de cinco elementos cuando no hay más disponibles
