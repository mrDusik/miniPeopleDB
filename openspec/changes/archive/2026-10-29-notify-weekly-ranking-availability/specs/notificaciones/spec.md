# Spec Delta

## ADDED Requirements

### Requirement: Avisar de la disponibilidad semanal una vez por semana
Cuando una sincronizacion diaria completada produzca por primera vez candidatos validos para el Ranking Semanal de una semana ISO en Europe/Madrid, el sistema SHALL crear una notificacion duradera y no leida para cada cuenta registrada. La notificacion SHALL identificar `weekStart` y ofrecer una accion para abrir el Ranking Semanal. SHALL existir como maximo una notificacion por cuenta y semana. Los reintentos, capturas posteriores y lecturas del ranking SHALL NOT duplicarla; abrir el ranking SHALL NOT marcarla como leida. Sin candidatos comparables SHALL NOT crearse la notificacion.

#### Scenario: Primera medicion valida de la semana
- **WHEN** la sincronizacion diaria confirma la primera captura que hace disponible el Ranking Semanal
- **THEN** cada cuenta registrada recibe una notificacion no leida con el inicio de semana y una accion para abrir el ranking

#### Scenario: Reintento o medicion diaria posterior
- **WHEN** se reintenta la sincronizacion o se confirma otra captura de la misma semana
- **THEN** no se duplica la notificacion de disponibilidad de esa semana

#### Scenario: Sin ranking disponible
- **WHEN** la sincronizacion no encuentra candidatos con base y medicion semanal validas
- **THEN** no crea notificaciones de disponibilidad

#### Scenario: Abrir el ranking desde la bandeja
- **WHEN** el usuario activa la accion de una notificacion de disponibilidad
- **THEN** se abre el dialogo Ranking Semanal y la notificacion conserva su estado leido/no leido

#### Scenario: Nueva semana
- **WHEN** una semana ISO posterior se vuelve disponible por primera vez
- **THEN** se crea una nueva notificacion por cuenta para esa semana