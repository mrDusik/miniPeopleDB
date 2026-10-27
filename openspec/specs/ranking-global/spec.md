# ranking-global Specification

## Purpose

Permite comparar de forma segura el progreso público de los coleccionistas y reconocer sus colecciones mediante regalos únicos de Bricks.

## Requirements

### Requirement: Consultar el ranking global

El sistema SHALL exponer `GET /api/ranking` para usuarios autenticados. La membresía SHALL ser siempre el Top 10 por Nivel y Bricks; los criterios alternativos SHALL reordenar únicamente esos mismos usuarios y no SHALL incorporar usuarios fuera del Top 10 por Nivel. El parámetro opcional `criterio` SHALL aceptar exclusivamente `nivel` (por defecto), `coleccion`, `rarityHunter`, `collector`, `explorer` y `fan`; los valores inválidos, vacíos o repetidos SHALL devolver `400` con `{ "error": "PARAMETRO_INVALIDO", "parametro": "criterio" }`. Nivel SHALL ordenar por nivel descendente y Bricks descendente, Colección por número de figuras en estado `COLECCIÓN` descendente, y cada rasgo por su porcentaje DNA completo descendente, usando cero para Newbie. Todos los criterios SHALL desempatar por nivel descendente, Bricks descendente y finalmente `user_id` ascendente. Cada entrada SHALL incluir `userId`, `avatarUrl`, `displayName`, `bricks`, `nivel`, `nombreNivel`, `imagenNivel`, `totalColeccion` y `regaloEnviado`, sin exponer correo ni otros metadatos privados.

El modal SHALL incluir un grupo de botones segmentados alineado a la izquierda encima de las filas del ranking, con las etiquetas exactas Nivel, Colección, Rarity Hunter, Collector, Explorer y Fan, sin aclaraciones entre paréntesis. El criterio seleccionado SHALL indicarse con `aria-pressed="true"`; los demás SHALL tener `aria-pressed="false"`. Cada cambio SHALL solicitar el Top 10 del criterio elegido e ignorar respuestas anteriores que lleguen tarde. El indicador de posición del panel principal SHALL conservar el criterio Nivel. El cierre de sesión SHALL restaurar Nivel.

#### Scenario: Elegir un criterio alternativo
- **WHEN** el usuario activa el botón segmentado Colección o un rasgo DNA
- **THEN** el modal reordena según ese criterio únicamente los diez usuarios que ya pertenecen al Top 10 por Nivel
- **AND** ningún usuario fuera del Top 10 por Nivel aparece aunque puntúe más alto en el criterio alternativo
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

### Requirement: Distribuir los criterios a ancho completo en portrait

En orientacion portrait, el grupo de seis criterios del modal Ranking Global SHALL ocupar el mismo ancho util que la linea azul de su encabezado. Todos los botones SHALL tener igual ancho, sin desplazamiento horizontal ni recorte de texto. En pantallas donde seis columnas no permitan leer las etiquetas, SHALL distribuirse en filas manteniendo columnas de igual ancho y cubriendo todo el ancho util. Se SHALL conservar las etiquetas, aria-pressed, criterios, orden del Top 10 y comportamiento landscape existentes. Este ajuste no SHALL introducir selectores en el modal semanal.

#### Scenario: Movil portrait
- **WHEN** se abre el global en un viewport portrait estrecho
- **THEN** los seis criterios se distribuyen con igual ancho, el grupo cubre la linea azul y no hay scroll horizontal ni textos solapados

#### Scenario: Tablet portrait y landscape
- **WHEN** se abre el global en tablet portrait y despues en landscape
- **THEN** portrait mantiene igual ancho y ancho completo, mientras landscape conserva su comportamiento actual

### Requirement: Consultar los destacados de cada colección clasificada

Cada entrada de `GET /api/ranking` SHALL incluir `top5Precio` y `top5Antiguedad`, limitados a minifiguras del usuario en estado `COLECCIÓN`. `top5Precio` SHALL usar exactamente el orden y los desempates de `top5` en la valoración de la colección, y `top5Antiguedad` SHALL usar exactamente el orden y los desempates de `top5Antiguas`. Cada elemento SHALL limitarse a los datos necesarios para renderizar la misma imagen, texto y tooltip que en la pantalla principal. En landscape, las filas expandidas de los modales Global y Semanal SHALL mostrar como máximo tres elementos de cada grupo; en portrait SHALL mostrar como máximo cinco.

#### Scenario: Usuario con más de cinco minifiguras en colección
- **WHEN** un usuario clasificado tiene más de cinco minifiguras en `COLECCIÓN`
- **THEN** `top5Precio` contiene las cinco primeras según el criterio de valoración vigente
- **AND** `top5Antiguedad` contiene las cinco primeras según el criterio de antigüedad vigente

#### Scenario: Minifiguras buscadas
- **WHEN** un usuario clasificado tiene minifiguras en estado `BUSCADA`
- **THEN** esas minifiguras no cuentan en `totalColeccion` ni aparecen en ninguno de los dos Top 5

### Requirement: Enviar un regalo único de Bricks

El sistema SHALL conservar `POST /api/ranking/regalar` con JWT y cuerpo `{ "receptorId": <uuid> }`. Una donacion valida SHALL registrar atomicamente pareja, fecha, 50 Bricks directos del receptor, hitos V2 resultantes, nivel, progreso y notificacion, sin reducir el saldo del donante. El saldo final SHALL incluir ademas los hitos V2 que se crucen, sin duplicar el importe directo. La unicidad por pareja SHALL regir dentro del ledger vigente V2; las parejas consumidas V1 SHALL resetearse una sola vez.

#### Scenario: Regalo válido
- **WHEN** un usuario autenticado regala a un receptor existente distinto de si mismo sin regalo previo en el ledger V2
- **THEN** recibe 200 y se registra una donacion con fecha
- **AND** el receptor suma exactamente 50 Bricks directos mas los nuevos hitos que correspondan, sin alterar el saldo del donante

#### Scenario: Autorregalo
- **WHEN** receptorId es el usuario autenticado
- **THEN** responde 400 AUTORREGALO_NO_PERMITIDO sin cambios

#### Scenario: Regalo repetido
- **WHEN** ya existe regalo V2 de la misma pareja
- **THEN** responde 409 REGALO_YA_ENVIADO sin incrementar saldo ni hitos

#### Scenario: Receptor inexistente
- **WHEN** receptorId no identifica un usuario con gamificacion
- **THEN** responde 404 RECEPTOR_NO_ENCONTRADO sin registrar donacion

### Requirement: Registrar el logro de regalo

Cada regalo global V2 SHALL incrementar el contador unificado de regalos recibidos, junto con los semanales, y reevaluar los dos hitos no repetibles de `logros-v2`: primer regalo por 20 Bricks y diez regalos por 100, acumulativos. Los 50 Bricks directos SHALL mantenerse aparte; SHALL NOT recrearse Your collection is top! ni su ID V1. Un recalcule SHALL preservar ledger V2 e hitos vigentes sin convertir cada regalo en una concesion repetible. Las fuentes V1 SHALL eliminarse durante la migracion, no retitularse como V2.

#### Scenario: Primer regalo recibido
- **WHEN** una cuenta sin otras recompensas recibe el primer regalo V2 global
- **THEN** obtiene 70 Bricks, un hito tipo regalo de cantidad 1 y total 20, y ningun logro repetible V1

#### Scenario: Regalos de distintos donantes
- **WHEN** una cuenta recibe dos regalos globales V2 de donantes diferentes
- **THEN** conserva el primer hito con cantidad 1 y 20 Bricks, mas 100 Bricks directos
- **AND** el hito de diez solo se obtiene al alcanzar diez regalos combinados

### Requirement: Notificar regalos y procesar agradecimientos

Una donacion confirmada SHALL crear atomicamente una notificacion agradecible para el receptor, identificando al donante por username y el importe directo de 50. El receptor SHALL poder agradecer cada regalo V2 una sola vez. SHALL mantenerse el pago directo existente de 5 Bricks al donante y su notificacion, pero SHALL eliminarse el logro V1 adicional repetible por recibir las gracias. Los nuevos hitos por agradecer SHALL corresponder al emisor de las gracias, segun `logros-v2`, por la primera y decima accion confirmada. Esta regla SHALL aplicarse tambien al agradecimiento de regalos semanales, sin premios por accion adicionales no definidos en V2.

#### Scenario: Donacion confirmada
- **WHEN** POST /api/ranking/regalar confirma un regalo
- **THEN** hay una notificacion con username e importe directo 50
- **AND** un fallo del evento revierte el regalo y sus consecuencias

#### Scenario: Recompensar un agradecimiento
- **WHEN** el receptor agradece por primera vez un regalo V2 valido
- **THEN** el donante obtiene 5 Bricks directos y una notificacion, sin logro repetible V1
- **AND** quien agradece obtiene su hito V2 de 5 Bricks si aun no lo tenia

#### Scenario: Solicitud duplicada o ajena
- **WHEN** se repite el agradecimiento o pertenece a un regalo ajeno
- **THEN** no se conceden Bricks, hitos ni notificaciones adicionales
