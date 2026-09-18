# interfaz-web-minifiguras Specification

## Purpose

Esta capacidad permite consultar el catálogo de minifiguras desde un navegador mediante una interfaz estática, con filtros explícitos, resultados tabulares y estados de interacción comprensibles.

## Requirements

### Requirement: Servir la interfaz web estática

El sistema SHALL servir una interfaz web estática desde la ruta raíz del servidor Express, incluyendo los recursos HTML, CSS y JavaScript necesarios para renderizarla en un navegador compatible.

#### Scenario: Cargar la página principal

- **WHEN** un usuario solicita `GET /`
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo contiene el documento HTML de la interfaz
- **AND** la respuesta identifica un tipo de contenido HTML

#### Scenario: Cargar recursos de la interfaz

- **WHEN** el navegador solicita los recursos CSS y JavaScript referenciados por la página principal
- **THEN** el sistema responde con HTTP `200`
- **AND** cada recurso se entrega con su tipo de contenido correspondiente

### Requirement: Filtrar el catálogo desde el panel de búsqueda

La interfaz SHALL mostrar un panel con controles para `tema`, `anio` y `estadoColeccion`, y SHALL ofrecer las acciones `Buscar` y `Mostrar todo`.

#### Scenario: Buscar con filtros

- **WHEN** el usuario completa uno o más filtros y activa `Buscar`
- **THEN** la interfaz solicita `GET /minifiguras` con los parámetros correspondientes
- **AND** actualiza la tabla con la colección devuelta por el servidor

#### Scenario: Mostrar todo

- **WHEN** el usuario activa `Mostrar todo`
- **THEN** la interfaz limpia los filtros activos
- **AND** solicita `GET /minifiguras` sin filtros
- **AND** actualiza la tabla con todo el catálogo devuelto

### Requirement: Mostrar resultados en una tabla dinámica

La interfaz SHALL representar cada minifigura recibida en una fila de tabla y SHALL mostrar, como mínimo, `id`, `nombre`, `descripcion`, `tematica`, `anio` y `estadoColeccion`.

#### Scenario: Catálogo con resultados

- **WHEN** una consulta devuelve una o más minifiguras válidas
- **THEN** la tabla contiene una fila por minifigura
- **AND** las filas conservan el orden recibido por la API

#### Scenario: Consulta sin resultados

- **WHEN** una consulta devuelve un arreglo vacío
- **THEN** la interfaz conserva los encabezados de la tabla
- **AND** muestra un estado visible que indica que no hay resultados

### Requirement: Comunicar estados de carga y error

La interfaz SHALL comunicar que una consulta está en curso y SHALL mostrar un mensaje visible cuando la API no responde correctamente o devuelve datos que no pueden representarse como una colección.

#### Scenario: Consulta en curso

- **WHEN** se inicia una consulta al catálogo
- **THEN** la interfaz muestra un estado de carga
- **AND** evita que una acción repetida produzca una actualización incoherente mientras la consulta está pendiente

#### Scenario: Error de consulta

- **WHEN** la API devuelve un estado HTTP de error o la solicitud falla
- **THEN** la interfaz muestra un mensaje visible de error
- **AND** no presenta datos parciales como si fueran resultados correctos