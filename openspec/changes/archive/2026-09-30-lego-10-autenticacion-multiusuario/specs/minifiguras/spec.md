# Spec Delta

## MODIFIED Requirements

### Requirement: Listar minifiguras desde persistencia local

El sistema SHALL exponer `GET /minifiguras` a usuarios autenticados y SHALL obtener la colección del usuario desde la persistencia en Supabase, sin depender de archivos JSON locales ni de la disponibilidad de Brickset. Cada minifigura SHALL conservar en su raíz los campos opcionales `precioCompra`, `fechaCompra` y `precio`, todos expresados en Euros, y su `estadoColeccion` SHALL ser `COLECCIÓN` o `BUSCADA`. Cada minifigura SHALL identificar su categoría oficial mediante `categoria` y, opcionalmente, su subcategoría oficial mediante `subcategoria`. Cada minifigura SHALL incluir el booleano `observada`.

#### Scenario: Catálogo con minifiguras disponibles
- **WHEN** un usuario autenticado realiza `GET /minifiguras` y su colección persistida es válida
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo es JSON con un arreglo de minifiguras
- **AND** cada minifigura incluye al menos `id`, `nombre` y `FechaRegistro`
- **AND** los campos planos de precio se devuelven sin consultar Brickset

#### Scenario: Catálogo con estado de observación
- **WHEN** un usuario autenticado realiza `GET /minifiguras` y su colección persistida es válida
- **THEN** el sistema responde con HTTP `200`
- **AND** cada elemento incluye `id`, `nombre`, `FechaRegistro` y `observada` booleano
- **AND** los campos planos de precio se devuelven sin consultar Brickset

#### Scenario: Catálogo vacío
- **WHEN** un usuario autenticado sin minifiguras realiza `GET /minifiguras`
- **THEN** el sistema responde con HTTP `200`
- **AND** el cuerpo contiene un arreglo vacío

### Requirement: Validar y reportar errores de persistencia

El sistema SHALL validar que cada registro leído de la persistencia cumpla el modelo de minifigura y SHALL validar los campos opcionales de precio y fecha cuando estén presentes. Los importes SHALL ser números finitos no negativos, `fechaCompra` SHALL usar `YYYY-MM-DD` como fecha real y no SHALL permitirse campos anidados o propiedades fuera del modelo plano en las peticiones. Los errores de lectura o formato SHALL comunicarse mediante respuestas HTTP consistentes.

#### Scenario: Archivo de catálogo inexistente
- **WHEN** un usuario autenticado realiza `GET /minifiguras` y Supabase no responde o devuelve un error
- **THEN** el sistema responde con HTTP `500`
- **AND** el cuerpo JSON identifica `CATALOGO_NO_DISPONIBLE` sin exponer URLs, claves ni detalles sensibles

#### Scenario: Archivo de catálogo con JSON inválido o estructura incorrecta
- **WHEN** un usuario autenticado realiza `GET /minifiguras` y alguna fila de Supabase no cumple el modelo o contiene precios inválidos
- **THEN** el sistema responde con HTTP `500`
- **AND** el cuerpo JSON identifica `CATALOGO_INVALIDO` sin incluir el contenido del registro

## REMOVED Requirements

### Requirement: Mantener datos locales reproducibles

**Reason**: El catálogo ya no se guarda en un archivo JSON local; la persistencia es por usuario en Supabase y la escritura atómica la garantiza la base de datos.
**Migration**: El orden estable y el aislamiento en pruebas se cubren con los requisitos "Conservar el contrato de la API" y "Permitir sustituir el cliente de persistencia en pruebas" de `persistencia-supabase`.
