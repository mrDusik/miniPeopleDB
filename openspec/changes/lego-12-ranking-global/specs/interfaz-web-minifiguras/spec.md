# Spec Delta

## ADDED Requirements

### Requirement: Abrir el Ranking Global desde el panel de nivel

El menú desplegable del panel de nivel SHALL incluir en su tercera fila un control con icono de globo y texto `Ranking Global`. Al activarlo SHALL abrir un modal visualmente consistente con la aplicación y solicitar el ranking autenticado.

#### Scenario: Abrir el modal
- **WHEN** el usuario activa `Ranking Global`
- **THEN** se abre un modal accesible con el Top 10 recibido de la API

#### Scenario: Fallo al cargar el ranking
- **WHEN** la API de ranking no está disponible
- **THEN** el modal muestra un estado de error controlado sin conservar datos obsoletos

### Requirement: Mostrar las filas del Top 10

Cada fila del modal SHALL mostrar avatar de Google, nombre visible, Bricks, imagen de nivel, número de nivel, nombre del nivel, número de minifiguras en `COLECCIÓN`, un control de despliegue y, salvo para el usuario autenticado, el control para regalar 50 Bricks.

#### Scenario: Renderizar un usuario clasificado
- **WHEN** el ranking contiene un usuario
- **THEN** su fila presenta todos los datos definidos sin permitir editar su perfil o colección

#### Scenario: Fila del usuario autenticado
- **WHEN** una fila corresponde al usuario de la sesión
- **THEN** la fila no muestra un control para regalarse Bricks

### Requirement: Indicar la presencia del usuario autenticado en el Top 10

Si el usuario autenticado figura en el Top 10, la interfaz SHALL mostrar un botón con icono de globo junto a su avatar en el panel de nivel principal y SHALL NOT mostrar una estrella junto a su fila del ranking. El botón SHALL abrir el modal Ranking Global y SHALL mostrar el tooltip `En Top Global`. Debajo del globo SHALL mostrar la medalla 🥇, 🥈 o 🥉 para las posiciones 1, 2 o 3 respectivamente, o la posición con formato `#4` desde la cuarta posición. Si no figura, el botón SHALL estar ausente.

#### Scenario: Usuario dentro del Top 10
- **WHEN** la respuesta del ranking contiene el `userId` de la sesión
- **THEN** se muestra el icono de globo en el panel de nivel y no se muestra ninguna estrella junto a la fila del ranking

#### Scenario: Usuario fuera del Top 10
- **WHEN** la respuesta del ranking no contiene el `userId` de la sesión
- **THEN** no se muestra el icono de globo en el panel de nivel ni una estrella junto a la fila del ranking

#### Scenario: Abrir el ranking desde el globo
- **WHEN** el usuario activa el globo del panel de nivel
- **THEN** se abre el modal Ranking Global sin abrir el menú de usuario
- **AND** al cerrar el modal el foco vuelve al globo si sigue visible

#### Scenario: Mostrar posición en el panel de nivel
- **WHEN** el usuario figura en el ranking
- **THEN** debajo del globo se muestra la medalla correspondiente si ocupa una de las tres primeras posiciones, o su posición con prefijo `#` en los demás casos
- **AND** el tooltip del globo indica `En Top Global`

### Requirement: Desplegar destacados en acordeón exclusivo

Al activar una fila o su flecha, la interfaz SHALL desplegar solo sus Top 3 por precio y antigüedad, tomando los tres primeros elementos de cada Top 5 recibido de la API sin alterar su orden. Las tarjetas SHALL reutilizar la presentación, imagen y tooltip de las tarjetas equivalentes de la pantalla principal, pero SHALL ser no interactivas. Solo una fila SHALL permanecer desplegada a la vez.

#### Scenario: Abrir una fila
- **WHEN** el usuario activa una fila cerrada
- **THEN** se muestran sus dos grupos de destacados y la fila se anuncia como expandida

#### Scenario: Limitar el tamaño de los destacados
- **WHEN** la API devuelve cinco destacados por precio y cinco por antigüedad
- **THEN** el modal muestra solo los tres primeros de cada grupo con los títulos `Top 3 por precio` y `Top 3 por antigüedad`

#### Scenario: Abrir una segunda fila
- **WHEN** una fila está abierta y el usuario activa otra
- **THEN** la primera se cierra automáticamente y solo la segunda permanece abierta

#### Scenario: Activar una tarjeta del ranking
- **WHEN** el usuario pulsa o hace clic sobre una tarjeta de minifigura dentro del ranking
- **THEN** no se abre el detalle ni se ejecuta ninguna acción sobre la colección

### Requirement: Regalar Bricks desde el ranking

El control de regalo SHALL indicar que envía 50 Bricks y SHALL quedar permanentemente deshabilitado para un destinatario cuando la API indique que ya existe una donación o confirme una nueva. Durante el envío SHALL impedir activaciones duplicadas y, tras completarse, SHALL actualizar los datos visibles afectados.

#### Scenario: Enviar un regalo
- **WHEN** el usuario activa el regalo de una fila habilitada y la API confirma la donación
- **THEN** el control de ese destinatario queda deshabilitado
- **AND** el ranking refleja los Bricks y nivel actualizados del receptor

#### Scenario: Regalo previamente enviado
- **WHEN** una entrada del ranking tiene `regaloEnviado` igual a `true`
- **THEN** su control de regalo aparece deshabilitado desde el primer renderizado

### Requirement: Diferenciar los logros de regalo

El modal de Logros SHALL mostrar un icono de regalo `🎁` para los logros de tipo `regalo` y SHALL conservar la copa habitual para los demás logros.

#### Scenario: Mostrar un logro de regalo
- **WHEN** el estado de gamificación contiene un logro con tipo `regalo`
- **THEN** el logro se representa con `🎁` en lugar de la copa
