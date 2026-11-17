# Spec Delta

## ADDED Requirements

### Requirement: Consultar las minipersonas incluidas en un set

El sistema SHALL permitir a un usuario autenticado consultar el contenido de un set de Brickset usando el número base o una variante explícita. Para un número base, SHALL buscar entre sus variantes la que incluya la palabra `Complete` en su nombre y usarla cuando exista; si no existe, SHALL resolver la variante `-1`. Una variante explícita SHALL conservarse, aunque exista una variante Complete. La respuesta SHALL identificar el set resuelto y sus minipersonas con los metadatos válidos necesarios para crear registros conforme al modelo actual de minifigura. Los registros que ya existan en el inventario del usuario SHALL devolverse con sus datos persistidos, que tendrán precedencia sobre los metadatos de Brickset.

El sistema SHALL distinguir entre set inexistente, set existente sin minipersonas y fallo temporal de Brickset. Ningún fallo de consulta SHALL representarse como un resultado exitoso ni como un set inexistente. Las operaciones SHALL usar la identidad autenticada y RLS vigente; SHALL NOT usar `service_role` ni exponer datos del inventario de otros usuarios.

#### Scenario: Consultar un set válido
- **WHEN** un usuario autenticado consulta un set que contiene minipersonas y Brickset devuelve los metadatos necesarios
- **THEN** recibe el set y la lista de minipersonas con IDs canónicos y metadatos válidos
- **AND** las minipersonas propias ya existentes se devuelven con sus datos guardados

#### Scenario: Resolver número base y variante explícita
- **WHEN** se consulta un número base o un número con sufijo de variante
- **THEN** el número base se resuelve como la variante Complete del mismo número, si existe, o como `-1` en caso contrario
- **AND** el sufijo explícito se conserva para la consulta

#### Scenario: Resolver una serie CMF completa
- **WHEN** se consulta `71001` y Brickset lista `71001-17` como `LEGO Minifigures - Series 10 - Complete (except Mr. Gold)`
- **THEN** se devuelve `71001-17` con las 16 minifiguras de su inventario
- **AND** no se agregan minifiguras ajenas al inventario de esa variante
- **AND** buscar `71001-2` sigue consultando únicamente esa variante explícita

#### Scenario: Revisar variantes sin confundir resultados o errores
- **WHEN** se busca una variante Complete para un número base
- **THEN** se comprueban las páginas de resultados necesarias y solo se consideran variantes de ese mismo número
- **AND** un fallo de consulta o formato no se oculta usando la variante `-1`

#### Scenario: Set inexistente o sin minipersonas
- **WHEN** Brickset confirma que el set no existe o que no contiene minipersonas
- **THEN** el sistema devuelve resultados distinguibles para ambos casos

#### Scenario: Fallo temporal de Brickset
- **WHEN** Brickset no está disponible o la consulta expira
- **THEN** el sistema devuelve un error controlado distinto de set inexistente
- **AND** no devuelve una lista parcial como resultado exitoso

#### Scenario: Aislar el inventario propio
- **WHEN** un usuario consulta los datos de un set
- **THEN** la consulta del inventario incluye únicamente minipersonas propias bajo JWT y RLS
- **AND** no usa `service_role` ni devuelve registros de otros usuarios

### Requirement: Crear de forma atómica las minipersonas nuevas de un set

El sistema SHALL permitir crear conjuntamente las minipersonas nuevas seleccionadas de un set con el mismo modelo, normalización, validaciones y valores por defecto que el alta individual. Los datos de compra SHALL usar la fecha común recibida cuando exista; el precio de compra SHALL omitirse. El estado y el seguimiento SHALL conservar la selección de cada fila.

Los IDs ya existentes en el inventario del usuario SHALL tratarse como duplicados, SHALL conservar todos sus datos y SHALL NOT actualizarse mediante esta operación. Si aparece un duplicado entre la consulta y el guardado, SHALL omitirse e informarse como existente. Las nuevas filas SHALL confirmarse como una única operación atómica: ante cualquier fallo de validación o persistencia no SHALL quedar guardada ninguna fila nueva del lote. La operación SHALL ejecutarse para el usuario autenticado bajo JWT y RLS y SHALL activar la misma actualización de estado derivado que las altas individuales tras confirmarse el lote.

#### Scenario: Crear varias minipersonas nuevas
- **WHEN** el usuario guarda filas válidas nuevas del set
- **THEN** todas se crean con los campos seleccionados y fecha común opcional
- **AND** el precio de compra queda ausente
- **AND** el estado derivado de la colección se actualiza tras confirmar el lote

#### Scenario: Omitir IDs que ya existen
- **WHEN** una minipersona del lote ya existe en el inventario
- **THEN** se conserva el registro existente sin cambios y se identifica como duplicado
- **AND** las demás filas nuevas válidas pueden guardarse

#### Scenario: Revertir el lote ante un error
- **WHEN** una fila nueva incumple el modelo o falla la persistencia del lote
- **THEN** se rechaza la operación
- **AND** no queda persistida ninguna fila nueva del lote

#### Scenario: Impedir duplicados concurrentes
- **WHEN** otro guardado crea un ID del lote después de consultar el set y antes de confirmar el lote actual
- **THEN** el ID concurrente se trata como existente y no se reemplaza
- **AND** el resto de filas válidas se procesa sin crear un lote parcial

#### Scenario: Mantener la autorización ordinaria
- **WHEN** se consultan o crean minipersonas de un set
- **THEN** las operaciones usan la identidad JWT del usuario y las políticas RLS
- **AND** no usan `service_role` ni aceptan una identidad de usuario seleccionada por el cliente
