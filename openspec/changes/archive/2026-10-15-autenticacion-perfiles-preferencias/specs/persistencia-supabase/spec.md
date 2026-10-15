# Spec Delta

## ADDED Requirements

### Requirement: Resolver Username únicamente con prueba de contraseña

La RPC `resolver_acceso_username` SHALL ser la única excepción de acceso global para login: ejecutable por `anon`, con `SECURITY DEFINER` y search path fijo, SHALL resolver el email solo tras comprobar la contraseña contra el hash existente de Supabase Auth. SHALL NOT conceder lectura directa a `auth.users`, perfiles ni contadores privados, ni usar `service_role`. La limitación de cinco intentos por cuenta en ventanas de un minuto SHALL ser atómica, compartida entre instancias del servidor y case-insensitive. Los contadores SHALL eliminarse en cascada con la identidad. Supabase Auth SHALL seguir siendo la autoridad de emisión de sesiones.

#### Scenario: Resolución protegida y límite de intentos
- **WHEN** se invoca la RPC sin una contraseña válida o tras agotar cinco intentos de la cuenta en un minuto
- **THEN** devuelve null sin revelar si el Username existe
- **AND** la llamada no concede acceso a las tablas privadas
- **AND** una nueva ventana permite volver a autenticar sin guardar contraseñas ni hashes adicionales

### Requirement: Persistir perfiles privados y favoritos con RLS

El sistema SHALL almacenar username, estado de onboarding, avatar y preferencias de idioma y moneda en una tabla relacional `user_profiles` ligada por clave foránea a `auth.users`. Las categorías favoritas SHALL almacenarse como filas relacionales separadas y no como JSON. SHALL imponerse en la base de datos la unicidad del username sin distinguir mayúsculas/minúsculas y la validación del formato `/^[a-zA-Z0-9_]{3,20}$/`. RLS SHALL permitir a cada usuario consultar y modificar únicamente su perfil y sus favoritos. Por autorización explícita, `perfiles_publicos.display_name` SHALL contener el username guardado; la proyección SHALL conservar su esquema limitado para ranking y regalos y SHALL NOT exponer email ni preferencias privadas.

#### Scenario: Guardar perfil propio
- **WHEN** un usuario autenticado guarda su perfil y preferencias
- **THEN** los datos quedan asociados exclusivamente a `auth.uid()` en `user_profiles`
- **AND** las categorías favoritas quedan en filas relacionales separadas

#### Scenario: Rechazar username duplicado ignorando mayúsculas
- **WHEN** dos usuarios intentan guardar usernames iguales salvo por mayúsculas/minúsculas
- **THEN** la base de datos acepta como máximo uno
- **AND** el perfil rechazado no queda marcado como onboarding completo

#### Scenario: Rechazar username con formato inválido
- **WHEN** una escritura intenta guardar un username fuera del formato permitido
- **THEN** la base de datos la rechaza incluso si evita la validación de interfaz

#### Scenario: Aislar perfiles y favoritos por propietario
- **WHEN** un usuario consulta o modifica perfiles o favoritos de otro usuario
- **THEN** RLS no devuelve ni modifica filas ajenas

#### Scenario: Rechazar más de tres favoritas
- **WHEN** se intenta guardar más de tres favoritas o insertar directamente una cuarta fila
- **THEN** API, RPC y trigger rechazan el exceso sin reemplazar parcialmente los datos
- **AND** el trigger bloquea la fila padre para serializar cambios y permite sustituir una categoría existente cuando ya hay tres

#### Scenario: Conservar la proyección pública existente
- **WHEN** el perfil se crea o modifica
- **THEN** las respuestas actuales de ranking y regalos siguen exponiendo únicamente los campos permitidos por sus contratos
- **AND** el nombre público es el username autorizado, sin añadir correo, idioma, moneda ni categorías favoritas

#### Scenario: Eliminar identidad
- **WHEN** se elimina una fila de `auth.users`
- **THEN** se eliminan en cascada su perfil privado y sus categorías favoritas

### Requirement: Borrar únicamente la identidad del JWT

La RPC sin parámetros `eliminar_cuenta_usuario()` SHALL ser ejecutable solo por `authenticated`, con `SECURITY DEFINER` y search path vacío. SHALL exigir `auth.uid()` no nulo y rol autenticado; su única identidad objetivo SHALL ser ese UID. SHALL NOT aceptar un usuario objetivo, usar `service_role` ni conceder acceso directo a `auth.users`. El borrado y sus cascadas SHALL ser una sola transacción y cualquier fallo SHALL revertirla por completo.

#### Scenario: Aislamiento y atomicidad del borrado
- **WHEN** una cuenta autenticada invoca la RPC
- **THEN** solo se elimina su fila de Auth y las filas relacionadas por las cascadas existentes
- **AND** las identidades y datos propios de otras cuentas permanecen
- **AND** si una cascada o trigger falla, la cuenta y sus datos se conservan
- **AND** llamadas anónimas o sin un UID autenticado se rechazan

### Requirement: Persistir avatares con permisos por carpeta

El bucket público `profile-avatars` SHALL limitar archivos a 2 MiB y MIME PNG/JPEG/WebP. Las políticas SHALL permitir insertar únicamente en `<auth.uid()>/<uuid>.png|jpg|webp` y listar/borrar solo objetos de la carpeta del JWT, sin sobrescritura ni service_role. El perfil SHALL guardar solo la URL, nunca el archivo ni una imagen base64. El borrado de cuenta SHALL limpiar su carpeta mediante Storage antes de invocar la RPC de Auth; un fallo de Storage SHALL impedir eliminar la identidad. La eliminación física de archivos no forma parte del rollback SQL posterior.

#### Scenario: Rechazar accesos a archivos ajenos
- **WHEN** una cuenta intenta subir o borrar en otra carpeta o subir SVG/rutas anidadas
- **THEN** la política rechaza la operación
- **AND** la lectura pública de imágenes no concede lectura de preferencias ni perfiles privados