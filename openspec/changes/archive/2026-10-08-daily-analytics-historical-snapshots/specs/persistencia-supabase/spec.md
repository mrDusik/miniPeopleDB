# Spec Delta

## MODIFIED Requirements

### Requirement: Limitar el acceso privilegiado al recálculo automático de categorías

Las operaciones ordinarias de usuario SHALL seguir usando el JWT autenticado y RLS, y las consultas de ranking, mutaciones de regalos y lecturas historicas propias SHALL NOT usar `service_role`. Se permite la excepcion existente para el proceso backend que recalcula gamificacion despues de un cambio valido en `data/categorias-brickset.json` o al arrancar con definiciones de objetivos nuevas sobre categorias validas: SHALL llamar unicamente a la RPC administrativa definida para aplicar el lote de estados y su fingerprint, SHALL requerir `service_role`, y SHALL mantener la clave fuera de respuestas HTTP y codigo de navegador. La RPC SHALL rechazar roles distintos de `service_role` y SHALL persistir lote y fingerprint en una sola transaccion. La huella SHALL incluir categorias y definiciones de objetivos para actualizar usuarios existentes sin nuevas altas de figuras. Se permite adicionalmente el trabajador backend de analitica diaria iniciado por el cron autenticado: su acceso global SHALL limitarse a RPC allowlisted para gestionar ejecuciones, obtener fuentes minimas, aplicar precios/recalculos y capturar snapshots. Las RPC diarias SHALL rechazar `anon` y `authenticated`, limitar escrituras al trabajo reclamado y conservar la privacidad de datos de Auth y ponderaciones; SHALL NOT ser accesibles desde rutas ordinarias ni navegador.

#### Scenario: Intento de llamar al recálculo administrativo con sesión de usuario
- **WHEN** un rol `anon` o `authenticated` invoca la RPC de recálculo global
- **THEN** la base de datos rechaza la operación sin modificar filas

#### Scenario: Recalcular después de cambiar categorías
- **WHEN** el proceso backend aplica la huella nueva del catálogo
- **THEN** cada fila de gamificación se calcula desde las minifiguras actuales y los regalos recibidos
- **AND** la siguiente lectura de DNA y Ranking Global refleja los valores persistidos

#### Scenario: Recalcular usuarios actuales al desplegar nuevos logros
- **WHEN** arranca el backend con nuevos objetivos y categorías válidas aunque su JSON no haya cambiado
- **THEN** recalcula los logros, Bricks, nivel y progreso de todos los usuarios con gamificación, figuras o regalos existentes
- **AND** conserva los regalos recibidos y una huella ya aplicada no vuelve a escribir los estados

#### Scenario: Intento de llamar al cron administrativo con JWT ordinario
- **WHEN** `anon` o `authenticated` intenta gestionar un trabajo diario o capturar snapshots mediante RPC
- **THEN** la base de datos rechaza la llamada sin leer fuentes globales ni modificar filas

#### Scenario: Cron autorizado sin ampliar rutas ordinarias
- **WHEN** un trigger valido activa el trabajador diario backend
- **THEN** solo ese trabajador usa las RPC diarias con `service_role`, y consultar el historico propio sigue usando JWT y RLS

## ADDED Requirements

### Requirement: Proteger snapshots y checkpoints de analitica

La tabla historica SHALL tener RLS habilitado y permitir a `authenticated` unicamente SELECT de filas con `user_id = auth.uid()`. Clientes ordinarios SHALL NOT poder insertar, actualizar ni eliminar mediciones, ni acceder a ejecuciones, leases, checkpoints o la cache privada global de precios. Las tablas internas del trabajo y `private.daily_sync_figure_prices` SHALL carecer de grants para `public`, `anon` y `authenticated`; las RPC administrativas SHALL comprobar rol ademas de restringir EXECUTE. La cache global SHALL guardar solo IDs canonicos, precios Brickset no negativos y `fetched_at`; su lectura/escritura ocurrira exclusivamente dentro de RPC allowlisted del worker. El historial SHALL borrarse en cascada al eliminar la cuenta y SHALL NOT publicarse mediante ranking o perfiles.

#### Scenario: Lectura y escritura directas
- **WHEN** un cliente autenticado intenta leer snapshots ajenos, cambiar propios o consultar checkpoints
- **THEN** no obtiene filas ajenas ni checkpoints y las escrituras son rechazadas

#### Scenario: Borrar cuenta
- **WHEN** se elimina una cuenta de `auth.users`
- **THEN** se eliminan sus snapshots sin afectar historicos de otras cuentas

#### Scenario: Cache de precios inaccesible a clientes
- **WHEN** roles `anon` o `authenticated` consultan o mutan `private.daily_sync_figure_prices`
- **THEN** Postgres deniega el acceso directo; solo RPC allowlisted con `service_role` pueden utilizarla