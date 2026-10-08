# Proposal

## Why

MiniPeopleDB muestra el estado actual de la coleccion, Bricks, nivel y DNA, pero no conserva su evolucion diaria. Capturar estados fechados permite consultar tendencias reales sin reconstruir un pasado que el inventario actual ya no representa.

## What Changes

- Crear `user_daily_snapshots`, privado por usuario, con valor en EUR, figuras en coleccion, Bricks, identificador de nivel y cuatro porcentajes DNA, unico por usuario y fecha de Madrid.
- Programar un trigger externo diario a las 04:00 `Europe/Madrid`, autenticado con `CRON_SECRET`, para `POST /api/cron/daily-sync`.
- Iniciar con HTTP 202 un trabajo persistente, recuperable y sin solapamientos; consultar su estado mediante `GET /api/cron/daily-sync/:jobId` con el mismo secreto. El resultado completado conserva `{ success, processedUsers, timestamp }`. Esta decision, confirmada por el usuario, sustituye la espera HTTP del borrador original porque Brickset serializa peticiones con un intervalo minimo de 9 segundos.
- Incluir todos los usuarios existentes en Supabase Auth al iniciar el trabajo, incluso sin coleccion. Refrescar precios antes de capturar, deduplicando IDs entre inventarios, conservando precios anteriores ante fallos y recalculando gamificacion con las reglas existentes.
- Ampliar explicitamente la excepcion administrativa del backend para las RPC allowlisted del trabajo diario, sin permitir `service_role` en rutas ordinarias ni navegador.
- Mantener DNA actual dinamico y guardar sus porcentajes exclusivamente como mediciones historicas; no recalcular fechas anteriores por cambios de ponderaciones.
- Incorporar un modal de historico con rangos temporales, valor y cambio neto de figuras, DNA apilado y Bricks/nivel. Los descensos son validos; no se presenta el cambio neto como altas reales.

## Capabilities

### New Capabilities

- `analitica-historica`: ejecucion diaria segura y recuperable, snapshots idempotentes y consulta privada por rango.

### Modified Capabilities

- `persistencia-supabase`: ampliar la excepcion administrativa a RPC acotadas de analitica diaria y proteger snapshots y metadatos del trabajo.
- `interfaz-web-minifiguras`: permitir mediciones DNA historicas sin alterar el calculo actual y ofrecer el modal con tres graficos.

## Impact

- Backend: `src/server.js`, configuracion de secretos en `src/services/supabase.js`, nuevo coordinador/repositorio de analitica; reutilizacion de `BricksetScraper`, `calcularGamificacion` y `private.dna_calcular`.
- Supabase: `supabase/schema.sql`, tabla historica, tablas internas de ejecucion/checkpoints, RLS, grants y RPC administrativas transaccionales.
- Frontend estatico: `public/index.html`, `public/app.js`, `public/styles.css`; Chart.js servido localmente como nueva dependencia, sin framework ni CDN adicional.
- Tests: mock existente de Supabase para API/coordinador, PGlite para RPC/RLS y JSDOM para interfaz, mas comprobacion visual en navegador.
- Documentacion: `README.md`, `sup.env.example` y actualizacion futura de `AGENTS.md` para reflejar la excepcion aprobada. Configuracion del proveedor cron y rotacion del secreto fuera del repositorio.
- No incluye backfill, eventos de altas/eliminaciones, historicos publicos, retencion automatica ni cambios en rankings.