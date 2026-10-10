# analitica-historica Specification

## Purpose

Conserva mediciones diarias privadas de la coleccion, gamificacion y DNA de cada usuario, mediante un proceso nocturno seguro y recuperable, y permite consultar su evolucion por rango temporal.

## Requirements

### Requirement: Autenticar el trigger diario y la consulta de ejecucion

El sistema SHALL ofrecer `POST /api/cron/daily-sync` y `GET /api/cron/daily-sync/:jobId` exclusivamente mediante `Authorization: Bearer <CRON_SECRET>`. Un JWT ordinario de Supabase SHALL NOT sustituir ese secreto. Sin cabecera valida SHALL devolver `401` con `{ "error": "CRON_NO_AUTORIZADO" }`, sin consultas administrativas ni efectos secundarios. Con secreto de servidor ausente SHALL rechazar toda ejecucion con `503 CRON_NO_CONFIGURADO`. Otros metodos SHALL devolver `405`. El secreto y la clave administrativa SHALL NOT aparecer en recursos, respuestas ni logs.

#### Scenario: Cabecera incorrecta
- **WHEN** se llama al inicio o al estado sin bearer, con token incorrecto o con JWT de usuario
- **THEN** responde `401 CRON_NO_AUTORIZADO` sin leer ni escribir datos administrativos

#### Scenario: Configuracion ausente
- **WHEN** el servidor no tiene `CRON_SECRET`
- **THEN** las rutas cron responden `503 CRON_NO_CONFIGURADO` y no ejecutan el trabajo

### Requirement: Ejecutar un trabajo diario durable sin solapamientos

El trigger externo SHALL programarse cada dia a las 04:00 en `Europe/Madrid`, respetando horario de verano. El inicio SHALL fijar una unica fecha logica de Madrid y persistir el trabajo antes de devolver `202` con `{ "jobId": "UUID", "status": "pending|running", "snapshotDate": "YYYY-MM-DD" }`. Una llamada durante un trabajo activo SHALL devolver ese mismo trabajo, sin iniciar otro refresco global. El trabajo SHALL conservar fecha, progreso y resultados ante reinicios; un trabajador interrumpido SHALL poder ser reemplazado sin permitir escrituras tardias del anterior. Una nueva llamada tras completar un trabajo SHALL poder crear otro y actualizar los snapshots del mismo dia sin duplicarlos. El sistema SHALL NOT mantener una peticion HTTP abierta hasta terminar el scraping.

#### Scenario: Peticiones simultaneas
- **WHEN** dos triggers validos llegan mientras no existe otro trabajo activo
- **THEN** ambos identifican un unico trabajo persistido y solo un trabajador realiza sus operaciones

#### Scenario: Reinicio y cambio de fecha
- **WHEN** el proceso se reinicia y el trabajo continua despues de medianoche
- **THEN** recupera checkpoints y conserva la fecha de Madrid fijada al inicio
- **AND** un trabajador cuyo permiso de ejecucion ha caducado no puede modificar el trabajo

#### Scenario: Reinicio mientras sigue vigente el lease anterior
- **WHEN** el backend se reinicia antes de que venza el lease de un trabajo activo
- **THEN** el nuevo worker espera y vuelve a intentar reclamar el trabajo mientras siga activo
- **AND** reanuda sus checkpoints cuando el lease anterior vence
- **AND** deja de esperar si el trabajo ya no esta pendiente ni en ejecucion

#### Scenario: Repeticion tras completar
- **WHEN** un trigger inicia un nuevo trabajo el mismo dia tras completar el anterior
- **THEN** los datos actuales sustituyen el snapshot de ese dia sin crear una segunda fila por usuario

### Requirement: Incluir todos los usuarios registrados

Cada trabajo SHALL fijar al inicio el conjunto de usuarios existentes en Supabase Auth, incluso sin figuras ni gamificacion, y SHALL procesarlo sin truncamiento por limites de consulta. Los registrados despues SHALL incorporarse en el siguiente trabajo. Una cuenta eliminada durante la ejecucion SHALL omitirse sin recrearla ni bloquear las demas; sus snapshots SHALL desaparecer por borrado en cascada. Usuarios vacios SHALL tener cero figuras, cero valor, cero Bricks, nivel inicial vigente `0` y cuatro porcentajes cero.

#### Scenario: Usuario sin actividad
- **WHEN** existe una cuenta de Auth sin inventario, gamificacion ni regalos
- **THEN** el trabajo guarda su snapshot con los valores iniciales definidos

#### Scenario: Usuarios por encima del limite de pagina
- **WHEN** hay mas usuarios de los que devuelve una sola consulta
- **THEN** todos los existentes al iniciar el trabajo reciben exactamente un snapshot para la fecha logica

#### Scenario: Cuenta eliminada
- **WHEN** se elimina una cuenta antes de guardar su snapshot
- **THEN** se omite esa cuenta y los demas usuarios siguen procesandose

### Requirement: Refrescar precios antes de capturar el estado

El trabajo SHALL considerar los IDs presentes en inventarios de usuarios incluidos, tanto en coleccion como buscadas, y SHALL consultar una sola vez cada ID distinto cuyo precio global no exista o tenga mas de 24 horas, salvo reintentos acotados. Un precio cacheado con antiguedad menor o igual a 24 horas SHALL reutilizarse sin llamada a Brickset y SHALL aplicarse a las filas de inventario elegibles aun existentes. La cache SHALL ser compartida por todos los usuarios, persistir entre runs y SHALL NOT ser legible ni escribible directamente por clientes ordinarios. El trabajo SHALL compartir el limite global de peticiones de Brickset con operaciones ordinarias, respetar `429 Retry-After` y establecer timeouts y reintentos finitos. Una respuesta valida SHALL actualizar cache, precios de filas aun existentes y checkpoint de ID atomically. Un fallo de scraping SHALL conservar cache y precios anteriores y permitir completar; SHALL contar como `failedPrices` solo si se intento el refresco caducado. No SHALL recrear figuras eliminadas. Antes del snapshot de cada usuario SHALL recalcular su gamificacion con las reglas vigentes y conservar regalos; el DNA SHALL corresponder a ese estado. Un fallo de persistencia SHALL NOT notificarse como exito.

#### Scenario: ID compartido y fallo parcial
- **WHEN** dos usuarios tienen el mismo ID y otro ID falla en Brickset
- **THEN** se comparte el resultado del ID comun, se conserva el precio anterior del fallido y se capturan ambos usuarios

#### Scenario: Reutilizar cache fresca
- **WHEN** el ID de inventario tiene un precio valido guardado globalmente hace menos de 24 horas
- **THEN** el job reutiliza ese valor, no consulta Brickset y captura todos los usuarios con ese ID
- **AND** el checkpoint del run marca el ID completado sin incrementar intentos de scraping

#### Scenario: Refrescar cache caducada
- **WHEN** el precio global del ID no existe o tiene mas de 24 horas
- **THEN** Brickset se consulta una vez por ID distinto y el precio valido actualiza la cache para siguientes runs
- **AND** si la consulta falla, se conservan la cache y los precios anteriores y aumenta `failedPrices`

#### Scenario: Precio modifica logros
- **WHEN** un precio actualizado cambia un requisito de gamificacion
- **THEN** el snapshot registra Bricks, nivel y DNA recalculados, conservando regalos recibidos

#### Scenario: Fallo al persistir
- **WHEN** no se puede confirmar una escritura necesaria para capturar un usuario
- **THEN** el trabajo queda pendiente de reintento o fallido y no devuelve un resultado global exitoso

### Requirement: Persistir mediciones diarias coherentes e idempotentes

El sistema SHALL guardar `user_daily_snapshots` con `id`, `user_id`, `snapshot_date`, `total_figures`, `total_value`, `bricks`, `level`, `pct_collector`, `pct_explorer`, `pct_rarity_hunter`, `pct_fan` y `created_at`, referenciando `auth.users` con cascada y unicidad `(user_id, snapshot_date)`. SHALL contar solo figuras en coleccion y calcular EUR con prioridad de precio de mercado valido, compra valida como fallback y cero sin ambos, excluyendo buscadas. `level` SHALL ser el identificador numerico de nivel vigente, no su objeto completo. Valores, recuentos y Bricks SHALL ser no negativos, nivel SHALL aceptar `0`, y porcentajes SHALL estar entre 0 y 100 con dos decimales. Un DNA sin contribuciones SHALL guardar cuatro ceros; en otro caso la suma SHALL ser 100 con tolerancia de 0,02 puntos por redondeo independiente. Guardar la medicion y marcar al usuario procesado SHALL ser atomico. Reintentos SHALL actualizar la fila existente, conservando `id` y `created_at`; dias anteriores SHALL NOT cambiar por nuevas ponderaciones o ejecuciones de fechas posteriores.

#### Scenario: Coleccion mixta
- **WHEN** hay una figura en coleccion con mercado 20 y compra 10, otra solo con compra 5 y una buscada de valor 100
- **THEN** el snapshot registra `total_figures: 2` y `total_value: 25.00`

#### Scenario: Idempotencia y atomicidad
- **WHEN** se repite la persistencia de un usuario y fecha o falla antes de confirmar la transaccion
- **THEN** existe como maximo una fila, y ni el snapshot ni el checkpoint quedan confirmados parcialmente

#### Scenario: DNA historico estable
- **WHEN** cambian ponderaciones despues de capturar un dia anterior
- **THEN** el DNA actual cambia conforme a sus reglas y el snapshot anterior conserva sus porcentajes

### Requirement: Publicar el estado y el resultado controlado del trabajo

La consulta cron autenticada SHALL devolver `200` con `{ jobId, status, snapshotDate, processedUsers, totalUsers, failedPrices, result }`, donde `status` es `pending`, `running`, `completed` o `failed`; `result` SHALL ser `null` hasta completar y entonces `{ "success": true, "processedUsers": N, "timestamp": "ISO_DATE" }`. `processedUsers` SHALL contar usuarios con snapshot confirmado en ese trabajo, no intentos ni filas de otros trabajos. Un fallo terminal SHALL indicar un codigo controlado y SHALL NOT publicar `success: true`, datos de usuarios ni errores internos. Un identificador desconocido SHALL devolver `404 CRON_TRABAJO_NO_ENCONTRADO`.

#### Scenario: Trabajo completado con errores de scraping
- **WHEN** todos los usuarios disponibles tienen snapshot confirmado y algunas consultas de precios fallaron
- **THEN** el estado es `completed`, `failedPrices` informa el numero de IDs fallidos y `result` contiene exito, recuento confirmado y fecha ISO de finalizacion

#### Scenario: Usuario repetido por recuperacion
- **WHEN** se reanuda un usuario ya confirmado
- **THEN** no se incrementa dos veces `processedUsers`

### Requirement: Consultar unicamente el historico propio por rango

El sistema SHALL ofrecer `GET /api/analytics/history?from=YYYY-MM-DD&to=YYYY-MM-DD` mediante JWT Supabase valido y RLS, sin aceptar una identidad objetivo. Ambos parametros SHALL ser opcionales: `to` predeterminado es hoy en Madrid y `from` predeterminado es 89 dias antes de `to`. SHALL validar fechas reales, parametros desconocidos o repetidos, orden y longitud maxima de 366 dias inclusivos, devolviendo `400 PARAMETRO_INVALIDO` ante incumplimiento. SHALL devolver `200` con `{ snapshots, baseline }`, snapshots propios ordenados por fecha ascendente, y `baseline` como fecha y total de figuras del ultimo snapshot propio anterior a `from`, o `null`. Cada snapshot SHALL exponer `snapshotDate`, `totalFigures`, `totalValue`, `bricks`, `level` y `dna: { collector, explorer, rarityHunter, fan }` como numeros, sin pesos, datos de Auth ni identificadores ajenos. Dias ausentes SHALL NOT fabricarse. Sin sesion SHALL responder `401`; fallos de persistencia SHALL responder `500 HISTORICO_NO_DISPONIBLE`.

#### Scenario: Lectura privada
- **WHEN** el usuario A consulta el historico y existen mediciones de A y B
- **THEN** recibe exclusivamente snapshots y baseline de A, y no puede insertar, alterar ni borrar snapshots

#### Scenario: Rango invalido
- **WHEN** se envia fecha imposible, un rango invertido, mas de 366 dias, parametro repetido o `userId`
- **THEN** responde `400 PARAMETRO_INVALIDO` sin ampliar el acceso

#### Scenario: Historico vacio o incompleto
- **WHEN** no hay mediciones para algunas o todas las fechas del rango
- **THEN** devuelve solo registros existentes, un arreglo vacio si procede y baseline propio o `null`

### Requirement: Publicar el resumen de progreso diario confirmado

Al confirmar el snapshot diario de un usuario, el proceso `daily-sync` SHALL crear o actualizar una notificacion de resumen para esa fecha. El resumen SHALL comparar con el snapshot anterior existente del usuario e incluir diferencias de figuras, valor total EUR, Bricks, nivel y los cuatro porcentajes DNA, aceptando diferencias negativas. No SHALL fabricar cambios si no existe base previa. SHALL mostrar el movimiento de posicion global o semanal solo si el usuario pertenecia al ranking en ambas mediciones. La creacion del snapshot y el resumen SHALL ser idempotentes ante reintentos y el resumen SHALL NOT publicarse antes de confirmar la captura.

#### Scenario: Snapshot diario completado
- **WHEN** el trabajador confirma un snapshot y existe una medicion anterior
- **THEN** genera el resumen con diferencias netas de todos los valores y DNA
- **AND** conserva movimientos negativos de nivel y valor de coleccion

#### Scenario: Usuario sin medicion base
- **WHEN** se confirma el primer snapshot del usuario
- **THEN** crea el resumen sin diferencias ficticias ni valores base cero

#### Scenario: Reintento y fallo parcial
- **WHEN** se reintenta la captura de la misma fecha o falla antes de confirmar el snapshot
- **THEN** se actualiza como maximo un resumen por usuario y fecha, o no se publica resumen si el snapshot no fue confirmado