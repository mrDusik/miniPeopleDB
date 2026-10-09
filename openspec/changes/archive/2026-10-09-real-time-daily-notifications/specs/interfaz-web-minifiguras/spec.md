# Spec Delta

## ADDED Requirements

### Requirement: Acceder a notificaciones desde la cabecera

La interfaz SHALL mostrar un boton con el asset local `sobre.png` alineado a la izquierda encima del panel Rankings y repetir el asset en la cabecera del dialogo. El boton SHALL tener nombre accesible y abrir un dialogo consistente con el modal de Logros. Un punto rojo SHALL mostrarse exactamente cuando exista al menos una notificacion no leida y SHALL desaparecer unicamente cuando el conteo llegue a cero por lecturas individuales o globales.

#### Scenario: Indicador de no leidas
- **WHEN** existe una o mas notificaciones no leidas
- **THEN** se muestra el punto rojo sobre el icono del sobre
- **WHEN** no existen notificaciones no leidas o se marcan todas como leidas
- **THEN** el punto rojo no se muestra

#### Scenario: Apertura accesible
- **WHEN** se activa el boton del sobre
- **THEN** se abre el modal de notificaciones y al cerrarlo el foco vuelve al boton

### Requirement: Mostrar y paginar la bandeja de notificaciones

El modal SHALL cargar notificaciones en paginas de 15 y solicitar la pagina siguiente al aproximarse el final del scroll, sin duplicar resultados. Cada fila SHALL tener una sola tarjeta de texto, todas del mismo ancho disponible, con el borde sin incluir la columna de controles. Cada notificacion no leida SHALL tener su propio boton `✅` fuera del rectangulo, en una columna de ancho fijo a la derecha de la fila; el emoji SHALL quedar exactamente centrado en ambos ejes dentro del boton cuadrado. Tras marcarla como leida el boton SHALL permanecer visible pero deshabilitado. El boton `¡Gracias! +5` SHALL estar debajo del texto del regalo en su propio renglon y ser independiente del boton de lectura. `Marcar todas como leídas` SHALL alinearse a la izquierda y estar habilitada solo si hay notificaciones no leidas. Las fechas SHALL agruparse dinamicamente al abrir el modal como `Hace un instante`, `Hoy`, `Ayer`, `Esta semana`, `La semana pasada` o `Hace más de dos semanas`; cada etiqueta SHALL incluir `title` nativo con la fecha exacta `DD/MM/YYYY HH:mm`. La accion de agradecimiento SHALL permanecer independiente del estado de lectura.

#### Scenario: Scroll infinito
- **WHEN** el usuario llega al final de los resultados actuales y quedan notificaciones
- **THEN** se carga la pagina siguiente de 15 como maximo y se agrega al final de la lista

#### Scenario: Agrupar fechas al abrir
- **WHEN** se abre la bandeja
- **THEN** las fechas relativas se recalculan y cada una expone el timestamp exacto en su atributo `title`

#### Scenario: Limpiar el indicador
- **WHEN** el usuario activa `Marcar todas como leídas`
- **THEN** la lista y el badge reflejan el nuevo estado sin que abrir o recorrer el modal marque elementos como leidos

#### Scenario: Marcar una línea
- **WHEN** el usuario activa el boton `✅` de una notificacion no leida
- **THEN** solo esa linea queda leida, el boton queda visible pero deshabilitado y se actualiza el badge

#### Scenario: Toast Realtime
- **WHEN** llega una nueva notificacion a la sesion autenticada
- **THEN** aparece un toast verde con `sobre.png` y el texto `Tienes una nueva notificación`

### Requirement: Representar las tarjetas sociales y el progreso diario

La tarjeta diaria SHALL poder desplegarse y SHALL reutilizar los iconos locales existentes para colección, valor, Bricks y rasgos DNA. Los cuatro cambios DNA SHALL presentarse en una cuadrícula compacta 2x2 alineada con los colores vigentes: Collector azul, Explorer rojo, Rarity Hunter amarillo y Fan verde. El nivel diario SHALL llevar el emoji `👉`, y las variaciones de ranking SHALL ir bajo una linea separadora. Los regalos SHALL mostrar el nombre del donante en negrita, sin el prefijo `El usuario` ni la palabra `Bricks`, y con el icono local de Brick. El boton de agradecimiento SHALL usar el mismo estilo que el boton de regalo del Ranking Global y mostrar `¡Gracias! +5` seguido del icono local. Las tarjetas de agradecimiento SHALL mostrar el nombre en negrita y `{user} agradeció tu regalo con 5` seguido del icono. Las entradas SHALL llevar `🌐` (Global) o `🗓️` (Semanal), y las salidas SHALL empezar por `❌`.

#### Scenario: Cuadricula DNA diaria
- **WHEN** se muestra un resumen diario
- **THEN** aparecen los cuatro cambios DNA en una cuadrícula 2x2 con nombre, porcentaje y color correspondiente

#### Scenario: Agradecimiento pendiente y completado
- **WHEN** se muestra un regalo sin agradecer
- **THEN** aparece `¡Gracias! +5` seguido del icono local de Brick
- **WHEN** la API confirma el agradecimiento
- **THEN** el control queda deshabilitado y no permite repetir la recompensa