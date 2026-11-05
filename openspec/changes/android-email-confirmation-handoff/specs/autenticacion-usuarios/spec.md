# Spec Delta

## ADDED Requirements

### Requirement: Completar registro Android tras confirmar el email en un navegador externo

Tras confirmar el email de una cuenta registrada en Android, el sistema SHALL entregar a la app originaria una sesión válida de Supabase Auth mediante un traspaso cifrado, temporal y de un solo uso. La sesión SHALL quedar vinculada a la cuenta y al registro que inició el traspaso.

#### Scenario: Confirmación en otro dispositivo con Android abierto
- **WHEN** la persona confirma el email desde otro dispositivo mientras la app Android originaria está abierta
- **THEN** la app recibe y establece la sesión de la cuenta confirmada
- **AND** comprueba el perfil y muestra el onboarding obligatorio si falta completarlo
- **AND** no solicita datos operativos antes de completar el onboarding

#### Scenario: Confirmación mientras Android está cerrado
- **WHEN** la persona confirma el email mientras la app Android está cerrada y abre la app antes de expirar el traspaso
- **THEN** la app recupera y establece la sesión de la cuenta confirmada
- **AND** muestra el onboarding obligatorio antes de solicitar datos operativos

#### Scenario: Email confirmado para otra cuenta
- **WHEN** el navegador confirma una cuenta cuyo email no coincide con el registro Android que creó el traspaso
- **THEN** el traspaso se rechaza sin establecer una sesión en Android
- **AND** la app muestra un error genérico y conserva el acceso a la pantalla de autenticación

### Requirement: Proteger el traspaso de sesión de confirmación

El traspaso SHALL usar una prueba de posesión no incluida en el enlace de email, cifrar la sesión para la app originaria, expirar en un plazo máximo de 24 horas y permitir su consumo una sola vez. Las tablas SHALL permanecer inaccesibles a consultas directas de clientes; las operaciones SHALL limitarse a RPC allowlisted de traspaso, sin `service_role`.

#### Scenario: Leer o reutilizar un traspaso
- **WHEN** una persona consulta directamente la tabla, usa una prueba incorrecta o intenta consumir de nuevo un traspaso ya reclamado
- **THEN** no obtiene tokens ni datos privados y el traspaso no se vuelve disponible

#### Scenario: Traspaso expirado
- **WHEN** se intenta publicar o consumir un traspaso después de su expiración
- **THEN** se rechaza la operación sin crear una sesión en Android
- **AND** se elimina cualquier ciphertext vencido durante la operación

#### Scenario: Exposición del enlace o del callback
- **WHEN** el sistema procesa un enlace de confirmación
- **THEN** los access tokens y refresh tokens no aparecen en URLs, logs ni respuestas de API en texto claro
- **AND** el token de verificación de Supabase se consume y se elimina de la URL visible antes de mostrar el resultado

#### Scenario: Error de publicación o consumo
- **WHEN** falla una operación temporal de traspaso
- **THEN** la API devuelve un error genérico sin tokens ni detalles internos
- **AND** la cuenta confirmada y la sesión del navegador no se revocan por el fallo de persistencia
