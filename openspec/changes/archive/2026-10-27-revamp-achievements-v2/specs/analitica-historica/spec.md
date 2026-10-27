# Spec Delta

## MODIFIED Requirements

### Requirement: Persistir mediciones diarias coherentes e idempotentes

El sistema SHALL conservar user_daily_snapshots con id, user_id, snapshot_date, total_figures, total_value, bricks, level, pct_collector, pct_explorer, pct_rarity_hunter, pct_fan y created_at, FK a auth.users con cascada y unicidad por usuario/fecha. SHALL contar solo COLECCIÓN, valorar mercado valido primero, compra como fallback y cero sin ambos. level SHALL ser ID numerico, incluyendo cero. Recuentos, valores y Bricks SHALL ser no negativos; porcentajes SHALL ser de 0 a 100 con dos decimales, cuatro ceros sin contribuciones y suma 100 con tolerancia 0.02 en otro caso.

La medicion SHALL usar el estado completo de gamificacion V2, incluidas relaciones y ledger vigentes, con pesos privados V2. Guardar snapshot y marcar usuario procesado SHALL ser atomico; reintentos SHALL conservar id y created_at. Los dias anteriores SHALL conservar sus capturas ante nuevas ponderaciones o fechas posteriores. La unica excepcion sera la migracion inicial autorizada a V2, que SHALL eliminar snapshots V1 completos, no reinterpretarlos ni mezclarlos con mediciones nuevas. La fuente de version SHALL ser controlada por backend, nunca un parametro elegido por el navegador.

#### Scenario: Coleccion mixta
- **WHEN** hay una figura con mercado 20 y compra 10, otra solo compra 5 y una buscada de valor 100
- **THEN** captura dos figuras y 25.00 EUR

#### Scenario: Idempotencia y atomicidad
- **WHEN** se repite una captura o falla la transaccion
- **THEN** existe como maximo una fila por usuario/fecha y no hay snapshot o checkpoint parcial

#### Scenario: DNA historico estable
- **WHEN** cambian pesos despues de una captura V2
- **THEN** el DNA actual cambia segun sus reglas pero el snapshot V2 anterior conserva sus porcentajes

## ADDED Requirements

### Requirement: Reiniciar el historico sin recuperar mediciones V1

La transicion V2 SHALL eliminar snapshots completos V1, incluidas figuras y valor, y resetear o invalidar ejecuciones, leases, checkpoints, resumenes y bases de ranking que puedan restaurarlos. Durante el reset no SHALL ejecutarse captura ordinaria ni comparaciones contra V1. Un worker anterior SHALL perder autoridad para escribir aunque conserve un jobId o lease local. Reiniciar despues de la migracion SHALL reanudar solo trabajo compatible V2, no ejecutar otro reset.

Las primeras capturas nuevas SHALL producir historico V2 sin backfill, base cero inventada ni resumen que cuente la migracion como progreso. Las consultas privadas SHALL devolver los puntos V2 realmente existentes y baseline null cuando no haya captura V2 anterior. La base dominical semanal SHALL ser una captura real del domingo anterior bajo V2, no una fila artificial del dia de despliegue. La cache de precios publica de origen Brickset SHALL poder conservarse, pues no constituye historico de recompensas, sin otorgar nuevos grants ni restaurar snapshots eliminados.

#### Scenario: Primer acceso a Progreso
- **WHEN** finaliza el reset antes de la primera captura V2
- **THEN** el historico devuelve snapshots vacio y baseline null sin curvas ni diferencias V1

#### Scenario: Primer snapshot nuevo
- **WHEN** se confirma la primera captura V2 de un usuario
- **THEN** contiene su estado V2 real y el resumen omite diferencias que no tienen una base V2

#### Scenario: Worker V1 atrasado
- **WHEN** un proceso anterior intenta confirmar precios/checkpoints/capturas con autoridad invalidada por el reset
- **THEN** no puede recrear historico, recompensas o notificaciones V1