# categorias-brickset Specification

## Purpose

Esta capacidad mantiene una fuente local y reproducible de las categorías oficiales de minifiguras de Brickset, sus totales y sus subcategorías (nombre y total opcional definido manualmente), disponible para la API y para la interfaz.

## Requirements

### Requirement: Mantener el catálogo local anidado de categorías y subcategorías

El sistema SHALL mantener un archivo JSON local (`data/categorias-brickset.json`) con una entrada por cada categoría de `https://brickset.com/browse/minifigs`. Cada entrada SHALL incluir el nombre oficial de la categoría, su total entero no negativo de minifiguras y un arreglo `subcategorias` con un objeto `{ subcategoria, total }` por cada subcategoría publicada para esa categoría, donde `subcategoria` SHALL ser el nombre oficial no vacío y `total` SHALL ser opcional. Cuando `total` esté presente SHALL ser un entero no negativo. El sistema no SHALL calcular ni derivar automáticamente el valor de `total` de una subcategoría: SHALL definirse manualmente. Un `total` ausente o igual a `0` SHALL tratarse como "no definido" y no SHALL considerarse en ningún cálculo, validación cruzada o visualización que dependa de un total de subcategoría conocido. Una categoría sin subcategorías publicadas SHALL tener `subcategorias` como arreglo vacío. El sistema SHALL exponer `GET /categorias` devolviendo el catálogo completo en el mismo orden que el archivo local.

#### Scenario: Consultar categorías disponibles
- **WHEN** un cliente realiza `GET /categorias` y el archivo local es válido
- **THEN** el sistema responde con HTTP `200`
- **AND** devuelve todas las categorías con su nombre oficial, su total y su arreglo `subcategorias`

#### Scenario: Subcategoría con total en 0 o sin definir
- **WHEN** una subcategoría del catálogo local tiene `total` ausente o igual a `0`
- **THEN** el sistema la trata como una subcategoría válida sin total conocido
- **AND** ningún cálculo, validación o visualización que dependa de un total de subcategoría la tiene en cuenta

#### Scenario: Rechazar un catálogo de categorías inválido
- **WHEN** un cliente realiza `GET /categorias` y el archivo falta o contiene nombres repetidos, totales de categoría o de subcategoría inválidos (no enteros o negativos), subcategorías con nombres repetidos dentro de la misma categoría o una estructura distinta a la esperada
- **THEN** el sistema responde con HTTP `500`
- **AND** devuelve un error controlado sin exponer el contenido del archivo

### Requirement: Limitar el alcance de subcategorías a Collectible Minifigures

Mientras no se decida ampliar el alcance, el sistema SHALL mantener el arreglo `subcategorias` completo (todas las subcategorías oficiales publicadas por Brickset) únicamente para la categoría `Collectible Minifigures`. El resto de categorías SHALL conservar `subcategorias` como arreglo vacío, aunque Brickset publique subcategorías para ellas, hasta que se decida ampliar el alcance explícitamente.

#### Scenario: Collectible Minifigures con todas sus subcategorías
- **WHEN** se consulta el catálogo local de categorías
- **THEN** la entrada `Collectible Minifigures` incluye el conjunto completo de subcategorías oficiales publicadas por Brickset para esa categoría

#### Scenario: Otras categorías sin subcategorías registradas
- **WHEN** se consulta el catálogo local de categorías para una categoría distinta de `Collectible Minifigures`
- **THEN** su arreglo `subcategorias` es vacío, independientemente de si Brickset publica subcategorías para ella

### Requirement: Sincronizar manualmente las categorías y subcategorías desde Brickset

El sistema SHALL proporcionar un agente o comando manual que consulte la página pública de categorías de Brickset, extraiga todos los nombres oficiales y totales de categoría, y actualice el archivo JSON local únicamente cuando la respuesta completa sea válida. Para la subcategoría, el agente SHALL revisar y mantener actualizado exclusivamente el arreglo `subcategorias` de `Collectible Minifigures`, dejando `subcategorias: []` en el resto de categorías conforme al alcance definido. El agente no SHALL calcular, inventar ni sobrescribir el `total` definido manualmente para una subcategoría existente; al añadir una subcategoría nueva SHALL omitir `total` o dejarlo en `0`. Cada vez que el agente añada o renombre una subcategoría de `Collectible Minifigures`, SHALL emitir un aviso indicando que el número de minifiguras de esa subcategoría requiere revisión manual.

#### Scenario: Sincronización exitosa
- **WHEN** una ejecución manual recibe una página de Brickset con categorías y totales válidos
- **THEN** reemplaza el catálogo local por el conjunto completo extraído
- **AND** conserva cada nombre y total sin añadir categorías inventadas
- **AND** conserva el `total` definido manualmente en cada subcategoría existente de `Collectible Minifigures`

#### Scenario: Aviso de revisión manual al añadir o renombrar una subcategoría
- **WHEN** una ejecución manual añade una subcategoría nueva o renombra una subcategoría existente de `Collectible Minifigures`
- **THEN** el reporte final incluye un aviso identificando cada subcategoría afectada y solicitando revisar manualmente su número de minifiguras

#### Scenario: Brickset no disponible durante la sincronización
- **WHEN** una ejecución manual no puede obtener la página o recibe un error HTTP
- **THEN** informa el fallo con un resultado no exitoso
- **AND** conserva sin cambios el catálogo local anterior

#### Scenario: Reconciliar minifiguras tras un cambio de categorías o subcategorías
- **WHEN** una sincronización renombra o elimina una categoría, o renombra o elimina una subcategoría de `Collectible Minifigures`, referenciada por alguna minifigura del catálogo local de minifiguras
- **THEN** el agente actualiza las referencias `categoria` y `subcategoria` de las minifiguras afectadas a los nombres oficiales vigentes, o detiene la sincronización sin aplicar cambios si no puede resolver la referencia de forma inequívoca

### Requirement: Persistir el catálogo de categorías de forma segura

La actualización del catálogo de categorías SHALL ser atómica y SHALL permitir que las pruebas aíslen la ruta del archivo y la respuesta HTTP de Brickset.

#### Scenario: Fallo al reemplazar el archivo de categorías
- **WHEN** la escritura o sustitución del nuevo archivo falla durante una sincronización
- **THEN** la ejecución informa un fallo controlado
- **AND** el archivo anterior permanece legible y completo
