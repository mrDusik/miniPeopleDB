# Proposal

## Why

La interfaz solo esta disponible en espanol, aunque el perfil ya contiene una preferencia de idioma y muestra Ingles como opcion futura. Se necesita habilitar ingles sin alterar el contenido de Brickset ni los nombres originales de los logros, y establecer una base mantenible para traducir la interfaz.

## What Changes

- Incorporar catalogos de textos por claves estables para espanol (`es`) e ingles (`en`), con interpolacion, plurales y respaldo espanol.
- Traducir toda la interfaz propia: acceso, onboarding, preferencias, inventario, filtros, formularios, rankings, amigos, perfiles, DNA, historico, contacto, notificaciones dentro de la app, toasts, errores y accesibilidad; incluir las paginas propias de confirmacion de email web y Android.
- Conservar sin traduccion los datos procedentes de Brickset y los nombres de los logros. **Aclaracion confirmada:** por "subtitulos" se entiende el nombre del logro, como `Block by block`; su descripcion inferior, como `Has anadido una minipersona`, SI se traduce.
- Habilitar Ingles en el selector de Preferencias/onboarding existente, junto a Espanol. Italiano y Frances seguiran deshabilitados; Euro seguira siendo la unica moneda habilitada.
- Guardar y recuperar `es`/`en` en el perfil existente de Supabase y aplicar el idioma tras guardar correctamente, sin perder el estado de trabajo.
- Mantener espanol como idioma inicial sin preferencia y permitir recordar localmente el ultimo idioma confirmado para las pantallas sin sesion, subordinado siempre al perfil de la cuenta activa.
- Adaptar fechas, cantidades, porcentajes y moneda al idioma sin convertir importes ni cambiar valores, estados canonicos o reglas de negocio.
- Anadir pruebas automatizadas de catalogos, interfaz, persistencia, aislamiento entre sesiones y exclusiones.

## Capabilities

### New Capabilities

- `internacionalizacion-interfaz`: cobertura ES/EN, catalogos, resolucion y ciclo de vida del idioma, excepciones de contenido, mensajes y formatos locales en web y Android.

### Modified Capabilities

- `perfil-usuario`: permitir guardar espanol o ingles desde el selector existente conservando las reglas de avatar, username, favoritas y guardado coherente.
- `interfaz-web-minifiguras`: hacer que terminologia, nombres accesibles y textos/formatos de los filtros dependan del idioma, manteniendo los datos originales y la logica de filtrado.

## Impact

- Frontend sin framework en `public/index.html`, `public/app.js` y paginas/scripts de confirmacion de email; nuevos recursos locales de internacionalizacion.
- Dependencia propuesta: i18next, distribuida localmente sin CDN; recursos servidos por Express y empaquetados en Android con el proceso existente.
- Validacion de `src/user-profile-repository.js`, restriccion de idioma de `supabase/schema.sql` y migracion incremental para bases existentes, sin cambiar el contrato de `GET/PUT /api/profile` ni de `guardar_perfil_usuario`.
- Renderizado de mensajes procedentes del backend por codigo/tipo e identificadores estables, sin traducir ni reescribir los datos persistidos.
- Tests existentes Node/JSDOM, mock compartido de Supabase para API y PGlite para migracion, RPC y aislamiento RLS.
- Documentacion de idiomas, exclusiones, despliegue de la migracion y empaquetado Android.
- Fuera de alcance: otros idiomas, selector nuevo antes del acceso, deteccion automatica del idioma del navegador, conversion de divisas, traduccion automatica, contenido libre del usuario, emails enviados por proveedores y texto de notificaciones push del sistema operativo fuera de la app. Los avisos que se leen dentro de la app SI se traducen.
