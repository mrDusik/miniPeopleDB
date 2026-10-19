# Spec Delta

## ADDED Requirements

### Requirement: Asignar usernames secuenciales a perfiles legados

La migración SHALL identificar cuentas existentes cuyo onboarding no está completado y cuyo username conserva exactamente el nombre predeterminado `Coleccionista`. SHALL asignar a cada una un nombre `ColeccionistaN`, empezando en 1 y procesando las cuentas en orden de registro ascendente, con `user_id` ascendente como desempate determinista. SHALL saltar sufijos que ya estén ocupados sin distinguir mayúsculas y minúsculas, conservar la unicidad global y actualizar la identidad pública visible junto al username. La migración SHALL ser idempotente y SHALL NOT cambiar usernames de cuentas con onboarding completo ni perfiles que ya tengan otro username. Las cuentas migradas SHALL poder elegir su username definitivo mediante el onboarding existente.

#### Scenario: Migrar varios perfiles predeterminados
- **WHEN** la migración encuentra varias cuentas sin onboarding con username `Coleccionista`
- **THEN** asigna nombres secuenciales únicos según su orden de registro
- **AND** el username y el nombre público coinciden

#### Scenario: Resolver sufijos ocupados y repetir migración
- **WHEN** un sufijo generado ya está ocupado o la migración vuelve a ejecutarse
- **THEN** se usa el siguiente sufijo libre y no se generan duplicados ni se renombran cuentas ya migradas

#### Scenario: Preservar perfiles no elegibles
- **WHEN** una cuenta completó el onboarding o ya tiene un username distinto del nombre predeterminado
- **THEN** su username y nombre público permanecen sin cambios