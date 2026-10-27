# Design

## Context

Ver `proposal.md` para la motivacion. El proyecto es Node.js con frontend estatico y Supabase. `public/app.js` concentra el renderizado de logros y reutiliza `createAchievementItem` en perfiles. El modal propio ordena regalos al final y, dentro del tipo, por `total` descendente; los empates mantienen el orden de entrada. Los toasts tienen una cola independiente por `bricksNuevos` ascendente.

`src/gamificacion-repository.js` reconstruye y persiste `logros` mediante una allowlist de campos, por lo que guardar estrellas dentro del JSON derivado las perderia en recalculos. Hay escrituras de gamificacion tanto desde Node como desde RPC sociales y recalculos backend autorizados. La limpieza debe cubrir todas, no solo acciones del modal.

`amigos_perfil` construye logros en SQL y `src/amigos-repository.js` y el frontend recortan a cinco. La RPC actualmente devuelve mas elementos; el nuevo orden y limite se aplicaran en origen. Su orden SQL tampoco reproduce literalmente el comparador del modal para todos los casos: `type` puede estar ausente y SQL usa comparaciones que producen NULL. Se definira un orden explicito y comun, sin depender de esa incidentalidad.

`ranking_logros` admite usuarios del Top global y del semanal. Sus campos y los del repositorio estan allowlisted. El modal compartido distingue consultas propias y ajenas y debe mantener esa separacion. `.modal-achievements` tiene ancho maximo de 600px; existen reglas especificas para Smartphone y se validan cuatro familias de dispositivo.

## Goals / Non-Goals

**Goals:** separar preferencia de estado derivado; imponer el limite en base de datos; mantener coherencia ante perdida de logros y concurrencia; usar el mismo contrato de orden para proyecciones SQL y frontend; no ampliar permisos publicos.

**Non-Goals:** reescribir calculo V2, cambiar elegibilidad de rankings, crear ranking de estrellas, ordenar manualmente, guardar fechas de prioridad, emitir eventos de recompensa ni modificar layouts fuera de los logros. Persistencia entre dispositivos no implica una nueva suscripcion Realtime: cada nueva consulta/revalidacion recibe el estado confirmado.

## Decisions

### 1. Seleccion separada y escritura acotada

Crear `public.logros_destacados` con clave compuesta `(user_id, logro_id)` y FK de usuario con borrado en cascada. No almacenar cantidades, orden ni copias del catalogo. Habilitar RLS y lectura exclusivamente propia. Revocar DML directo a `anon`, `authenticated` y accesos no necesarios: la unica escritura ordinaria sera una RPC autenticada acotada. Las proyecciones publicas acceden mediante sus RPC existentes, sin SELECT general ajeno.

Nueva RPC `establecer_logro_destacado(p_logro_id text, p_destacado boolean)`: obtener `auth.uid()`, bloquear la fila de gamificacion propia con `FOR UPDATE`, comprobar que el ID esta obtenido con cantidad positiva y aplicar el estado solicitado. Para marcar: si ya existe, exito idempotente; si hay cinco, error de limite; en otro caso insertar. Para desmarcar: eliminar si existe, sin exigir que el ID siga obtenido. Devolver el conjunto confirmado de IDs propios.

La identidad no es un parametro. Usar permisos minimos, revocaciones explicitas y `search_path` fijo para la RPC `SECURITY DEFINER`. No usar `service_role` ni ampliar las excepciones administrativas existentes. Bloquear gamificacion antes de tocar destacados en todos los caminos evita que dos marcas simultaneas ocupen el ultimo hueco o una marca sobreviva a una perdida concurrente.

Alternativas descartadas: `localStorage` no comparte dispositivos; un flag en `gamificacion.logros` se pierde al reconstruir; un array sustituido desde el navegador facilita actualizaciones perdidas y delega invariantes al cliente.

### 2. Limpieza transaccional en el punto comun de persistencia

Anadir un trigger acotado a cambios de `gamificacion.logros` que elimine de la seleccion del usuario exclusivamente los IDs no presentes con cantidad positiva en el nuevo JSON. Debe ejecutarse en la misma transaccion y con permisos de escritura acotados, sin modificar la propia gamificacion ni lanzar un recalcule. Esto cubre upserts desde Node, regalos, amistades, eliminacion de una cuenta relacionada y recalculos de categorias u objetivos, manteniendo las excepciones backend actuales sin nuevas facultades.

La fila de gamificacion ya se bloquea al escribir y es tambien el primer bloqueo de la RPC de seleccion. Conservar IDs obtenidos incluso cuando bajen sus cantidades; eliminar filas perdidas, no dejarlas latentes para una futura recuperacion. El borrado de cuenta retira destacados por FK. Ninguna lectura publica limpia datos.

Alternativa descartada: filtrar IDs solo al leer pareceria liberar cupo, pero restauraria estrellas al recuperar logros y dejaria decisiones incoherentes entre dispositivos. Limpiar solo en `GamificacionRepository` no cubre las mutaciones SQL.

### 3. Contratos HTTP y proyecciones seguras

Proponer `PUT /gamificacion/logros/:logroId/destacado` con cuerpo estricto `{ "destacado": true|false }`, sin selectores de cuenta. Actualizar expresamente `protectedPath` y la construccion de contexto autenticado en `src/server.js`; una ruta nueva fuera de esa expresion no debe quedar sin autenticacion. Responder `200` con `{ "logrosDestacados": ["id", ...] }` despues de confirmar. Errores: `401` sin sesion, `400 LOGRO_INVALIDO` para entrada/ID no obtenido, `409 LIMITE_LOGROS_DESTACADOS` para sexto y `500 LOGROS_DESTACADOS_NO_DISPONIBLES` sin detalles internos ante fallo. Rechazar campos adicionales y no interpretar la entrada como un toggle no idempotente.

En la lectura propia, incorporar `logrosDestacados` como campo adicional a la respuesta de gamificacion, manteniendo los campos y calculos actuales. Consultar estado e IDs mediante una proyeccion propia coherente de solo lectura tras la inicializacion existente; no derivar estrellas de un cache de otra cuenta. No persistir anotaciones de presentacion dentro de los logros calculados. Las respuestas de mutaciones y la revalidacion posterior deben conservar o actualizar la seleccion, nunca borrarla por omitir este campo.

En `ranking_logros`, proyectar exclusivamente un booleano `destacado` por logro y el orden comun; mantener elegibilidad global/semanal. En `amigos_perfil`, proyectar `featured` junto a los nombres ingleses existentes y ordenar/limitar a cinco en SQL, antes de los recortes defensivos de Node y frontend. Ampliar las allowlists de ambos repositorios, sin exponer IDs ajenos fuera de los logros permitidos ni fechas o metadatos de preferencias.

### 4. Orden estable y reutilizacion del renderizado

Contrato del comparador: `(esNoDestacado asc, esRegalo asc, total desc, posicionOrigen asc)`. SQL usara `coalesce(type = 'regalo', false)` para que un tipo ausente sea no-regalo y `WITH ORDINALITY` para desempates. Mantener el JSON de logros derivados en su orden canonico; ordenar las proyecciones, no reescribir ese JSON por una estrella. Frontend reutilizara un unico comparador para listas, normalizando el conjunto propio y los booleanos publicos a la misma decision.

Ampliar `createAchievementItem` con un modo explicito: editable solo desde el modal propio, indicador no interactivo para vistas de consulta y perfil. La apertura desde ranking conserva su modo publico de solo lectura incluso en la fila propia, como en el contrato existente. No reutilizar un booleano ambiguo basado exclusivamente en el ultimo usuario cargado. La estrella se anade al final; los no destacados ajenos no necesitan una falsa accion deshabilitada.

Alternativas descartadas: ordenar solo los cinco que entrega el repositorio excluiria destacados de menor recompensa; usar fecha de seleccion introduciria un orden no autorizado; cambiar el orden del estado fuente alteraria los desempates.

### 5. Guardado confirmado y aislamiento de peticiones

Serializar guardados desde el modal con estado pendiente de sus controles; dejar accesible el cierre. La peticion expresa el estado deseado y no invierte un estado potencialmente antiguo. No cambiar estrella ni ordenar hasta el exito. Al recibir IDs confirmados, actualizar solo la preferencia del propietario y renderizar con el orden comun; conservar foco por ID, no por indice. El sexto conserva su estrella inactiva y muestra la advertencia exacta. Ante fallo, mantener orden y estrellas anteriores y liberar controles para reintento.

Usar generacion de sesion, contexto de modal y secuencia de peticion para descartar respuestas obsoletas de lectura o escritura. Una lectura iniciada antes del guardado no debe restaurar preferencias antiguas. Si el modal se cierra durante un guardado, no reabrirlo; la siguiente apertura revalida la seleccion persistida, aunque el servidor hubiese completado la peticion. Cambio de cuenta limpia seleccion y pendientes. Tras confirmar cambios que alteran logros, revalidar seleccion junto al estado propio; la consulta de otra persona nunca se mezcla con `ownGamification`.

### 6. Estrella y espacio responsive

Reutilizar icono de estrella de Lucide ya disponible y el patron activo/inactivo del ojo, con area fija de interaccion, `aria-pressed`, `aria-label`, `title` y foco visible; no usar un emoji ambiguo como unica identificacion accesible. Los indicadores publicos no son botones y tienen descripcion accesible de destacado.

Proponer maximo de 660px para Logros en Monitor y Tablet frente a los 600px actuales, siempre limitado por viewport. Reservar una columna estable para la estrella sin modificar reglas globales de `.modal` ni otros dialogos. En Smartphone mantener los margenes vigentes, permitir ajuste de nombre/descripcion y distribuir cantidad/Bricks sin solapamientos ni scroll horizontal. Reutilizar scroll vertical interno y bloqueo de fondo.

## Risks / Trade-offs

- Diferencias SQL/JavaScript o tipos ausentes: probar fixtures identicos con regalos, empates y destacados fuera del Top 5 anterior.
- Carrera entre seleccion y recalcule: mismo bloqueo inicial de gamificacion y limpieza transaccional; probar intercalaciones y rollback con PGlite. Usar dos conexiones a PostgreSQL de pruebas si PGlite no permite demostrar concurrencia real; no dar esa garantia por probada con llamadas secuenciales.
- Trigger con facultades excesivas: funcion privada, permisos minimos, sin RPC de limpieza elegible por usuario arbitrario; probar con roles `anon` y `authenticated`, no solo como superusuario.
- Revalidacion anterior al guardado o respuesta tardia: secuencias por contexto y pruebas de cambio de cuenta, cierre, reapertura y vista ajena.
- Desplazamiento de filas y foco: actualizar despues de confirmar, restaurar foco por ID y medir controles en navegador real ademas de JSDOM.

## Migration Plan

1. Anadir migracion SQL incremental y reflejarla en `supabase/schema.sql`; crear tabla vacia, indices/clave, RLS, RPC, permisos y trigger sin reset de logros, regalos ni snapshots.
2. Actualizar proyecciones publicas conservando todas sus restricciones; validar migracion y permisos en PGlite antes de desplegar.
3. Desplegar backend con ruta protegida y nuevos campos; despues frontend con estrella. El frontend antiguo ignora campos adicionales. No ejecutar migraciones sobre entornos remotos como parte de la implementacion sin autorizacion de despliegue.
4. Verificar selecciones de cero a cinco, consulta desde otra cuenta y perdida/recuperacion sin efectos de recompensa.
5. Rollback: retirar primero controles/frontend y ruta/backend nuevos, restaurar definiciones anteriores de RPC publicas y despues retirar trigger, RPC y tabla nuevos mediante rollback controlado. Las estrellas se perderan al eliminar esa tabla, pero coleccion, gamificacion e historial no deben cambiar.