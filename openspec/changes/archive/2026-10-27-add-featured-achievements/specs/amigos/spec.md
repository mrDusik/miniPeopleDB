# Spec Delta

## MODIFIED Requirements

### Requirement: Consultar el resumen de perfil de otro coleccionista

Todo usuario autenticado SHALL poder consultar el perfil resumido de otro usuario, sin requerir amistad. La respuesta SHALL incluir username y avatar, Top 5 de figuras de colección por precio y antigüedad, los cuatro porcentajes DNA agregados, Bricks y nivel, número total de figuras de colección y las cinco añadidas más recientemente, número total de figuras buscadas y las cinco añadidas más recientemente, y hasta cinco logros. Los logros SHALL aplicar el orden comun de `logros-destacados` del usuario consultado antes de limitarse a cinco: destacados primero y, dentro de cada grupo, no-regalos antes que regalos, `total` descendente y orden de origen en empates. SHALL completar con no destacados cuando haya menos de cinco seleccionados y existan mas logros obtenidos. Cada logro SHALL incluir un indicador booleano publico de destacado, mostrado como estrella no editable solo si es verdadero. Las figuras recientes SHALL ordenarse por fecha de registro descendente. La respuesta SHALL ser de solo lectura y SHALL NOT incluir correo, identidad OAuth, preferencias privadas distintas de la seleccion publica de destacados, datos de compra, ponderaciones DNA individuales ni información de relaciones con terceros. Consultar SHALL NOT limpiar estrellas ni recalcular gamificacion ajena.

#### Scenario: Perfil con datos completos
- **WHEN** una persona autenticada abre el perfil de otro coleccionista
- **THEN** recibe los Tops, cuatro proporciones DNA agregadas, métricas, últimas figuras y hasta cinco logros según los órdenes definidos
- **AND** ninguna minifigura, gamificación o perfil del usuario consultado cambia

#### Scenario: Colección, búsqueda o logros vacíos
- **WHEN** el perfil consultado carece de figuras en una sección o de logros
- **THEN** los totales son cero y las listas correspondientes son vacías sin inventar elementos

#### Scenario: Consultar perfil propio o usuario inexistente
- **WHEN** se consulta el perfil propio o un identificador inexistente o mal formado
- **THEN** el sistema rechaza la autorconsulta o devuelve el error controlado correspondiente sin revelar datos de otra cuenta

#### Scenario: Fallo o cambio de sesión
- **WHEN** falla la lectura del perfil o cambia la sesión durante la consulta
- **THEN** el sistema devuelve un error controlado y la interfaz no conserva ni atribuye datos de otra cuenta

#### Scenario: Destacado fuera de los cinco anteriores
- **WHEN** el titular destaca un logro que antes quedaba fuera de sus cinco primeros y otra cuenta abre su perfil
- **THEN** ese logro participa en el grupo prioritario antes de truncar a cinco, aunque el espectador tenga otra seleccion
- **AND** las estrellas son indicadores no editables y el resto de plazas se completa con no destacados segun el orden comun
