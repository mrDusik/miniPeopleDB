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

### Requirement: Recalcular la gamificación al cambiar el catálogo de categorías

El servidor SHALL calcular una huella SHA-256 de categorias validadas, sus totales, subcategorias, anios de serie y definiciones completas de objetivos/ponderaciones V2; SHALL detectar cambios al arrancar y con el proceso activo. Cuando difiera de la ultima aplicada SHALL recalcular todos los usuarios con fuentes de gamificacion vigentes, incluidas relaciones sociales aunque no tengan figuras ni regalos. SHALL usar inventario, relaciones y ledger V2 actuales sin restaurar V1. Los estados y la nueva huella SHALL guardarse en una transaccion idempotente. JSON invalido o fallo de lectura, calculo o persistencia SHALL NOT cambiar la huella; los fallos transitorios SHALL reintentarse.

El recalcule global SHALL ejecutarse solo en backend mediante la RPC administrativa allowlisted existente, accesible solo con service_role, nunca mediante acceso global directo a tablas. Las claves SHALL mantenerse fuera del navegador, respuestas y `/config/supabase`. Operaciones ordinarias SHALL seguir usando JWT y RLS. El recalcule SHALL conservar regalos y fuentes sociales V2 y SHALL NOT ejecutar el reset de migracion al detectar una huella nueva.

#### Scenario: Cambio de categorías con gamificación existente
- **WHEN** cambia un total, anioInicio o definicion V2 validos
- **THEN** se recalculan logros, Bricks, nivel y progreso y solo se guarda la huella junto al lote confirmado
- **AND** no se modifican inventarios, perfiles, relaciones ni ledger

#### Scenario: Cambio de categorías con el servidor detenido
- **WHEN** el archivo o las definiciones cambian con el servidor detenido
- **THEN** el siguiente arranque aplica el recalcule antes de atender peticiones y no repite el reset V2

#### Scenario: DNA y Ranking Global tras el recálculo
- **WHEN** cambia la gamificacion de un usuario
- **THEN** las siguientes lecturas de DNA y ranking usan el estado vigente sin un recalcule separado del ranking

#### Scenario: Catálogo inválido o fallo del recálculo global
- **WHEN** falla la validacion o la confirmacion del lote
- **THEN** conserva el ultimo fingerprint y estado validos y reintenta sin publicar exito parcial

#### Scenario: Usuario solo social
- **WHEN** existe una cuenta con amistades pero sin inventario ni regalos
- **THEN** participa en el recalcule y recibe los logros sociales que le correspondan

### Requirement: Publicar un anio de serie independiente de colecciones privadas

El catalogo local SHALL permitir un metadato opcional `anioInicio` entero positivo por subcategoria de Collectible Minifigures, igual al menor anio publicado de las figuras Brickset observadas en esa misma subcategoria. SHALL considerar todas las subcategorias oficiales, incluida Other, y no confundir rutas compuestas con grupos agregados adicionales. La evidencia SHALL proceder de todas las paginas publicas de Brickset, nunca de inventarios de usuarios. Si una o mas fichas de la subcategoria carecen de anio, se SHALL usar el minimo de las fichas de esa misma subcategoria que si publican anio y marcar `anioInicioEstimado: true`; ese valor SHALL NOT presentarse como minimo confirmado. Si ninguna ficha de esa subcategoria publica anio, `anioInicio` SHALL permanecer ausente y no habilitara hitos que necesiten clasificar la serie. Una paginacion incompleta o ID duplicado SHALL NOT producir un `anioInicio` para esa entrada. El fallback SHALL NOT usar otra serie, el anio actual ni inventarios privados.

Durante la migracion inicial V2, el sistema SHALL canonicalizar unicamente estos alias aprobados de `Collectible Minifigures` en el JSON local y en las referencias guardadas de minifiguras: `Harry Potter / Harry Potter Series 1 Fantastic Beasts` a `Harry Potter / Harry Potter Series 1 / Fantastic Beasts`, y `Super Heroes / Marvel Studios Series 1 What If` a `Super Heroes / Marvel Studios Series 1 / What If...?`. SHALL conservar los totales manuales 6 y 4, respectivamente. La transaccion SHALL modificar solo `subcategoria` de las filas que coincidan exactamente con el alias y SHALL conservar IDs, nombres visibles, descripciones, estados, precios y demas datos. Ningun otro nombre parecido SHALL canonicalizarse sin una decision explicita.

El agente Brickset SHALL reportar el anio local, el minimo observado, si es estimado, las fuentes y su completitud para cada serie, manteniendo su modo de solo lectura y sin consultar Supabase ni aplicar archivos. Un bloqueo o paginacion incompleta SHALL producir estado incompleto y no publicar minimos para esas rutas. Los totales de subcategoria SHALL seguir siendo manuales: obtener anios SHALL NOT autorizar calcularlos ni sobrescribirlos. El despliegue V2 SHALL validar la cobertura de paginas, las estimaciones y las rutas sin correspondencia antes del recalcule para no clasificar series usando solo figuras que posea alguien.

#### Scenario: Serie con varios anios
- **WHEN** la evidencia publica completa contiene figuras de 2016 y 2017
- **THEN** el reporte identifica 2016 como anio minimo y el catalogo validado clasifica esa serie como antigua para todos

#### Scenario: Fuente incompleta
- **WHEN** falta una pagina o no se puede confirmar el anio minimo de una serie
- **THEN** el agente informa la limitacion sin modificar archivos, inventar un anio ni usar inventarios privados

#### Scenario: Año ausente en una ficha de serie
- **WHEN** todas las páginas de la serie están completas, hay fichas con año y al menos una ficha de esa misma serie carece de año
- **THEN** se usa el menor año publicado entre las fichas observadas de esa serie y se marca `anioInicioEstimado: true`
- **AND** si ninguna ficha de la serie publica año, `anioInicio` permanece ausente

#### Scenario: Canonicalizar aliases aprobados al migrar referencias
- **WHEN** una minifigura tiene exactamente una de las dos subcategorias locales aprobadas
- **THEN** la migracion V2 cambia solo su referencia a la ruta oficial anidada correspondiente
- **AND** conserva el total manual, ID, nombre, descripcion, estado y precios
- **AND** no altera otras rutas parecidas

#### Scenario: Metadato invalido
- **WHEN** se intenta publicar anioInicio cero, negativo, fraccionario o no numerico
- **THEN** la validacion rechaza el archivo y conserva el ultimo catalogo valido
