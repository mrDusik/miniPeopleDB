# Proposal

## Why

El ranking actual compara el estado acumulado y no permite distinguir el progreso de la semana. Los snapshots nocturnos ya conservan Bricks diarios y permiten publicar un Top 10 por incremento neto sin crear eventos ni modificar la gamificacion.

## What Changes

- Anadir un ranking semanal de Bricks netos: ultimo snapshot disponible de la semana actual menos snapshot del domingo anterior, con calendario Europe/Madrid.
- Activarlo desde el lunes 2026-10-12; hasta entonces el nuevo modal muestra exactamente `No disponible`. Tampoco se inventan resultados si falta una base comparable.
- Mantener diferencias negativas, regalos y variaciones derivadas de precios/recalculos como parte del progreso neto medido; no llamarlo actividad por eventos ni un corte exacto a medianoche.
- Incorporar `GET /api/ranking/semanal`, autenticado con JWT, y una RPC de lectura con proyeccion publica limitada. Conservar privados los snapshots personales.
- Crear un modal `Ranking Semanal` independiente, con el mismo aspecto y comportamiento de las filas del global, sin selectores de criterio y mostrando Bricks semanales.
- Anadir el boton `Ranking Semanal` con el emoji calendario solicitado junto a `Ranking Global` en el desplegable de nivel; ambos ocupan la misma fila y tienen igual ancho.
- En portrait, hacer que los seis selectores del ranking global cubran el ancho de la linea azul superior y tengan el mismo ancho, sin desplazamiento horizontal.
- Mantener intactos el contrato del ranking global, su indicador principal, el proceso nocturno, los snapshots anteriores y las reglas de regalos.

## Capabilities

### New Capabilities

- `ranking-semanal`: lectura segura del Top 10 por Bricks netos de la semana, activacion fechada, elegibilidad por snapshots y modal independiente.

### Modified Capabilities

- `ranking-global`: anadir un requisito de distribucion equitativa a ancho completo de los selectores en portrait, sin cambiar los criterios ni el orden del ranking global.

## Impact

- Supabase: RPC publica acotada en `supabase/schema.sql`, permisos y reutilizacion de `user_daily_snapshots`, perfiles y destacados actuales. No requiere tablas ni un worker nuevo.
- Backend: `src/ranking-repository.js`, proteccion JWT y nueva ruta en `src/server.js`; sin cliente administrativo en rutas ordinarias.
- Frontend: `public/index.html`, `public/app.js` y `public/styles.css`, reutilizando filas/estilos del ranking con estados y foco independientes.
- Tests: extender `test-support/supabase-mock.js` y las pruebas existentes de ranking API/repositorio/web; verificar la nueva RPC y la privacidad con PGlite en los tests SQL existentes.
- Documentacion: describir fecha de activacion, base del domingo anterior y limites de las mediciones en `README.md`. Aplicacion del schema en Supabase como paso de despliegue, sin ejecutar cambios remotos automaticamente.
- Sin nuevas dependencias, sin registro de eventos, sin historicos publicos individuales ni cambios en el cron externo.