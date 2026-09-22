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

La interfaz SHALL mostrar controles para `tema`, `anio` y `estadoColeccion`, y SHALL ofrecer `Buscar` y `Mostrar todo`.

#### Scenario: Buscar con filtros
- **WHEN** el usuario completa filtros y activa `Buscar`
- **THEN** la interfaz solicita `GET /minifiguras` con los parámetros correspondientes
- **AND** actualiza la tabla

#### Scenario: Mostrar todo
- **WHEN** el usuario activa `Mostrar todo`
- **THEN** limpia los filtros
- **AND** solicita `GET /minifiguras` sin filtros
- **AND** muestra todo el catálogo

### Requirement: Mostrar resultados en una tabla dinámica

La interfaz SHALL representar cada minifigura en una fila y SHALL mostrar `id`, `nombre`, `descripcion`, `tematica`, `anio`, `estadoColeccion`, `Precio` y `Diferencia`.

#### Scenario: Catálogo con resultados
- **WHEN** una consulta devuelve figuras válidas
- **THEN** la tabla contiene una fila por figura y conserva el orden recibido
- **AND** `Precio` se muestra en Euros cuando existe
- **AND** `Diferencia` muestra `precio - precioCompra` para `COLECCIÓN`, `?` si falta un precio y `N/A` para `BUSCADA`

#### Scenario: Consulta sin resultados
- **WHEN** la consulta devuelve un arreglo vacío
- **THEN** conserva los encabezados
- **AND** muestra un estado visible sin resultados

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

La interfaz SHALL incluir `precioCompra`, `fechaCompra` y `precio` readonly en el formulario, permitir consultar el precio individual y ofrecer actualización masiva desde el header.

#### Scenario: Consulta individual
- **WHEN** el usuario solicita el precio con un ID válido
- **THEN** solicita el precio individual a la API
- **AND** rellena `precio` en Euros
- **AND** mantiene el campo no editable

#### Scenario: Actualización masiva
- **WHEN** el usuario activa `Actualizar precios desde Brickset`
- **THEN** inicia la actualización masiva
- **AND** muestra Toasts de carga, éxito o error
- **AND** refresca tabla y resumen al terminar

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
