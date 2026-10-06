# ranking-global Specification

## Purpose

Permite comparar de forma segura el progreso público de los coleccionistas y reconocer sus colecciones mediante regalos únicos de Bricks.

## Requirements

### Requirement: Consultar el ranking global

El sistema SHALL exponer `GET /api/ranking` para usuarios autenticados y SHALL devolver como máximo los 10 usuarios mejor clasificados por el criterio elegido, aplicado en Supabase antes del límite. El parámetro opcional `criterio` SHALL aceptar exclusivamente `nivel` (por defecto), `coleccion`, `rarityHunter`, `collector`, `explorer` y `fan`; los valores inválidos, vacíos o repetidos SHALL devolver `400` con `{ "error": "PARAMETRO_INVALIDO", "parametro": "criterio" }`. Nivel SHALL ordenar por nivel descendente y Bricks descendente, Colección por número de figuras en estado `COLECCIÓN` descendente, y cada rasgo por su porcentaje DNA completo descendente, usando cero para Newbie. Todos los criterios SHALL desempatar por nivel descendente, Bricks descendente y finalmente `user_id` ascendente. Cada entrada SHALL incluir `userId`, `avatarUrl`, `displayName`, `bricks`, `nivel`, `nombreNivel`, `imagenNivel`, `totalColeccion` y `regaloEnviado`, sin exponer correo ni otros metadatos privados.

El modal SHALL incluir un selector alineado a la izquierda encima de las filas del ranking, con las etiquetas exactas Nivel, Colección, Rarity Hunter, Collector, Explorer y Fan, sin aclaraciones entre paréntesis. Cada cambio SHALL solicitar el Top 10 del criterio elegido e ignorar respuestas anteriores que lleguen tarde. El indicador de posición del panel principal SHALL conservar el criterio Nivel. El cierre de sesión SHALL restaurar Nivel.

#### Scenario: Elegir un criterio alternativo
- **WHEN** el usuario selecciona Colección o un rasgo DNA
- **THEN** el modal muestra los diez primeros de todos los usuarios según ese criterio, no una reordenación del Top 10 por Nivel
- **AND** la distribución completa de DNA permanece privada incluso si el rasgo elegido no está entre los dos rasgos públicos

#### Scenario: Empatar en un criterio alternativo
- **WHEN** dos usuarios tienen el mismo número de figuras o porcentaje del rasgo elegido
- **THEN** se ordenan por nivel descendente, Bricks descendente y `user_id` ascendente

`imagenNivel` SHALL apuntar a la imagen disponible del nivel en `public/level_images/`; cuando no exista un activo para ese nivel, SHALL usar `/level_images/9_forestman.png`.

Cada entrada SHALL incluir `dnaPrincipal` y `dnaRasgos`, cuyos objetos contienen exclusivamente `nombre` y `porcentaje`. Para Nivel y Colección, `dnaRasgos` SHALL incluir como máximo dos objetos: primero el principal calculado por Supabase y después el rasgo restante de mayor proporción, usando el orden estable Rarity Hunter, Explorer, Collector, Fan en caso de empate del segundo rasgo; Newbie SHALL devolver `dnaRasgos: []`. Para un criterio DNA, `dnaRasgos` SHALL incluir exclusivamente el nombre y porcentaje del rasgo seleccionado, aunque no sea uno de los dos principales; Newbie SHALL devolver ese rasgo con porcentaje cero. Las ponderaciones y la distribución completa de cuatro rasgos SHALL permanecer privadas.

#### Scenario: Mostrar el rasgo DNA seleccionado
- **WHEN** el usuario selecciona Rarity Hunter, Collector, Explorer o Fan
- **THEN** cada fila muestra exclusivamente el porcentaje del rasgo seleccionado seguido de su nombre, conservando el estilo habitual
- **AND** Newbie muestra cero por ciento y el nombre del rasgo seleccionado
- **AND** al volver a Nivel o Colección se restauran los dos rasgos principales o el texto Newbie

#### Scenario: Mostrar los dos rasgos publicos
- **WHEN** se abre el ranking global de un usuario con DNA calculado usando Nivel o Colección
- **THEN** su fila muestra los dos rasgos con el porcentaje antes del nombre, igual que el panel propio y conservando el tamaño actual de 0.68rem
- **AND** el numero y nombre de nivel aparecen en negro
- **AND** los usuarios Newbie muestran solo ese texto, sin porcentajes inventados

#### Scenario: Obtener el Top 10
- **WHEN** un usuario autenticado consulta `GET /api/ranking` y existen más de 10 usuarios con gamificación
- **THEN** recibe `200` con exactamente los 10 primeros según el orden definido
- **AND** cada entrada contiene únicamente los datos públicos del ranking y si el usuario autenticado ya regaló a ese destinatario

#### Scenario: Empate de nivel y Bricks
- **WHEN** dos usuarios tienen el mismo nivel y número de Bricks
- **THEN** aparecen ordenados por `user_id` ascendente de forma estable

#### Scenario: Ranking con menos de 10 usuarios
- **WHEN** existen menos de 10 usuarios con gamificación
- **THEN** la respuesta contiene todos los usuarios disponibles sin rellenar posiciones artificiales

#### Scenario: Imagen de nivel en cada fila
- **WHEN** una fila del ranking muestra el nivel de un usuario
- **THEN** muestra el activo local asociado al ID de ese nivel
- **AND** usa la imagen de Forestman cuando no existe un activo específico

### Requirement: Consultar los destacados de cada colección clasificada

Cada entrada de `GET /api/ranking` SHALL incluir `top5Precio` y `top5Antiguedad`, limitados a minifiguras del usuario en estado `COLECCIÓN`. `top5Precio` SHALL usar exactamente el orden y los desempates de `top5` en la valoración de la colección, y `top5Antiguedad` SHALL usar exactamente el orden y los desempates de `top5Antiguas`. Cada elemento SHALL limitarse a los datos necesarios para renderizar la misma imagen, texto y tooltip que en la pantalla principal.

#### Scenario: Usuario con más de cinco minifiguras en colección
- **WHEN** un usuario clasificado tiene más de cinco minifiguras en `COLECCIÓN`
- **THEN** `top5Precio` contiene las cinco primeras según el criterio de valoración vigente
- **AND** `top5Antiguedad` contiene las cinco primeras según el criterio de antigüedad vigente

#### Scenario: Minifiguras buscadas
- **WHEN** un usuario clasificado tiene minifiguras en estado `BUSCADA`
- **THEN** esas minifiguras no cuentan en `totalColeccion` ni aparecen en ninguno de los dos Top 5

### Requirement: Enviar un regalo único de Bricks

El sistema SHALL exponer `POST /api/ranking/regalar` para usuarios autenticados con un cuerpo `{ "receptorId": <uuid> }`. Una donación válida SHALL registrar de forma atómica la pareja donante-receptor, incrementar en 50 los Bricks del receptor sin reducir los del donante y actualizar el nivel y progreso del receptor conforme a su nuevo saldo.

#### Scenario: Regalo válido
- **WHEN** un usuario autenticado envía un receptor existente distinto de sí mismo al que nunca había regalado
- **THEN** el sistema responde `200`
- **AND** registra una sola donación con su fecha
- **AND** el receptor obtiene exactamente 50 Bricks sin alterar el saldo del donante

#### Scenario: Autorregalo
- **WHEN** el `receptorId` coincide con el usuario autenticado
- **THEN** el sistema responde `400` con `{ "error": "AUTORREGALO_NO_PERMITIDO" }`
- **AND** no modifica ningún saldo ni registro

#### Scenario: Regalo repetido
- **WHEN** el mismo donante ya regaló anteriormente al receptor
- **THEN** el sistema responde `409` con `{ "error": "REGALO_YA_ENVIADO" }`
- **AND** no vuelve a incrementar los Bricks

#### Scenario: Receptor inexistente
- **WHEN** `receptorId` no identifica a un usuario con gamificación
- **THEN** el sistema responde `404` con `{ "error": "RECEPTOR_NO_ENCONTRADO" }`
- **AND** no registra la donación

### Requirement: Registrar el logro de regalo

Cada regalo válido SHALL añadir o incrementar en la gamificación del receptor un logro de tipo `regalo`, con título `Someone liked your collection`, descripción `Has aparecido en el ranking global y te han hecho un regalo.` y una contribución de 50 Bricks por regalo. El logro y sus Bricks SHALL conservarse tras posteriores recálculos de gamificación.

#### Scenario: Primer regalo recibido
- **WHEN** un usuario recibe su primer regalo válido
- **THEN** su estado de gamificación contiene el logro de tipo `regalo` con cantidad 1 y total 50

#### Scenario: Regalos de distintos donantes
- **WHEN** un receptor obtiene regalos válidos de dos donantes diferentes
- **THEN** el logro de regalo tiene cantidad 2 y total 100
- **AND** ambos regalos forman parte de sus Bricks