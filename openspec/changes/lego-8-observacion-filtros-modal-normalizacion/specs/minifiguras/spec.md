# Spec Delta

## MODIFIED Requirements

### Requirement: Listar minifiguras desde persistencia local
El sistema SHALL exponer `GET /minifiguras` y SHALL obtener la colección desde un archivo JSON local, sin depender de una base de datos ni de la disponibilidad de Brickset. Cada minifigura SHALL conservar en su raíz los campos opcionales `precioCompra`, `fechaCompra` y `precio`, todos expresados en Euros, y su `estadoColeccion` SHALL ser `COLECCIÓN` o `BUSCADA`. Cada minifigura SHALL identificar su categoría oficial mediante `categoria` y, opcionalmente, su subcategoría oficial mediante `subcategoria`. Cada minifigura SHALL incluir el booleano `observada`; los registros existentes migrados sin ese campo SHALL quedar en `false`.

#### Scenario: Catálogo con estado de observación
- **WHEN** un cliente realiza `GET /minifiguras` y el archivo JSON contiene una colección válida
- **THEN** el sistema responde con HTTP `200`
- **AND** cada elemento incluye `id`, `nombre`, `FechaRegistro` y `observada` booleano
- **AND** los campos planos de precio se devuelven sin consultar Brickset

#### Scenario: Catálogo con minifiguras disponibles
- **WHEN** un cliente realiza `GET /minifiguras` y el archivo JSON contiene una colección válida
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo es JSON con un arreglo de minifiguras
- **AND** cada minifigura incluye al menos `id`, `nombre` y `FechaRegistro`

#### Scenario: Catálogo vacío
- **WHEN** un cliente realiza `GET /minifiguras` y el archivo JSON contiene una colección vacía
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo contiene un arreglo vacío

### Requirement: Permitir descripción y año ausentes
El sistema SHALL aceptar minifiguras sin `descripcion` y sin `anio`. Cuando Brickset devuelva el año `0` o no devuelva un año válido durante una sincronización, la aplicación SHALL asignar el año natural actual antes de habilitar el guardado y persistir el resultado.

#### Scenario: Crear sin descripción ni año manual
- **WHEN** se crea o edita una minifigura sin `descripcion` o sin `anio` fuera de una sincronización
- **THEN** la operación se completa correctamente cuando el resto del modelo es válido
- **AND** esos campos permanecen ausentes o vacíos

#### Scenario: Crear sin descripción ni año
- **WHEN** se crea o edita una minifigura sin `descripcion` o sin `anio`
- **THEN** la operación se completa correctamente
- **AND** esos campos permanecen ausentes o vacíos

#### Scenario: Brickset devuelve año cero
- **WHEN** Brickset devuelve `0` o un año ausente para una sincronización
- **THEN** la respuesta de sincronización contiene el año natural actual
- **AND** el formulario muestra ese año y permite guardar si los demás obligatorios son válidos

### Requirement: Filtrar minifiguras por características
El sistema SHALL permitir filtrar `GET /minifiguras` por `id`, `nombre`, `categoria`, `subcategoria`, `anio`, `estadoColeccion` y `observada`, rechazando estados distintos de `COLECCIÓN` y `BUSCADA` y valores no booleanos para `observada`. El filtro `nombre` SHALL realizar coincidencias parciales insensibles a mayúsculas y acentos.

#### Scenario: Filtro por nombre
- **WHEN** el cliente envía un filtro `nombre` con una parte del nombre
- **THEN** el sistema devuelve las figuras cuyo nombre contiene esa parte sin distinguir mayúsculas ni acentos

#### Scenario: Filtro válido
- **WHEN** el cliente envía uno o más filtros válidos
- **THEN** el sistema devuelve solo las minifiguras coincidentes con HTTP `200`

#### Scenario: Filtro por id
- **WHEN** el cliente envía un filtro `id` con un texto parcial o completo
- **THEN** el sistema devuelve solo las minifiguras cuyo `id` coincide

#### Scenario: Filtro por subcategoría sin categoría
- **WHEN** el cliente envía `subcategoria` sin `categoria`
- **THEN** el sistema devuelve solo las minifiguras cuya `subcategoria` coincide
- **AND** no exige `categoria`

#### Scenario: Filtro por observadas
- **WHEN** el cliente envía `observada=true`
- **THEN** el sistema devuelve únicamente figuras con `observada: true`

#### Scenario: Filtro de observación inválido
- **WHEN** el cliente envía un valor de `observada` distinto de `true` o `false`
- **THEN** el sistema responde con HTTP `400`
- **AND** identifica el parámetro inválido

#### Scenario: Estado de filtro inválido
- **WHEN** el cliente envía un `estadoColeccion` distinto de los estados permitidos
- **THEN** el sistema responde con HTTP `400`
- **AND** identifica el parámetro inválido

### Requirement: Gestionar el catálogo mediante CRUD
El sistema SHALL permitir crear, reemplazar y eliminar minifiguras mediante `POST /minifiguras`, `PUT /minifiguras/:id` y `DELETE /minifiguras/:id`, manteniendo el orden y la persistencia atómica. Los campos planos enviados SHALL validarse contra el modelo permitido. Al crear, reemplazar o procesar cualquier minifigura, el ID SHALL persistirse como `id.toUpperCase().trim()`. Los identificadores de ruta y los duplicados SHALL compararse tras esa normalización.

#### Scenario: Normalizar ID al crear
- **WHEN** el cliente crea una figura con un ID con espacios o minúsculas
- **THEN** el sistema responde con HTTP `201`
- **AND** persiste y devuelve el ID en mayúsculas y sin espacios

#### Scenario: Crear una minifigura válida
- **WHEN** el cliente envía una minifigura válida con un ID no usado
- **THEN** el sistema responde con HTTP `201` y persiste la figura

#### Scenario: Detectar duplicado normalizado
- **WHEN** el cliente crea una figura cuyo ID normalizado ya existe
- **THEN** el sistema responde con HTTP `409`
- **AND** no modifica el catálogo

#### Scenario: Rechazar ID duplicado
- **WHEN** el cliente intenta crear una minifigura con un ID existente
- **THEN** el sistema responde con HTTP `409`
- **AND** no modifica el catálogo

#### Scenario: Reemplazar por ruta normalizada
- **WHEN** el cliente reemplaza una figura usando una variante de mayúsculas o espacios del ID de ruta
- **THEN** el sistema actualiza la figura canónica conservando su posición y `FechaRegistro`

#### Scenario: Reemplazar una minifigura existente
- **WHEN** el cliente envía un reemplazo válido con el mismo ID de la ruta
- **THEN** el sistema responde con HTTP `200`
- **AND** conserva la posición de la figura

#### Scenario: Eliminar una minifigura existente
- **WHEN** el cliente solicita `DELETE /minifiguras/:id` para una figura existente
- **THEN** el sistema responde con HTTP `204`
- **AND** elimina la figura del catálogo

## ADDED Requirements

### Requirement: Gestionar minifiguras en observación
El sistema SHALL permitir marcar o desmarcar como observada cualquier minifigura en estado `COLECCIÓN` o `BUSCADA`. El catálogo SHALL contener como máximo 10 figuras observadas; superar ese límite SHALL rechazarse sin persistir cambios y SHALL permitir a la interfaz mostrar el mensaje de límite acordado.

#### Scenario: Marcar una figura dentro del límite
- **WHEN** se marca como observada una figura no observada y hay menos de 10 observadas
- **THEN** la operación persiste `observada: true`
- **AND** conserva el resto de los campos de la figura

#### Scenario: Rechazar la undécima observada
- **WHEN** se intenta marcar una figura y ya existen 10 observadas
- **THEN** la operación responde con un error controlado
- **AND** la figura permanece con `observada: false`

#### Scenario: Desmarcar una figura
- **WHEN** se desmarca una figura observada
- **THEN** la operación persiste `observada: false`
- **AND** libera el cupo sin modificar otros datos

### Requirement: Migrar y validar el estado de observación
El sistema SHALL aceptar únicamente `observada` booleano cuando esté presente y SHALL migrar de forma persistente los registros que no lo tengan a `false`, sin cambiar sus IDs ni el orden del catálogo.

#### Scenario: Migración de registros existentes
- **WHEN** se lee un catálogo válido que carece de `observada`
- **THEN** cada registro recibe `observada: false`
- **AND** la migración se persiste de forma atómica y solo una vez

#### Scenario: Rechazar tipo inválido
- **WHEN** el catálogo o una operación contiene `observada` con un tipo distinto de booleano
- **THEN** el sistema responde con error de catálogo o de minifigura inválida
- **AND** no persiste el cambio inválido
