# Proposal

## Why

La colección necesita registrar cuánto costó cada minifigura y consultar su valor actual en Brickset. LEGO-6 añade esa valoración usando la página pública de cada minifigura, sin credenciales ni API Key, y mantiene la aplicación operativa cuando alguna consulta externa falla.

## What Changes

- Añadir a cada minifigura los campos opcionales de raíz `precioCompra`, `fechaCompra` y `precio`.
- Consultar directamente `https://brickset.com/minifigs/<ID>` mediante scraping/fetch y extraer el valor `Current Value - New` en Euros (€).
- Mantener todos los importes exclusivamente en Euros, sin monedas alternativas ni objetos anidados de valoración.
- Añadir al formulario los campos de compra y el precio obtenido, con el precio en modo solo lectura y un botón para consultarlo individualmente.
- Mostrar la columna `Precio` en la tabla principal.
- Mostrar en el header el `Valor Total de la Colección`, calculado priorizando `precio` y usando `precioCompra` cuando no exista.
- Mostrar junto al total los contadores de minifiguras en `COLECCIÓN` y `BUSCADA`.
- Mostrar en la cabecera un top 5 dinámico de minifiguras en colección por precio y otro top 5 de las más antiguas.
- Añadir en la tabla la columna `Diferencia`, calculada como `precio - precioCompra` para figuras en colección.
- Permitir ordenar la tabla por `Año` y `Precio` en ambos sentidos.
- Limitar `estadoColeccion` a `COLECCIÓN` y `BUSCADA`, usando una lista de selección con `COLECCIÓN` por defecto.
- Añadir el botón `Actualizar precios desde Brickset` para sincronizar masivamente de forma resiliente.
- Deshabilitar los botones durante la actualización masiva y comunicar carga, éxito parcial y error mediante Toasts sin bloquear la interfaz.
- Mantener la persistencia local en JSON, el CRUD existente y la lectura del catálogo aunque Brickset no responda.

## Capabilities

### New Capabilities

- `valoracion-coleccion`: Consulta precios públicos de Brickset, calcula el valor total y sus contadores en Euros, y genera rankings dinámicos de la colección.

### Modified Capabilities

- `minifiguras`: Añade los campos raíz opcionales `precioCompra`, `fechaCompra` y `precio`, restringe los estados y define el cálculo de total y rankings.
- `interfaz-web-minifiguras`: Añade controles de precio, total, contadores, rankings, diferencia económica, ordenación de tabla y actualización desde Brickset.

## Impact

- Afecta `src/minifiguras-repository.js`, `src/server.js`, `data/minifiguras.json`, `public/index.html`, `public/app.js`, `public/styles.css` y los tests existentes.
- Añade un scraper/fetch de páginas públicas de Brickset sin credenciales ni API Key.
- Amplía la API para consultar precios, ejecutar la actualización masiva y devolver total, contadores y rankings.
- No introduce base de datos, conversión de divisas ni un modelo anidado de valoración.