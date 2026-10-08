# Spec Delta

## Purpose

Permitir comparar el progreso neto de Bricks durante la semana actual usando mediciones nocturnas, mediante un ranking publico acotado y un modal independiente del ranking global.

## ADDED Requirements

### Requirement: Calcular el ranking semanal desde snapshots

El sistema SHALL clasificar como maximo diez usuarios por Bricks semanales, definidos como Bricks del ultimo snapshot disponible de la semana actual menos Bricks del snapshot del domingo anterior. La semana SHALL comenzar el lunes y terminar el domingo segun Europe/Madrid. Solo SHALL participar usuarios con ambas mediciones; la ausencia de base no SHALL sustituirse por cero ni por una fecha anterior distinta. Los snapshots posteriores a hoy en Madrid no SHALL participar. Los resultados SHALL ordenarse por diferencia descendente y, en empate, por identificador de usuario ascendente, sin favorecer el nivel o saldo global. El limite SHALL aplicarse despues de calcular y ordenar todos los candidatos. SHALL conservar diferencias positivas, cero y negativas, incluyendo regalos y variaciones de precios o reglas presentes en las mediciones. No SHALL consultar el saldo actual como sustituto del ultimo snapshot.

#### Scenario: Menor saldo global pero mayor progreso
- **WHEN** Ana pasa de 12000 a 12450 Bricks y Luis pasa de 800 a 1500 durante la semana
- **THEN** Luis aparece antes de Ana con 700 Bricks semanales frente a 450

#### Scenario: Descensos y empates
- **WHEN** existen diferencias negativas y dos usuarios tienen la misma diferencia
- **THEN** se mantienen los valores negativos y el empate se resuelve por identificador, independientemente del nivel global

#### Scenario: Base ausente y snapshots futuros
- **WHEN** un usuario carece del snapshot del domingo anterior o solo tiene mediciones futuras
- **THEN** no participa y no se inventa una base cero

#### Scenario: Cambio de semana
- **WHEN** llega el lunes en Madrid, incluyendo semanas con cambio de horario
- **THEN** se usa el domingo inmediatamente anterior como nueva base y se excluyen mediciones de la semana anterior del valor final

#### Scenario: Top diez sobre todos los usuarios
- **WHEN** el mayor incremento pertenece a un usuario fuera del Top 10 global
- **THEN** ese usuario puede encabezar el semanal y la consulta no se limita previamente a los participantes del global

### Requirement: Activar el semanal el lunes acordado

El ranking semanal SHALL estar inactivo antes de 2026-10-12 en Europe/Madrid. La disponibilidad SHALL decidirse en el backend sin depender del reloj del navegador. Desde esa fecha SHALL activarse automaticamente para la semana actual cuando exista al menos un candidato con base y medicion semanal. Sin candidatos comparables SHALL mantenerse no disponible. No SHALL borrar Bricks, modificar snapshots ni ejecutar resets semanales. La captura nocturna SHALL continuar sin modificaciones y SHALL ser la fuente de nuevas diferencias.

#### Scenario: Consulta antes del estreno
- **WHEN** se abre el semanal el 2026-10-08 aunque existan snapshots previos
- **THEN** aparece exactamente `No disponible` y no hay filas de clasificacion

#### Scenario: Primera captura semanal
- **WHEN** es 2026-10-12 en Madrid y existe el snapshot de 2026-10-11 y una captura de 2026-10-12
- **THEN** se muestra automaticamente la diferencia sin cambiar los Bricks globales

#### Scenario: Lunes antes de disponer de captura
- **WHEN** ha comenzado el lunes pero todavia no existe ningun snapshot comparable de esa semana
- **THEN** el modal muestra `No disponible` sin reutilizar la clasificacion de la semana anterior

### Requirement: Consultar solo una proyeccion publica autorizada

El sistema SHALL exponer `GET /api/ranking/semanal` con JWT ordinario y sin parametros de usuario, fecha, semana ni criterio. Sin sesion SHALL responder 401; un metodo distinto de GET SHALL responder 405 con Allow GET; parametros de consulta SHALL responder 400 con `PARAMETRO_INVALIDO`. Una lectura correcta SHALL responder 200 con `{ available, availableFrom, weekStart, weekEnd, entries }`. `availableFrom` SHALL ser `2026-10-12`; las fechas SHALL usar YYYY-MM-DD. Si `available` es false, `entries` SHALL ser vacio. Cada entrada SHALL incluir el contrato publico del ranking global por Nivel y ademas `bricksSemanales` y `snapshotDate`; `bricks` SHALL seguir representando el saldo global y la UI semanal SHALL usar `bricksSemanales` como cifra principal. No SHALL exponer el saldo base, snapshots completos, correos, precios de compra ni distribucion DNA completa. Los fallos de almacenamiento SHALL devolver 500 con `RANKING_SEMANAL_NO_DISPONIBLE`, sin detalles internos ni exito aparente. Las consultas ordinarias SHALL usar anon mas JWT y nunca service_role. RLS del historico personal SHALL mantenerse intacta.

#### Scenario: Proyeccion publica sin abrir historicos
- **WHEN** un usuario autenticado consulta el ranking semanal
- **THEN** recibe hasta diez entradas publicas y no puede consultar snapshots individuales ajenos mediante lectura directa

#### Scenario: Intento de elegir usuario o semana
- **WHEN** se envia userId, fecha, semana o criterio en la URL
- **THEN** la API rechaza los parametros y no ejecuta una consulta global arbitraria

#### Scenario: Fallo real de almacenamiento
- **WHEN** falla la consulta de datos
- **THEN** la API responde 500 con el codigo controlado y el modal muestra un estado de error distinto de `No disponible`

### Requirement: Abrir un modal semanal independiente con el aspecto del global

El desplegable de nivel SHALL tener los botones `Ranking Global` y `Ranking Semanal` en la misma fila, con el mismo ancho. El semanal SHALL llevar el emoji calendario U+1F5D3 con selector emoji U+FE0F solicitado por el usuario. Ambos SHALL indicar el dialogo que abren de forma accesible. El modal semanal SHALL ser independiente, titularse `Ranking Semanal` y conservar el aspecto del global: dimensiones, encabezado, linea azul, boton Cerrar, tipografia, filas, avatar, nivel, DNA publico, recuento, destacado de usuario propio, detalles de Top 5 y regalos. No SHALL incluir selectores de criterio ni un selector Global/Semanal dentro del modal. Su cifra principal SHALL ser Bricks semanales con signo positivo cuando corresponda; los negativos SHALL permanecer visibles. El indicador principal de Top Global SHALL seguir representando el ranking global por Nivel.

#### Scenario: Accesos adyacentes
- **WHEN** se despliega el panel de nivel en escritorio o movil
- **THEN** ambos accesos aparecen en una sola fila con igual ancho, texto legible y sin solaparse

#### Scenario: Apertura independiente
- **WHEN** se pulsa Ranking Semanal
- **THEN** se abre su propio dialogo con el aspecto del global, sin los seis selectores y sin modificar su criterio seleccionado

#### Scenario: Regalo y destacados
- **WHEN** se despliega una fila semanal y se envia un regalo valido
- **THEN** se mantienen destacados y controles del global, el regalo no se duplica y los Bricks semanales no cambian hasta que una nueva medicion lo refleje

### Requirement: Aislar estados, peticiones y foco del modal semanal

El semanal SHALL mostrar carga, no disponibilidad o error segun la respuesta de su propia consulta. SHALL cargar nuevamente al abrir, ignorar respuestas obsoletas tras cierre, reapertura o cambio de cuenta y borrar datos al cerrar sesion. Cerrar mediante boton o Escape SHALL devolver el foco al acceso semanal. La seleccion, expansion, peticiones y estado del global SHALL permanecer independientes y no SHALL poblarse desde respuestas del semanal.

#### Scenario: Respuesta tardia tras cambiar cuenta
- **WHEN** una respuesta llega despues de cerrar sesion o cambiar de usuario
- **THEN** no se renderizan datos de la cuenta anterior ni se cambia el indicador global

#### Scenario: Cierre por teclado
- **WHEN** el usuario pulsa Escape en el modal semanal
- **THEN** se cierra y el foco vuelve a Ranking Semanal