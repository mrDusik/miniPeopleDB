# Design

## Context

Ver `proposal.md` para motivacion y alcance; `specs/logros-v2/spec.md` contiene el catalogo normativo completo, no el PDF externo.

- `src/gamificacion.js` contiene los objetivos de coleccion V1, reglas por ID, niveles y pesos en orden Rarity Hunter / Collector / Explorer / Fan. El PDF usa otro orden; cambiar posiciones sin nombres invertiria rasgos.
- `GamificacionRepository.calculate` obtiene regalos y agradecimientos por RPC, pero usa agradecimientos recibidos y no consulta relaciones. `ensure` devuelve el estado persistido si existe; cambiar constantes no actualiza por si mismo cuentas existentes.
- `CategoryGamificationRecalculator` calcula estados en JS, pagina tablas con service_role, obtiene algunos contadores por RPC y confirma lote/fingerprint mediante `aplicar_recalculo_gamificacion_categorias`. Su huella actual no incluye pesos. Hay que sustituir lecturas globales directas por fuentes minimas de RPC allowlisted, conforme a AGENTS.md.
- El worker diario obtiene fuentes con `leer_daily_sync_fuentes`, usa revision optimista y `capturar_daily_sync_usuario` bloquea antes de confirmar. Las fuentes no incluyen relaciones ni nombre completo, y la revision no incorpora amistades.
- `friend_requests` conserva sender_id/recipient_id incluso al aceptar; eliminar la amistad elimina tambien esa solicitud. Las rechazadas permanecen en los contadores de la UI, pero no deben sostener First contact.
- SQL implementa regalos/agradecimientos atomicamente, mantiene `dna_ponderaciones` privada y calcula DNA con `private.dna_calcular`. `agradecer_regalo` concede hoy 10 Bricks al donante: 5 directos mas 5 del logro V1. V2 retira el segundo componente y concede los hitos al emisor.
- La disponibilidad semanal tiene 2026-10-12 tanto en SQL como en la validacion de `RankingRepository.weekly`; el cliente no puede aceptar una fecha dinamica si solo se cambia SQL.
- El scraper separa Name en nombre/descripcion y en ciertos formatos descarta sufijos desde una coma. Concatenar esos campos no recupera necesariamente el nombre original. El JSON de categorias no tiene anios de serie. El agente Brickset es de solo lectura y aun describe logros V1.
- Pruebas existentes: node:test, JSDOM, `test-support/supabase-mock.js` y PGlite. No hacen falta dependencias nuevas.

## Goals / Non-Goals

**Goals:**

- Tener una definicion verificable por cada uno de los 115 logros y paridad entre calculo personal, lotes globales, SQL social y snapshots.
- Evitar duplicar saldo, perder una actualizacion social concurrente o publicar pesos en el navegador.
- Ejecutar una transicion unica, operable y recuperable, sin mezclar V1 y V2 ni trasladar la fecha de estreno al reiniciar.
- Mantener las APIs y la experiencia actuales salvo las consecuencias de las nuevas reglas y los mensajes sociales afectados.

**Non-Goals:**

- No redisenar modales, introducir agrupaciones editoriales en la UI, cambiar niveles ni introducir un historial permanente de acciones para logros.
- No ampliar busquedas publicas por username, acceso directo a tablas privadas, permisos de cron, autenticacion o service_role ordinario.
- No automatizar la aplicacion de informes del agente Brickset, ni cambiar la regla de totales manuales de subcategoria.
- No ejecutar migraciones, scraping de produccion, borrados ni despliegue durante esta propuesta o como efecto de una prueba.

## Decisions

### 1. Catalogo declarativo de servidor y evaluadores por familia

Sustituir OBJETIVOS por las definiciones V2 con IDs estables fijados en la spec. Representar pesos con claves de rasgo, convirtiendo explicitamente a columnas SQL/orden heredado; validar IDs unicos, cantidades, Bricks enteros, repetibilidad y suma de pesos 0 o 100. Conservar NIVELES/selectLevel y la forma publica del estado. Usar evaluadores locales por familia (figura, valor, serie, categoria, universo, relacion, ledger, DNA), no 115 ramas de control nuevas.

Mantener una sola fuente de metadatos de servidor y una proyeccion SQL privada reproducible de los datos necesarios para transacciones sociales y pesos. Verificar paridad mediante tests; no servir esa fuente como asset. Conservar la distincion entre `total` de un logro calculado y Total editorial. La presentacion tipo regalo se aplica a los cuatro hitos sociales del PDF, manteniendo el orden de UI existente.

Alternativas descartadas: cargar el Excel/PDF en runtime (dependencia operacional e interpretacion ambigua), trasladar pesos al cliente (privacidad) y continuar anadiendo objetivos V1 (contradice sustitucion total).

### 2. Estado derivado y dos pasadas para DNA

El calculador recibira inventario normalizado, catalogo validado y un contexto explicito de fuentes sociales V2. Canonicalizar IDs y deduplicar antes de contar. Calcular primero todos los objetivos no condicionados por DNA; derivar contribuciones con pesos con nombre; evaluar despues los cuatro hitos DNA de pesos cero, sin bucles ni realimentacion. Calcular finalmente saldo, nivel y progreso.

Comparar fracciones sin redondeo: por ejemplo, cantidad * 100 > total * 80 para series. Para categorias, los hitos 50/80/100 usan >=. Seleccionar un solo tramo de tamano por total vigente antes de evaluar los tres hitos; un cambio de tramo puede bajar Bricks. Valor total usa >=, precio individual > y decadas son intervalos completos de la spec. Un total ausente/cero no habilita porcentajes.

No persistir porcentajes actuales ni usar los Bricks como ponderacion. Los pesos cero no forman parte del denominador. Los hitos DNA pueden coexistir en un empate exacto 50/50.

Alternativa descartada: mantener concesiones historicas, contar altas o aplicar redondeo de UI en umbrales; impide las perdidas y recuperaciones acordadas.

### 3. Fuentes sociales y saldo directo independientes de logros

El contexto incluira regalos globales/semanales recibidos, agradecimientos emitidos y recibidos, amistades aceptadas actuales y evidencia de direccion para First contact/Handshake. Derivar fuentes del JWT en operaciones personales y de RPC allowlisted en lotes/cron, nunca de un selector HTTP de usuario.

Saldo = suma de totales de logros V2 + 50 por regalo global V2 + 5 por regalo semanal V2 + 5 por agradecimiento V2 recibido como donante original. El ultimo componente conserva el pago directo ya existente, no el logro V1 retirado: la sustitucion acordada afecta al catalogo, mientras que los efectos directos no ligados a logro se mantienen. Los hitos por agradecer corresponden exclusivamente a quien los emite. No existe un regalo/logro artificial para cuadrar saldo con suma de logros.

Actualizar las RPC sociales para reconstruir la porcion social del estado desde el ledger/relaciones confirmados y los metadatos privados V2, conservando la porcion de coleccion ya validada. Todos los logros sociales tienen pesos cero, por lo que esta mutacion no requiere inferir nuevos pesos de coleccion. Usar un helper SQL privado comun a regalos, agradecimientos y amistades, sin EXECUTE publico y con identidades elegidas solo por las RPC que validaron la relacion. Reutilizar el calculo de niveles existente.

Bloquear participantes en orden estable de UUID y coordinarlo con la fila de solicitud/notificacion correspondiente; comprobar rollback de todos los pasos. Las cascadas de eliminacion de cuenta deben retirar fuentes sociales del superviviente y actualizar sus consecuencias, sin cambiar la autenticacion ni permitir elegir otra cuenta para borrar.

Alternativa descartada: conceder incrementos fijos por cada invocacion, pues duplica hitos con reintentos y no soporta perdidas.

### 4. Revisiones comunes para evitar estados obsoletos

Ampliar la revision de fuentes usada por el worker para incluir relaciones/direccion/estado, regalos con su semana, ledger de agradecimientos, nombre completo, anios de serie y fingerprint de catalogo/pesos/version. Aplicar una comprobacion equivalente a calculos personales y lotes para impedir que una lectura anterior a una accion social sobrescriba su resultado.

Extender las RPC allowlisted de categorias para fuentes minimas paginadas, incluyendo usuarios solo sociales. Usar Auth como conjunto completo en la migracion inicial; no depender de la existencia previa de gamificacion. Persistir lote/fingerprint solo si sus fuentes y version siguen siendo validas; ante conflicto reobtener y recalcular. Conservar limites de paginacion y leases del worker diario. No introducir un cliente administrativo generico que vuelva a leer tablas directamente.

Alternativa descartada: solo refrescar la UI tras mutaciones; no protege la base de datos frente a workers concurrentes.

### 5. Metadatos publicos Brickset conservados sin alterar nombres visibles

Agregar `anioInicio` opcional validado a subcategorias del JSON local, calculado como minimo de los anios publicados de esa misma ruta. Obtener todas las paginas publicas; una paginacion incompleta no permite asignar minimo. Si una ficha carece de anio pero existen otras con anio en la misma serie, usar el minimo observado y marcar `anioInicioEstimado: true`; si ninguna figura de esa serie tiene anio, dejarlo sin clasificar. Nunca inferir desde inventarios ni desde el fallback del formulario y no tocar automaticamente totales manuales.

Canonicalizar en el archivo local y en la migracion V2 solo los aliases aprobados `Harry Potter / Harry Potter Series 1 Fantastic Beasts` -> `Harry Potter / Harry Potter Series 1 / Fantastic Beasts` y `Super Heroes / Marvel Studios Series 1 What If` -> `Super Heroes / Marvel Studios Series 1 / What If...?`. Conservar totales manuales 6/4 y migrar referencias exactas de minifiguras dentro de la transaccion, antes de recalcular. No inferir otros aliases ni cambiar nombres visibles.

Preservar el Name original normalizado de Brickset como metadato de servidor por ID, separado de nombre/descripcion visibles; incluirlo en fuentes minimas de calculo sin ampliar la proyeccion publica de API. Recuperar los nombres originales de IDs ya existentes con extraccion deduplicada, limites actuales de peticiones, reintentos acotados y evidencia de cobertura antes de migrar. La correccion puntual `correct-brickset-names.js` y sus RPC temporales no se reutilizan ni se convierten en una nueva excepcion permanente.

La ubicacion del metadato por figura puede ser una columna interna de minifiguras, sin exponerla en los contratos publicos existentes. El anio de serie permanece en el JSON local, no en Supabase como nuevo catalogo de categorias. El fingerprint incluye ambos tipos de datos que influyen en requisitos. No reconstruir nombre completo exclusivamente concatenando campos porque algunos sufijos ya se perdieron.

Actualizar `.github/agents/brickset.agent.md` para reportar cobertura/anio minimo y el impacto real V2 de cambios de total, anio y nombre, conservando prohibicion de escribir archivos, acceder a Supabase o aplicar diferencias. Sus instrucciones de herramientas y fuentes deben permitir las lecturas publicas acotadas necesarias, no acceso general de escritura.

Alternativas descartadas: usar el minimo de las figuras poseidas (clasificacion diferente entre usuarios), scrapear desde cada consulta de logros (latencia y dependencia de red), inferir aliases por parecido sin autorizacion o permitir al agente modificar JSON automaticamente (cambia su contrato).

### 6. Migracion puntual separada del schema habitual

Preparar SQL de despliegue versionado y un runbook, no una ruta de aplicacion. Separar instalacion de funciones/constraints V2 del reset destructivo. Un registro privado de activacion guardara version, fingerprint, fecha efectiva de despliegue y availableFrom, sin grants ordinarios de escritura. Mantener acceso web bloqueado durante la transicion y no hacer que aplicar `schema.sql` o iniciar el servidor borre datos.

El operador ejecuta el SQL de reset con autoridad de propietario y confirmacion de proyecto, no con una clave service_role desde el navegador o un script de tabla global. Produccion y cualquier proyecto no desechable requieren backup restaurable; solo el proyecto de pruebas confirmado `wvcnftjhvcdxmuqpjqda` permite omitirlo con una bandera explicita de test. Los estados iniciales se preparan con el motor JS V2 y fuentes de las RPC existentes ampliadas y allowlisted, mientras las escrituras ordinarias estan detenidas. La aplicacion final verifica cobertura completa y revisiones bajo bloqueo antes de confirmar reset, estados, membership global silenciosa, huella y marca de activacion en una transaccion. Los estados iniciales consideran regalos/agradecimientos cero y relaciones/inventario conservados. No generar snapshots sinteticos de la fecha de despliegue.

Una segunda ejecucion con marca aplicada devuelve sin cambios; no debe truncar antes de comprobarla. Invalidar jobs/leases/checkpoints V1 antes de la fase final y comprobar version en las RPC de escritura para rechazar procesos viejos incluso tras volver a abrir trafico. La tabla interna de jobs no se limpia de una forma que permita a un proceso antiguo recuperar autoridad. Reinicializar checkpoints de notificaciones y membership sin avisos. Invalidar caches de cliente/servidor mediante version V2 y revalidacion, sin retener toasts viejos.

Alternativas descartadas: borrado automatico por fingerprint, migracion al primer login o simple DELETE de snapshots con cron activo; todas permiten datos mixtos o destruyen datos V2 posteriores.

### 7. Activacion semanal relativa al despliegue real

Guardar una sola vez el instante efectivo de activacion V2 en produccion. Calcular su fecha local Madrid y el proximo lunes estrictamente posterior, incluso si se despliega en lunes. `availableFrom` se lee de esa marca persistida y se devuelve como fecha valida, sin constante en repositorio, SQL, mock o tests. No actualizarla con un restart ni con el merge que precede al despliegue.

La comparacion mantiene base del domingo anterior y ultimo snapshot disponible de la semana. Tras reset completo no hay base V1 utilizable; se espera una captura real del domingo bajo V2 y otra semanal. Sin ambas, No disponible. Conservar diferencias negativas, orden por delta/UUID, Top 10 independiente del global, regalos semanales y privacidad. Verificar la funcion interna de membership usada por el resumen diario ademas de la RPC de consulta.

Alternativa descartada: fijar una fecha conocida al redactar esta propuesta o usar saldo actual/base cero para estrenar inmediatamente.

## Risks / Trade-offs

- [Fuentes Brickset incompletas o bloqueadas] -> Preparar metadatos antes del corte, informar cobertura y no inventar anios/nombres. Retrasar activacion si la cobertura requerida no es verificable.
- [Divergencia JS/SQL/mock] -> Una fuente declarativa de servidor, proyeccion SQL verificable y fixtures de paridad con las mismas cuentas/acciones. No duplicar silenciosamente el catalogo en la UI.
- [Carreras y bloqueos entre operaciones sociales/cron] -> Orden de locks documentado, revisiones que incluyan todas las fuentes y pruebas concurrentes/de rollback.
- [Reset irreversible con datos reales nuevos] -> Backup previo, mantenimiento, marca de una sola ejecucion y retorno sin cambios tras exito; no ejecutar produccion como parte de tests.
- [Usuario con coleccion pero DNA Newbie] -> Es comportamiento esperado con logros de pesos cero; no inventar proporciones ni considerarlo error.
- [Perdidas de logros por nuevas series/totales/tramos] -> Probar descensos de cantidad/saldo/nivel y no imponer crecimiento monotono.
- [Fecha semanal incorrecta por zona horaria o redeploy] -> Fecha persistida calculada en Madrid y tests de viernes, domingo, lunes, cambio de horario y reinicio.
- [Restauracion parcial de reglas V1] -> Retirar tambien migraciones automaticas V1 que recreen agradecimientos, titulos o recompensas; probar schema actualizado y despliegue repetido.

## Migration Plan

1. Validar catalogo, escenarios y paridad en entorno local/PGlite; preparar metadatos Brickset publicos completos, sin tocar produccion.
2. Preparar backup restaurable, identificar proyecto y aprobar ventana de mantenimiento. El reset requiere una operacion explicita posterior, no esta propuesta.
3. Detener trafico de escritura, scheduler y workers antiguos; instalar funciones V2 y sus guardas de version. Invalidar leases anteriores y preparar fuentes/estados consistentes de todos los usuarios.
4. Ejecutar la transaccion de reset unico: retirar ledger V1 y dependencias, notificaciones, snapshots completos, bases de membership y estado derivado; reconstruir V2 desde cuentas/inventario/relaciones conservados. Confirmar huella, marca V2 y disponibilidad semanal sin emitir eventos.
5. Comprobar recuentos e invariantes de datos conservados, ausencia de IDs V1 retirados, saldos, permisos, bandejas vacias y weekly no disponible. Habilitar solo backend V2; rechazar procesos V1 tardios. Revalidar caches activas.
6. Reactivar cron de las 04:00 Madrid; capturar nuevos snapshots normales, observar el primer domingo/lunes comparable y comprobar que un redespliegue no borra datos ni cambia availableFrom.

Rollback antes del commit revierte la transaccion y mantiene mantenimiento hasta restaurar servicios compatibles. Tras el commit, volver a V1 exige restaurar el backup completo compatible (schema y datos) durante mantenimiento; no intentar recrear ledger o historico V1 desde ceros ni hacer un downgrade de binario sobre datos V2. Si ya hay actividad V2 nueva, conservar/exportar esa actividad antes de restaurar y acordar su tratamiento con el operador; nunca borrarla silenciosamente con un reintento.

## Verification Strategy

- Dominio: comprobar las 115 definiciones y sus textos/pesos/repetibilidad, todos los limites exactos y grupos acumulativos/exclusivos; fixtures de perdida y recuperacion, duplicados, BUSCADA, anios desconocidos y Newbie con coleccion.
- SQL PGlite: ejecutar schema y migracion en fixture; validar grants con roles no privilegiados, identidad de actor, atomicidad, carreras, borrado de cuenta, idempotencia, lease obsoleto y preservacion exacta de inventarios/perfiles/relaciones. El mock no demuestra permisos reales.
- API: extender exclusivamente `test-support/supabase-mock.js` y tests existentes; demostrar fuentes V2, validacion dinamica de availableFrom y ausencia de pesos/datos ajenos sin red ni credenciales.
- Integracion de recalculos: mismos estados en operaciones personales, RPC sociales, recalcule de categorias y diario, incluidos usuarios solo sociales y conflictos de revision.
- Web/JSDOM: titulos/textos, logros retirados ausentes, orden/iconos existentes, saldos con contribuciones directas, revalidacion tras acciones sociales, limpieza de bandeja y sesiones/respuestas obsoletas. No redisenar ni introducir grupos del PDF.
- Verificaciones de entrega: pruebas enfocadas por tarea, suite `npm.cmd test` y `openspec validate revamp-achievements-v2 --strict`. Las pruebas no deben leer sup.env, usar credenciales reales ni ejecutar reset de produccion.