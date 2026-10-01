# Tasks

## 1. Persistencia segura y cliente simulado

- [x] 1.1 Añadir a `supabase/schema.sql` `perfiles_publicos`, `regalos_enviados`, claves, checks e índices, habilitar RLS y definir políticas de perfil propio; verificar las restricciones y aislamiento con casos nuevos en `test/supabase.test.js` mediante `node --test test/supabase.test.js`.
- [x] 1.2 Implementar la función SQL autenticada de lectura del Top 10 con orden estable, campos públicos, total `COLECCIÓN`, ambos Top 5 y `regalo_enviado`; verificar columnas, exclusión de `BUSCADA`, límite, desempates y ausencia de metadatos privados en pruebas de ranking.
- [x] 1.3 Implementar la función SQL transaccional de regalo con `auth.uid()`, bloqueo del receptor, unicidad, incremento de 50, logro y recálculo de nivel/progreso; verificar autorregalo, receptor inexistente, duplicado/concurrencia y rollback sin cambios parciales.
- [x] 1.4 Ampliar `test-support/supabase-mock.js` con perfiles, regalos y RPC autenticadas equivalentes, incluida la inyección de fallos atómicos; verificar que las pruebas nuevas se ejecutan sin red ni variables `SUPABASE_*`.

## 2. Dominio y repositorios

- [x] 2.1 Extraer los criterios reutilizables de Top 5 desde `MinifigurasRepository.valuationSummary` y aplicar los mismos desempates al ranking/mock; verificar que `test/minifiguras.test.js` conserva sus resultados y que los casos contractuales de ranking coinciden.
- [x] 2.2 Extender el modelo de gamificación para combinar logros base con regalos de 50 Bricks, aceptar `type: "regalo"` y recalcular nivel/progreso sin perder ni duplicar regalos; verificar primeros/múltiples regalos y recálculo tras cambios de catálogo con `node --test test/gamificacion.test.js test/gamificacion-repository.test.js`.
- [x] 2.3 Crear el repositorio de ranking para sincronizar el perfil validado, mapear la RPC a camelCase y traducir fallos de regalo a errores de dominio; verificar orden, forma de respuesta, fallback de perfil y errores controlados en un test unitario dedicado.

## 3. API Express

- [x] 3.1 Extender la autenticación para conservar los metadatos seguros devueltos por `auth.getUser` y sincronizar `full_name`/`name` y `avatar_url` sin aceptar datos de perfil del cliente; verificar alta y actualización de perfil en pruebas de autenticación.
- [x] 3.2 Proteger e implementar `GET /api/ranking` con el repositorio de ranking y respuestas de error sin detalles internos; verificar `401`, Top 10, campos públicos, Top 5 y `regaloEnviado` con `node --test test/ranking-api.test.js`.
- [x] 3.3 Implementar `POST /api/ranking/regalar` con validación estricta de `{ receptorId }`, respuesta `200 { "ok": true }` y mapeos `400 AUTORREGALO_NO_PERMITIDO`, `404 RECEPTOR_NO_ENCONTRADO` y `409 REGALO_YA_ENVIADO`; verificar que no acepta suplantación del donante y que cada error deja el estado intacto.

## 4. Modal de Ranking Global

- [x] 4.1 Añadir en la tercera fila del menú el control con icono de globo, el diálogo semántico de ranking y estilos responsive coherentes con la app; verificar estructura, etiquetas accesibles, foco/cierre y ausencia de desbordamientos en `test/ranking-web.test.js`.
- [x] 4.2 Implementar carga y renderizado del Top 10 con avatar/fallback, nombre, Bricks, imagen/número/nombre de nivel, total `COLECCIÓN`, flecha y estado de error; verificar los datos visibles y la resolución compartida de imágenes de nivel en el test web.
- [x] 4.3 Mostrar la estrella junto a la fila y a la izquierda del avatar principal solo cuando el `userId` de sesión esté en el Top 10; verificar entrada, salida y limpieza de sesión/ranking en el test web.
- [x] 4.4 Implementar el acordeón exclusivo y reutilizar las tarjetas/tooltip de precio y antigüedad en modo no interactivo; verificar `aria-expanded`, cierre automático, criterios visibles y que las tarjetas no abren detalles ni modifican datos.
- [x] 4.5 Implementar el envío de 50 Bricks con botón ausente en la fila propia, deshabilitado por `regaloEnviado` o durante POST, y refresco canónico de ranking/gamificación tras éxito; verificar éxito, doble clic, error y deshabilitación permanente por destinatario.
- [x] 4.6 Renderizar `🎁` para logros con `type: "regalo"` y conservar la copa actual para el resto; verificar ambos tipos en `test/gamificacion-web.test.js`.

## 5. Verificación integral

- [x] 5.1 Ejecutar `npm.cmd test` y corregir únicamente regresiones relacionadas hasta que pasen la suite existente y las pruebas nuevas de ranking, seguridad, persistencia y UI.
- [x] 5.2 Ejecutar `openspec validate "lego-12-ranking-global" --type change --strict --no-interactive` y verificar que todos los deltas y escenarios cumplen el contrato antes de dar la implementación por terminada.