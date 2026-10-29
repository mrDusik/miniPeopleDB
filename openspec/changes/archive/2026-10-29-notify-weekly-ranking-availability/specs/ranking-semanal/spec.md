# Spec Delta

## ADDED Requirements

### Requirement: Publicar el primer ranking semanal disponible
El sistema SHALL considerar disponible una semana a partir de la primera sincronizacion diaria completada que contenga al menos un candidato con snapshots V2 comparables. Ese evento SHALL emitir la notificacion semanal definida en `notificaciones` una sola vez por semana ISO en Europe/Madrid, sin crearla durante una lectura HTTP del ranking.

#### Scenario: Disponibilidad tras completar snapshots
- **WHEN** una sincronizacion diaria completada encuentra al menos un candidato comparable en una semana activa
- **THEN** publica la disponibilidad de esa semana y emite el aviso informativo una sola vez

#### Scenario: Lectura sin nueva captura
- **WHEN** un usuario consulta el ranking varias veces sin una nueva sincronizacion diaria
- **THEN** la consulta devuelve el estado actual y no genera notificaciones