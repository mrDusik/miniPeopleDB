# Proposal

## Why

La tarea LEGO-1 necesita una primera capacidad consultable para listar las minifiguras disponibles. El endpoint debe funcionar sin una base de datos externa, conservar los datos en un archivo JSON local y ofrecer una base estable para las siguientes operaciones del catálogo.

## What Changes

Se añadirá el endpoint HTTP `GET /minifiguras`, que leerá el catálogo desde un archivo JSON local y devolverá la colección de minifiguras en JSON. La implementación incluirá el modelo o contrato inicial, el acceso a persistencia local, el manejo de catálogo inexistente o inválido y pruebas automatizadas del comportamiento.

## Capabilities

### New Capabilities

- `minifiguras`: Listado de minifiguras LEGO mediante `GET /minifiguras` con persistencia local en JSON.

### Modified Capabilities

- Ninguna.

## Impact

Se incorporan la ruta HTTP, el modelo de minifigura, un repositorio o servicio de lectura del archivo JSON local, un archivo inicial de datos y pruebas de endpoint y persistencia. No se requiere una base de datos ni un servicio externo. La forma concreta de arrancar el servidor y la ubicación del archivo se alinearán con la estructura de aplicación disponible durante la implementación.