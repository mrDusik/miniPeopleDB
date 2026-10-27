# Spec Delta

## MODIFIED Requirements

### Requirement: Derivar todos los logros de colección del estado vigente

Todos los logros de coleccion SHALL representar requisitos cumplidos por las minifiguras actuales en `COLECCIÓN` y los totales conocidos actuales, no concesiones historicas permanentes. El catalogo y condiciones SHALL ser exclusivamente las de `logros-v2`. El recalcule SHALL reconstruir cantidades y Bricks, ajustar nivel y progreso tanto al alza como a la baja y conservar los umbrales de nivel vigentes. SHALL ganar, perder o recuperar logros tras altas, ediciones, eliminaciones, cambios entre COLECCIÓN y BUSCADA, cambios validos de metadatos de figuras, totales y anio de serie, y despliegues de objetivos. `repetible: false` SHALL limitar a una concesion vigente sin impedir perdida o recuperacion. Los logros sociales SHALL seguir igualmente sus fuentes vigentes V2. Las siguientes consultas de DNA, logros publicos, perfil y ranking SHALL reflejar el estado confirmado.

Los regalos y agradecimientos V2 persistidos SHALL conservar su contribucion vigente independientemente del inventario; la migracion unica autorizada SHALL retirar las fuentes V1. La UI SHALL mantener su presentacion y orden existentes, sin grupos editoriales nuevos ni importar la columna Total. El saldo de Bricks SHALL admitir contribuciones directas que no se representan como logros repetibles.

#### Scenario: Aumento del total conocido
- **WHEN** el total de una categoria o subcategoria aumenta y deja de cumplirse un hito
- **THEN** se retiran o reducen los logros y sus Bricks, ajustando nivel y progreso sin borrar regalos V2

#### Scenario: Pérdida y recuperación por estado de figura
- **WHEN** una figura necesaria pasa a BUSCADA y posteriormente vuelve a COLECCIÓN
- **THEN** se pierden y recuperan los logros cuyos requisitos cambian, incluidos los no repetibles

#### Scenario: Concesión retroactiva sin nueva adquisición
- **WHEN** se aplica V2 y el inventario conservado ya cumple requisitos nuevos
- **THEN** el recalcule los concede sin exigir altas nuevas y sin mantener el catalogo V1

#### Scenario: Revalidacion tras accion social
- **WHEN** se confirma un regalo, agradecimiento, envio, rechazo, aceptacion o eliminacion de amistad
- **THEN** el panel y los modales afectados revalidan Bricks, nivel, logros y DNA sin conservar resultados obsoletos de otra sesion

### Requirement: Calcular DNA propio dinamico y retroactivo

El sistema SHALL calcular DNA actual en Supabase mediante consulta dinamica de los logros obtenidos y sus cantidades vigentes, sin persistir porcentajes como fuente actual ni publicar o calcular pesos en el cliente. La medicion diaria privada SHALL conservar porcentajes de la fecha, no sustituir el calculo dinamico ni reescribirse con nuevas ponderaciones, salvo el reset unico V2 definido en `analitica-historica`.

Cada contribucion SHALL ser cantidad por peso del rasgo, sin multiplicar por Bricks. Los pesos privados SHALL ser los definidos en `logros-v2`, enteros de 0 a 100 cuya suma por logro sea **0 o 100**. Todos los pesos cero SHALL excluirse del numerador y denominador, tanto si son de coleccion como sociales o hitos DNA. Un ID desconocido SHALL NOT recibir pesos inventados ni diluir el denominador. Las proporciones SHALL ser 100 por la contribucion del rasgo dividida por la suma de las cuatro contribuciones. Cero contribuciones SHALL devolver cuatro ceros y Newbie. Los cuatro logros de umbral DNA SHALL tener pesos cero y comprobar porcentajes exactos >= 50 sin realimentacion.

La lectura propia SHALL reflejar el estado confirmado y pesos privados vigentes sin modificar logros, Bricks, nivel ni minifiguras. Cambios de pesos que alteren la elegibilidad de hitos DNA SHALL actualizar dichos hitos mediante recalcule autorizado, nunca mediante una lectura publica ajena. El reset inicial SHALL reconstruir el estado V2 antes de atender lecturas ordinarias, sin avisos masivos.

#### Scenario: Cantidades sin ponderacion por Bricks
- **WHEN** las contribuciones son una unidad Sweet find y una Hidden gem
- **THEN** el DNA es Collector 65%, Rarity Hunter 12.5%, Fan 15% y Explorer 7.5%, antes de evaluar hitos DNA
- **AND** los diferentes Bricks de cada logro no alteran esa distribucion

#### Scenario: Retroactividad
- **WHEN** se confirma la migracion V2
- **THEN** la primera consulta refleja logros y pesos V2 de la coleccion conservada sin nuevas altas ni notificaciones sinteticas

#### Scenario: Regalos no alteran personalidad
- **WHEN** aumenta Block by block o un hito social de pesos cero sin cambiar las contribuciones restantes
- **THEN** sus Bricks pueden cambiar pero DNA no cambia
- **AND** un usuario con solo esos logros permanece Newbie aunque tenga coleccion y Bricks

#### Scenario: Actualizar cantidades
- **WHEN** una mutacion confirmada o sincronizacion cambia cantidades de logros
- **THEN** el siguiente refresco calcula DNA desde las cantidades vigentes, sin reutilizar porcentajes anteriores

#### Scenario: Cambios en las ponderaciones
- **WHEN** se modifica una ponderacion privada valida y se confirma el recalcule necesario de hitos DNA
- **THEN** DNA y Ranking Global reflejan los pesos actuales y los dias V2 anteriores conservan sus porcentajes capturados

### Requirement: Diferenciar los logros de regalo

El modal de Logros SHALL mostrar el icono de regalo existente para los cuatro hitos V2 de regalos y agradecimientos emitidos, de tipo `regalo`, y SHALL conservar la copa habitual para los demas. No SHALL mostrar los antiguos logros repetibles de regalos/agradecimientos ni crear logros artificiales para justificar Bricks directos. Este tipo de presentacion SHALL NOT introducir los grupos editoriales del PDF como secciones de la aplicacion.

#### Scenario: Mostrar un logro de regalo
- **WHEN** el estado V2 contiene Oh! you shouldn't have! o un hito V2 de agradecimiento emitido
- **THEN** conserva el icono de regalo y solo muestra cantidad y recompensa del hito
- **AND** el saldo global incluye aparte los Bricks directos que correspondan

### Requirement: Representar las tarjetas sociales y el progreso diario

La tarjeta diaria SHALL poder desplegarse y reutilizar los iconos locales de coleccion, valor, Bricks y DNA. Los cuatro cambios DNA SHALL presentarse en una cuadricula compacta 2x2: Collector azul, Explorer rojo, Rarity Hunter amarillo y Fan verde. El nivel diario SHALL llevar el emoji existente y las variaciones de ranking SHALL ir bajo una linea separadora. Los regalos SHALL mostrar el username del donante en negrita, sin prefijo El usuario ni la palabra Bricks, y con el icono local de Brick. El boton de agradecimiento SHALL conservar el estilo del boton de regalo y representar fielmente el importe directo vigente del contrato social, sin prometer un logro V1 al receptor de las gracias. Las tarjetas de agradecimiento SHALL identificar quien agradecio y el importe directo concedido. Las entradas y salidas de ranking SHALL conservar sus iconos actuales. El reset V2 SHALL vaciar la bandeja anterior y la migracion inicial SHALL NOT crear tarjetas de progreso o transiciones ficticias.

#### Scenario: Cuadricula DNA diaria
- **WHEN** se muestra un resumen diario V2
- **THEN** aparecen los cuatro cambios con nombre, porcentaje y color correspondiente

#### Scenario: Agradecimiento pendiente y completado
- **WHEN** se muestra un regalo V2 sin agradecer y se confirma la accion
- **THEN** el control queda deshabilitado y los textos distinguen importe directo de los hitos obtenidos por quien agradece
- **AND** ningun texto anuncia el logro repetible V1 por recibir las gracias

## ADDED Requirements

### Requirement: Notificar logros nuevos con toast

La UI SHALL mostrar un toast por cada logro nuevo obtenido tras una accion confirmada del usuario, incluidas altas, ediciones o eliminaciones de figuras, cambios de precios, regalos, agradecimientos y acciones sociales. Los logros repetibles SHALL generar un toast por el incremento de cantidad, con los Bricks nuevos correspondientes; no SHALL notificarse logros ya existentes durante la carga inicial, ni concesiones sinteticas del reset o la migracion V2.

#### Scenario: Logro social recién obtenido
- **WHEN** enviar o aceptar una solicitud de amistad concede First contact o Handshake
- **THEN** se muestra el nombre del logro y los Bricks concedidos en un toast

#### Scenario: Incremento repetible
- **WHEN** una accion confirmada aumenta la cantidad vigente de un logro repetible
- **THEN** se muestra un toast por la cantidad nueva y no se repiten las concesiones anteriores

## REMOVED Requirements

### Requirement: Conceder nuevos logros de categorías, figuras y completitud

**Reason**: el catalogo incremental V1 y sus recompensas se sustituyen integramente por las 115 definiciones V2.

**Migration**: usar `logros-v2` para todos los IDs, titulos, condiciones, pesos y Bricks; reconstruir las cantidades desde el inventario vigente durante la migracion unica, sin conservar recompensas omitidas.