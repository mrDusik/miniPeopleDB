# Design

## Context

Ver `proposal.md` para motivacion. El cambio activo `daily-analytics-historical-snapshots` esta completado y proporciona `user_daily_snapshots` con una fila usuario/fecha, RLS personal e indice temporal. El worker guarda Bricks despues de refrescar precios; no guarda eventos ni un corte global a medianoche.

`public.ranking_global` ordena todos los candidatos antes de limitarlos a diez y proyecta perfiles, destacados, regalos y DNA acotado. `RankingRepository` usa un cliente anon con JWT. `protectedPath` en `src/server.js` protege expresamente las rutas de ranking existentes; la nueva ruta debe incorporarse. El renderer de `public/app.js` decide filas, regalos, destacados e indicador principal en la misma funcion y mantiene estado global: hay que separar la construccion compartida de filas del estado de cada modal.

En `public/styles.css`, portrait usa actualmente flex con ancho max-content, botones de ancho variable y scroll horizontal. `test/ranking-web.test.js` verifica expresamente ese CSS, por lo que el test debe evolucionar junto con el requisito. El desplegable contiene `.summary-ranking-row` y un solo acceso global. La suite usa mock Supabase compartido, JSDOM y PGlite; no hacen falta nuevas dependencias.

## Goals / Non-Goals

**Goals:** consulta semanal reproducible con fecha de servidor, aislamiento de historicos, reutilizacion visual y funcional sin acoplar estado entre modales, despliegue aditivo y pruebas temporales sin depender del dia real.

**Non-Goals:** contabilidad exacta lunes 00:00/domingo 23:59, registro de actividad, premios semanales, historial de ganadores, reset de Bricks, cambios de cron, nuevas reglas de regalos o tablas de agregacion.

## Decisions

### 1. Fecha Madrid y estreno fijo

La fecha autoritativa es `(clock_timestamp() AT TIME ZONE 'Europe/Madrid')::date`. Obtener el lunes mediante aritmetica de fechas calendario e ISO day-of-week; fin inclusivo es lunes + 6. Activacion fija `DATE '2026-10-12'`, no un lunes calculado al desplegar, para que redeploys no retrasen el estreno. No emplear CURRENT_DATE dependiente de la sesion ni semanas del navegador.

Para pruebas SQL deterministas, separar el calculo en una funcion privada con fecha de referencia y revocar su ejecucion a PUBLIC/anon/authenticated; la RPC publica no acepta fecha y llama ese helper con la fecha de base de datos. PGlite puede probar el helper como owner y verificar que authenticated solo accede a la proyeccion publica autorizada. El mock recibe un reloj inyectable para tests de API. Alternativa descartada: exponer un parametro temporal al cliente o cambiar el reloj global de los tests.

### 2. Base exacta y ultimo snapshot disponible

Cruzar una base por usuario en lunes - 1 con la ultima fila entre lunes y hoy. Calcular `bricks_semanales = latest.bricks - baseline.bricks`, ordenar diferencia DESC y user_id ASC, aplicar LIMIT 10. No llamar ranking_global y restar sobre su Top 10: excluiria posibles ganadores semanales. No usar SUM de diferencias positivas: cambiaria la semantica neta acordada.

Usuarios sin base quedan excluidos, incluidos usuarios nuevos; no se supone cero. Las filas de la semana siguiente no participan y el domingo es elegible como ultimo snapshot de su semana. Al comenzar lunes, no hay filas hasta alguna captura semanal. Los huecos entre dias no impiden comparar extremos cuando existe la base exacta. Si no hay candidatos, devolver available false; la UI muestra `No disponible`.

Las mediciones representan estados capturados durante el batch; la semana es por snapshot_date, no por timestamps de acciones. Una repeticion del job puede actualizar el resultado del mismo dia sin duplicarlo. No crear acumulados persistidos: consulta sobre el historial evita otra sincronizacion o invalidacion.

### 3. RPC publica acotada y privacidad intacta

Crear `public.ranking_semanal()` de solo lectura SECURITY DEFINER con search_path fijo, tablas cualificadas, comprobacion de auth.uid() y EXECUTE solo authenticated. La excepcion es la misma proyeccion publica acotada del ranking existente; no usar service_role ni ampliar grants de user_daily_snapshots. Helper privado no ejecutable por clientes.

Proyectar los diez IDs seleccionados con los mismos datos publicos del global por Nivel, no con su distribucion DNA completa ni bases historicas. Reutilizar selectores/proyecciones adecuados con una abstraccion pequena solo si evita duplicacion real; no refactorizar contratos ordinarios. Los saldos base permanecen internos. Conservar bricks globales para compatibilidad y anadir bricksSemanales y snapshotDate para el semanal. No invocar ranking_global como fuente de candidatos.

HTTP GET `/api/ranking/semanal`: `{ available, availableFrom, weekStart, weekEnd, entries }`. Sin queries, usuario/fecha elegidos ni cuerpos de seleccion. Autenticacion ordinaria antes de ejecutar la RPC; no ejecutar recalculos de gamificacion como condicion de esta lectura. Repo normaliza los numericos y valida resultado; errores usan `RANKING_SEMANAL_NO_DISPONIBLE`. Diferenciar no disponibilidad de negocio (200) y error real (500).

### 4. Filas compartidas, dos estados de dialogo

Agregar dialogo `weekly-ranking-dialog`, status/lista/boton cerrar propios y un acceso `open-weekly-ranking` adyacente al global. Usar `.modal-ranking`, `.ranking-dialog-heading`, `.global-ranking-list` y los mismos estilos de fila; no inventar otro aspecto ni selectores nuevos. Emoji literal calendario segun el usuario, compatible con HTML existente que ya contiene emojis.

Extraer la construccion de filas con el minimo cambio necesario para recibir entries, contenedor, fuente de Bricks, expansion y callbacks. La funcion que actualiza el indicador Top Global solo usa defaultRankingEntries. Estado semanal independiente para entries, request sequence, trigger y expanded user. Los destacados, regalos, imagenes y controles de buscadas existentes deben funcionar en ambos contenedores; sustituir selectores ligados al global por helpers que reciben el contenedor cuando sea necesario. No cambiar reglas de regalos, ni sumar +50 inmediatamente al delta: esperar la siguiente captura.

Carga al abrir, invalida respuestas al cerrar/cambiar cuenta, reset de ambos estados al logout, focus restore al trigger correspondiente. Mantener error de carga separado de available false. No agregar textos explicativos o fechas visibles que cambien el aspecto solicitado; las fechas son parte del contrato y pruebas.

### 5. Responsive localizado

Accesos: dos tracks iguales `minmax(0, 1fr)` dentro de la fila existente, gap conservado, botones a width 100%, texto con ajuste de linea si hace falta, sin apilarlos en filas diferentes ni ocultar etiquetas.

Criterios globales en portrait: grupo width 100% y grid con tracks iguales, sin padding lateral que lo desaline con la linea azul. En portrait estrecho usar tres columnas y dos filas; en portrait amplio seis columnas si las etiquetas caben. Permitir ajuste de texto dentro de los botones, no truncarlo ni hacer font-size dependiente del viewport. No cambiar landscape ni los rangos del modal Progreso.

### 6. Verificacion proporcional

Extender los archivos existentes: ranking-repository y ranking-api para contrato/autorizacion/errores/reloj del mock; ranking-web para independencia, estados, foco, respuestas tardias, regalos/destacados y CSS; supabase-daily-analytics para SQL determinista, grants/RLS, negativos, empates y mas de diez candidatos. Mantener los mocks de API en `test-support/supabase-mock.js`.

Verificar en navegador real portrait movil y tablet, landscape y desktop: mismos bordes/dimensiones/tipografia entre modales, botones de acceso iguales y en una fila, criterios globales alineados con la linea azul y de igual ancho, sin scroll horizontal. Usar datos de prueba con deltas positivos/cero/negativos sin modificar datos reales; confirmar tambien el estado real de estreno `No disponible`.

## Risks / Trade-offs

- Capturas no simultaneas y retraso nocturno: documentar progreso por fecha de snapshot; no afirmar actividad exacta ni tiempo real.
- Usuarios sin domingo base quedan fuera: mostrar no disponibilidad cuando no hay candidatos, no conceder ventajas con cero artificial.
- Extraccion del renderer puede afectar global/regalos/destacados: mantener cambios locales y ejecutar la suite de ranking existente junto a los nuevos tests.
- RPC privilegiada de lectura: grants minimos, helper inaccesible, proyeccion acotada y pruebas de permisos con roles reales.
- CSS y JSDOM no bastan para medidas visuales: validar anchos/scroll/foco en navegador real.

## Migration Plan

1. Implementar y probar la RPC aditiva en el schema, sus permisos y su helper privado; no modificar tablas historicas ni worker.
2. Aplicar el schema en el Supabase autorizado mediante el procedimiento de despliegue existente. No usar secretos reales ni ejecutar SQL remoto automaticamente durante desarrollo.
3. Desplegar API y frontend con ambos modales y comprobar hoy el estado `No disponible`.
4. Confirmar operativamente que se ejecuta la captura del domingo 2026-10-11; desde la captura del lunes 2026-10-12 habra primera comparacion. La activacion no configura ni repara el proveedor cron.
5. Rollback: retirar API/acceso semanal y revocar su RPC/helper sin borrar snapshots ni modificar el ranking global. El ajuste visual portrait puede permanecer independiente.