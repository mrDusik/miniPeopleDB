# Spec Delta

## ADDED Requirements

### Requirement: Publicar el resumen de progreso diario confirmado

Al confirmar el snapshot diario de un usuario, el proceso `daily-sync` SHALL crear o actualizar una notificacion de resumen para esa fecha. El resumen SHALL comparar con el snapshot anterior existente del usuario e incluir diferencias de figuras, valor total EUR, Bricks, nivel y los cuatro porcentajes DNA, aceptando diferencias negativas. No SHALL fabricar cambios si no existe base previa. SHALL mostrar el movimiento de posicion global o semanal solo si el usuario pertenecia al ranking en ambas mediciones. La creacion del snapshot y el resumen SHALL ser idempotentes ante reintentos y el resumen SHALL NOT publicarse antes de confirmar la captura.

#### Scenario: Snapshot diario completado
- **WHEN** el trabajador confirma un snapshot y existe una medicion anterior
- **THEN** genera el resumen con diferencias netas de todos los valores y DNA
- **AND** conserva movimientos negativos de nivel y valor de coleccion

#### Scenario: Usuario sin medicion base
- **WHEN** se confirma el primer snapshot del usuario
- **THEN** crea el resumen sin diferencias ficticias ni valores base cero

#### Scenario: Reintento y fallo parcial
- **WHEN** se reintenta la captura de la misma fecha o falla antes de confirmar el snapshot
- **THEN** se actualiza como maximo un resumen por usuario y fecha, o no se publica resumen si el snapshot no fue confirmado