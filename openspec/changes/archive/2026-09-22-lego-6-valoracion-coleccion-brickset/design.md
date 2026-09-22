# Design

## Context

El catálogo vive en `data/minifiguras.json`, se valida y persiste mediante `MinifigurasRepository`, y la API Express sirve el CRUD y la interfaz vanilla. Brickset ofrece una página pública por identificador en `https://brickset.com/minifigs/<ID>`; la integración leerá esa página y extraerá el texto `Current Value - New` en Euros. Ver `proposal.md` y las specs del cambio para el contrato funcional.

## Goals / Non-Goals

**Goals:**

- Mantener los campos opcionales `precioCompra`, `fechaCompra` y `precio` directamente en la raíz de cada minifigura.
- Restringir `estadoColeccion` a `COLECCIÓN` y `BUSCADA`, con `COLECCIÓN` como valor por defecto.
- Operar exclusivamente en Euros, sin códigos de moneda, conversiones ni estructuras anidadas.
- Consultar el precio individual y actualizar el catálogo completo desde Brickset mediante fetch/scraping público.
- Conservar precios anteriores y datos locales cuando falle una consulta externa.
- Hacer visible el progreso, éxito parcial y error mediante Toasts sin bloquear la interfaz.
- Calcular desde una única lectura el total, los contadores y los rankings que consume la cabecera.

**Non-Goals:**

- No se usan credenciales, API Key ni autenticación contra Brickset.
- No se crea histórico de precios, alertas, conversión de divisas ni proceso automático en segundo plano.
- No se convierte Brickset en la fuente de verdad del catálogo ni se permite que elimine minifiguras.
- No se incluyen figuras `BUSCADA` en el valor total ni en los rankings de colección.

## Decisions

### Modelo de datos plano y compatible

Cada minifigura podrá incluir en su raíz:

- `precioCompra`: número no negativo, en Euros.
- `fechaCompra`: cadena con formato `YYYY-MM-DD`.
- `precio`: número no negativo, en Euros, obtenido de Brickset.

Los tres campos serán opcionales para conservar registros existentes. No se añadirá un bloque `valoracion`, moneda, fecha de sincronización ni estado externo al modelo solicitado. La validación rechazará valores presentes con tipos o formatos incorrectos.

El estado de colección se persiste únicamente como `COLECCIÓN` o `BUSCADA`. Las altas y ediciones sin estado o con estado vacío reciben `COLECCIÓN`; las variantes no canónicas se rechazan.

### Scraping público directo

El scraper construirá la URL exacta `https://brickset.com/minifigs/<ID>`, realizará un `fetch` con timeout y localizará el precio asociado a `Current Value - New`. El texto monetario se normalizará a un número en Euros, aceptando el formato mostrado por Brickset y rechazando respuestas ambiguas o sin precio.

No habrá credenciales ni API Key. El transporte se inyectará en el scraper o servicio para probar HTML exitoso, página inexistente, HTML cambiado, timeout y error de red sin acceder a Internet durante los tests.

### Sincronización individual y masiva

La API tendrá una operación individual para consultar el precio de una minifigura y una operación masiva para actualizar todos los elementos con identificador. La sincronización masiva procesará cada elemento de manera aislada, aplicará solo precios válidos y persistirá el catálogo mediante la escritura atómica existente. Un fallo no borrará el `precio` anterior y se incluirá en el resumen de resultados.

El campo `precio` se valida como número no negativo en las operaciones CRUD porque el formulario necesita persistir el resultado de una consulta individual de Brickset; la aplicación no permite editarlo manualmente y la sincronización masiva solo aplica valores obtenidos del scraper.

La operación masiva será explícita, no parte de `GET /minifiguras`, para que la lectura local siga funcionando aunque Brickset esté caído. Los endpoints no expondrán HTML bruto, URLs internas adicionales ni detalles sensibles del error.

### Valor total y rankings de la colección

El servidor calculará en una única lectura un resumen en Euros. Las figuras `BUSCADA` incrementan su contador pero no aportan al total. Para cada figura en colección se usará `precio` si es válido; si no existe, se usará `precioCompra`; si ninguno existe, se aportará cero. El resumen incluye los contadores de colección y búsqueda, un top 5 por precio y un top 5 por antigüedad.

El top por precio incluye las figuras `COLECCIÓN`, ordena los precios válidos de mayor a menor y coloca al final las figuras sin `precio` válido. Desempata por `fechaCompra` más antigua y después por posición posterior en el JSON. El top de figuras más antiguas ordena por `anio` ascendente, desempata por `precio` descendente y finalmente por posición posterior en el JSON. Ambos excluyen `BUSCADA` y limitan el resultado a cinco elementos.

### Interfaz y estados no bloqueantes

El formulario tendrá `precioCompra`, `fechaCompra` y `precio` readonly, además de un botón para consultar el precio individual y rellenar el campo. La tabla mostrará las columnas `Precio` y `Diferencia`. Para una figura en colección, `Diferencia` es `precio - precioCompra`, con `?` si falta algún dato y color verde/rojo según el signo; para `BUSCADA` muestra `N/A`. Las cabeceras `Año` y `Precio` son ordenables ascendente/descendente en cliente.

El header mostrará total, contadores y los dos rankings, además de `Actualizar precios desde Brickset`.

Durante una actualización se deshabilitarán los botones relevantes para impedir duplicados, pero no se bloqueará la página ni la interacción con Toasts. Al finalizar se recargarán catálogo y total; si hay fallos parciales, se conservarán las filas y se mostrará el resumen de actualizados y fallidos.

## Risks / Trade-offs

- [Brickset puede cambiar el HTML o el texto del precio] -> Aislar el selector del scraper, validar el resultado y conservar el precio anterior si no se encuentra un valor inequívoco.
- [Una sincronización masiva puede tardar o ser limitada por el sitio] -> Usar timeout, reintentos limitados y concurrencia controlada; tratar cada minifigura de forma independiente.
- [El identificador local puede no tener página correspondiente] -> Clasificarlo como no encontrado y continuar con el resto sin modificar su precio previo.
- [El total mezcla coste y valor cuando faltan precios de mercado] -> Aplicar de forma explícita la prioridad `precio` y fallback `precioCompra`, y mostrar siempre que el total está expresado en Euros.

## Migration Plan

1. Hacer opcionales y validar los tres campos planos sin modificar los registros que no los contienen.
2. Añadir el scraper público, las operaciones individual/masiva y tests con transporte simulado.
3. Añadir el total en el header, los campos del formulario, la columna `Precio`, el botón individual y el botón masivo con Toasts.
4. Verificar que `GET /minifiguras` y el CRUD siguen funcionando sin conexión a Brickset. Para revertir, retirar los controles y endpoints nuevos; los campos planos desconocidos pueden ignorarse sin invalidar el catálogo base.