# Tasks

## 1. Ranking semanal en Supabase

- [x] 1.1 Implementar calculo privado por fecha de referencia y RPC publica `ranking_semanal()` sin parametros, con fecha Madrid y activacion fija 2026-10-12; verificar con PGlite fechas anteriores al estreno, lunes/domingo, cambio de semana y horario verano/invierno.
- [x] 1.2 Calcular ultimo snapshot semanal menos domingo anterior, ordenar todos los candidatos antes del Top 10 y desempatar por user_id; verificar en `test/supabase-daily-analytics.test.js` diferencias positivas/cero/negativas, huecos, base ausente, fechas futuras y ganador fuera del Top 10 global.
- [x] 1.3 Proyectar solo datos publicos del ranking por Nivel, Bricks semanales y fecha de medicion, conservando destacados/DNA acotado/regalos; verificar campos exactos y ausencia de saldo base, snapshots completos, compras o correos con PGlite.
- [x] 1.4 Fijar search_path, guard de sesion, EXECUTE solo authenticated y helper privado no ejecutable por clientes, sin cambiar RLS del historial; verificar permisos reales anon/authenticated, consulta directa de snapshot ajeno, instalacion repetida del schema y regresion del ranking global.

## 2. Repositorio, mock y API

- [x] 2.1 Extender `test-support/supabase-mock.js` con RPC semanal y reloj inyectable sin credenciales/red; verificar fixtures de domingo y semana actual, no disponibilidad antes del estreno y coherencia con el contrato SQL.
- [x] 2.2 Incorporar lectura semanal al repositorio ordinary anon mas JWT, normalizacion/validacion de resultado y error controlado `RANKING_SEMANAL_NO_DISPONIBLE`; verificar en `test/ranking-repository.test.js` proyeccion, numericos invalidos, errores y ausencia de llamadas administrativas.
- [x] 2.3 Proteger e implementar GET `/api/ranking/semanal` sin parametros elegidos por cliente y sin recalculo como condicion de lectura; verificar en `test/ranking-api.test.js` 401, 405/Allow, 400 queries, 200 available false/true, 500 controlado y contrato inalterado de `/api/ranking`.

## 3. Modal independiente y filas compartidas

- [x] 3.1 Agregar acceso Ranking Semanal con emoji calendario solicitado y dialogo propio usando clases del global, sin selectores; verificar en `test/ranking-web.test.js` estructura semantica, controles de dialogo, titulos y ausencia de selectores semanales.
- [x] 3.2 Separar la construccion reutilizable de filas del estado global e integrar cifra semanal firmada sin cambiar indicador Top Global; verificar en tests web positivo/cero/negativo, orden recibido, avatar/nivel/DNA/recuento, fila propia, destacado expandido y criterio global conservado.
- [x] 3.3 Hacer funcionar regalos, destacados, imagenes y acciones de buscadas en ambos contenedores sin duplicar reglas; verificar en tests web y API regalo unico, refresh de ambos estados necesarios y delta semanal sin +50 artificial antes de captura.
- [x] 3.4 Implementar carga semanal, `No disponible` exacto para available false y error real diferenciado; verificar con JSDOM estados, nuevas lecturas al reabrir y ausencia de filas falsas antes del lunes acordado.
- [x] 3.5 Aislar secuencias de peticion, expansion y foco; invalidar respuestas tras cierre/reapertura/cambio de cuenta y limpiar al logout; verificar con JSDOM carreras entre modales, Escape/cerrar, retorno de foco y no filtracion entre sesiones.

## 4. Responsive solicitado

- [x] 4.1 Distribuir los dos accesos de ranking con igual ancho en una sola fila del desplegable, sin ocultar texto; verificar tests de estructura y medidas reales en navegador movil, tablet y escritorio.
- [x] 4.2 Sustituir en portrait los criterios de ancho variable con scroll por columnas iguales a ancho completo de la linea azul, con filas adicionales si hace falta; actualizar el test CSS existente y comprobar en navegador anchos iguales, etiquetas legibles, alineacion y ausencia de scroll horizontal, preservando landscape.
- [x] 4.3 Comprobar visualmente que el modal semanal coincide con el global salvo titulo/cifra de Bricks/ausencia de criterios, usando datos de prueba sin modificar colecciones reales; verificar dimensiones, tipografia, filas, detalles, focus y estado actual `No disponible` en portrait/landscape/desktop.

## 5. Documentacion y validacion integrada

- [x] 5.1 Documentar contrato API, activacion 2026-10-12, necesidad de snapshot del domingo 2026-10-11, limites temporales y despliegue/rollback aditivo en README; verificar que no promete actividad exacta ni modifica/configura cron y que distingue aplicacion de schema remoto de cambios locales.
- [x] 5.2 Ejecutar tests focalizados de ranking SQL/repositorio/API/web y despues `npm.cmd test -- --test-reporter=dot`; verificar regresiones de ranking global, regalos, gamificacion, historico y autenticacion sin red ni credenciales reales.
- [x] 5.3 Ejecutar `openspec validate weekly-bricks-ranking --strict` y `git diff --check`, y registrar comprobaciones de navegador realizadas y pasos de despliegue pendientes; verificar todos los requisitos antes de completar tareas, sin marcar aplicado un schema remoto no desplegado.