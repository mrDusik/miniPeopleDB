# Proposal

## Why

El acceso exclusivamente mediante Google impide el registro clásico y no ofrece una identidad de comunidad ni preferencias persistentes. Un perfil relacional permitirá incorporar usuarios actuales y nuevos mediante un onboarding consistente, y dejará una base segura para futuras funciones sociales.

## What Changes

- Añadir registro con email, Username y contraseña, e inicio de sesión solo por Username y contraseña mediante Supabase Auth, incluida la recuperación por email, sin retirar Google OAuth.
- Exigir repetir contraseña en el registro, un toggle que muestre ambos campos y directrices dinámicas rojo/verde: al menos cinco caracteres, mayúscula, minúscula y número.
- Autorizar exclusivamente para el acceso clásico una RPC de resolución de Username protegida por contraseña y limitada a cinco intentos por cuenta/minuto, sin `service_role` ni exposición pública del email.
- Exigir completar username y preferencias antes de usar el inventario; cubrir usuarios Google existentes y nuevos, además de nuevos usuarios clásicos.
- Añadir preferencias editables de avatar, idioma, moneda y categorías favoritas, con username único sin distinguir mayúsculas/minúsculas.
- Compactar Preferencias en tres filas: Username/avatar con Cargar y vista previa; Idioma/Moneda; favoritas visibles con contador 0/3 a 3/3 y máximo de tres. Subir PNG/JPEG/WebP de hasta 2 MiB a Supabase Storage mediante JWT, únicamente al guardar.
- Usar el username guardado como identidad visible propia y nombre público en rankings y avisos nuevos o guardados, con autorización explícita para sustituir el nombre del proveedor; corregir los históricos mediante referencias fiables sin cambiar fechas ni lectura, y no publicar emails ni preferencias privadas.
- Reducir el menú de perfil a la mitad de su ancho anterior y añadir al final de Preferencias la eliminación irreversible de la cuenta propia, con confirmación separada y borrado autenticado en cascada sin `service_role`.
- Persistir el perfil y las categorías favoritas en relaciones normalizadas protegidas por RLS, y conservar la proyección pública existente para ranking y regalos.
- Mantener Euro y Español como únicas opciones activas; mostrar Dólar e Inglés, Italiano y Francés como opciones futuras deshabilitadas.

## Capabilities

### New Capabilities
- `perfil-usuario`: onboarding, configuración personal, username y preferencias del perfil.

### Modified Capabilities
- `autenticacion-usuarios`: añadir acceso clásico y condicionar el acceso al inventario al onboarding, sin cambiar el flujo PKCE de Google.
- `persistencia-supabase`: almacenar perfiles/preferencias en tablas relacionales con aislamiento RLS y restricciones de unicidad.

## Impact

- Interfaz web en `public/index.html`, `public/app.js` y `public/styles.css`; autenticación del navegador con Supabase Auth.
- Esquema/migración de Supabase y permisos RLS; integración compatible con `public.perfiles_publicos` y sus consumidores de ranking/regalos.
- Validación de favoritos contra el catálogo local de `data/categorias-brickset.json`; pruebas web, de persistencia y SQL con PGlite.
- Suposiciones para revisión: avatar cargado desde el dispositivo con URL pública persistida, manteniendo compatibles las URLs HTTP/HTTPS existentes; username inmutable tras completar el onboarding; confirmar email seguirá la configuración de Supabase Auth.