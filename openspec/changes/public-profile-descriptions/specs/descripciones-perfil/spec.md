# Spec Delta

## Purpose

Ofrece una síntesis breve y verificable de la trayectoria de colección, visible en el DNA propio y en los perfiles ajenos, sin depender de un proveedor de IA.

## ADDED Requirements

### Requirement: Generar variantes propias y públicas desde contexto verificable

El sistema SHALL construir la descripción con una plantilla determinista y versionada, sin enviar datos a un proveedor de IA. El contexto SHALL incluir el nivel actual; los porcentajes agregados de Explorer, Collector, Fan y Rarity Hunter; los logros obtenidos con sus cantidades y los IDs destacados por su titular; las cinco minifiguras más recientes en `COLECCIÓN` y las cinco más recientes en `BUSCADA`; y de cero a tres categorías favoritas. Las figuras SHALL usar el criterio del perfil de Amigos: `fecha_registro` descendente e ID ascendente para desempatar. Los logros destacados SHALL influir en la selección y énfasis del texto, y sus cantidades SHALL distinguir una consecución de varias.

Para un usuario autenticado, el texto SHALL estar escrito en segunda persona. Para un perfil ajeno, SHALL estar escrito en tercera persona con construcciones neutras que no presupongan género. Ambas variantes SHALL derivarse del mismo contexto y SHALL evitar afirmar rasgos, motivos o hechos que las fuentes no permitan concluir. La descripción SHALL ser breve, legible y apta para mostrarse en los modales responsive.

El tono SHALL ser lúdico y coherente con los nombres de logros y las descripciones DNA de la aplicación. Los datos SHALL orientar la selección de frases sin enumerarse literalmente: el texto SHALL NOT incluir nombres de logros, nombres exactos de categorías o figuras, porcentajes ni cantidades de consecuciones.

Las categorías favoritas SHALL poder influir en la variante pública por autorización expresa de esta funcionalidad; el texto puede revelar indirectamente una afinidad, pero la lista directa de categorías SHALL permanecer privada.

#### Scenario: Componer la variante propia
- **WHEN** existe una descripción generada y el titular abre su modal DNA
- **THEN** la variante presentada se dirige al titular en segunda persona
- **AND** se apoya en DNA, nivel, logros/cantidades, destacados, figuras recientes y categorías favoritas disponibles

#### Scenario: Componer la variante pública
- **WHEN** otro usuario autenticado consulta el perfil
- **THEN** la variante presentada habla de la persona en tercera persona sin asumir su género
- **AND** puede reflejar sus categorías favoritas sin devolver la lista directa de favoritas

#### Scenario: Datos incompletos o ausencia de logros
- **WHEN** una fuente opcional está vacía o todavía no existe una descripción
- **THEN** el sistema omite esa señal y no inventa logros, porcentajes ni categorías
- **AND** devuelve la descripción como no disponible sin invalidar el resto del perfil

### Requirement: Regenerar semanalmente solo tras actividad relevante

Un job backend SHALL poder ejecutarse una vez cada domingo mediante un scheduler externo configurable; SHALL NOT depender de que el usuario abra la aplicación ni estar acoplado al éxito del snapshot diario. El job SHALL ser durable, idempotente, paginado, reclamado con lease y recuperable tras interrupción. Repetir el trigger de la misma ejecución SHALL NOT generar ni guardar dos veces la misma actualización.

La descripción SHALL regenerarse solo si no existe y el contexto inicial contiene al menos un logro obtenido o una figura en las listas recientes, o si desde la última generación exitosa se cumple al menos una condición: cambia el nivel; se obtiene un logro o aumenta su cantidad; cambia la selección de logros destacados; cambia el rasgo DNA principal o un porcentaje individual al menos cinco puntos porcentuales; cambia la pertenencia de una o más figuras a las listas recientes por una mutación de colección/estado; o cambia el conjunto de categorías favoritas. Los cambios menores de DNA SHALL acumularse respecto al último contexto generado hasta superar el umbral. Categorías favoritas por sí solas SHALL influir en el texto, pero no SHALL habilitar la primera generación sin actividad de colección o logros.

Si no se cumple una condición, el job SHALL conservar la descripción existente. Un error SHALL dejar intacta la última descripción correcta y permitir reintento. El resultado, su contexto base y su fingerprint SHALL confirmarse atómicamente por usuario; una nueva generación exitosa SHALL actualizar ambas variantes, fecha y versión de plantilla.

#### Scenario: Ejecución dominical sin actividad suficiente
- **WHEN** el scheduler inicia el job y un usuario no cumple ninguna condición desde su última generación
- **THEN** se conserva el texto, su fecha y su fingerprint
- **AND** no se realiza trabajo de generación para ese usuario

#### Scenario: Actividad relevante acumulada
- **WHEN** el job detecta un logro nuevo, un incremento de cantidad, un cambio destacado, un cambio de nivel, un cambio DNA que alcanza el umbral, una variación de las listas recientes o un cambio de favoritas
- **THEN** genera y persiste las dos variantes desde una única captura coherente del contexto

#### Scenario: Primera generación
- **WHEN** no hay texto previo y el usuario ya tiene al menos un logro o una figura en las listas recientes
- **THEN** el job genera ambas variantes aunque no exista fingerprint anterior
- **AND** favoritas vacías o favoritas como único dato no provocan una primera generación

#### Scenario: Reintento, duplicado o fallo parcial
- **WHEN** el trigger se repite, el worker pierde su lease o falla una escritura
- **THEN** no se publica una actualización parcial ni se duplica una generación confirmada
- **AND** la última descripción correcta permanece disponible y el trabajo puede recuperarse

### Requirement: Servir cada variante solo en la vista correspondiente

El estado propio SHALL exponer exclusivamente la variante en segunda persona al titular autenticado. La proyección pública de perfil SHALL exponer exclusivamente la variante en tercera persona a usuarios autenticados. Las respuestas SHALL devolver ausencia explícita cuando todavía no haya descripción y SHALL NOT exponer el fingerprint, snapshot privado, lista de favoritas, ponderaciones DNA ni datos internos del job. Leer una descripción SHALL ser de solo lectura y SHALL NOT iniciar una generación ni mutar la cuenta consultada.

#### Scenario: Lectura propia
- **WHEN** el titular autenticado consulta su DNA
- **THEN** recibe su variante en segunda persona si está generada
- **AND** no puede elegir el ID de otra cuenta ni obtener la variante privada de otra persona

#### Scenario: Lectura pública autenticada
- **WHEN** un usuario autenticado consulta el perfil de otra cuenta
- **THEN** recibe solo la variante pública en tercera persona si existe
- **AND** no recibe categorías favoritas directas, el snapshot de generación ni detalles del worker

#### Scenario: Lecturas sin efectos laterales
- **WHEN** se consulta el DNA propio o un perfil ajeno
- **THEN** la lectura no genera ni recalcula descripciones, logros, DNA o preferencias