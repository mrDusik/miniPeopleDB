# Tasks

## 1. Compartir la cotización del BCE

- [x] 1.1 Exponer y reutilizar el tipo BCE USD/EUR desde el scraper sin duplicar la petición, caché de 24 horas ni política de reintento; ampliar `test/brickset-scraper.test.js` para validar ambas conversiones base, caché, tasa inválida y fallo.
- [x] 1.2 Añadir la consulta autenticada de tipo de cambio reutilizando la cotización compartida; probar respuesta, caché, error del BCE y rechazo sin JWT con los helpers de API existentes.

## 2. Habilitar USD en preferencias

- [x] 2.1 Ampliar a `EUR`/`USD` la restricción de `supabase/schema.sql` y crear una migración transaccional y reejecutable que conserve el default EUR, perfiles, RLS y grants; probar esquema nuevo, migración y repetición con PGlite.
- [x] 2.2 Actualizar validación de perfil y mock compartido para aceptar solo EUR/USD; ampliar `test/profile-api.test.js` para guardar y leer ambas monedas, rechazar valores inválidos sin cambios parciales y mantener EUR por defecto.
- [x] 2.3 Habilitar Dólar en onboarding/Preferencias y localizar su etiqueta en ES/EN/IT/FR; ampliar tests de autenticación/perfil para verificar las dos monedas activas y que el valor guardado se recupera.

## 3. Convertir y mostrar precios con seguridad

- [x] 3.1 Añadir helpers de conversión y formato según la moneda del perfil, preparando la tasa antes de confirmar USD; cubrir USD/EUR, EUR/USD, redondeo, fallo y reintento con tests de interfaz.
- [x] 3.2 Aplicar la moneda elegida a precios, diferencias, resumen, rankings, perfiles, histórico, gráficos, tooltips y avisos sin alterar los datos EUR; verificar superficies representativas y el cambio EUR↔USD sin pérdida de estado.
- [x] 3.3 Mostrar el precio de compra en la moneda activa y convertirlo a EUR al crear/editar; verificar con tests web/API el valor canónico enviado, la edición sin guardar y que el fallo de tasa no persiste importes incorrectos.

## 4. Documentar y validar la integración

- [x] 4.1 Actualizar la documentación existente sobre EUR/USD, tipo BCE, unidad canónica EUR, migración previa y manejo de indisponibilidad; verificar que coincide con los recursos y comandos reales.
- [x] 4.2 Ejecutar una selección de tests de cotización, perfil/PGlite, autenticación, inventario, valoración, histórico y recursos web/Android; ejecutar `npm test` si los resultados indican riesgo de regresión transversal.
- [x] 4.3 Ejecutar `openspec validate add-eur-usd-price-conversion --strict` y comprobar que la migración conserva compatibilidad EUR y que todos los escenarios tienen pruebas.
