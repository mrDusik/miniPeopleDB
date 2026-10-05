# Spec Delta

## MODIFIED Requirements

### Requirement: Unificar el modal por modo de apertura

La interfaz SHALL usar un modal de dos columnas con formulario a la izquierda y preview de 250px a la derecha, sin fondo gris detrás de la imagen. El modal SHALL ajustarse al viewport sin scroll horizontal ni vertical. La fila de identidad SHALL ocupar el ancho de la columna del formulario y distribuir en dos áreas iguales una columna apilada de ID y Nombre y el campo de Descripción. La consulta individual SHALL iniciarse automáticamente al cargar la imagen tras introducir un ID en alta ordinaria; no habrá un botón individual de sincronización. Los asteriscos de campos obligatorios SHALL ocultarse en visualización. El estado SHALL controlarse mediante botones de icono mutuamente excluyentes, con `📦` seleccionado por defecto en alta ordinaria; Seguir SHALL ser un toggle visual con los estados activo/inactivo de la tabla. En creación ordinaria solo ID estará habilitado inicialmente; los campos dependientes y Guardar permanecerán deshabilitados hasta obtener datos y completar ID, Nombre, Estado, Categoría, Año y Precio Brickset. En edición ID SHALL estar deshabilitado, sombreado y no editable, los campos Brickset serán solo lectura y se conservará `FechaRegistro`; Nombre y Descripción, estado, seguimiento y datos de compra SHALL mantener las posibilidades de edición vigentes, con compra deshabilitada para BUSCADA. El alta rápida desde ranking SHALL reutilizar el modal con aspecto de edición, ID deshabilitado y sombreado, metadatos precargados, Nombre y Descripción vacíos, BUSCADA fijo, seguimiento editable y datos de compra deshabilitados; guardar SHALL crear una figura propia, no editar una ajena. En visualización todos los campos e iconos estarán deshabilitados y solo Cerrar estará activo.

#### Scenario: Crear y sincronizar
- **WHEN** el usuario abre alta ordinaria, introduce un ID y sincroniza correctamente
- **THEN** se autocompletan los datos Brickset y la imagen
- **AND** se habilitan únicamente los campos manuales permitidos y Guardar cuando los obligatorios sean válidos

#### Scenario: Visualizar solo lectura
- **WHEN** se abre una figura desde `.id-link`, una tarjeta de ranking propio o una tarjeta de observadas
- **THEN** el modal muestra todos los datos y preview sin permitir edición, observación ni sincronización
- **AND** solo Cerrar permanece activo

#### Scenario: Visualizar una tarjeta fuera del catálogo filtrado
- **WHEN** se abre una tarjeta cuya figura no está en el catálogo actualmente cargado
- **THEN** la interfaz obtiene la figura por su ID antes de abrir el modal
- **AND** muestra el registro completo en modo visualización

#### Scenario: Editar una figura existente
- **WHEN** se abre una figura propia en edición
- **THEN** ID está deshabilitado y sombreado y los campos Brickset no admiten edición manual
- **AND** Nombre, Descripción, estado, seguimiento y datos de compra siguen las reglas vigentes
- **AND** guardar conserva el ID y `FechaRegistro`

#### Scenario: Alta rápida desde ranking
- **WHEN** se abre una figura ajena mediante el botón de añadir a buscadas
- **THEN** el modal muestra ID y metadatos bloqueados, Nombre y Descripción vacíos y BUSCADA seleccionado sin posibilidad de cambiar estado
- **AND** seguimiento permanece editable y guardar crea un registro propio

#### Scenario: Restaurar los modos ordinarios
- **WHEN** tras cerrar el alta rápida se abre alta ordinaria, edición propia o visualización
- **THEN** el modal restaura los valores y permisos propios de ese modo sin conservar restricciones o datos del destacado anterior

## ADDED Requirements

### Requirement: Mostrar en rojo los indicadores de obligatoriedad

La interfaz SHALL mostrar en rojo cada asterisco visible que identifica un campo obligatorio en cualquier formulario de la aplicación. El color SHALL aplicarse al asterisco, no a toda la etiqueta, y SHALL NOT cambiar las reglas de validación ni añadir obligatoriedad a campos opcionales. En visualización SHALL mantenerse la ocultación de estos indicadores.

#### Scenario: Formularios con campos requeridos
- **WHEN** se muestra un formulario con etiquetas de campos obligatorios, incluida el alta rápida desde ranking
- **THEN** todos sus asteriscos visibles aparecen en rojo y el texto de las etiquetas conserva su color habitual

#### Scenario: Visualización y campos opcionales
- **WHEN** se abre un formulario en modo visualización o se muestra un campo opcional
- **THEN** visualización no muestra asteriscos y los campos opcionales no reciben indicadores de obligatoriedad

### Requirement: Calcular DNA propio dinamico y retroactivo

El sistema SHALL calcular DNA en Supabase mediante una consulta dinamica sobre los logros obtenidos y sus cantidades actuales, sin almacenar porcentajes derivados ni calcular pesos en el cliente. Cada contribucion SHALL ser cantidad por peso del caracter, sin multiplicar por Bricks o total de Bricks. Las proporciones SHALL ser 100 por la suma de contribuciones de un caracter dividida por la suma de contribuciones de los cuatro caracteres. Los logros de coleccion SHALL tener los siguientes pesos privados, con suma 100 por fila; `someone-liked-your-collection` SHALL ser la unica excepcion confirmada con pesos cero y SHALL NOT contribuir a sumas ni denominador. Un identificador desconocido SHALL NOT recibir pesos inventados ni diluir el denominador. Nuevos logros de coleccion SHALL requerir una ponderacion de suma 100 antes de habilitarse para DNA.

| Logro | Rarity Hunter | Collector | Explorer | Fan |
| --- | --- | --- | --- | --- |
| new-mini-person | 5 | 60 | 15 | 20 |
| woah | 50 | 30 | 10 | 10 |
| deal-master | 75 | 15 | 5 | 5 |
| masterpiece | 90 | 5 | 0 | 5 |
| holy-grail | 95 | 5 | 0 | 0 |
| omgold | 95 | 0 | 0 | 5 |
| lets-go | 5 | 20 | 60 | 15 |
| collector | 10 | 80 | 0 | 10 |
| step-by-step | 5 | 15 | 70 | 10 |
| bricky-potter | 0 | 10 | 20 | 70 |
| bricky-mouse | 0 | 10 | 20 | 70 |
| its-a-me-mario | 0 | 10 | 20 | 70 |
| green-hill-zone | 0 | 10 | 20 | 70 |
| dimensional | 10 | 10 | 30 | 50 |
| warsie | 0 | 10 | 20 | 70 |
| in-ny-i-was | 60 | 5 | 5 | 30 |
| welcome-to-the-upsidedown | 30 | 10 | 10 | 50 |
| chill-nancy-im-fine | 40 | 10 | 10 | 40 |
| someone-liked-your-collection | 0 | 0 | 0 | 0 |

El resultado SHALL reflejar los registros historicos de pruebas y produccion desde la primera consulta tras aplicar el esquema, sin requerir nuevas altas ni reotorgar logros. Las consultas posteriores y los refrescos tras mutaciones confirmadas de la coleccion SHALL reflejar las cantidades vigentes. La lectura DNA SHALL NOT modificar logros, Bricks, nivel ni minifiguras.

#### Scenario: Cantidades sin ponderacion por Bricks
- **WHEN** hay dos `new-mini-person` y un `woah`
- **THEN** DNA contiene Rarity Hunter 20%, Collector 50%, Explorer 40/3% y Fan 50/3%, con tolerancia de representacion numerica
- **AND** el caracter principal es Collector aunque `woah` conceda mas Bricks por unidad

#### Scenario: Retroactividad
- **WHEN** se instala el esquema DNA en pruebas o produccion con logros historicos existentes
- **THEN** la primera consulta calcula DNA desde sus cantidades sin nuevas acciones del usuario
- **AND** no cambia los registros historicos ni concede notificaciones de nuevos logros

#### Scenario: Regalos no alteran personalidad
- **WHEN** aumenta la cantidad de `someone-liked-your-collection` sin cambios de logros de coleccion
- **THEN** sus Bricks y nivel mantienen las reglas de regalos vigentes y su DNA no cambia

#### Scenario: Actualizar cantidades
- **WHEN** una alta, edicion, eliminacion, cambio de estado o sincronizacion modifica logros de coleccion y se confirma el recalculo
- **THEN** el siguiente refresco muestra el DNA correspondiente sin persistir porcentajes calculados previamente

### Requirement: Seleccionar caracter principal sin ambiguedad

El sistema SHALL mostrar `Newbie` y cuatro proporciones cero cuando la suma de contribuciones es cero, incluidos usuarios sin logros o con solo regalos. En otro caso SHALL elegir el caracter de mayor contribucion exacta, aplicando en empate Explorer > Collector > Fan > Rarity Hunter. El redondeo de presentacion SHALL NOT intervenir en la seleccion. El panel propio SHALL mostrar solo el nombre del caracter, sin porcentajes DNA; el porcentaje de progreso hacia el siguiente nivel SHALL conservarse.

#### Scenario: Usuario Newbie
- **WHEN** el usuario no tiene logros de coleccion que contribuyan a DNA
- **THEN** el panel muestra `Newbie` y el resultado DNA contiene cuatro ceros sin division por cero

#### Scenario: Empate de todos los caracteres
- **WHEN** las cuatro contribuciones son iguales y positivas
- **THEN** el caracter principal es Explorer

#### Scenario: Empates parciales
- **WHEN** el maximo corresponde a Collector, Fan y Rarity Hunter sin Explorer, o solo a Fan y Rarity Hunter
- **THEN** se elige respectivamente Collector o Fan

#### Scenario: Redondeo no genera empates
- **WHEN** dos proporciones distintas parecen iguales tras redondearse para presentacion
- **THEN** se elige la mayor contribucion original sin aplicar desempate artificial

### Requirement: Mantener privadas las ponderaciones individuales

Las ponderaciones por logro SHALL NOT ser accesibles desde API de logros, respuestas de mutaciones, recursos estaticos, datos del DOM, tooltips, modales propios o ajenos ni consultas directas del cliente Supabase. El usuario autenticado SHALL poder consultar exclusivamente sus proporciones DNA agregadas y caracter principal; SHALL NOT elegir un usuario ajeno como objetivo de esa consulta. El ranking SHALL exponer exclusivamente el caracter principal de sus usuarios, sin proporciones DNA ni pesos. Las tablas privadas SHALL conservar RLS por usuario. Una peticion propia sin sesion SHALL recibir `401`; un fallo de consulta SHALL producir un estado de error, no fingir `Newbie`.

#### Scenario: Pesos fuera del cliente
- **WHEN** se consultan logros propios o publicos, ranking o resultados de operaciones de coleccion
- **THEN** ninguna respuesta incluye la matriz ni propiedades de pesos por logro
- **AND** los recursos HTML, CSS y JavaScript servidos no contienen la matriz de ponderaciones

#### Scenario: Consulta DNA propia autenticada
- **WHEN** un usuario autenticado consulta su DNA
- **THEN** recibe solo las cuatro proporciones agregadas y su caracter principal
- **AND** no puede consultar proporciones ajenas ni leer o escribir la tabla de pesos

#### Scenario: Error y sesion
- **WHEN** falta sesion o no esta disponible la consulta DNA
- **THEN** sin sesion se rechaza la peticion y ante fallo la interfaz muestra un error controlado con posibilidad de reintentar
- **AND** no muestra DNA de una cuenta previa ni trata el fallo como personalidad Newbie

### Requirement: Abrir DNA desde el panel propio

Debajo del nivel y nombre del usuario activo SHALL aparecer un boton de icono DNA junto al nombre de su caracter principal, con estilo equivalente al boton de Ranking, tooltip y nombre accesible `DNA`. El icono SHALL abrir el modal DNA propio. El desplegable SHALL incluir `DNA` a la derecha de `Ver Logros`, con el mismo estilo, en un contenedor flex distribuido en dos mitades iguales. El acceso existente a Ranking Global SHALL conservarse en una fila separada. Los botones SHALL ser controles independientes sin anidarse dentro del boton de nivel y utilizables por teclado.

#### Scenario: Accesos equivalentes
- **WHEN** el usuario activa el icono DNA bajo el nivel o el boton DNA del desplegable
- **THEN** se abre el mismo modal con el DNA del usuario activo, nunca el del ultimo usuario cuyos logros se consultaron
- **AND** ambos controles conservan nombres accesibles y no abren logros ni ranking

#### Scenario: Distribucion responsive
- **WHEN** se muestra el desplegable en escritorio o movil
- **THEN** Ver Logros ocupa la mitad izquierda y DNA la mitad derecha, sin solapamientos ni scroll horizontal
- **AND** Ranking Global sigue disponible sin compartir ese reparto

### Requirement: Visualizar DNA propio en modal de tarta

El modal DNA SHALL conservar la linea grafica de los modales existentes y representar las proporciones agregadas mediante una tarta con Rarity Hunter amarillo, Explorer rojo, Collector azul y Fan verde. SHALL incluir una leyenda con los cuatro nombres, sus colores y descripciones: Rarity Hunter busca piezas raras y valiosas; Explorer descubre categorias y subcategorias; Collector amplia y completa la coleccion; Fan muestra afinidad por tematicas y personajes. La leyenda SHALL ofrecer tambien las proporciones agregadas propias de forma accesible, sin pesos individuales. Un usuario Newbie SHALL ver un estado neutro con ese texto, sin segmentos inventados. SHALL manejar carga, error, cierre por boton o Escape y retorno de foco al disparador, sin cambiar logros propios o ajenos. Al cerrar o cambiar sesion SHALL descartar respuestas obsoletas y limpiar datos privados.

#### Scenario: DNA disponible
- **WHEN** el usuario abre DNA con contribuciones positivas
- **THEN** ve una tarta proporcional con los cuatro colores y una leyenda descriptiva accesible
- **AND** los porcentajes agregados solo aparecen en este modal propio, no en el panel ni el ranking

#### Scenario: Tarta sin contribuciones
- **WHEN** se abre DNA para un Newbie
- **THEN** se muestra una representacion neutra y cuatro proporciones cero, sin un sector completo asignado a ningun caracter

#### Scenario: Cerrar y cambiar sesion
- **WHEN** se cierra DNA con Cerrar o Escape, o termina la sesion durante una consulta
- **THEN** el cierre devuelve foco al disparador valido y el cambio de sesion limpia el modal
- **AND** una respuesta obsoleta no modifica el DNA de la nueva cuenta ni la vista de logros abierta