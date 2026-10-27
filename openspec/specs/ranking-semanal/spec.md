# ranking-semanal Specification

## Purpose

Permitir comparar el progreso neto de Bricks durante la semana actual usando mediciones nocturnas, mediante un ranking publico acotado y un modal independiente del ranking global.

## Requirements

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

El ranking semanal SHALL permanecer inactivo hasta el lunes estrictamente posterior a la fecha del despliegue efectivo V2 en produccion, segun Europe/Madrid. Un despliegue en lunes SHALL activar el lunes de la semana siguiente. El backend SHALL fijar y persistir la fecha una sola vez al activar V2, sin depender del navegador, fecha de propuesta, merge pendiente de desplegar ni cada reinicio del servidor. SHALL sustituirse la fecha fija V1 de 2026-10-12.

Desde availableFrom SHALL estar disponible solo con al menos un candidato con snapshot del domingo inmediatamente anterior y una medicion de la semana actual, ambas V2, sin reutilizar capturas V1 ni base cero. Sin candidatos comparables SHALL mostrar exactamente No disponible y entries vacio. El reset unico de snapshots pertenece a la migracion V2; los cambios de semana ordinarios SHALL NOT borrar Bricks, editar snapshots ni ejecutar resets. Las nuevas diferencias SHALL proceder de la captura nocturna vigente.

#### Scenario: Consulta antes del estreno
- **WHEN** se despliega V2 el viernes 2026-10-23 y se consulta antes del lunes 2026-10-26
- **THEN** aparece No disponible, availableFrom es 2026-10-26 y no hay filas

#### Scenario: Primera captura semanal
- **WHEN** llega el lunes acordado y hay capturas V2 del domingo anterior y de ese lunes
- **THEN** se muestra la diferencia sin contar el reset ni cambiar Bricks globales

#### Scenario: Lunes antes de disponer de captura
- **WHEN** llega el lunes pero falta base dominical o medicion semanal V2
- **THEN** muestra No disponible sin reutilizar otra semana ni inventar ceros

#### Scenario: Despliegue en lunes y reinicio
- **WHEN** V2 se activa el lunes 2026-10-26 y se reinicia el servidor el martes
- **THEN** availableFrom se mantiene en 2026-11-02, sin recalcularla desde el reinicio

### Requirement: Consultar solo una proyeccion publica autorizada

El sistema SHALL conservar GET /api/ranking/semanal con JWT ordinario, sin parametros de usuario, fecha, semana o criterio. Sin sesion SHALL responder 401; otro metodo 405 con Allow GET; query no permitida 400 PARAMETRO_INVALIDO. La respuesta correcta SHALL ser 200 con `{ available, availableFrom, weekStart, weekEnd, entries }`. availableFrom SHALL ser la fecha persistida de activacion V2 en YYYY-MM-DD, no una constante V1; weekStart/weekEnd SHALL ser fechas reales de la semana Madrid. Con available false entries SHALL estar vacio; con true SHALL incluir de uno a diez candidatos comparables.

Cada entrada SHALL conservar la proyeccion publica del global por Nivel mas bricksSemanales y snapshotDate; bricks SHALL seguir siendo el saldo global y la UI SHALL usar bricksSemanales como cifra principal. SHALL NOT exponer base privada, snapshots completos, correos, datos de compra ni DNA completo. Los fallos SHALL responder 500 RANKING_SEMANAL_NO_DISPONIBLE, sin detalles internos ni falsa no disponibilidad. SHALL usar anon mas JWT, nunca service_role, manteniendo RLS historico.

#### Scenario: Proyeccion publica sin abrir historicos
- **WHEN** un usuario autenticado consulta el semanal
- **THEN** recibe hasta diez proyecciones autorizadas y la fecha V2 sin acceso directo a snapshots ajenos

#### Scenario: Intento de elegir usuario o semana
- **WHEN** la URL incluye userId, fecha, semana o criterio
- **THEN** se rechaza sin una consulta global arbitraria

#### Scenario: Fallo real de almacenamiento
- **WHEN** falla la consulta
- **THEN** devuelve 500 RANKING_SEMANAL_NO_DISPONIBLE y la UI distingue error de No disponible

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

### Requirement: Regalar 5 Bricks una vez por semana

Cada fila ajena del semanal SHALL conservar el boton +5, nombre accesible Enviar 5 Bricks, endpoint POST /api/ranking/semanal/regalar y cuerpo solo receptorId. SHALL usar JWT, validar destinatario en el Top 10 semanal disponible y derivar donante y semana Madrid, sin service_role. SHALL permitir una concesion por pareja y semana, independiente del regalo global; SHALL rechazar autorregalos, destinatarios no clasificados, duplicados y carreras sin efectos parciales. regaloEnviado SHALL referirse a esa semana y se renovara al cambiar de semana sin borrar regalos V2 anteriores.

El regalo SHALL conceder 5 Bricks directos y actualizar los hitos V2 de contador combinado, no conceder You're on fire this week! ni ningun logro repetible V1. SHALL crear notificacion gift_received con importe directo 5 y permitir un agradecimiento con las reglas V2 del global. Los recalculos SHALL preservar sus fuentes V2 y las lecturas de logros de usuarios solo clasificados en el semanal SHALL seguir autorizadas. Sus Bricks semanales SHALL cambiar solo cuando una nueva captura refleje el regalo.

#### Scenario: Regalo semanal y global independientes
- **WHEN** se regala a un participante que ya recibio el regalo global del mismo donante
- **THEN** suma 5 Bricks directos, un regalo al contador unificado y los hitos nuevos que correspondan, sin logro V1
- **AND** repetirlo en esa semana responde 409 REGALO_YA_ENVIADO

#### Scenario: Renovacion semanal
- **WHEN** comienza otra semana y el receptor sigue clasificado
- **THEN** puede recibir otro regalo de esa pareja y se mantienen fuentes y recompensas V2 de semanas anteriores

### Requirement: Aislar estados, peticiones y foco del modal semanal

El semanal SHALL mostrar carga, no disponibilidad o error segun la respuesta de su propia consulta. SHALL cargar nuevamente al abrir, ignorar respuestas obsoletas tras cierre, reapertura o cambio de cuenta y borrar datos al cerrar sesion. Cerrar mediante boton o Escape SHALL devolver el foco al acceso semanal. La seleccion, expansion, peticiones y estado del global SHALL permanecer independientes y no SHALL poblarse desde respuestas del semanal.

#### Scenario: Respuesta tardia tras cambiar cuenta
- **WHEN** una respuesta llega despues de cerrar sesion o cambiar de usuario
- **THEN** no se renderizan datos de la cuenta anterior ni se cambia el indicador global

#### Scenario: Cierre por teclado
- **WHEN** el usuario pulsa Escape en el modal semanal
- **THEN** se cierra y el foco vuelve a Ranking Semanal

### Requirement: Notificar transiciones del Ranking Semanal

Cuando el Ranking Semanal este disponible segun su contrato vigente, el sistema SHALL notificar una sola vez la entrada de un usuario al Top 10 con su posicion o su salida del Top 10. Una lectura del ranking SHALL NOT crear ni repetir una transicion. Las notificaciones de movimiento diario SHALL limitarse a usuarios presentes en el ranking en ambas mediciones comparadas.

#### Scenario: Entrada semanal
- **WHEN** una medicion valida incorpora un usuario al Top 10 semanal
- **THEN** se crea una notificacion no leida con el nombre del ranking y la posicion

#### Scenario: Salida semanal
- **WHEN** una medicion valida retira del Top 10 semanal a un usuario que pertenecia a el
- **THEN** se crea una notificacion no leida de salida sin incluir una posicion inventada

#### Scenario: Ranking no disponible o lectura repetida
- **WHEN** el ranking semanal aun no esta disponible o un usuario vuelve a consultar el mismo estado
- **THEN** no se crea una transicion ni se duplica una notificacion existente
