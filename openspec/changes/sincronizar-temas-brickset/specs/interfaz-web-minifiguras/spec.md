# Spec Delta

## MODIFIED Requirements

### Requirement: Filtrar el catálogo desde el panel de búsqueda

La interfaz SHALL mostrar controles para `tema`, `anio` y `estadoColeccion`, y SHALL ofrecer `Buscar` y `Mostrar todo`. El control `tema` SHALL cargarse desde el catálogo oficial de `GET /temas`, SHALL permitir seleccionar como máximo un tema y SHALL no ofrecer valores derivados únicamente de las minifiguras actualmente visibles.

#### Scenario: Cargar temas oficiales en la búsqueda
- **WHEN** el usuario abre la interfaz y `GET /temas` devuelve un catálogo válido
- **THEN** el selector de tema contiene únicamente los nombres oficiales recibidos
- **AND** cada opción aparece una sola vez

#### Scenario: Buscar con un tema oficial
- **WHEN** el usuario selecciona un tema y activa `Buscar`
- **THEN** la interfaz solicita `GET /minifiguras` con ese parámetro
- **AND** actualiza la tabla con los resultados

#### Scenario: Buscar con filtros
- **WHEN** el usuario completa filtros y activa `Buscar`
- **THEN** la interfaz solicita `GET /minifiguras` con los parámetros correspondientes
- **AND** actualiza la tabla

#### Scenario: Error al cargar temas
- **WHEN** `GET /temas` falla
- **THEN** la interfaz muestra un error visible
- **AND** no permite enviar un tema que no haya sido validado como oficial

#### Scenario: Mostrar todo
- **WHEN** el usuario activa `Mostrar todo`
- **THEN** limpia los filtros
- **AND** solicita `GET /minifiguras` sin filtros
- **AND** muestra todo el catálogo

### Requirement: Crear, editar y eliminar minifiguras

La interfaz SHALL ofrecer creación, edición y eliminación mediante formularios y confirmación explícita, mostrando Toasts tras cada operación. Los formularios de creación y edición SHALL mostrar `tematica` como selector de una sola opción cargado con los temas oficiales de `GET /temas`.

#### Scenario: Crear una minifigura con tema oficial
- **WHEN** el usuario selecciona un tema oficial y confirma una nueva minifigura
- **THEN** la interfaz envía el valor seleccionado a la API
- **AND** refresca la tabla conservando filtros
- **AND** muestra un Toast de éxito si la API confirma la operación

#### Scenario: Editar una minifigura con tema oficial
- **WHEN** el usuario edita una figura y selecciona otro tema oficial
- **THEN** la interfaz envía el nuevo valor a la API
- **AND** conserva los datos existentes si la API rechaza la operación

#### Scenario: Alta, edición o eliminación exitosa
- **WHEN** la API confirma la operación
- **THEN** refresca la tabla conservando filtros
- **AND** muestra un Toast de éxito

#### Scenario: Operación rechazada
- **WHEN** la API devuelve un error por tema inválido u otra causa
- **THEN** conserva los datos existentes
- **AND** muestra un mensaje o Toast de error