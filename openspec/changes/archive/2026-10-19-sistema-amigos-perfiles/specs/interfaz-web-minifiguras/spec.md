# Spec Delta

## ADDED Requirements

### Requirement: Gestionar amigos y solicitudes desde un modal

La interfaz SHALL ofrecer un modal de Amigos con las pestañas `Amigos (N)`, `Buscador`, `Solicitudes Enviadas (N)` y `Solicitudes Recibidas (N)`. Cada contador SHALL reflejar el total propio confirmado por el servidor; enviadas y recibidas incluyen pendientes y rechazadas, no aceptadas. El botón Amigos de la cabecera SHALL sustituir el `375` estático por el total real de amigos del usuario conectado, incluyendo nombre accesible y tooltip. El control de ranking SHALL permanecer independiente y sin ese contador.

La pestaña Amigos SHALL mostrar cada amigo confirmado una sola vez. Las filas de Amigos y Buscador SHALL mostrar la misma información y disposición visual del resumen de las filas del ranking: posición global, avatar, username, imagen/número/nombre de nivel, DNA resumido, Bricks con su icono y total de colección con su icono, reutilizando tipografía y comportamiento responsive, sin panel desplegable ni acción de regalo; activar el usuario SHALL abrir su perfil ajeno. El Buscador SHALL esperar al menos tres caracteres y ofrecer solicitud solo cuando no exista amistad ni una solicitud que lo impida. Enviadas SHALL mostrar solicitudes pendientes o rechazadas sin ofrecer reenvío. Recibidas SHALL mostrar solicitudes pendientes o rechazadas; una fila pendiente ofrecerá `Aceptar` y `Rechazar`, y una rechazada conservará `Aceptar` para permitir aceptarla más tarde. El rechazo SHALL permanecer visible y no notificará al emisor. Tras aceptar, la fila SHALL mostrar `Aceptada` con la acción deshabilitada y la amistad aparecerá en ambas cuentas.

Toda fila que represente una amistad confirmada, tanto en Amigos como en Buscador, SHALL ofrecer un botón accesible de eliminación independiente del control de perfil. La fila y los contadores SHALL cambiar solo tras confirmación del servidor; las acciones pendientes SHALL bloquear envíos duplicados y sus fallos SHALL conservar el estado y permitir reintento. La eliminación SHALL reflejar la ausencia recíproca y habilitar nuevas solicitudes conforme a `amigos`.

#### Scenario: Navegar las cuatro pestañas
- **WHEN** se abre el modal de Amigos
- **THEN** se puede cambiar entre Amigos, Buscador, Solicitudes Enviadas y Solicitudes Recibidas
- **AND** cada pestaña representa el estado confirmado por el servidor sin filas duplicadas

#### Scenario: Mostrar resumen de ranking y contadores reales
- **WHEN** se inicia sesión o se abre el modal de Amigos
- **THEN** el botón Amigos y las tres pestañas contadas reflejan los totales del servidor de la cuenta conectada
- **AND** las filas de Amigos y Buscador muestran los mismos campos, iconos y distribución responsive del resumen de ranking sin expansión ni regalos

#### Scenario: Actualizar contadores e invalidar otra sesión
- **WHEN** se envía, rechaza, acepta o elimina una relación, llega un evento social o se reabre el modal
- **THEN** se actualizan los contadores propios desde el servidor
- **AND** cambiar de cuenta descarta respuestas obsoletas y limpia los valores anteriores sin mostrar un fallo como cero confirmado

#### Scenario: Eliminar desde una fila de amigo
- **WHEN** se activa el botón de eliminar en Amigos o en un resultado que ya sea amigo
- **THEN** la amistad se elimina para ambas cuentas tras confirmación y los contadores se actualizan
- **AND** el control no abre el perfil ni envía otra solicitud; si falla, la fila permanece recuperable

#### Scenario: Buscar y enviar solicitud
- **WHEN** se introducen menos de tres caracteres o se muestran resultados coincidentes
- **THEN** no se ejecuta una búsqueda incompleta
- **AND** los resultados de al menos tres caracteres permiten abrir el perfil o enviar una solicitud válida, nunca al usuario propio

#### Scenario: Rechazar y aceptar después
- **WHEN** se rechaza una solicitud y luego se decide aceptarla
- **THEN** la fila permanece identificada como rechazada y todavía ofrece aceptar
- **AND** al aceptar muestra `Aceptada` deshabilitado y el amigo aparece en ambas listas

#### Scenario: Carga, error y cambio de sesión
- **WHEN** una pestaña carga, falla o la sesión cambia durante una petición
- **THEN** la interfaz muestra carga o error controlado y descarta respuestas obsoletas de otra cuenta

### Requirement: Mantener estable el modal de Preferencias

En Smartphone y, por autorizacion expresa, en Monitor, Preferencias SHALL tener una altura fija de 640px limitada a la altura disponible de la pantalla menos 32px, con scroll vertical cuando sea necesario. El numero de resultados al buscar categorias favoritas SHALL NOT cambiar la altura ni la posicion del modal o del boton Guardar; la lista SHALL reservar 108px y desplazar sus resultados internamente. La preview del avatar y sus controles SHALL desplazarse 12px a la derecha sin desbordar su columna. Estos ajustes SHALL NOT modificar otros modales ni las reglas de Tablet.

#### Scenario: Buscar categorias sin redimensionar Preferencias
- **WHEN** se busca una categoria en Smartphone o Monitor y la lista pasa de multiples resultados a uno o ninguno
- **THEN** el modal mantiene su altura, posicion y controles, y sigue siendo accesible en pantallas bajas mediante scroll vertical

### Requirement: Abrir perfiles ajenos desde listados sociales

La interfaz SHALL abrir el mismo modal de perfil ajeno al activar un usuario en búsqueda, amigos, solicitudes enviadas o solicitudes recibidas. Los rankings global y semanal SHALL NOT incluir botones para abrir el perfil ajeno; conservarán sus controles de expansión, regalo y logros. Abrir un perfil desde una lista social SHALL NOT aceptar/rechazar solicitudes, regalar Bricks ni alterar datos propios. El modal SHALL mostrar username y avatar, Top 5 por precio y antigüedad, porcentajes de los cuatro rasgos DNA, Bricks y nivel, total y últimas cinco figuras de colección, total y últimas cinco figuras buscadas, y los cinco logros más importantes según el orden del modal de logros existente. Las secciones vacías SHALL mostrarse sin datos ficticios. La carga, fallo y cierre SHALL limpiar datos anteriores, soportar teclado y devolver el foco al control que abrió el perfil.

En monitor con ratón, Amigos SHALL tener un ancho máximo de 759px (un 15% más que el ajuste anterior de 660px) y el perfil de 1280px, limitado al ancho disponible de la ventana. Los grupos de tarjetas del perfil SHALL mostrar sus cinco figuras sin scroll horizontal; si no caben dos grupos en paralelo, SHALL apilarse sin estrechar las tarjetas. Las tarjetas de minifiguras de perfil y rankings SHALL tener al menos 112px de ancho, reservar espacio superior para la lupa y permitir que el texto se ajuste sin recorte. Estos ajustes de dimensiones SHALL NOT modificar las reglas de Smartphone o Tablet táctil. El Buscador SHALL omitir los avisos de longitud mínima, conservando el umbral de tres caracteres.

Los ajustes posteriores SHALL limitarse a Smartphone (hasta 600px en portrait o hasta 900px de ancho y 500px de alto en landscape táctil), sin modificar Monitor ni Tablet. En Smartphone, las tarjetas de los modales de Usuario y de ambos rankings SHALL medir 112px de ancho y reservar 52px sobre la imagen para evitar solapamiento con la lupa. Las cuatro pestañas de Amigos SHALL permanecer en una sola fila sin scroll horizontal, usando `Sol. Enviadas (N)` y `Sol. Recibidas (N)` visualmente, con nombres accesibles completos y contadores confirmados; Monitor y Tablet SHALL conservar las etiquetas completas. En los modos ver, crear y editar minifigura, Descripción SHALL extenderse hasta el borde inferior de Nombre. El gráfico del modal DNA SHALL desplazarse 8px hacia arriba solo en Smartphone.

#### Scenario: Ajustar los modales solo en Smartphone
- **WHEN** se muestran los modales en Smartphone
- **THEN** las lupas no se superponen a las imágenes, Descripción termina a la altura de Nombre y las cuatro pestañas de Amigos tienen el mismo ancho y caben sin scroll horizontal
- **AND** los ajustes no alteran dimensiones, etiquetas ni posición del gráfico en Monitor y Tablet

#### Scenario: Mantener el resumen de Usuario en una fila en Smartphone
- **WHEN** se abre el modal Usuario en Smartphone, incluso con un nivel largo como `Dragon Form`
- **THEN** Bricks, nivel, colección y búsqueda permanecen en una sola fila de cuatro contadores sin desbordamiento horizontal
- **AND** los iconos y espacios se compactan solo en Smartphone y el nombre del nivel puede ajustarse dentro de su propia columna sin ocultarse

#### Scenario: Abrir un perfil desde cada listado
- **WHEN** se activa un usuario desde Buscador, Amigos, Solicitudes Enviadas o Solicitudes Recibidas
- **THEN** se abre el perfil del usuario seleccionado en modo de solo lectura
- **AND** la acción no activa expansión, regalo, logros ni modificación de colección

#### Scenario: Mostrar resumen y logros destacados
- **WHEN** el perfil termina de cargar
- **THEN** aparecen los Tops, distribución DNA, métricas, figuras recientes y hasta cinco logros en el orden definido
- **AND** las últimas figuras se ordenan de más reciente a más antigua

#### Scenario: Error, cierre y respuestas obsoletas
- **WHEN** falla la consulta, se cierra el modal o cambia la cuenta durante la carga
- **THEN** no se muestran datos de otra selección o sesión y cerrar devuelve el foco al disparador válido