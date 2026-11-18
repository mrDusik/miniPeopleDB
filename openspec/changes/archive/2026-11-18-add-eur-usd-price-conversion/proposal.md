# Proposal

## Why

La aplicacion almacena y muestra todos los precios en EUR aunque Brickset publica importes en USD y el BCE ya proporciona el tipo de cambio diario. Habilitar USD como preferencia de presentacion y entrada permitira trabajar con ambas monedas sin cambiar la unidad canonica ni reinterpretar los precios ya guardados.

## What Changes

- Habilitar EUR y USD en la preferencia de moneda existente del perfil, onboarding y Preferencias; EUR seguira siendo el valor predeterminado para perfiles actuales y nuevos.
- Reutilizar el tipo de cambio diario del BCE para conversiones EUR/USD y USD/EUR, con cache compartida en el servidor.
- Mantener `precio` y `precioCompra` persistidos en EUR. Convertir a la moneda del perfil para la presentacion y convertir los precios manuales a EUR antes de guardarlos.
- Aplicar la moneda elegida coherentemente a tabla, formularios, diferencias, resumen, rankings, graficos y avisos de valoracion.
- Rechazar con un error visible las operaciones que requieran conversion si el tipo de cambio BCE no esta disponible; no mostrar importes con un simbolo incorrecto ni guardar un valor sin convertir.
- Anadir migracion reejecutable de la restriccion de moneda del perfil y pruebas de API, perfil, conversion, fallo BCE y compatibilidad con los importes EUR existentes.

## Capabilities

### New Capabilities

### Modified Capabilities
- `perfil-usuario`: permitir guardar EUR o USD como preferencia de moneda.
- `valoracion-coleccion`: exponer el tipo de cambio BCE vigente necesario para conversiones de precios.
- `interfaz-web-minifiguras`: presentar precios y aceptar precios de compra en la moneda seleccionada, convirtiendo los valores manuales antes de persistirlos.

## Impact

- Perfil: `src/user-profile-repository.js`, `src/server.js`, RPC `guardar_perfil_usuario`, esquema y migracion Supabase, mock compartido y pruebas PGlite.
- Conversion: extractor/cache BCE existente en `src/brickset-scraper.js`, su integracion con API autenticada y pruebas de Brickset/API.
- Valoracion: operacion autenticada de consulta del tipo de cambio diario BCE.
- Interfaz: `public/app.js`, `public/index.html`, catalogos ES/EN/IT/FR, pruebas web, y documentacion de despliegue existente.
- No requiere cambiar el esquema ni los contratos de precios de cada minifigura ni el resumen de valoracion; sus valores y respuestas existentes continuan en EUR.
