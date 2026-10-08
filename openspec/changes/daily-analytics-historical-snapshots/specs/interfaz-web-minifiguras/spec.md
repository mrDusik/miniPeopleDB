# Spec Delta

## MODIFIED Requirements

### Requirement: Calcular DNA propio dinamico y retroactivo

El sistema SHALL calcular DNA actual en Supabase mediante una consulta dinamica sobre los logros obtenidos y sus cantidades actuales, sin almacenar porcentajes derivados como fuente del estado actual ni calcular pesos en el cliente. La unica excepcion de almacenamiento SHALL ser la medicion diaria privada de `analitica-historica`, que conserva porcentajes agregados a la fecha de captura, no sustituye la consulta dinamica y no se reescribe retroactivamente por cambios de ponderaciones. Cada contribucion SHALL ser cantidad por peso del caracter, sin multiplicar por Bricks o total de Bricks. Las proporciones SHALL ser 100 por la suma de contribuciones de un caracter dividida por la suma de contribuciones de los cuatro caracteres. Los logros de coleccion SHALL tener los siguientes pesos privados, con suma 100 por fila; `someone-liked-your-collection` SHALL ser la unica excepcion confirmada con pesos cero y SHALL NOT contribuir a sumas ni denominador. Un identificador desconocido SHALL NOT recibir pesos inventados ni diluir el denominador. Nuevos logros de coleccion SHALL requerir una ponderacion de suma 100 antes de habilitarse para DNA.

| Logro | Rarity Hunter | Collector | Explorer | Fan |
| --- | --- | --- | --- | --- |
| new-mini-person | 0 | 80 | 10 | 10 |
| woah | 50 | 20 | 10 | 20 |
| deal-master | 80 | 10 | 0 | 10 |
| masterpiece | 90 | 5 | 0 | 5 |
| holy-grail | 80 | 10 | 0 | 10 |
| omgold | 95 | 5 | 0 | 0 |
| lets-go | 0 | 5 | 90 | 5 |
| collector | 5 | 90 | 0 | 5 |
| step-by-step | 5 | 45 | 50 | 0 |
| bricky-potter | 0 | 10 | 20 | 70 |
| bricky-mouse | 0 | 10 | 20 | 70 |
| its-a-me-mario | 0 | 10 | 20 | 70 |
| green-hill-zone | 0 | 10 | 20 | 70 |
| dimensional | 60 | 10 | 20 | 10 |
| warsie | 0 | 10 | 20 | 70 |
| in-ny-i-was | 80 | 10 | 0 | 10 |
| welcome-to-the-upsidedown | 60 | 30 | 0 | 10 |
| chill-nancy-im-fine | 80 | 10 | 0 | 10 |
| the-legend | 0 | 10 | 20 | 70 |
| heh-there-is-another-one-for-you | 0 | 10 | 20 | 70 |
| change-will-not-come-in-a-single-sunrise | 0 | 10 | 20 | 70 |
| start-poetry | 0 | 10 | 20 | 70 |
| mental-breakdown | 90 | 5 | 0 | 5 |
| the-dark-plastic | 90 | 5 | 0 | 5 |
| concrete-savanna | 90 | 5 | 0 | 5 |
| youre-shooting-for-the-stars | 20 | 40 | 0 | 40 |
| strike | 20 | 40 | 0 | 40 |
| someone-liked-your-collection | 0 | 0 | 0 | 0 |

El resultado SHALL reflejar los registros historicos de pruebas y produccion desde la primera consulta tras aplicar el esquema, sin requerir nuevas altas ni reotorgar logros. Las consultas posteriores y los refrescos tras mutaciones confirmadas de la coleccion SHALL reflejar las cantidades vigentes. La lectura DNA SHALL NOT modificar logros, Bricks, nivel ni minifiguras.

#### Scenario: Cantidades sin ponderacion por Bricks
- **WHEN** hay dos `new-mini-person` y un `woah`
- **THEN** DNA contiene Rarity Hunter 50/3%, Collector 60%, Explorer 10% y Fan 40/3%, con tolerancia de representacion numerica
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
- **THEN** el siguiente refresco muestra el DNA correspondiente sin reutilizar porcentajes calculados previamente como fuente del estado actual

#### Scenario: Cambios en las ponderaciones
- **WHEN** se inserta, modifica o elimina una fila de `dna_ponderaciones`
- **THEN** la siguiente consulta DNA y Ranking Global de todos los usuarios refleja las ponderaciones vigentes sin backfill ni recalculo de logros
- **AND** las mediciones de dias anteriores conservan los porcentajes capturados

## ADDED Requirements

### Requirement: Consultar evolucion propia en un modal historico

La interfaz SHALL ofrecer al usuario autenticado un acceso de icono con nombre accesible y tooltip `Historico` junto al panel propio, sin cambiar los accesos existentes a DNA, logros o ranking. SHALL abrir un modal consistente con los actuales con selector de 30, 90 o 365 dias, 90 por defecto, y fechas personalizadas hasta 366 dias inclusivos. SHALL consultar solo la API historica propia al abrir o cambiar rango, representar carga, error con reintento y estado vacio, descartar respuestas obsoletas y limpiar datos y graficos al terminar la sesion. Cerrar por boton o Escape SHALL devolver foco al disparador valido. SHALL ajustarse a escritorio y movil sin solapamientos ni scroll horizontal, permitiendo scroll vertical interno.

#### Scenario: Abrir y cambiar rango
- **WHEN** el usuario abre Historico y cambia de 90 a 30 dias
- **THEN** el modal consulta el rango seleccionado y una respuesta anterior tardia no sustituye la vista nueva

#### Scenario: Historico vacio o fallido
- **WHEN** la API devuelve cero snapshots o falla
- **THEN** el modal muestra respectivamente estado vacio o error con reintento, sin inventar datos ni conservar los de una cuenta previa

#### Scenario: Cerrar o cambiar cuenta
- **WHEN** se cierra el modal o finaliza la sesion durante la carga
- **THEN** se invalidan respuestas pendientes, se liberan los graficos y al cerrar se restaura el foco cuando corresponde

### Requirement: Representar valor y cambio neto de coleccion

El modal SHALL mostrar linea de valor total EUR y barras de cambio neto de figuras en ejes separados y etiquetados. El cambio SHALL ser total actual menos total del dia inmediatamente anterior, usando `baseline` para el inicio del rango cuando corresponda; SHALL admitir valores negativos. Sin snapshot del dia anterior SHALL mostrar cambio no disponible, no cero ni una incorporacion ficticia. Las fechas ausentes SHALL mostrarse como huecos, sin interpolar ni repartir cambios entre dias. SHALL permitir inspeccionar fecha, EUR, total de figuras y cambio neto mediante tooltip y alternativa tabular accesible.

#### Scenario: Perdida de figuras
- **WHEN** dos dias consecutivos tienen 12 y 9 figuras
- **THEN** el segundo muestra barra de cambio neto -3 y su valor EUR correspondiente

#### Scenario: Baseline y huecos
- **WHEN** el rango tiene un baseline del dia anterior al primero, y mas adelante falta un dia
- **THEN** la primera barra usa ese baseline y el dia posterior al hueco no inventa un cambio diario

### Requirement: Representar evolucion historica de DNA

El modal SHALL mostrar areas apiladas sobre un eje fijo de 0 a 100 para Collector azul, Explorer rojo, Rarity Hunter amarillo y Fan verde, conservando colores actuales y nombres en leyenda accesible. SHALL usar exclusivamente porcentajes historicos devueltos, sin exponer pesos ni recalcularlos en el cliente. Cuatro ceros SHALL representar ausencia de contribuciones, no normalizarse a una personalidad inventada. Dias ausentes SHALL cortar las series. La inspeccion por fecha SHALL informar los cuatro porcentajes guardados y SHALL tolerar el redondeo de captura sin modificar los valores.

#### Scenario: Composicion historica y Newbie
- **WHEN** hay un snapshot con cuatro porcentajes positivos y otro con cuatro ceros
- **THEN** el primero muestra areas proporcionales con los colores definidos y el segundo muestra ausencia de contribuciones

### Requirement: Representar Bricks y nivel historicos

El modal SHALL mostrar Bricks y nivel en series temporales con escalas independientes, etiquetas claras y nivel entero escalonado. SHALL permitir descensos conforme a las reglas vigentes, nivel inicial cero y un unico punto cuando solo exista una medicion, sin imponer crecimiento monotono ni inventar estados intermedios. Fechas, Bricks y nivel SHALL estar disponibles mediante tooltip y alternativa tabular accesible.

#### Scenario: Progresion no monotona
- **WHEN** el historico registra descenso de Bricks y nivel tras retirar una figura
- **THEN** ambas series reflejan el descenso y mantienen las fechas originales

#### Scenario: Una sola medicion
- **WHEN** el rango contiene un unico snapshot
- **THEN** los tres graficos muestran una medicion inspeccionable sin errores ni puntos ficticios