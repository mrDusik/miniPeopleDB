# Spec Delta

## ADDED Requirements

### Requirement: Registrarse con email e iniciar sesión con Username y contraseña

La interfaz SHALL permitir crear una cuenta de Supabase Auth con email y contraseña, indicando un username que cumpla `/^[a-zA-Z0-9_]{3,20}$/`, e iniciar sesión solo con Username y contraseña. El email SHALL estar oculto y deshabilitado en el inicio de sesión. Supabase Auth SHALL gestionar las credenciales y emitir la sesión; el sistema SHALL NOT almacenar contraseñas en tablas de la aplicación. El alta clásica SHALL coexistir con Google OAuth y los errores SHALL mostrarse sin detalles internos sensibles.

#### Scenario: Confirmación y seguridad en el registro
- **WHEN** una persona selecciona crear cuenta
- **THEN** aparece el campo obligatorio "Repetir Contraseña" y se rechaza el alta si no coincide
- **AND** se comprueba al menos cinco caracteres, una mayúscula, una minúscula y un número antes de enviar el alta
- **AND** cada directriz se muestra en rojo mientras no se cumpla y en verde cuando se cumpla, actualizándose al escribir o borrar
- **AND** un toggle muestra u oculta el contenido de los dos campos simultáneamente
- **AND** estas reglas de alta no impiden acceder con una contraseña existente

#### Scenario: Registro clásico válido
- **WHEN** una persona envía un email, username con formato válido y contraseña que acepta Supabase Auth
- **THEN** se crea la identidad en Supabase Auth y se inicia o continúa el flujo de confirmación de email configurado
- **AND** la contraseña no aparece en tablas de la aplicación ni en respuestas de la API

#### Scenario: Username de registro inválido
- **WHEN** el username no cumple `/^[a-zA-Z0-9_]{3,20}$/`
- **THEN** el formulario rechaza el alta antes de enviarla
- **AND** no se crea una identidad

#### Scenario: Inicio de sesión clásico
- **WHEN** una persona envía solo Username y contraseña válidos de una cuenta clásica con perfil guardado
- **THEN** Supabase Auth establece la misma clase de sesión que para Google
- **AND** el Username se resuelve sin distinguir mayúsculas, comprobando primero la contraseña y sin exponer el email al navegador
- **AND** la API devuelve solo tokens sin caché y respeta los rechazos de Supabase Auth
- **AND** las peticiones posteriores usan el access token vigente en `Authorization: Bearer <token>`

#### Scenario: Credenciales clásicas rechazadas
- **WHEN** el Username no existe, la contraseña es incorrecta, se supera el límite de intentos o Supabase Auth rechaza el acceso
- **THEN** la pantalla de acceso permanece visible y muestra un error controlado
- **AND** no se exponen detalles técnicos ni se solicitan datos del inventario

### Requirement: Recuperar contraseña de una cuenta clásica

La interfaz SHALL permitir solicitar a Supabase Auth un enlace de recuperación para una cuenta clásica y completar el cambio de contraseña mediante el flujo seguro de Auth. SHALL NOT revelar si un email está registrado.

#### Scenario: Solicitud de recuperación
- **WHEN** una persona solicita recuperar su contraseña indicando un email
- **THEN** la aplicación solicita a Supabase Auth el envío del enlace de recuperación
- **AND** muestra una confirmación que no revela si existe una cuenta para ese email

#### Scenario: Cambio de contraseña desde enlace válido
- **WHEN** la persona abre un enlace de recuperación vigente y envía una nueva contraseña aceptada
- **THEN** Supabase Auth actualiza la contraseña
- **AND** la aplicación no almacena la contraseña en sus tablas

## MODIFIED Requirements

### Requirement: Gestionar el estado de sesión

La interfaz SHALL restaurar una sesión existente al recargar la página, SHALL reaccionar a los cambios de estado de autenticación (inicio de sesión, refresco de token y cierre de sesión) y SHALL mostrar el username guardado del usuario autenticado junto a un botón "Cerrar sesión". Tras autenticar, SHALL comprobar el perfil antes de solicitar datos del inventario. Si el onboarding no está completo o falta un username, SHALL mostrar obligatoriamente el modal de completar perfil y SHALL impedir el acceso operativo al inventario hasta que el guardado del perfil se confirme. Esto SHALL aplicarse a usuarios Google nuevos o existentes y a usuarios clásicos.

#### Scenario: Sesión existente al recargar
- **WHEN** el usuario con sesión válida recarga la página y su perfil tiene onboarding completo
- **THEN** la aplicación muestra directamente la colección sin volver a pedir inicio de sesión ni onboarding
- **AND** muestra el username del perfil en lugar del nombre del proveedor o correo

#### Scenario: Sesión válida con perfil incompleto
- **WHEN** una sesión válida se restaura y el perfil no existe, carece de username o indica onboarding incompleto
- **THEN** la aplicación abre el modal obligatorio de completar perfil
- **AND** no solicita endpoints de colección, gamificación, ranking ni notificaciones hasta completar el perfil

#### Scenario: Usuario Google existente sin username
- **WHEN** un usuario Google existente vuelve a la aplicación y su perfil no contiene username único o onboarding completado
- **THEN** conserva su sesión de Supabase Auth
- **AND** debe completar el perfil antes de operar el inventario

#### Scenario: Perfil guardado correctamente
- **WHEN** el usuario completa los campos obligatorios y el servidor confirma su persistencia
- **THEN** se cierra el modal de onboarding y se inicializa el inventario una sola vez

#### Scenario: Error al comprobar o guardar el perfil
- **WHEN** no se puede consultar el estado del perfil o falla su guardado
- **THEN** el inventario permanece inaccesible y se muestra un error controlado con opción de reintento
- **AND** la sesión autenticada no se elimina por ese fallo

#### Scenario: Cerrar sesión
- **WHEN** el usuario pulsa "Cerrar sesión"
- **THEN** la sesión se invalida
- **AND** la interfaz vacía los datos de la colección y de gamificación mostrados
- **AND** se vuelve a mostrar la pantalla de acceso

#### Scenario: Sesión expirada o rechazada por la API
- **WHEN** una llamada a la API de datos responde `401`
- **THEN** la interfaz cierra la sesión local
- **AND** muestra la pantalla de acceso con un aviso de sesión caducada

### Requirement: Mantener el perfil público del usuario autenticado

Tras validar una sesión, el sistema SHALL obtener del perfil guardado su username y SHALL mantenerlo como `display_name` en la proyección pública limitada a `user_id`, `display_name` y `avatar_url`. La publicación del username está explícitamente autorizada. Cuando el usuario tenga un avatar personalizado en su perfil, ese valor SHALL prevalecer sobre el avatar de Google; en otro caso se SHALL usar el avatar vigente de Google. SHALL NOT tomar el nombre público de metadatos OAuth o de campos no validados del cuerpo, ni exponer correo, tokens u otras preferencias privadas.

#### Scenario: Primera petición de un usuario de Google
- **WHEN** un usuario autenticado realiza su primera petición protegida
- **THEN** su username guardado y el avatar disponible quedan disponibles para futuras respuestas del ranking

#### Scenario: Metadatos de Google actualizados
- **WHEN** una sesión válida contiene un nombre visible distinto del almacenado y no existe un avatar personalizado
- **THEN** la proyección pública conserva el username guardado y actualiza solo el avatar del token validado

#### Scenario: Avatar personalizado
- **WHEN** el usuario configura un avatar propio y después realiza una petición protegida
- **THEN** la proyección pública conserva el avatar personalizado en vez de sobrescribirlo con el avatar de Google
- **AND** el nombre visible continúa siendo el username guardado