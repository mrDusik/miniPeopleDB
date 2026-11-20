# Spec Delta

## Purpose

Permitir el uso completo de la interfaz propia en espanol, ingles, italiano y frances, preservando el contenido original del catalogo, los nombres de logros y los contratos de datos existentes.

## ADDED Requirements

### Requirement: Ofrecer cobertura completa de interfaz en los cuatro idiomas

La aplicacion SHALL ofrecer los idiomas `es`, `en`, `it` y `fr` para todos los textos propios visibles y accesibles de acceso, registro, recuperacion y cambio de contrasena, onboarding, preferencias, inventario, filtros, formularios, rankings, amigos, perfiles, DNA, historico, contacto, notificaciones dentro de la aplicacion y toasts. SHALL incluir encabezados, opciones, estados de carga/vacio/error, validaciones, confirmaciones, leyendas y tooltips de graficos, etiquetas de iconos, placeholders, titulos y textos alternativos significativos. Las paginas propias de confirmacion de email web y Android SHALL usar la misma politica de idioma y respaldo. Los nombres de marca y el contenido explicitamente excluido SHALL conservarse.

Los literales espanoles de otras especificaciones SHALL entenderse como la presentacion en `es`; en `en`, `it` y `fr` SHALL mostrarse su equivalente, sin cambiar la accion ni las reglas asociadas. Esta regla SHALL NOT traducir identificadores ni textos explicitamente excluidos. Los emails de proveedores, sus pantallas externas, los dialogos nativos del sistema y el texto de push fuera de la app quedan fuera de esta capacidad.

#### Scenario: Recorrer la app en ingles
- **WHEN** una persona con idioma `en` usa las pantallas, modales y acciones disponibles de la aplicacion
- **THEN** los textos propios y sus nombres accesibles aparecen en ingles, incluidos los estados generados despues de la carga inicial
- **AND** los unicos textos que conservan otro idioma son los contenidos explicitamente excluidos y los respaldos diagnosticados por traducciones ausentes

#### Scenario: Acceso y confirmacion de email
- **WHEN** se abre una pantalla propia sin sesion o de confirmacion de email
- **THEN** sus instrucciones y estados de exito o fallo siguen el ultimo idioma confirmado disponible en ese navegador, o espanol si no existe
- **AND** no se agregan parametros de idioma a enlaces de autenticacion ni se cambia su validacion o tratamiento de tokens

### Requirement: Preservar Brickset y los nombres originales de los logros

El cambio de idioma SHALL NOT traducir ni reescribir nombres, descripciones, categorias, subcategorias u otros textos procedentes de Brickset, ni valores introducidos libremente por usuarios, usernames, IDs, URLs o nombres de marca. Los alias visuales de categorias y subcategorias CMF ya autorizados SHALL seguir funcionando sin introducir nuevas traducciones de esos datos. Los nombres de los logros, por ejemplo `Block by block`, SHALL conservar su texto original en listas propias, perfiles ajenos, destacados y toasts. Las descripciones inferiores de los logros SI SHALL traducirse, identificando el logro de manera estable y manteniendo intacto el dato fuente.

#### Scenario: Misma figura en ambos idiomas
- **WHEN** se visualiza la misma figura en `es` y `en`
- **THEN** su nombre, descripcion, categoria, subcategoria, ID y valores fuente son identicos
- **AND** solo cambian las etiquetas propias, los mensajes envolventes y los formatos de presentacion

#### Scenario: Nombre de logro y descripcion
- **WHEN** se muestra el logro `block-by-block` con idioma `en`
- **THEN** su nombre sigue siendo `Block by block` y su descripcion inferior aparece en ingles
- **AND** al volver a `es` se recupera su descripcion espanola con terminologia minipersona
- **AND** no se modifican el objeto recibido, el catalogo persistido, sus condiciones ni sus Bricks

#### Scenario: Mensaje con contenido externo interpolado
- **WHEN** un texto traducido contiene un username o un nombre de Brickset
- **THEN** ese valor se conserva literalmente y se representa como texto seguro, nunca como HTML ejecutable

### Requirement: Resolver el idioma sin mezclar preferencias entre cuentas

El idioma del perfil de la cuenta activa SHALL ser la fuente de verdad autenticada. Sin perfil disponible, la interfaz SHALL usar el ultimo idioma confirmado recordado en el dispositivo y, en su ausencia, `es`, sin deteccion automatica del navegador. La preferencia local SHALL almacenar solo el codigo de idioma y SHALL NOT contener tokens ni datos de identidad. Un perfil nuevo sin preferencia persistida SHALL mantener `es` como valor inicial del formulario. Al recuperar el perfil activo, su idioma SHALL prevalecer sobre la preferencia local.

La seleccion del formulario SHALL aplicarse globalmente y recordarse solo tras guardar correctamente el perfil. Cerrar sin guardar o fallar el guardado SHALL conservar el idioma confirmado anterior. Una respuesta de perfil de una cuenta anterior SHALL NOT cambiar el idioma de la cuenta actual. La indisponibilidad de almacenamiento local SHALL NOT impedir usar o guardar el idioma del perfil y SHALL producir un diagnostico explicito sin datos sensibles.

#### Scenario: Primera visita
- **WHEN** no hay sesion, preferencia local ni perfil
- **THEN** la interfaz aparece en espanol y no elige ingles por el idioma del navegador

#### Scenario: Cambiar y guardar idioma
- **WHEN** se selecciona ingles en el selector existente y el perfil se guarda correctamente
- **THEN** la interfaz activa pasa a ingles sin exigir recarga manual ni perder filtros, seleccion de vista o datos cargados
- **AND** al recargar o iniciar sesion en otro dispositivo se aplica el `en` del perfil

#### Scenario: Cancelacion o fallo
- **WHEN** se selecciona otro idioma y se cierra sin guardar o falla el guardado
- **THEN** la interfaz conserva el idioma confirmado anterior
- **AND** ante fallo se informa en ese idioma y el formulario conserva los valores para reintentar

#### Scenario: Cambio de cuenta durante una peticion
- **WHEN** una cuenta con `en` sale y entra otra cuyo perfil tiene `es`, incluso si queda una respuesta anterior pendiente
- **THEN** al resolver el perfil de la nueva cuenta se muestra espanol
- **AND** ninguna respuesta ni cache de la cuenta anterior sustituye su idioma o sus datos

### Requirement: Mantener traducciones completas con respaldo observable

Los textos propios SHALL resolverse mediante claves estables y catalogos separados por idioma, con frases completas, parametros nombrados y pluralizacion del idioma seleccionado. Los catalogos ES/EN/IT/FR SHALL cubrir las mismas claves y parametros requeridos, incluidas las descripciones de todos los logros vigentes. Las pruebas SHALL fallar ante claves o parametros requeridos ausentes. Si falta una traduccion en ejecucion, SHALL mostrarse el equivalente espanol y emitirse un diagnostico con la clave y el idioma, sin datos de usuario. Si tampoco existe texto espanol, SHALL mostrarse un mensaje generico localizado y diagnosticarse el fallo, nunca mostrar una clave tecnica al usuario.

#### Scenario: Singular y plural
- **WHEN** un contador representa cero, una o varias minipersonas
- **THEN** cada idioma muestra una frase completa con el plural correspondiente y el numero correcto
- **AND** la frase no depende de concatenar fragmentos con orden fijo espanol

#### Scenario: Traduccion inglesa ausente
- **WHEN** una clave tiene traduccion espanola pero carece de traduccion inglesa en ejecucion
- **THEN** la interfaz muestra el texto espanol y registra la clave ausente sin interpolar datos privados en el diagnostico
- **AND** la comprobacion automatizada del catalogo detecta esa carencia

#### Scenario: Recursos de idioma no disponibles
- **WHEN** no pueden cargarse los recursos necesarios para aplicar ingles
- **THEN** la aplicacion comunica el problema y ofrece reintentar, sin presentar el cambio como aplicado
- **AND** conserva el idioma anterior utilizable o la pantalla base espanola con un error visible si no hay recursos cargados
- **AND** no persiste un idioma distinto ni modifica preferencias para ocultar el error

### Requirement: Localizar la presentacion sin alterar contratos o magnitudes

La interfaz SHALL presentar fechas, horas, cantidades, porcentajes y moneda conforme a `es-ES`, `en-GB`, `it-IT` o `fr-FR` segun el idioma elegido. SHALL conservar importes y moneda EUR, precision de negocio, orden cronologico, zona horaria funcional y calculos de semanas/fechas existentes. Los valores canonicos de formularios, filtros y peticiones, incluidos `COLECCIÓN` y `BUSCADA`, SHALL permanecer inalterados aunque sus etiquetas se traduzcan. La ordenacion por texto visible SHALL usar el idioma activo sin cambiar comparaciones numericas ni la normalizacion de las busquedas.

#### Scenario: Formatos locales
- **WHEN** la interfaz muestra el porcentaje 10.6 y un importe de 1234.5 EUR
- **THEN** en espanol utiliza separadores espanoles y en ingles separadores ingleses, con la precision correspondiente a cada campo
- **AND** conserva las magnitudes 10.6 y 1234.5 y la moneda EUR, sin convertirlas a USD o GBP

#### Scenario: Filtros en ingles
- **WHEN** se selecciona la etiqueta inglesa de un estado de coleccion
- **THEN** el filtrado y las peticiones siguen usando el valor canonico existente y devuelven las mismas figuras que en espanol

#### Scenario: Fechas y semanas
- **WHEN** se cambia el idioma al consultar historico, ranking semanal o notificaciones cerca de un cambio de dia
- **THEN** solo cambian los textos y formatos visibles, no los registros agrupados, la semana consultada ni los limites temporales

### Requirement: Traducir mensajes dinamicos sin reescribir el historial

Los errores, estados y avisos propios provenientes del backend SHALL localizarse al presentarse usando codigos, tipos y datos estructurados existentes. Las notificaciones nuevas y guardadas de tipos soportados SHALL mostrar el idioma activo sin migrar su texto persistido, conservando autores autorizados, fecha, lectura, cantidades y acciones. Un tipo o codigo desconocido SHALL producir un mensaje generico localizado y un diagnostico, sin exponer errores internos ni interpretar contenido libre como una clave. Las descripciones de logros SHALL resolverse por su identificador, no por sustituciones globales sobre el DOM.

#### Scenario: Aviso historico de ranking
- **WHEN** una notificacion guardada de ranking con mensaje espanol se abre con idioma `en`
- **THEN** se presenta una frase inglesa obtenida de su tipo y sus datos disponibles
- **AND** no se cambia su contenido persistido, fecha, estado de lectura ni comportamiento

#### Scenario: Error conocido o desconocido
- **WHEN** una operacion devuelve un codigo de error conocido o uno no soportado
- **THEN** se muestra respectivamente su mensaje localizado especifico o un error generico localizado
- **AND** el desconocido se diagnostica sin revelar trazas, credenciales ni datos privados

### Requirement: Conservar accesibilidad y distribucion en web y Android

El documento SHALL declarar el idioma activo mediante `lang`. Actualizar textos SHALL preservar el foco, las asociaciones de etiquetas, la semantica de controles, la seguridad del renderizado y los valores editados. Los textos en ambos idiomas SHALL caber en los disenos de escritorio y smartphone sin solaparse ni ocultar acciones. Los cuatro recursos de traduccion SHALL distribuirse con la aplicacion web y el paquete Android, sin depender de CDN ni servicios externos de traduccion.

#### Scenario: Cambio accesible
- **WHEN** se aplica ingles despues de guardar las preferencias
- **THEN** `lang` pasa a `en` y se actualizan nombres accesibles, titulos y textos propios
- **AND** se conserva el comportamiento de teclado y retorno de foco del flujo de guardado, sin reconstruir indiscriminadamente controles o perder estado

#### Scenario: Paquete Android
- **WHEN** se generan e instalan los recursos web de Android
- **THEN** incluyen la libreria y los catalogos ES/EN/IT/FR y resuelven sus rutas desde el origen local de Capacitor
- **AND** las traducciones no requieren descargar recursos de un tercero
