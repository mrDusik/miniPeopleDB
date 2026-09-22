# Spec Delta

## MODIFIED Requirements

### Requirement: Listar minifiguras desde persistencia local

El sistema SHALL exponer `GET /minifiguras` y SHALL obtener la colección desde un archivo JSON local, sin depender de una base de datos ni de la disponibilidad de Brickset. Cuando existan, cada minifigura SHALL conservar en su raíz los campos opcionales `precioCompra`, `fechaCompra` y `precio`, todos expresados en Euros, y su `estadoColeccion` SHALL ser `COLECCIÓN` o `BUSCADA`.

#### Scenario: Catálogo con minifiguras disponibles

- **WHEN** un cliente realiza `GET /minifiguras` y el archivo JSON contiene una colección válida
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo es JSON con un arreglo de minifiguras
- **AND** cada minifigura incluye al menos `id`, `nombre` y `descripcion`
- **AND** los campos planos de precio se devuelven sin consultar Brickset

#### Scenario: Catálogo vacío

- **WHEN** un cliente realiza `GET /minifiguras` y el archivo JSON contiene una colección vacía
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo contiene un arreglo vacío

### Requirement: Validar y reportar errores de persistencia

El sistema SHALL validar que el archivo JSON tenga la estructura de colección esperada y SHALL validar, cuando estén presentes, que `precioCompra` y `precio` sean números finitos no negativos y que `fechaCompra` sea una cadena con formato `YYYY-MM-DD`. Los errores de lectura o formato SHALL comunicarse mediante respuestas HTTP consistentes.

#### Scenario: Archivo de catálogo inexistente

- **WHEN** un cliente realiza `GET /minifiguras` y el archivo JSON no existe
- **THEN** el sistema responde con HTTP `500`
- **AND** el cuerpo JSON identifica un error interno de persistencia sin exponer rutas del sistema ni detalles sensibles

#### Scenario: Archivo de catálogo con JSON inválido o estructura incorrecta

- **WHEN** un cliente realiza `GET /minifiguras` y el archivo no puede interpretarse como una colección válida de minifiguras o contiene campos de precio inválidos
- **THEN** el sistema responde con HTTP `500`
- **AND** el cuerpo JSON identifica un error de catálogo inválido sin incluir el contenido bruto del archivo

### Requirement: Mantener datos locales reproducibles

La implementación SHALL incluir un archivo JSON inicial válido y SHALL permitir que las pruebas sustituyan o aíslen la ubicación del archivo sin modificar el código de producción. Las actualizaciones de precios SHALL persistir cambios de forma atómica para que un fallo no deje un JSON parcial.

#### Scenario: Lectura repetida del catálogo

- **WHEN** se realizan dos solicitudes consecutivas sin cambiar el archivo JSON
- **THEN** ambas respuestas contienen la misma colección y el mismo orden de elementos

#### Scenario: Fallo al persistir una actualización de precios

- **WHEN** una actualización de precios no puede reemplazar el archivo local
- **THEN** el sistema informa un error controlado
- **AND** el archivo anterior permanece legible y sin datos parcialmente escritos

## ADDED Requirements

### Requirement: Restringir el estado de la minifigura

El sistema SHALL aceptar únicamente los estados `COLECCIÓN` y `BUSCADA`. Cuando una creación no proporcione `estadoColeccion`, el sistema SHALL persistir `COLECCIÓN` como valor por defecto.

#### Scenario: Estado permitido

- **WHEN** se crea o actualiza una minifigura con estado `COLECCIÓN` o `BUSCADA`
- **THEN** la operación se completa correctamente
- **AND** conserva el estado recibido

#### Scenario: Estado no permitido

- **WHEN** una solicitud contiene un estado distinto de `COLECCIÓN` o `BUSCADA`
- **THEN** el sistema responde con HTTP `400`
- **AND** no modifica el catálogo

#### Scenario: Creación sin estado

- **WHEN** se crea una minifigura sin `estadoColeccion`
- **THEN** el sistema persiste el estado `COLECCIÓN`
