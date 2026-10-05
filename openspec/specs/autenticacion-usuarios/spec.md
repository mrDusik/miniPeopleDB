# autenticacion-usuarios Specification

## Purpose

Identifica a cada usuario mediante Google OAuth, mantiene su sesión en la interfaz web y garantiza que la API de datos solo atienda peticiones autenticadas.

## Requirements

### Requirement: Iniciar sesión con Google

La interfaz SHALL mostrar una pantalla de acceso con un botón "Iniciar sesión con Google" cuando no exista una sesión válida, y SHALL ocultar el contenido de la colección hasta que el usuario esté autenticado. El inicio de sesión SHALL delegarse en el proveedor Google a través de Supabase Auth usando el flujo PKCE y SHALL volver a la misma aplicación tras la autenticación.

#### Scenario: Usuario sin sesión abre la aplicación
- **WHEN** un usuario sin sesión carga la página principal
- **THEN** se muestra la pantalla de acceso con el botón "Iniciar sesión con Google"
- **AND** no se solicita ningún endpoint de datos de la API

#### Scenario: Usuario pulsa iniciar sesión
- **WHEN** el usuario pulsa "Iniciar sesión con Google"
- **THEN** la aplicación inicia el flujo OAuth del proveedor `google` con redirección al origen de la aplicación

#### Scenario: Fallo al iniciar el flujo OAuth
- **WHEN** el proveedor devuelve un error al iniciar el flujo
- **THEN** la pantalla de acceso permanece visible
- **AND** se muestra un mensaje de error sin detalles técnicos sensibles

### Requirement: Gestionar el estado de sesión

La interfaz SHALL restaurar una sesión existente al recargar la página, SHALL reaccionar a los cambios de estado de autenticación (inicio de sesión, refresco de token y cierre de sesión) y SHALL mostrar el nombre o correo del usuario autenticado junto a un botón "Cerrar sesión".

#### Scenario: Sesión existente al recargar
- **WHEN** el usuario con sesión válida recarga la página
- **THEN** la aplicación muestra directamente la colección sin volver a pedir inicio de sesión
- **AND** muestra el nombre o correo del usuario

#### Scenario: Cerrar sesión
- **WHEN** el usuario pulsa "Cerrar sesión"
- **THEN** la sesión se invalida
- **AND** la interfaz vacía los datos de la colección y de gamificación mostrados
- **AND** se vuelve a mostrar la pantalla de acceso

#### Scenario: Sesión expirada o rechazada por la API
- **WHEN** una llamada a la API de datos responde `401`
- **THEN** la interfaz cierra la sesión local
- **AND** muestra la pantalla de acceso con un aviso de sesión caducada

### Requirement: Enviar credenciales a la API de datos

La interfaz SHALL incluir el access token vigente de la sesión en la cabecera `Authorization: Bearer <token>` de cada petición a los endpoints de datos, y SHALL NOT almacenar el token en cookies propias ni incluirlo en URLs.

#### Scenario: Petición autenticada
- **WHEN** la interfaz solicita `GET /minifiguras` con una sesión activa
- **THEN** la petición incluye `Authorization: Bearer <access_token>`

### Requirement: Exponer la configuración pública del cliente

El sistema SHALL exponer `GET /config/supabase` sin autenticación, devolviendo únicamente la URL del proyecto y la clave pública `anon`. SHALL NOT exponer claves de servicio ni otros secretos.

#### Scenario: Consultar configuración pública
- **WHEN** un cliente realiza `GET /config/supabase`
- **THEN** el sistema responde `200` con `{ "url": <string>, "anonKey": <string> }` y ningún otro campo

#### Scenario: Configuración ausente
- **WHEN** el servidor no tiene configurada la URL o la clave anónima
- **THEN** el sistema responde `500` con `{ "error": "CONFIGURACION_NO_DISPONIBLE" }` sin exponer rutas ni valores

### Requirement: Rechazar peticiones de datos no autenticadas

Los endpoints `/minifiguras`, `/minifiguras/*`, `/gamificacion`, `/valoracion`, `/valor-total`, `/sincronizacion/brickset`, `/api/ranking` y `/api/ranking/regalar` SHALL exigir un access token válido de Supabase. Los endpoints existentes de colección SHALL operar exclusivamente sobre los datos del usuario del token; los endpoints de ranking SHALL limitar la lectura y mutación entre usuarios a los campos y operaciones definidos por la capacidad `ranking-global`. `/categorias`, `/config/supabase` y los recursos estáticos SHALL seguir siendo públicos.

#### Scenario: Petición sin cabecera Authorization
- **WHEN** un cliente realiza `GET /minifiguras` sin cabecera `Authorization`
- **THEN** el sistema responde `401` con `{ "error": "NO_AUTENTICADO" }`
- **AND** no consulta la persistencia

#### Scenario: Ranking sin cabecera Authorization
- **WHEN** un cliente realiza `GET /api/ranking` o `POST /api/ranking/regalar` sin cabecera `Authorization`
- **THEN** el sistema responde `401` con `{ "error": "NO_AUTENTICADO" }`
- **AND** no consulta ni modifica la persistencia

#### Scenario: Token inválido o caducado
- **WHEN** un cliente envía un token que Supabase Auth no reconoce como válido
- **THEN** el sistema responde `401` con `{ "error": "NO_AUTENTICADO" }`

#### Scenario: Endpoint público
- **WHEN** un cliente sin sesión realiza `GET /categorias`
- **THEN** el sistema responde como hasta ahora sin exigir autenticación

#### Scenario: Aislamiento entre usuarios
- **WHEN** el usuario A y el usuario B tienen minifiguras con el mismo `id`
- **THEN** `GET /minifiguras` con el token de A devuelve solo las de A
- **AND** una modificación ordinaria hecha con el token de A no altera los datos de B

### Requirement: Mantener el perfil público del usuario autenticado

Tras validar una sesión, el sistema SHALL obtener del usuario autenticado el nombre visible y avatar proporcionados por Google y SHALL mantener una proyección pública limitada a `user_id`, `display_name` y `avatar_url`. SHALL NOT confiar en valores de perfil enviados en el cuerpo de una petición ni exponer correo, tokens u otros metadatos de autenticación.

#### Scenario: Primera petición de un usuario de Google
- **WHEN** un usuario autenticado realiza su primera petición protegida
- **THEN** su nombre visible y avatar quedan disponibles para futuras respuestas del ranking

#### Scenario: Metadatos de Google actualizados
- **WHEN** una sesión válida contiene un nombre visible o avatar distinto del almacenado
- **THEN** la proyección pública se actualiza con los valores vigentes del token validado
