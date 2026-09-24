## Purpose

Permite exponer, validar y mantener el catálogo de minifiguras en un archivo JSON local, incluyendo datos opcionales de compra y valoración en Euros.

## Requirements

### Requirement: Listar minifiguras desde persistencia local

El sistema SHALL exponer `GET /minifiguras` y SHALL obtener la colección desde un archivo JSON local, sin depender de una base de datos ni de la disponibilidad de Brickset. Cada minifigura SHALL conservar en su raíz los campos opcionales `precioCompra`, `fechaCompra` y `precio`, todos expresados en Euros, y su `estadoColeccion` SHALL ser `COLECCIÓN` o `BUSCADA`. Cada minifigura SHALL identificar su categoría oficial mediante el campo `categoria` y, opcionalmente, su subcategoría oficial mediante el campo `subcategoria`.

#### Scenario: Catálogo con minifiguras disponibles
- **WHEN** un cliente realiza `GET /minifiguras` y el archivo JSON contiene una colección válida
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo es JSON con un arreglo de minifiguras
	- **AND** cada minifigura incluye al menos `id`, `nombre` y `FechaRegistro`
- **AND** los campos planos de precio se devuelven sin consultar Brickset

#### Scenario: Catálogo vacío
- **WHEN** un cliente realiza `GET /minifiguras` y el archivo JSON contiene una colección vacía
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo contiene un arreglo vacío

### Requirement: Validar y reportar errores de persistencia

El sistema SHALL validar que el archivo JSON tenga la estructura de colección esperada y SHALL validar los campos opcionales de precio y fecha cuando estén presentes. Los importes SHALL ser números finitos no negativos, `fechaCompra` SHALL usar `YYYY-MM-DD` como fecha real y no SHALL permitirse campos anidados o propiedades fuera del modelo plano. Los errores de lectura o formato SHALL comunicarse mediante respuestas HTTP consistentes.

#### Scenario: Archivo de catálogo inexistente
- **WHEN** un cliente realiza `GET /minifiguras` y el archivo JSON no existe
- **THEN** el sistema responde con HTTP `500`
- **AND** el cuerpo JSON identifica un error interno de persistencia sin exponer rutas del sistema ni detalles sensibles

#### Scenario: Archivo de catálogo con JSON inválido o estructura incorrecta
- **WHEN** un cliente realiza `GET /minifiguras` y el archivo no puede interpretarse como una colección válida o contiene campos de precio inválidos
- **THEN** el sistema responde con HTTP `500`
- **AND** el cuerpo JSON identifica un error de catálogo inválido sin incluir el contenido bruto del archivo

### Requirement: Mantener datos locales reproducibles

La implementación SHALL incluir un archivo JSON inicial válido y SHALL permitir que las pruebas sustituyan o aíslen la ubicación del archivo. Las actualizaciones de precios SHALL persistir cambios de forma atómica.

#### Scenario: Lectura repetida del catálogo
- **WHEN** se realizan dos solicitudes consecutivas sin cambiar el archivo JSON
- **THEN** ambas respuestas contienen la misma colección y el mismo orden de elementos

#### Scenario: Fallo al persistir una actualización de precios
- **WHEN** una actualización de precios no puede reemplazar el archivo local
- **THEN** el sistema informa un error controlado
- **AND** el archivo anterior permanece legible y sin datos parcialmente escritos

### Requirement: Permitir descripción y año ausentes

El sistema SHALL aceptar minifiguras sin `descripcion` y sin `anio`. Cuando Brickset devuelva el año `0`, la aplicación SHALL tratarlo como ausente y SHALL dejar vacío el campo Año del formulario.

#### Scenario: Crear sin descripción ni año
- **WHEN** se crea o edita una minifigura sin `descripcion` o sin `anio`
- **THEN** la operación se completa correctamente
- **AND** esos campos permanecen ausentes o vacíos

#### Scenario: Brickset devuelve año cero
- **WHEN** Brickset devuelve `0` como año de lanzamiento
- **THEN** la API no incluye un año válido para ese resultado
- **AND** el formulario deja vacío el campo Año

### Requirement: Registrar y ordenar por fecha de alta

Cada minifigura SHALL conservar un campo `FechaRegistro` con una marca temporal ISO de su alta. Las altas nuevas SHALL generarlo automáticamente y las ediciones SHALL conservarlo. Los registros antiguos sin ese campo SHALL migrarse una sola vez a marcas persistidas. La interfaz SHALL ordenar la tabla por `FechaRegistro` descendente por defecto y no SHALL mostrar esa columna.

#### Scenario: Alta y edición conservan FechaRegistro
- **WHEN** se crea una minifigura y posteriormente se edita
- **THEN** la alta incluye `FechaRegistro`
- **AND** la edición conserva exactamente la misma marca

#### Scenario: Orden por alta más reciente
- **WHEN** se muestra la tabla sin una ordenación manual
- **THEN** las minifiguras aparecen de `FechaRegistro` más reciente a más antigua
- **AND** `FechaRegistro` no se muestra como columna

### Requirement: Restringir el estado de la minifigura

El sistema SHALL aceptar únicamente los estados `COLECCIÓN` y `BUSCADA`. Cuando una creación o edición no proporcione `estadoColeccion` o lo reciba vacío, SHALL persistir `COLECCIÓN` como valor por defecto.

#### Scenario: Estado permitido
- **WHEN** se crea o actualiza una minifigura con estado `COLECCIÓN` o `BUSCADA`
- **THEN** la operación se completa correctamente
- **AND** conserva el estado recibido

#### Scenario: Estado no permitido
- **WHEN** una solicitud contiene un estado distinto de `COLECCIÓN` o `BUSCADA`
- **THEN** el sistema responde con HTTP `400`
- **AND** no modifica el catálogo

#### Scenario: Creación sin estado
- **WHEN** se crea una minifigura sin `estadoColeccion` o con valor vacío
- **THEN** el sistema persiste el estado `COLECCIÓN`

### Requirement: Filtrar minifiguras por características

El sistema SHALL permitir filtrar `GET /minifiguras` por `id`, `categoria`, `subcategoria`, `anio` y `estadoColeccion`, rechazando estados de filtro distintos de `COLECCIÓN` y `BUSCADA`.

#### Scenario: Filtro válido
- **WHEN** el cliente envía uno o más filtros válidos
- **THEN** el sistema devuelve solo las minifiguras coincidentes con HTTP `200`

#### Scenario: Filtro por id
- **WHEN** el cliente envía un filtro `id` con un texto parcial o completo
- **THEN** el sistema devuelve solo las minifiguras cuyo `id` coincide

#### Scenario: Filtro por subcategoría sin categoría
- **WHEN** el cliente envía `subcategoria` sin `categoria`
- **THEN** el sistema devuelve solo las minifiguras cuya `subcategoria` coincide, sin exigir `categoria`

#### Scenario: Estado de filtro inválido
- **WHEN** el cliente envía un `estadoColeccion` distinto de los estados permitidos
- **THEN** el sistema responde con HTTP `400`
- **AND** identifica el parámetro inválido

### Requirement: Mantener la coherencia entre categoría y subcategoría

Cuando una minifigura declare `subcategoria`, el sistema SHALL validar que su `categoria` exista en el catálogo local de categorías y que la `subcategoria` indicada pertenezca a esa `categoria`. Una minifigura cuya `categoria` no tenga subcategorías registradas no SHALL declarar `subcategoria`.

#### Scenario: Categoría y subcategoría coherentes
- **WHEN** se crea o actualiza una minifigura con una `subcategoria` que pertenece a la `categoria` indicada
- **THEN** la operación se completa correctamente

#### Scenario: Subcategoría de otra categoría
- **WHEN** se crea o actualiza una minifigura cuya `subcategoria` no pertenece a la `categoria` indicada
- **THEN** el sistema responde con HTTP `400`
- **AND** no modifica el catálogo

#### Scenario: Subcategoría sin categoría con subcategorías registradas
- **WHEN** se crea o actualiza una minifigura sin `subcategoria` aunque su `categoria` tenga subcategorías registradas
- **THEN** la operación se completa correctamente, ya que `subcategoria` es siempre opcional

### Requirement: Gestionar el catálogo mediante CRUD

El sistema SHALL permitir crear, reemplazar y eliminar minifiguras mediante `POST /minifiguras`, `PUT /minifiguras/:id` y `DELETE /minifiguras/:id`, manteniendo el orden y la persistencia atómica. Los campos planos enviados SHALL validarse contra el modelo permitido.

#### Scenario: Crear una minifigura válida
- **WHEN** el cliente envía una minifigura válida con un ID no usado
- **THEN** el sistema responde con HTTP `201` y persiste la figura

#### Scenario: Rechazar ID duplicado
- **WHEN** el cliente intenta crear una minifigura con un ID existente
- **THEN** el sistema responde con HTTP `409`
- **AND** no modifica el catálogo

#### Scenario: Reemplazar una minifigura existente
- **WHEN** el cliente envía un reemplazo válido con el mismo ID de la ruta
- **THEN** el sistema responde con HTTP `200`
- **AND** conserva la posición de la figura

#### Scenario: Eliminar una minifigura existente
- **WHEN** el cliente solicita `DELETE /minifiguras/:id` para una figura existente
- **THEN** el sistema responde con HTTP `204`
- **AND** elimina la figura del catálogo
