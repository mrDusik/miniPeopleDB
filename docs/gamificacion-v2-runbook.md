# Runbook de corte de Gamificación V2

## Estado y bloqueo

Este runbook no autoriza por sí solo un despliegue. La migración de producción sigue bloqueada hasta que el operador revise y acepte explícitamente las cuatro estimaciones y que `General` permanezca sin clasificar conforme a las tareas 2.2 y 2.4. El JSON local ya usa las rutas oficiales; el corte canonicaliza las referencias guardadas exactas.

La última consulta Brickset verificó las 17 páginas y los 845 registros, sin IDs duplicados. El catálogo local tiene 59/60 subcategorías con año: 55 mínimos confirmados y cuatro mínimos observados estimados. `General` sigue sin año porque su única ficha (`COL271`) no publica `Year released`; las dos referencias guardadas antiguas se migran a sus rutas oficiales antes del recálculo. El detalle está en [el informe de cobertura](brickset-series-coverage-2026-10-26.md). No completes el año de `General` ni pases `--confirm-catalog-coverage` hasta que el operador acepte su estado sin clasificar y las cuatro estimaciones.

## Responsabilidades y accesos

- El operador de la base debe ser su propietario o superusuario para preparar y ejecutar el corte.
- `SUPABASE_DB_URL` es una conexión PostgreSQL directa o pooler con SSL y rol propietario. No usar `SUPABASE_SERVICE_ROLE_KEY`, anon ni JWT de usuario.
- `supabase/prepare-gamification-v2.sql` crea el marcador durable `prepared`; no borra ni recalcula datos.
- `scripts/migrate-gamification-v2.js` ejecuta la transacción única. No está conectado a Express, `npm start`, el cron ni el arranque del worker.
- No hay ruta HTTP para resetear, elegir usuarios ni iniciar el corte.

## Antes del corte

1. Completar y aprobar la cobertura Brickset y conservar el reporte, fixtures y discrepancias resueltas.
2. Confirmar el project ref de 20 caracteres en el dashboard y que coincida con `SUPABASE_URL` y el host/usuario de `SUPABASE_DB_URL`.
3. Acordar una ventana de mantenimiento. Pausar el cron diario y el recálculo por cambios de categorías; detener escrituras ordinarias y esperar o invalidar los workers en curso.
4. En producción y en cualquier proyecto no desechable, crear un backup completo de base y Auth y ensayar su restauración en un entorno aislado compatible. Mantener el archivo fuera del repositorio y de logs:

```powershell
$backupPath = 'D:\backups\minipeople-v2-precutover.dump'
pg_dump --format=custom --dbname $env:SUPABASE_DB_URL --file $backupPath
pg_restore --list $backupPath
```

En una base aislada de restauración, comprueba además que el dump puede cargarse con el procedimiento de recuperación aprobado, sin `--clean` sobre producción:

```powershell
pg_restore --dbname $env:RESTORE_DB_URL --no-owner --no-privileges $backupPath
```
Solo para el proyecto desechable confirmado `wvcnftjhvcdxmuqpjqda`, el operador ha autorizado omitir este backup. El CLI lo permite exclusivamente con `--test-no-backup`; no uses esa opción en ningún otro proyecto.
5. Aplicar `supabase/schema.sql` actualizado. Es idempotente y no ejecuta el reset. Verificar roles, RPC, RLS y el campo de versión de snapshots.
6. Sustituir los dos valores `REPLACE_WITH_PROJECT_REF` en `supabase/prepare-gamification-v2.sql` por el project ref confirmado y ejecutarlo como propietario:

```powershell
psql --dbname $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f supabase/prepare-gamification-v2.sql
```

7. Consultar `private.gamificacion_v2_migration`: debe existir exactamente una fila singleton con `version = 'v2'`, el project ref esperado y `status = 'prepared'`. Si ya está `applied`, no volver a ejecutar el corte.

## Corte explícito

Solo después de completar todas las condiciones anteriores, confirmar los tres bloqueos operativos y ejecutar desde la raíz del proyecto:

```powershell
npm.cmd run migrate:gamification-v2 -- --confirm-project <project-ref> --confirm-backup --confirm-maintenance --confirm-catalog-coverage
```

Para la prueba desechable autorizada `wvcnftjhvcdxmuqpjqda`, la única variante sin backup es:

```powershell
npm.cmd run migrate:gamification-v2 -- --confirm-project wvcnftjhvcdxmuqpjqda --test-no-backup --confirm-maintenance --confirm-catalog-coverage
```

El CLI rechaza `--test-no-backup` si el project ref no coincide exactamente con esa base.

El script valida que el project ref coincida, abre una transacción serializable como propietario, bloquea las tablas fuente y deriva los estados V2 desde Auth, inventario, amistades y solicitudes aceptadas. Falla si falta cobertura confirmada, no existe el marcador preparado, hay una activación previa o una escritura no cumple los invariantes.

Antes de entrar en la transacción, el runner consulta una vez cada ID distinto cuya fila carece de `nombre_completo`. Si Brickset no devuelve un `Name` válido para todos, el corte se aborta sin escrituras. En la transacción solo se guarda ese texto completo en `minifiguras.nombre_completo`; `nombre` y `descripcion` visibles no se cambian y no se usan las RPC temporales de corrección.

La transacción invalida runs y leases diarios, canonicaliza exclusivamente los dos aliases aprobados modificando solo `subcategoria`, retira regalos/agradecimientos/notificaciones/snapshots V1, reconstruye todos los usuarios, actualiza la huella, establece membership global sin avisos y persiste `availableFrom` como el lunes estrictamente posterior a la fecha efectiva en Europe/Madrid. No genera snapshots ni notificaciones de reset. Cualquier fallo antes del commit revierte todas las escrituras.

## Comprobaciones posteriores

Antes de levantar mantenimiento, comprobar en la misma base:

```sql
select version, project_ref, status, fingerprint, prepared_at, applied_at
from private.gamificacion_v2_migration where singleton = true;

select (select count(*) from auth.users) as auth_users,
       (select count(*) from public.gamificacion) as gamificacion_users;

select (select count(*) from public.regalos_enviados) as regalos,
       (select count(*) from public.agradecimientos_regalo) as agradecimientos,
       (select count(*) from public.notificaciones) as notificaciones,
       (select count(*) from public.user_daily_snapshots) as snapshots;

select version, activated_at, available_from
from private.gamificacion_v2_activation where singleton = true;

select count(*) from public.ranking_top10_membership where ranking_type = 'weekly';

select count(*) as alias_references_remaining
from public.minifiguras
where categoria = 'Collectible Minifigures'
    and subcategoria in (
        'Harry Potter / Harry Potter Series 1 Fantastic Beasts',
        'Super Heroes / Marvel Studios Series 1 What If'
    );
```

Revisar que las cuentas Auth tengan estado, las filas conservadas coincidan con los recuentos previos, no queden IDs de logros retirados, el ledger/bandeja/snapshots estén vacíos y la membership global exista sin eventos sintéticos. Consultar el ranking semanal debe devolver `available: false` y `entries: []` hasta que haya una base dominical V2 y una captura V2 de semana real.

Después, desplegar el binario V2, confirmar `GET /health`, probar una lectura propia y la bandeja vacía, y reactivar el cron diario a las 04:00 de Madrid. Vigilar el primer resumen diario y confirmar que su snapshot lleva `calculation_version = 'v2'`. El primer ranking semanal no se habilita solo por llegar a `availableFrom`: necesita las dos capturas V2 comparables.

## Reintento y rollback

Con `status = 'applied'`, el runner devuelve no-op; no borra actividad posterior ni recalcula `availableFrom`. No borres ni edites manualmente el marcador para forzar otra ejecución.

Antes del commit, el rollback es transaccional: mantener mantenimiento, revisar el error y restaurar compatibilidad antes de reactivar workers. Después del commit, volver a V1 requiere restaurar el backup completo compatible durante mantenimiento; no ejecutar un downgrade de binario sobre datos V2. Si ya existe actividad V2, exportarla y acordar su conservación antes de restaurar. Nunca descartar notificaciones, regalos o snapshots posteriores con un reintento.