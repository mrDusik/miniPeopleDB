# Tasks

## 1. Modelo local y validacion

- [x] 1.1 Añadir validación para los campos raíz opcionales `precioCompra`, `fechaCompra` (`YYYY-MM-DD`) y `precio`, todos expresados en Euros; verificar registros antiguos, valores válidos y entradas inválidas en `test/minifiguras.test.js`.
- [x] 1.2 Extender el repositorio y el CRUD para conservar los tres campos planos sin crear objetos anidados ni lógica multimoneda; verificar que el orden y los campos existentes permanecen intactos.
- [x] 1.3 Actualizar `data/minifiguras.json` con datos de ejemplo compatibles y verificar que `npm test` mantiene los escenarios existentes del catálogo.

## 2. Scraping público de Brickset

- [x] 2.1 Crear un scraper con transporte inyectable que consulte `https://brickset.com/minifigs/<ID>` sin credenciales ni API Key; verificar con tests aislados que construye la URL correcta.
- [x] 2.2 Extraer y normalizar `Current Value - New` como número en Euros; verificar HTML válido, precio ausente, página no encontrada, HTML cambiado, timeout y error de red sin llamadas reales en los tests.
- [x] 2.3 Implementar la consulta individual y la actualización masiva con timeout, reintentos limitados y procesamiento aislado por minifigura; verificar que los fallos no borran precios anteriores y que los éxitos sí se persisten atómicamente.
- [x] 2.4 Exponer los endpoints de consulta individual y actualización masiva con resultados por id y errores públicos controlados; verificar éxito, fallo parcial y Brickset no disponible en `test/minifiguras.test.js`.

## 3. Total y API del catálogo

- [x] 3.1 Implementar el cálculo del `Valor Total de la Colección` priorizando `precio` y usando `precioCompra` como fallback, siempre en Euros; verificar combinaciones de campos presentes y ausentes.
- [x] 3.2 Exponer el total para la interfaz y mantener `GET /minifiguras` y el CRUD independientes de Brickset; verificar que la lectura local funciona con Brickset caído y conserva los filtros.

## 4. Interfaz web

- [x] 4.1 Añadir al formulario los campos `precioCompra`, `fechaCompra` y `precio` readonly, junto con el botón de consulta individual; verificar que la consulta rellena el precio sin permitir edición manual.
- [x] 4.2 Añadir la columna `Precio` a la tabla y el `Valor Total de la Colección` al header; verificar que los registros sin precio siguen renderizándose correctamente y que el total usa la prioridad especificada.
- [x] 4.3 Añadir el botón `Actualizar precios desde Brickset` y estados no bloqueantes de carga, éxito parcial y error mediante Toasts; verificar que deshabilita botones durante la operación, no congela la interfaz y conserva filas/precios anteriores ante fallos.
- [x] 4.4 Recargar catálogo y total tras una actualización masiva manteniendo filtros y operaciones CRUD; verificar las llamadas y estados en `test/web.test.js`.

## 5. Verificacion integrada

- [x] 5.1 Ejecutar `npm test` y corregir regresiones en API, persistencia, scraping e interfaz.
- [x] 5.2 Ejecutar `openspec validate "lego-6-valoracion-coleccion-brickset" --strict` y verificar que la implementación no introduce credenciales, API Key, multimoneda ni modelo anidado.

## 6. Funcionalidades adicionales implementadas

- [x] 6.1 Restringir `estadoColeccion` a `COLECCIÓN` y `BUSCADA`, aplicar `COLECCIÓN` por defecto y usar selectores en filtros, creación y edición; verificar rechazo de estados inválidos y persistencia del valor por defecto.
- [x] 6.2 Excluir `BUSCADA` del valor total y devolver contadores de colección y búsqueda desde el mismo resumen; verificar total y contadores con estados mezclados.
- [x] 6.3 Añadir top 5 de colección por precio y top 5 de figuras más antiguas, con desempates por fecha, precio y posición JSON según corresponda; verificar que se excluyen las figuras buscadas y que se muestran menos de cinco cuando procede.
- [x] 6.4 Añadir la columna `Diferencia` con `precio - precioCompra`, estados `?`/`N/A` y colores por signo; verificar sus tres comportamientos en la tabla.
- [x] 6.5 Hacer ordenables las columnas `Año` y `Precio` y refrescar rankings y resumen tras cargas o sincronizaciones; verificar controles, orden ascendente/descendente y ausencia de regresiones.
- [x] 6.6 Validar los precios recibidos antes de persistirlos, definir el orden de figuras sin precio en el ranking y verificar la creación desde el formulario con estado vacío.