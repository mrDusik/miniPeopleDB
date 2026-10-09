# Spec Delta

## ADDED Requirements

### Requirement: Notificar transiciones del Ranking Semanal

Cuando el Ranking Semanal este disponible segun su contrato vigente, el sistema SHALL notificar una sola vez la entrada de un usuario al Top 10 con su posicion o su salida del Top 10. Una lectura del ranking SHALL NOT crear ni repetir una transicion. Las notificaciones de movimiento diario SHALL limitarse a usuarios presentes en el ranking en ambas mediciones comparadas.

#### Scenario: Entrada semanal
- **WHEN** una medicion valida incorpora un usuario al Top 10 semanal
- **THEN** se crea una notificacion no leida con el nombre del ranking y la posicion

#### Scenario: Salida semanal
- **WHEN** una medicion valida retira del Top 10 semanal a un usuario que pertenecia a el
- **THEN** se crea una notificacion no leida de salida sin incluir una posicion inventada

#### Scenario: Ranking no disponible o lectura repetida
- **WHEN** el ranking semanal aun no esta disponible o un usuario vuelve a consultar el mismo estado
- **THEN** no se crea una transicion ni se duplica una notificacion existente