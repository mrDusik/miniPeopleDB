# Spec Delta

## ADDED Requirements

### Requirement: Recuperar en Android una cuenta confirmada desde un navegador externo

El cliente Android SHALL mantener el traspaso pendiente de forma recuperable y SHALL comprobarlo mientras la app esté activa y al reanudarse. Tras validar y establecer la sesión recibida, SHALL eliminar el material temporal y usar el flujo existente de perfil y onboarding antes de consultar datos protegidos.

#### Scenario: Confirmación en navegador de otro dispositivo
- **WHEN** se confirma el email desde un navegador distinto mientras la app Android espera el registro
- **THEN** Android obtiene el traspaso sin requerir que el navegador y la app compartan dispositivo
- **AND** la pantalla de onboarding aparece si el perfil todavía no está completo

#### Scenario: Android se reabre tras la confirmación
- **WHEN** Android se cierra durante la confirmación y vuelve a abrirse antes de que expire el traspaso
- **THEN** la app reanuda el traspaso pendiente y establece la sesión antes de solicitar datos protegidos

#### Scenario: Traspaso vencido o inválido
- **WHEN** Android recibe un traspaso vencido, ya consumido o que no puede descifrar
- **THEN** descarta la prueba y la clave temporal, conserva la pantalla de acceso y muestra un error genérico recuperable

#### Scenario: Autenticación OAuth existente
- **WHEN** una persona inicia sesión con Google en Android después de añadir el traspaso de email
- **THEN** el callback PKCE existente continúa funcionando sin cambios de destino ni de validación
