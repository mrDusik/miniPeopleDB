# Tasks

## 1. Catalogo normativo y contrato de datos

- [x] 1.1 Sustituir las definiciones V1 por los 115 logros de `specs/logros-v2/spec.md`, con IDs estables, textos, Bricks y repetibilidad; verificar en `test/gamificacion.test.js` el inventario completo de IDs y ausencia de objetivos V1 retirados, no solo el numero total.
- [x] 1.2 Representar pesos por nombre de rasgo y preparar la proyeccion SQL privada desde la misma fuente de servidor; verificar paridad de los 115 registros, suma 0/100, limites 0-100 y correcciones 5 Collector/95 Fan y Curiosity Driven cero en tests de dominio y PGlite.
- [x] 1.3 Conservar niveles, umbrales y formato publico del estado, separando Total editorial del total calculado por logro; verificar los contratos existentes de `test/gamificacion-api.test.js` y `test/gamificacion-repository.test.js` sin publicar grupos ni pesos.

## 2. Metadatos Brickset para series y nombres

- [x] 2.1 Ampliar la validacion de categorias para `anioInicio` opcional entero positivo sin cambiar totales manuales de subcategoria; verificar lectura compatible y rechazo de cero, negativos y fracciones en `test/categorias.test.js`.
- [x] 2.2 Obtener y reportar el menor anio observado por serie desde la cobertura publica completa; si una ficha carece de anio, usar el minimo observado de esa misma serie y marcarlo como estimado, y dejar sin clasificar las series sin ningun anio. Canonicalizar los dos aliases aprobados de Fantastic Beasts y What If conservando totales y referencias guardadas. Verificar fixtures, JSON y migracion PGlite, sin inferir desde inventarios ni escribir totales automaticamente.
- [x] 2.3 Preservar Name completo como metadato interno de servidor y preparar recuperacion deduplicada para IDs existentes sin cambiar nombre/descripcion visibles ni usar las RPC temporales de correccion; verificar `test/brickset-scraper.test.js`, contratos de minifiguras y coincidencias Comic-Con/Toy Fair en sufijos separados o descartados por el parser V1.
- [x] 2.4 Actualizar `.github/agents/brickset.agent.md` para reportar anios/cobertura e impacto V2 manteniendo solo lectura; verificar sus instrucciones, fuentes, restricciones de herramientas y ejemplos contra `specs/categorias-brickset/spec.md`, y entregar reporte de cobertura de todas las series antes de habilitar el despliegue.

## 3. Motor de logros y DNA

- [x] 3.1 Implementar evaluadores por familia en el motor existente, deduplicacion de IDs y filtro COLECCIÓN; verificar cantidad por figura/categoria/serie, no repetibles 0/1, BUSCADA excluida y perdida/recuperacion mediante `npm.cmd test -- test/gamificacion.test.js`.
- [x] 3.2 Implementar valor total >=, precio individual >, fallback de precio y decadas completas; verificar los importes exactos 10/50/100/500/1000, hitos de coleccion 500/1000/2000/5000/10000 y anios 1979/1980/1989/1990/1999/2000 en tests parametrizados de dominio.
- [x] 3.3 Implementar series exclusivamente Collectible Minifigures, anio minimo compartido, 2016 antiguo, inicio y fracciones >80/100%; verificar limites exactos, total desconocido/cero, varias series, Other y categoria ajena en `test/gamificacion.test.js`.
- [x] 3.4 Implementar tramos exclusivos 50<T<=100, 100<T<=500 y T>500, con 50/80/100 acumulativos en cada tramo e inclusion de Collectible Minifigures; verificar fronteras 50/100/101/500/501, categoria completa de 600 y cambios de tramo con perdida de Bricks.
- [x] 3.5 Implementar primeras categorias oficiales, universos ampliados y especiales por ID/nombre completo; verificar todas las filas del catalogo, union sin duplicados, no inclusion implicita de Batman I, correccion de alias y acumulacion de hitos 5/10/20/50/100 en tests de dominio.
- [x] 3.6 Evaluar DNA en dos pasadas, con cuatro hitos >=50 sin redondeo ni realimentacion y exclusiones de pesos cero; verificar Newbie con coleccion, empate 50/50, 49.99%, cantidades sin ponderar por Bricks y paridad del DNA privado en PGlite y mock.

## 4. Fuentes y repositorio personal

- [x] 4.1 Extender las fuentes personales derivadas del JWT para obtener pendientes propias, direccion de amistades y contadores de ledger V2; verificar identidad, rechazadas excluidas de First contact y ausencia de selectores arbitrarios mediante API con `test-support/supabase-mock.js`.
- [x] 4.2 Adaptar `GamificacionRepository` al contexto V2 y a revisiones de fuentes, dejando de usar solo agradecimientos recibidos como logro; verificar estados sin persistencia previa, revalidacion tras mutaciones, pagos directos e invalidacion V1 en `test/gamificacion-repository.test.js` y `test/gamificacion-api.test.js`.
- [x] 4.3 Ampliar exclusivamente `test-support/supabase-mock.js` para soportar catalogo, fuentes sociales, revisiones, versiones y fecha semanal V2; verificar con las suites API existentes que no se requiere red, sup.env ni credenciales y que el mock no se usa como sustituto de pruebas SQL de permisos.

## 5. RPC sociales y transacciones

- [x] 5.1 Preparar un helper SQL privado comun que reconstruya la porcion social y saldo/level desde relaciones/ledger V2 y logros de coleccion vigentes; verificar paridad JS/SQL, grants sin EXECUTE publico y bloqueo de usuarios en orden estable con PGlite.
- [x] 5.2 Adaptar regalos globales/semanales: importes directos 50/5, contador conjunto e hitos 1/10 sin logros repetibles V1; verificar primer global 70 Bricks, primer semanal 25, diez mixtos, duplicados concurrentes y rollback de notificacion/estado en PGlite y `test/ranking-api.test.js`.
- [x] 5.3 Adaptar agradecer a hitos por emision 1/10 y pago directo de 5 al donante, eliminando su antiguo logro adicional; verificar propiedad del regalo, ledger unico, lectura de notificacion sin cambios, no repeticion del primer hito y rollback de ambos participantes con PGlite y `test/notificaciones-api.test.js`.
- [x] 5.4 Recalcular ambos participantes al enviar/rechazar/aceptar/eliminar amistad y en cascadas por borrado de cuenta; verificar First contact pendiente/aceptada, Handshake por direccion, umbrales 10/20/50/100, rechazadas aun aceptables, terceros denegados y rollback sin cambios parciales en PGlite y `test/amigos-api.test.js`.

## 6. Recalculos global y diario coherentes

- [x] 6.1 Sustituir lecturas administrativas globales directas del recalcule de categorias por RPC allowlisted de fuentes minimas paginadas y ampliar fingerprint a pesos/metadatos/version V2; verificar usuarios solo sociales, cambios de anio/pesos, idempotencia y roles en `test/category-gamification-recalculator.test.js` y `test/supabase-category-recalculation.test.js`.
- [x] 6.2 Extender fuentes y revision del worker diario con relaciones, semana de regalos, nombre completo y version; verificar que una amistad/regalo nuevo invalida un calculo anterior y no se sobrescriben recompensas en `test/daily-analytics-jobs.test.js` y `test/supabase-daily-analytics.test.js`.
- [x] 6.3 Usar el mismo motor V2 en calculo personal, categorias y cron, sin excepciones nuevas de service_role; verificar fixtures de paridad de logros, saldo, nivel y DNA entre los tres caminos y mantener RLS/allowlists en PGlite.

## 7. Ranking global y semanal

- [x] 7.1 Persistir la fecha efectiva V2 y el lunes estrictamente posterior en Europe/Madrid, y retirar la constante V1 de SQL, repositorio, mock y pruebas; verificar viernes/domingo/lunes, cambio de horario, reinicio y fecha dinamica valida mediante tests de API y SQL.
- [x] 7.2 Exigir base dominical y captura de semana real ambas V2, sin saldo actual ni base cero; verificar No disponible antes de fecha, ausencia de base/captura, diferencias negativas y Top 10 independiente del global en los tests existentes de ranking y analitica SQL.
- [x] 7.3 Actualizar membership global/semanal y proyecciones sociales sin publicar pesos ni restaurar restricciones V1 de porcentajes; verificar refresco de estado, permisos para logros de participantes semanales y deduplicacion de eventos en `test/ranking-notifications.test.js`, `test/ranking-api.test.js` y tests de amigos.

## 8. Interfaz y notificaciones V2

- [x] 8.1 Refrescar gamificacion tras las acciones sociales y presentar los nuevos titulos/textos/cantidades sin grupos editoriales, conservando orden, iconos y modales; verificar saldos con importes directos, ausencia de logros retirados y respuestas obsoletas en `test/gamificacion-web.test.js`, `test/friends-web.test.js` y `test/notifications-web.test.js`.
- [x] 8.2 Limpiar caches, bandeja y toasts pendientes V1 al cambiar version, mantener los mensajes fieles a pagos/hitos V2 y no emitir eventos del reset; verificar unreadCount, sesion, reapertura de modales y vacio historico en las suites web/API existentes.
- [x] 8.3 Mostrar toasts para logros nuevos e incrementos repetibles en acciones sociales y mutaciones de figuras sin notificar durante la carga inicial; verificar First contact, Handshake y que los toasts existentes no se duplican.

## 9. Migracion unica y recuperacion

- [x] 9.1 Crear SQL de migracion V2 separado del arranque/schema habitual y guardado por marca durable, confirmacion de proyecto y autoridad de propietario, sin ruta HTTP de reset; verificar en PGlite la denegacion a anon/authenticated y que instalar/reaplicar schema no ejecuta el reset.
- [x] 9.2 Implementar transicion protegida por mantenimiento/version y bloqueo de jobs/leases V1; canonicalizar en la misma transaccion los dos aliases de subcategoria aprobados antes de reconstruir estados. Confirmar reset/reconstruccion/fingerprint/fecha/membership silenciosa atomicamente; verificar rollback de referencias, worker atrasado y usuario sin gamificacion previa con PGlite.
- [x] 9.3 Cubrir la matriz de preservacion y borrado: identidades, perfiles, favoritos, avatares, minifiguras y solicitudes/amistades intactas; regalos, agradecimientos, notificaciones, snapshots completos y derivados V1 retirados; verificar igualdad de datos conservados y nuevas recompensas desde fuentes vigentes en fixture PGlite.
- [x] 9.4 Probar segunda ejecucion tras un regalo/notificacion/snapshot V2 nuevo, arranque y redeploy; verificar que no se borra actividad V2 ni cambia availableFrom, que no se recrean logros V1 y que el primer historico V2 no usa una base anterior.

## 10. Verificacion de entrega y runbook

- [x] 10.1 Ejecutar todas las suites enfocadas y `npm.cmd test` sin credenciales, revisando tambien las regresiones de autenticacion, perfil, eliminacion de cuenta y datos de categorias; verificar salida exitosa sin tocar servicios reales ni ampliar permisos fuera del cambio.
- [x] 10.2 Entregar runbook de backup restaurable, comprobacion de cobertura Brickset, confirmacion de proyecto, mantenimiento, SQL de reset, smoke checks, cron y rollback compatible; verificar mediante ensayo local que no se pierde actividad posterior por reintento y que no se requiere una ruta de reset o acceso global directo nuevo.
- [x] 10.3 Documentar que produccion requiere una operacion explicita del operador y que apply no ejecuta el borrado/despliegue automaticamente; verificar instrucciones de README/runbook, tareas cerradas con evidencia y `openspec validate revamp-achievements-v2 --strict` antes de presentar la implementacion para revision.