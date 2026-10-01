# Design

## Context

El servidor Express crea un cliente Supabase con el bearer token de cada petición y aplica RLS sin clave de servicio. `gamificacion` y `minifiguras` solo son visibles para su propietario; los metadatos públicos de Google se leen hoy únicamente en el navegador. El cálculo de gamificación reconstruye `bricks`, nivel y logros desde la colección, por lo que una suma directa de 50 se perdería en el siguiente recálculo. La valoración ya define los órdenes exactos de `top5` y `top5Antiguas`, y la UI ya dispone de tarjetas, tooltips, modal de logros y tres imágenes de nivel con una resolución de fallback.

## Goals / Non-Goals

**Goals:**

- Mantener RLS y derivar siempre la identidad del donante mediante `auth.uid()`.
- Producir el ranking y cada regalo de forma consistente ante concurrencia.
- Conservar los regalos al recalcular gamificación desde la colección.
- Compartir criterios de valoración, resolución de nivel y presentación de tarjetas para impedir divergencias entre la pantalla principal y el ranking.
- Mantener la suite sin red mediante la ampliación de `test-support/supabase-mock.js`.

**Non-Goals:**

- Exponer catálogos completos, correos o metadatos privados de autenticación.
- Permitir retirar, repetir o transferir regalos, ni descontar Bricks al donante.
- Crear paginación o posiciones fuera del Top 10.
- Añadir nuevas imágenes de nivel; se reutilizará la resolución actual para los activos 9, 15 y 16.

## Decisions

### Proyección pública de perfil controlada por el servidor

Se añadirá `perfiles_publicos(user_id primary key, display_name, avatar_url, updated_at)` con FK a `auth.users` y RLS de inserción/actualización solo para el propietario. Después de `auth.getUser`, el servidor extraerá `full_name`/`name` y `avatar_url` de `user_metadata` y hará upsert con el mismo cliente autenticado. El cliente nunca enviará estos campos.

Esto evita consultar directamente `auth.users` y limita la superficie pública. La alternativa de tomar nombre y avatar del navegador permitiría manipulación del cuerpo y no mantendría perfiles de otros usuarios disponibles para el ranking.

### Funciones SQL autenticadas como frontera entre usuarios

Se crearán funciones SQL `security definer`, con `search_path` fijo, permisos revocados para `anon` y concedidos a `authenticated`:

- Una función de lectura devuelve el Top 10 y sus agregados, incluidos los dos Top 5 y `regalo_enviado` calculado respecto de `auth.uid()`.
- Una función de regalo recibe solo `receptor_id`, obtiene el donante de `auth.uid()` y ejecuta toda la mutación en su transacción.

El repositorio Express invocará estas funciones mediante RPC y mapeará filas snake_case al contrato camelCase. No se usará una clave de servicio. Una vista pública se descarta porque no puede personalizar `regaloEnviado` ni encapsular con la misma claridad la lectura limitada de minifiguras bajo RLS.

### Ranking calculado en base de datos y respuesta acotada

La consulta partirá de `gamificacion`, unirá `perfiles_publicos`, contará minifiguras `COLECCIÓN` y seleccionará primero los 10 usuarios por `bricks DESC, user_id ASC`. Después calculará los dos Top 5 solo para esos usuarios mediante subconsultas laterales/agregaciones JSON. Los desempates reproducirán `valuationSummary`: precio descendente, fecha de compra ascendente y registro más reciente para precio; año ascendente, precio descendente y registro más reciente para antigüedad.

Los criterios se extraerán también a helpers reutilizables en JavaScript para que la valoración actual y el mock prueben el mismo contrato. Ejecutar agregaciones en el servidor con múltiples consultas se descarta por generar lecturas N+1 y resultados no atómicos.

### Regalos como fuente persistente y gamificación reconciliada

`regalos_enviados` tendrá `donante_id`, `receptor_id`, `fecha`, PK compuesta y una restricción que impida autorregalos. La función de regalo bloqueará la fila de gamificación del receptor, validará su existencia, insertará la relación y reconstruirá el logro especial con cantidad igual al número de regalos recibidos. Sumará 50 al saldo por el nuevo registro y recalculará nivel, siguiente nivel y progreso dentro de la misma transacción.

El recálculo ordinario combinará el resultado base de la colección con el número de filas de `regalos_enviados` recibidas: añadirá `cantidad * 50`, incorporará un único logro `type: "regalo"` y volverá a seleccionar nivel/progreso. Así, la tabla de regalos es la fuente de verdad y una edición de catálogo no elimina ni duplica bonificaciones.

Guardar solo el incremento en `gamificacion.bricks` se descarta porque el código actual sobrescribe ese valor al recalcular. Añadir un saldo paralelo se descarta porque duplicaría una cantidad derivable y podría desviarse del historial.

### Integración en Express

La expresión de rutas protegidas incluirá `/api/ranking` y `/api/ranking/regalar`. Un `RankingRepository` encapsulará perfil, RPC de lectura y RPC de regalo, con errores de dominio para autorregalo, duplicado, receptor inexistente y fallo de persistencia. `readJsonBody` deberá permitir mapear cuerpos inválidos al error de ranking apropiado sin filtrar detalles SQL.

Tras un regalo correcto, la respuesta será `200 { "ok": true }` y la UI volverá a cargar `GET /api/ranking` como fuente canónica para saldos y niveles. Los errores SQL esperados se traducirán a los códigos HTTP definidos por la especificación.

### UI declarativa y acordeón exclusivo

Se añadirá la tercera fila del menú, el diálogo y plantillas de fila mediante HTML semántico. La UI mantendrá un único `expandedUserId`; al abrir otra fila actualizará `hidden` y `aria-expanded` de ambas. Las tarjetas usarán un helper compartido con `rankingCard`, parametrizado para renderizar un elemento no interactivo sin `data-action`.

El `userId` de sesión se comparará con las entradas para las estrellas y para omitir el botón propio. `regaloEnviado` inicializa el botón deshabilitado; durante POST también se deshabilita para impedir dobles envíos. Al confirmar, se recargan ranking y gamificación. Los logros elegirán `🎁` cuando `type === "regalo"` y conservarán la imagen actual en los demás casos.

La URL de `imagenNivel` se resolverá con el mismo helper que usa `renderGamification`: activos específicos para 15 y 16 y el fallback existente para los demás niveles.

### Pruebas por frontera

El mock incorporará las tablas nuevas y una implementación controlada de las RPC que respete identidad, unicidad y atomicidad. Las pruebas cubrirán SQL/contratos de repositorio, autenticación y errores HTTP, orden/Top 5, persistencia tras recálculo y DOM del modal, acordeón, estrellas, regalos e iconos. No se realizarán llamadas a Supabase real.

## Risks / Trade-offs

- **[Funciones `security definer` amplían privilegios]** → Fijar `search_path`, revocar permisos por defecto, exigir `auth.uid()` y devolver columnas enumeradas.
- **[El avatar remoto puede dejar de estar disponible]** → Mantener fallback visual y no bloquear una fila por error de imagen.
- **[La consulta de Top 5 puede crecer con el catálogo]** → Seleccionar primero el Top 10 y añadir índices sobre `gamificacion(bricks, user_id)`, `minifiguras(user_id, estado_coleccion)` y los campos de orden relevantes.
- **[Desfase entre SQL y valoración JavaScript]** → Codificar los mismos desempates, extraer helpers donde sea posible y añadir casos contractuales idénticos en tests.
- **[Perfiles previos sin proyección]** → Mostrar un nombre neutro y avatar fallback hasta la siguiente petición autenticada del usuario; no leer datos privados para rellenarlos retroactivamente.

## Migration Plan

1. Desplegar tablas, índices, RLS y funciones RPC de forma aditiva.
2. Desplegar servidor con sincronización de perfil, repositorio de ranking y reconciliación de regalos.
3. Desplegar UI y pruebas una vez disponibles los endpoints.
4. Verificar con dos usuarios de prueba el orden, la unicidad concurrente y la conservación tras recalcular.

Para rollback, retirar primero la UI y rutas Express, después revocar/eliminar las funciones. Las tablas pueden conservarse para no perder historial; solo se eliminarán en un rollback destructivo explícito. La migración no modifica filas existentes de minifiguras ni exige backfill de perfiles.