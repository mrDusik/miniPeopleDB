# Proposal

## Why

El catalogo actual solo permite consultar minifiguras, por lo que cualquier alta, correccion o retirada exige editar el JSON manualmente. Se necesita una API de gestion que conserve el JSON local como fuente de verdad y rechace datos que corromperian el catalogo.

## What Changes

- Incorporar `POST /minifiguras` para crear una minifigura con un `id` unico, `tematica` y `anio` obligatorios, y persistirla en el catalogo JSON local.
- Incorporar `PUT /minifiguras/:id` para reemplazar una minifigura existente mediante un cuerpo valido que incluya `tematica` y `anio`, y persistir el resultado.
- Incorporar `DELETE /minifiguras/:id` para eliminar una minifigura existente del catalogo JSON local.
- Normalizar el campo de categoria persistido como `tematica`; el filtro de consulta `tema` permanece disponible para conservar compatibilidad con las consultas existentes.
- Definir respuestas HTTP y errores JSON consistentes para cuerpos JSON invalidos, datos de minifigura invalidos, identificadores duplicados y recursos inexistentes.
- Extender el repositorio para leer, validar y escribir el catalogo de forma que no se deje un archivo JSON parcialmente escrito.
- Añadir pruebas automatizadas de los flujos de alta, actualizacion, eliminacion, validacion y persistencia, sin alterar el archivo de datos de produccion.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `minifiguras`: ampliar el catalogo local con operaciones de creacion, reemplazo y eliminacion validadas.

## Impact

- Afecta a `src/server.js` para el enrutamiento HTTP y el analisis de cuerpos JSON.
- Afecta a `src/minifiguras-repository.js` para la validacion y persistencia local.
- Afecta a `test/minifiguras.test.js` para cubrir los nuevos contratos HTTP y la escritura aislada en JSON.
- No incorpora dependencias ni bases de datos externas; `data/minifiguras.json` sigue siendo la persistencia de produccion.