# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Mantener el perfil público del usuario autenticado

Tras validar una sesión, el sistema SHALL obtener del usuario autenticado el nombre visible y avatar proporcionados por Google y SHALL mantener una proyección pública limitada a `user_id`, `display_name` y `avatar_url`. SHALL NOT confiar en valores de perfil enviados en el cuerpo de una petición ni exponer correo, tokens u otros metadatos de autenticación.

#### Scenario: Primera petición de un usuario de Google
- **WHEN** un usuario autenticado realiza su primera petición protegida
- **THEN** su nombre visible y avatar quedan disponibles para futuras respuestas del ranking

#### Scenario: Metadatos de Google actualizados
- **WHEN** una sesión válida contiene un nombre visible o avatar distinto del almacenado
- **THEN** la proyección pública se actualiza con los valores vigentes del token validado
