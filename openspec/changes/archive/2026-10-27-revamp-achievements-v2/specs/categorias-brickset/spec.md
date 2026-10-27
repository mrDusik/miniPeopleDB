# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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