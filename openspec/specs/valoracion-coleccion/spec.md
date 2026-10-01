## Purpose

Permite consultar y mantener el precio en Euros de las minifiguras mediante scraping de las páginas públicas de Brickset, con actualización individual y masiva resiliente.

## Requirements

### Requirement: Consultar el precio público de Brickset

El sistema SHALL consultar mediante fetch la URL pública `https://brickset.com/minifigs/<ID>` y SHALL extraer el importe asociado a `Current Value - New` como un número en Euros. La consulta no SHALL requerir credenciales ni API Key.

#### Scenario: Precio disponible
- **WHEN** se solicita el precio de una minifigura con una página Brickset válida que contiene `Current Value - New`
- **THEN** el sistema responde con el precio normalizado como número en Euros
- **AND** no modifica el catálogo hasta que el cliente confirme o solicite su persistencia

#### Scenario: Precio no disponible
- **WHEN** la página no existe, no contiene `Current Value - New` o el importe no puede interpretarse
- **THEN** el sistema devuelve un error público controlado
- **AND** no devuelve HTML bruto ni modifica el precio previamente almacenado

### Requirement: Calcular el valor total y los contadores de la colección

El sistema SHALL exponer un resumen en Euros con el valor total, el número de minifiguras en colección y el número de minifiguras buscadas. Para cada minifigura en `COLECCIÓN` SHALL priorizar `precio` y SHALL usar `precioCompra` solo cuando `precio` no sea válido. Las minifiguras `BUSCADA` no SHALL contribuir al total.

#### Scenario: Resumen de colección
- **WHEN** se solicita el resumen con figuras que tienen precio de mercado o compra
- **THEN** el sistema responde con HTTP `200`
- **AND** suma los importes aplicando la prioridad `precio` sobre `precioCompra`
- **AND** informa por separado los contadores de colección y búsqueda

#### Scenario: Figuras buscadas excluidas
- **WHEN** el resumen contiene figuras `COLECCIÓN` y `BUSCADA` con precios
- **THEN** las figuras `BUSCADA` incrementan su contador
- **AND** sus precios no se incluyen en el total

### Requirement: Actualizar precios de Brickset de forma resiliente

El sistema SHALL ofrecer una operación individual y una operación masiva para consultar Brickset. La actualización masiva SHALL ejecutarse como una tarea en segundo plano por usuario que procese cada figura persistida de forma aislada y secuencial, respetando el límite global de peticiones a Brickset, conserve precios anteriores cuando falle una consulta y persista cada precio válido en cuanto se obtenga. `POST /sincronizacion/brickset` SHALL iniciar la tarea y responder HTTP `202` con su estado sin esperar a que termine. El estado SHALL incluir `estado` (`en_curso` o `completada`), `procesados`, `total`, `actualizados` (IDs) y `fallidos` (pares `id`/`error`).

#### Scenario: Iniciar la actualización masiva
- **WHEN** un usuario autenticado sin tarea en curso solicita `POST /sincronizacion/brickset`
- **THEN** el sistema responde HTTP `202` con `estado: "en_curso"`, `procesados: 0` y `total` igual al número de figuras persistidas del usuario
- **AND** continúa consultando Brickset después de responder

#### Scenario: Catálogo vacío
- **WHEN** el usuario inicia la actualización masiva sin figuras persistidas
- **THEN** el sistema responde HTTP `202` con `estado: "completada"` y `total: 0`

#### Scenario: Tarea ya en curso
- **WHEN** el usuario solicita `POST /sincronizacion/brickset` mientras su tarea sigue en curso
- **THEN** el sistema responde HTTP `202` con el estado de la tarea existente
- **AND** no inicia una segunda tarea

#### Scenario: Actualización masiva completada
- **WHEN** Brickset responde con precios válidos
- **THEN** el sistema persiste los nuevos valores de `precio`
- **AND** al terminar el estado es `completada` e incluye los elementos actualizados

#### Scenario: Fallo parcial
- **WHEN** Brickset responde correctamente para unas figuras y falla para otras
- **THEN** el sistema persiste solo los precios válidos
- **AND** informa por separado elementos actualizados y fallidos
- **AND** las consultas locales continúan funcionando

#### Scenario: Actualización de todas las figuras persistidas
- **WHEN** se inicia una actualización masiva con figuras `COLECCIÓN` y `BUSCADA`
- **THEN** el sistema consulta Brickset para cada figura persistida
- **AND** `BUSCADA` solo se excluye del valor total y de los rankings

#### Scenario: Figura eliminada durante la tarea
- **WHEN** una figura se elimina mientras la tarea está en curso
- **THEN** el sistema no persiste su precio ni recrea la figura
- **AND** el resto de la tarea continúa

#### Scenario: Interrupción de la tarea
- **WHEN** el proceso del servidor se reinicia con una tarea en curso
- **THEN** los precios persistidos antes de la interrupción se conservan

### Requirement: Consultar el estado de la actualización masiva

El sistema SHALL exponer `GET /sincronizacion/brickset`, autenticado y aislado por usuario, que devuelva HTTP `200` con el estado de la tarea en curso o de la última tarea del usuario, con la misma forma que la respuesta de inicio. Si el usuario no tiene ninguna tarea registrada SHALL devolver `estado: "inactiva"`.

#### Scenario: Consultar una tarea en curso
- **WHEN** el usuario consulta el estado mientras la tarea avanza
- **THEN** el sistema devuelve `estado: "en_curso"` con `procesados` y `total` actualizados

#### Scenario: Sin tarea registrada
- **WHEN** el usuario nunca ha iniciado una actualización masiva en el proceso actual
- **THEN** el sistema devuelve `estado: "inactiva"`

#### Scenario: Aislamiento entre usuarios
- **WHEN** el usuario A tiene una tarea en curso y el usuario B consulta el estado
- **THEN** el usuario B no recibe información de la tarea del usuario A

### Requirement: Respetar el límite de peticiones de Brickset

El servidor SHALL enviar las peticiones a Brickset de una en una y con un intervalo mínimo configurable entre el inicio de dos peticiones consecutivas, compartido por todos los usuarios y por las consultas masivas e individuales. Ante una respuesta HTTP `429`, SHALL esperar el tiempo indicado por la cabecera `Retry-After` (en segundos o como fecha HTTP) o, si falta o no es interpretable, un tiempo de espera por defecto, y SHALL reintentar la misma figura un número acotado de veces. Si se agotan los reintentos, la figura SHALL registrarse como fallida con el código `BRICKSET_LIMITE`. Ningún otro error HTTP SHALL reintentarse sin espera previa.

#### Scenario: Intervalo entre peticiones
- **WHEN** se solicitan varias consultas a Brickset seguidas, aunque procedan de usuarios distintos
- **THEN** cada petición comienza al menos el intervalo mínimo después de la anterior
- **AND** nunca hay dos peticiones a Brickset simultáneas

#### Scenario: 429 con Retry-After
- **WHEN** Brickset responde `429` con `Retry-After: 30`
- **THEN** el servidor no envía ninguna petición a Brickset durante 30 segundos
- **AND** después reintenta la misma figura

#### Scenario: 429 persistente
- **WHEN** Brickset responde `429` en todos los reintentos permitidos para una figura
- **THEN** la figura se registra como fallida con `BRICKSET_LIMITE`
- **AND** la tarea continúa con la siguiente figura

#### Scenario: Consulta individual durante una tarea masiva
- **WHEN** un usuario consulta los datos de Brickset desde el formulario mientras hay una tarea masiva en curso
- **THEN** la consulta individual respeta el mismo límite global

### Requirement: Generar rankings de la colección

El sistema SHALL incluir un top 5 de figuras `COLECCIÓN` por precio y un top 5 de figuras `COLECCIÓN` más antiguas. El primer ranking ordenará precio descendente, fecha de compra más antigua y posición posterior en el JSON; las figuras sin precio aparecerán al final. El segundo ordenará año ascendente, precio descendente y posición posterior en el JSON.

#### Scenario: Rankings con menos de cinco figuras
- **WHEN** existen menos de cinco figuras `COLECCIÓN`
- **THEN** cada ranking devuelve únicamente las figuras disponibles
- **AND** ningún ranking incluye `BUSCADA`

### Requirement: Consultar categoría, subcategoría, año y precio individuales de Brickset

El sistema SHALL exponer `GET /minifiguras/:id/brickset` que consulte la misma página pública `https://brickset.com/minifigs/<ID>` y extraiga en una sola consulta la categoría oficial, la subcategoría (cuando la página la publique), el año de lanzamiento y el precio asociado a `Current Value - New`. El sistema SHALL resolver la categoría y, si aplica, la subcategoría extraídas contra el catálogo local de categorías (`data/categorias-brickset.json`) antes de responder.

#### Scenario: Datos completos y categoría reconocida
- **WHEN** se consultan los datos de una minifigura con una página Brickset válida cuya categoría existe en el catálogo local
- **THEN** el sistema responde con HTTP `200` y devuelve `categoria`, `anio` y `precio`
- **AND** incluye `subcategoria` únicamente si la subcategoría extraída pertenece a las subcategorías registradas localmente para esa categoría

#### Scenario: Categoría no reconocida en el catálogo local
- **WHEN** la categoría extraída de Brickset no coincide con ninguna categoría del catálogo local
- **THEN** el sistema responde con HTTP `502`
- **AND** identifica un error controlado sin exponer HTML bruto

#### Scenario: Página sin categoría o año
- **WHEN** la página no existe o no contiene una categoría o un año interpretables
- **THEN** el sistema responde con HTTP `502`
- **AND** no modifica el catálogo de minifiguras

### Requirement: Mantener la actualización masiva de precios sin afectar categoría, subcategoría o año

La actualización masiva de precios SHALL seguir consultando y persistiendo únicamente el precio de cada minifigura persistida, sin leer ni modificar `categoria`, `subcategoria` ni `anio`.

#### Scenario: Actualización masiva no toca categoría, subcategoría ni año
- **WHEN** se ejecuta la actualización masiva de precios
- **THEN** el sistema persiste solo el campo `precio` de las minifiguras actualizadas
- **AND** conserva sin cambios `categoria`, `subcategoria` y `anio` de todas las minifiguras

### Requirement: Exponer la galería de minifiguras observadas

El resumen de valoración SHALL exponer las minifiguras con `observada: true` para que la interfaz pueda construir la galería "En Observación". La lista SHALL ordenar primero por `precioBrickset` descendente y SHALL colocar después las figuras sin precio, conservando un orden estable entre empates. Debe incluir como mínimo `id`, `estadoColeccion`, `precioBrickset` y los datos necesarios para la tarjeta.

#### Scenario: Observadas ordenadas por precio
- **WHEN** el catálogo contiene varias figuras observadas con y sin precio Brickset
- **THEN** el resumen devuelve las observadas con precio de mayor a menor
- **AND** las que no tienen precio aparecen después

#### Scenario: Sin observadas
- **WHEN** ninguna figura está marcada como observada
- **THEN** el resumen devuelve una lista vacía
- **AND** no altera los contadores ni los rankings existentes
