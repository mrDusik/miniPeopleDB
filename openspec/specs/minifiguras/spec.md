## Purpose

Permite exponer y validar el catálogo de minifiguras desde archivos JSON locales, asegurando respuestas consistentes y pruebas reproducibles.

## Requirements

### Requirement: Listar minifiguras desde persistencia local
El sistema SHALL exponer `GET /minifiguras` y SHALL obtener la colección desde un archivo JSON local, sin depender de una base de datos o servicio externo.

#### Scenario: Catálogo con minifiguras disponibles
- **WHEN** un cliente realiza `GET /minifiguras` y el archivo JSON contiene una colección válida
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo es JSON con un arreglo de minifiguras
- **AND** cada minifigura incluye al menos `id`, `nombre` y `descripcion`

#### Scenario: Catálogo vacío
- **WHEN** un cliente realiza `GET /minifiguras` y el archivo JSON contiene una colección vacía
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo contiene un arreglo vacío

### Requirement: Validar y reportar errores de persistencia
El sistema SHALL validar que el archivo JSON tenga la estructura de colección esperada y SHALL comunicar los errores de lectura o formato mediante respuestas HTTP consistentes.

#### Scenario: Archivo de catálogo inexistente
- **WHEN** un cliente realiza `GET /minifiguras` y el archivo JSON no existe
- **THEN** el sistema responde con HTTP `500`
- **AND** el cuerpo JSON identifica un error interno de persistencia sin exponer rutas del sistema ni detalles sensibles

#### Scenario: Archivo de catálogo con JSON inválido o estructura incorrecta
- **WHEN** un cliente realiza `GET /minifiguras` y el archivo no puede interpretarse como una colección válida de minifiguras
- **THEN** el sistema responde con HTTP `500`
- **AND** el cuerpo JSON identifica un error de catálogo inválido sin incluir el contenido bruto del archivo

### Requirement: Mantener datos locales reproducibles
La implementación SHALL incluir un archivo JSON inicial válido y SHALL permitir que las pruebas sustituyan o aíslen la ubicación del archivo sin modificar el código de producción.

#### Scenario: Lectura repetida del catálogo
- **WHEN** se realizan dos solicitudes consecutivas sin cambiar el archivo JSON
- **THEN** ambas respuestas contienen la misma colección y el mismo orden de elementos
