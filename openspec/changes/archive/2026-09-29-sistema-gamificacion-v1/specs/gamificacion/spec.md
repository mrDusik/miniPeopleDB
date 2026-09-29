# Gamificacion

## ADDED Requirements

### Requirement: Persistir y consultar el estado de gamificacion

El sistema SHALL mantener el estado derivado del usuario en `data/gamificacion.json`, con una estructura que incluya el total de Bricks, el nivel actual y el desglose de logros por identificador, cantidad y Bricks acumulados. La ruta del archivo SHALL poder inyectarse en pruebas y la escritura SHALL ser atomica. El sistema SHALL exponer `GET /gamificacion` y SHALL devolver el estado actual sin depender de un servicio externo.

#### Scenario: Inicializar el estado desde un catalogo existente
- **WHEN** se inicia la aplicacion con un catalogo de minifiguras valido y no existe `gamificacion.json`
- **THEN** se evalua el catalogo completo
- **AND** se crea `gamificacion.json` con los logros, Bricks y nivel calculados
- **AND** `GET /gamificacion` devuelve ese mismo estado

#### Scenario: Leer el estado persistido
- **WHEN** un cliente solicita `GET /gamificacion`
- **THEN** el sistema responde con HTTP `200`
- **AND** devuelve el nivel, los Bricks totales, el progreso del nivel actual, el siguiente nivel si existe y el desglose de logros

### Requirement: Calcular niveles de forma escalable

El sistema SHALL declarar los niveles en una configuracion ordenada por umbral, sin codificar la seleccion de un nivel como una cadena de condicionales fija. El nivel actual SHALL ser el de mayor umbral que no supere los Bricks totales. La configuracion inicial SHALL contener los niveles 0 a 25 y sus umbrales exactos: Duplo 0, Stud 20, Plate 50, Three-Seven-Five 100, Citizen 200, Skeleton 300, Pirate 400, Captain 500, Redbeard 750, Forestman 1000, Wolfpack 1500, Wolfpack Master 2000, Ninja 2500, RX 3000, Dragon Form 5000, Space Baby 6000, Space Man 7000, Blacktron 8000, Technic 9000, Majisto 10000, Castle Knight 12500, Chrome Gold 15000, Wooden Duck 20000, De Billund 30000, Mr. Kirk 50000 y Mr. Gold 100000.

#### Scenario: Seleccionar nivel y progreso intermedio
- **WHEN** el usuario tiene 820 Bricks
- **THEN** el nivel actual es `8 Redbeard`
- **AND** el progreso se calcula entre 750 y 1000 Bricks
- **AND** el siguiente nivel es `9 Forestman`

#### Scenario: Alcanzar el nivel maximo
- **WHEN** el usuario tiene al menos 100000 Bricks
- **THEN** el nivel actual es `25 Mr. Gold`
- **AND** no se informa un siguiente nivel
- **AND** el progreso se informa como completado

### Requirement: Recalcular logros de forma determinista

El sistema SHALL recalcular los logros exclusivamente a partir de las minifiguras actuales en estado `COLECCIÓN` y del catalogo local de categorias/subcategorias, sin aplicar incrementos o decrementos manuales. Las minifiguras en estado `BUSCADA` SHALL ser excluidas de toda regla de logro, incluidas las reglas de precio, identificador, categoria, subcategoria y completitud. Cada minifigura `COLECCIÓN` que cumpla una regla repetible SHALL contribuir una vez a esa regla; un registro SHALL poder contribuir simultaneamente a todas las reglas de precio que cumpla. Las reglas de primera presencia SHALL producir una contribucion por cada categoria o subcategoria distinta actualmente representada por minifiguras `COLECCIÓN`. Las reglas no repetibles SHALL producir como maximo una contribucion. Los umbrales de precio SHALL ser estrictamente mayores que 10, 50, 100 y 300 Euros.

#### Scenario: Acumular reglas de precio en un mismo registro
- **WHEN** el catalogo contiene una minifigura de 135 Euros
- **THEN** el calculo suma `New mini person` (1), `WOAH!` (10), `Deal master` (50) y `Masterpiece` (100)
- **AND** el total aportado por ese registro es 161 Bricks
- **AND** no se suma `Holy grail` porque 135 no es mayor que 300

#### Scenario: Recalcular tras eliminar una figura
- **WHEN** se elimina una minifigura que aportaba logros
- **THEN** el siguiente recalculo elimina sus contribuciones
- **AND** el total de Bricks y el nivel pueden disminuir
- **AND** el desglose persistido coincide exactamente con el catalogo restante

#### Scenario: Excluir figuras buscadas
- **WHEN** el catalogo contiene una minifigura `BUSCADA` que cumple reglas de precio, categoria, subcategoria o identificador especial
- **THEN** esa minifigura no aporta ningun logro ni Brick
- **AND** no cuenta para primeras presencias ni para completar una subcategoria

#### Scenario: Evaluar objetivos por categorias y subcategorias
- **WHEN** el catalogo representa una categoria o subcategoria
- **THEN** se concede una vez el objetivo repetible de primera presencia correspondiente
- **AND** el objetivo de completar una subcategoria solo se concede cuando el numero de figuras actuales alcanza su total conocido y positivo
- **AND** los totales ausentes o iguales a cero no activan el objetivo de completitud

### Requirement: Mantener el catalogo de objetivos extensible

El catalogo de objetivos SHALL declarar para cada objetivo un identificador estable, nombre visible, valor en Bricks, modo repetible y una regla evaluable. SHALL incluir `New mini person` (1), `WOAH!` (10), `Deal master` (50), `Masterpiece` (100), `Holy grail` (500), `OMGold!!` para `COL161` (5000), `Let's go!` (5), `Collector` (50), `Step by step` (3), `Bricky Potter` (10), `Bricky Mouse` (10), `It's-a me, Mario!` (10), `Green Hill Zone` (10), `Dimensional` (25), `Warsie` (10), `In NY, I was` para `SW0465A` (3000), `Welcome to the Upsidedown!` para `ST008` (100) y `Chill, Nancy. I'm fine` para `ST009` (700). El motor SHALL permitir añadir niveles u objetivos mediante nuevos datos de configuracion sin reescribir el algoritmo de seleccion de nivel ni el formato del estado.

#### Scenario: Aplicar objetivos no repetibles
- **WHEN** el catalogo contiene `COL161`, `SW0465A`, `ST008` o `ST009`
- **THEN** cada objetivo especial correspondiente se refleja como una sola contribucion
- **AND** editar o mantener el mismo registro no duplica esa contribucion

### Requirement: Sincronizar el recalcule con las mutaciones del inventario

Toda alta, edicion, eliminacion o actualizacion persistente de una minifigura SHALL ejecutar el recalcule despues de persistir correctamente el catalogo. Si la persistencia del catalogo falla, no SHALL modificarse el estado de gamificacion. El proceso de inicializacion SHALL ejecutar el mismo motor sobre el inventario existente.

#### Scenario: Alta y edicion actualizan gamificacion
- **WHEN** una alta o edicion valida modifica el catalogo
- **THEN** la respuesta de la operacion se completa junto con el estado de gamificacion recalculado
- **AND** el estado consultable refleja los nuevos Bricks y logros

#### Scenario: Fallo de persistencia no deja estado parcial
- **WHEN** una mutacion del catalogo no puede reemplazar el archivo de minifiguras
- **THEN** la gamificacion conserva el estado anterior
- **AND** no se persiste un resultado calculado sobre datos que no llegaron a guardarse

### Requirement: Informar logros completados a la interfaz

Las operaciones de alta y edicion que completen logros SHALL devolver los logros nuevos o activados en la respuesta de la operacion, incluyendo nombre y Bricks otorgados. La informacion SHALL permitir a la interfaz ordenar avisos y no SHALL requerir que el navegador implemente las reglas de gamificacion.

#### Scenario: Obtener logros nuevos tras una mutacion
- **WHEN** una alta o edicion hace que el estado nuevo contenga una contribucion mayor que el estado anterior para uno o mas objetivos
- **THEN** la respuesta incluye esos objetivos con su cantidad y valor de Bricks
- **AND** los objetivos se pueden ordenar por valor ascendente

### Requirement: Informar subidas de nivel intermedias

Cuando una mutacion aumente el nivel del usuario, la respuesta SHALL incluir todos los niveles nuevos alcanzados entre el nivel anterior y el actual, en orden ascendente, incluyendo el nivel final. La interfaz SHALL mostrar un Toast diferenciado por cada nivel con el formato `Has alcanzado el nivel <id> <nombre>`. Si una sola mutacion salta varios niveles, SHALL mostrarse un Toast por cada nivel intermedio.

#### Scenario: Mostrar cada nivel superado
- **WHEN** el usuario pasa del nivel 4 al nivel 7 tras una mutacion
- **THEN** la interfaz muestra `Has alcanzado el nivel 5 Skeleton`
- **AND** muestra `Has alcanzado el nivel 6 Pirate`
- **AND** muestra `Has alcanzado el nivel 7 Captain`
- **AND** esos Toasts usan un estilo diferenciado del Toast de logro

## MODIFIED Requirements

### Requirement: Gestionar el catalogo mediante CRUD

Las operaciones existentes de alta, reemplazo y eliminacion SHALL conservar sus codigos HTTP y validaciones, y SHALL ejecutar el recalcule de gamificacion tras cada persistencia exitosa del catalogo. Las respuestas de alta y reemplazo SHALL incluir el resultado de gamificacion necesario para actualizar la interfaz; la eliminacion SHALL dejar el estado persistido recalculado aunque no tenga cuerpo de respuesta.

#### Scenario: CRUD mantiene el contrato y recalcula
- **WHEN** un cliente crea, reemplaza o elimina una minifigura valida
- **THEN** se conserva el comportamiento HTTP existente de la operacion
- **AND** `GET /gamificacion` refleja inmediatamente el catalogo resultante

