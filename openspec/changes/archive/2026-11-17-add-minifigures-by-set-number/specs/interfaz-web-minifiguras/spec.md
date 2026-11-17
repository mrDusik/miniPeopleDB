# Spec Delta

## ADDED Requirements

### Requirement: Elegir el modo de alta desde el modal de inventario

En estado de creación, el modal SHALL titularse `Añadir a inventario` y SHALL ofrecer los selectores `Nueva minipersona` y `Añadir por set`. `Nueva minipersona` SHALL estar seleccionado por defecto y SHALL conservar exactamente el contenido, comportamiento y validaciones del alta individual existente. Al elegir `Añadir por set`, SHALL abrirse un diálogo secundario titulado `Buscar set` para introducir el número de set y las acciones `Buscar` y `Cerrar`. Cerrar SHALL cerrar únicamente el diálogo secundario y conservar el modal de inventario en el modo seleccionado.

Mientras no haya una tabla de minipersonas del set, la sección SHALL ocultar el encabezado, el resumen de inventario, la fecha y los textos informativos del estado vacío. En su lugar SHALL mostrar un botón `Buscar set`, deshabilitado mientras el diálogo de búsqueda esté abierto y habilitado de nuevo al cerrarlo. Este botón SHALL permitir reabrir el diálogo sin cambiar de selector.

#### Scenario: Abrir el alta
- **WHEN** el usuario inicia la creación de una minipersona
- **THEN** el modal se titula `Añadir a inventario`
- **AND** `Nueva minipersona` aparece seleccionado por defecto y conserva su funcionamiento actual

#### Scenario: Elegir añadir por set
- **WHEN** el usuario selecciona `Añadir por set`
- **THEN** se abre el diálogo `Buscar set` para introducir un número de set con las acciones `Buscar` y `Cerrar`, sin botón `Cancelar`
- **AND** al cerrar, el diálogo secundario se cierra y el modal permanece en `Añadir por set`

#### Scenario: Mostrar el estado sin tabla de set
- **WHEN** está seleccionado `Añadir por set` y todavía no se ha continuado con un set encontrado
- **THEN** la sección muestra únicamente el botón `Buscar set`, sin encabezado, resumen, fecha ni textos de estado vacío
- **AND** el botón está deshabilitado mientras el diálogo `Buscar set` esté abierto
- **AND** al cerrar el diálogo mediante Cerrar o Escape, el botón vuelve a habilitarse y permite reabrir la búsqueda
- **AND** al continuar con un set encontrado, el botón se oculta y aparecen el encabezado, resumen, fecha y tabla

### Requirement: Buscar y revisar las minipersonas de un set

El diálogo SHALL aceptar un número base de set y SHALL usar la variante cuyo nombre incluya `Complete` si existe para ese número, o la variante `-1` en caso contrario; si se introduce explícitamente un sufijo de variante SHALL buscar esa variante exacta. Mientras se consulta, el diálogo SHALL comunicar la carga. Si se encuentra el set, sus minipersonas y datos requeridos están cargados y al menos una minipersona no está en el inventario, SHALL mostrar `Encontrado` y habilitar `Continuar`. Si todas sus minipersonas están en el inventario, SHALL mostrar `Encontrado. Todas las minifiguras de este set están en tu inventario.`, mantener `Continuar` deshabilitado y permitir únicamente buscar otro set o cerrar el diálogo. Si el set no existe, SHALL mostrar `El set no se encuentra` y mantener `Continuar` deshabilitado. Un set sin minipersonas y un error temporal de consulta SHALL comunicarse por separado del caso de set inexistente; el error temporal SHALL permitir reintentar y SHALL mantener `Continuar` deshabilitado. Al continuar, el diálogo de búsqueda SHALL cerrarse y el modal de inventario SHALL mostrar el set seleccionado.

La sección SHALL mostrar el rótulo `n Minipersonas en el set X`, donde `n` es el total de minipersonas del set y `X` el texto buscado por el usuario sin espacios exteriores, usando para este último la misma tipografía que para los IDs de minifigura. El encabezado y el campo al reabrir la búsqueda SHALL conservar ese texto, sin sustituirlo por la variante resuelta por el backend. Si el total es uno, SHALL usar el singular `1 Minipersona en el set X`. Debajo SHALL mostrar `(Ya tienes en el inventario n de ellas [id1, id2...])`, con el recuento y los IDs de las filas ya existentes, únicamente cuando el usuario tenga al menos una; si no tiene ninguna, SHALL omitir ese mensaje. La sección SHALL incluir un campo opcional `Fecha de compra` con el mismo formato, límite de fecha y validaciones que el alta individual existente.

La tabla SHALL mostrar una columna de imagen, Seguimiento, Minifigura (ID y nombre), Categoría, Subcategoría, Año, Estado y Precio en monitor. En smartphone y Android SHALL mostrar imagen, Seguimiento, Minifigura (ID y nombre), Estado y Precio, ocultando las columnas de categoría, subcategoría y año. Precio SHALL mostrar el precio devuelto por Brickset para filas nuevas, con el formato y el indicador de precio desconocido del inventario. La imagen SHALL abrirse ampliada al activarse, como en la tabla principal; el ID y el nombre SHALL NOT ser enlaces ni activar esa ampliación.

La columna Minifigura SHALL mostrar también la descripción debajo del nombre, tanto en monitor como en smartphone y Android. Si la descripción está ausente o vacía, SHALL omitirse esa línea.

La tabla SHALL permitir ordenar por Minifigura, Categoría, Subcategoría, Año y Precio en ambos sentidos, con los mismos criterios e indicadores que el inventario y los valores ausentes al final. La cabecera `Minifigura` SHALL ordenar implícitamente por ID, sin controles separados para ID o nombre. Imagen, Seguimiento y Estado SHALL NOT ofrecer ordenación. La ordenación SHALL ser independiente de la del inventario y SHALL conservar fecha, seguimiento, estado y restricciones de solo lectura. Los mensajes visibles del diálogo de búsqueda SHALL omitir la palabra `Brickset`.

Cada fila nueva SHALL permitir alternar Seguimiento y el estado entre colección y búsqueda mediante los iconos existentes. Por defecto, Seguimiento SHALL estar desactivado y Estado SHALL ser Colección. Si una minipersona ya existe en el inventario, la fila SHALL mostrar sus datos e iconos desde el registro guardado, SHALL NOT usar metadatos de Brickset para esa fila y SHALL ser de solo lectura.

#### Scenario: Encontrar un set con minipersonas
- **WHEN** Brickset devuelve un set con al menos una minipersona nueva y los datos requeridos están cargados
- **THEN** se muestra `Encontrado` y `Continuar` queda habilitado
- **AND** al continuar se muestra la tabla del set y el campo opcional de fecha de compra
- **AND** el encabezado indica el total de minipersonas y el resumen muestra cuántas ya están en el inventario junto a sus IDs solo si hay alguna existente

#### Scenario: Encontrar un set ya completo en el inventario
- **WHEN** se encuentra un set no vacío y todas sus minipersonas ya están en el inventario
- **THEN** se muestra `Encontrado. Todas las minifiguras de este set están en tu inventario.`
- **AND** `Continuar` permanece deshabilitado, sin reutilizar un resultado anterior que permitiera continuar
- **AND** solo se puede buscar otro set o cerrar el diálogo, sin abrir la tabla ni enviar un lote
- **AND** al buscar otro set con minipersonas nuevas, `Continuar` vuelve a habilitarse

#### Scenario: Comunicar la búsqueda en curso
- **WHEN** se está consultando el set
- **THEN** se muestra `Buscando...` con el mismo indicador animado, fuente y tamaño que los demás mensajes de carga
- **AND** la acción `Cerrar` permanece visible
- **AND** el indicador desaparece al terminar o cancelar la consulta

#### Scenario: Resolver el número de set
- **WHEN** el usuario busca `71851` o una variante explícita como `71851-2`
- **THEN** el número base se resuelve como `71851-1` si no existe una variante Complete de ese número
- **AND** la variante explícita se busca sin sustituir su sufijo

#### Scenario: Mostrar una serie CMF completa
- **WHEN** se busca `71001` sin sufijo y existe la variante `71001-17` con Complete en el nombre
- **THEN** se revisan las minipersonas de `71001-17`, pero el encabezado muestra `71001`, tal como se buscó
- **AND** siguen aplicándose el resumen de inventario, las restricciones de duplicados y el bloqueo de sets ya completos

#### Scenario: Conservar el texto buscado en el encabezado
- **WHEN** se busca `10774` y el backend resuelve `10774-1`
- **THEN** el encabezado muestra `n Minipersonas en el set 10774`
- **AND** si el usuario busca explícitamente `10774-2`, el encabezado conserva `10774-2`

#### Scenario: Set inexistente, vacío o consulta temporalmente fallida
- **WHEN** Brickset no encuentra el set, el set no contiene minipersonas o la consulta falla temporalmente
- **THEN** la interfaz comunica cada resultado de forma distinguible
- **AND** `Continuar` permanece deshabilitado
- **AND** el error temporal ofrece reintentar sin presentarse como set inexistente
- **AND** los mensajes no mencionan `Brickset`

#### Scenario: Mostrar los resultados en monitor y móvil
- **WHEN** se muestran las minipersonas de un set
- **THEN** monitor muestra imagen, Seguimiento, Minifigura, Categoría, Subcategoría, Año, Estado y Precio
- **AND** smartphone y Android muestran imagen, Seguimiento, Minifigura, Estado y Precio
- **AND** activar la imagen la amplía, mientras que ID y nombre no son enlaces
- **AND** la descripción aparece debajo del nombre cuando existe, sin dejar una línea vacía cuando falta

#### Scenario: Ordenar las minipersonas del set
- **WHEN** se activa una de las cabeceras Minifigura, Categoría, Subcategoría, Año o Precio de la tabla del set
- **THEN** las filas se ordenan ascendentemente por ese campo y una segunda activación invierte el sentido
- **AND** Minifigura ordena por ID, no por nombre, sin mostrar controles separados para ID o nombre
- **AND** los valores ausentes permanecen al final en ambos sentidos
- **AND** no cambia la ordenación del inventario ni se pierden las selecciones de fecha, seguimiento y estado

#### Scenario: Conservar datos de una minipersona ya existente
- **WHEN** una minipersona del set ya está en el inventario del usuario
- **THEN** la tabla muestra sus datos y estado actuales guardados
- **AND** la fila es de solo lectura y no se modifica al guardar el set

### Requirement: Guardar el alta de un set

Al guardar, la fecha elegida SHALL aplicarse a cada minipersona nueva; si no se elige fecha, SHALL conservarse como opcional según el alta individual. El precio de compra SHALL quedar vacío. Los demás metadatos SHALL seguir el mismo origen y validaciones que el alta individual. Los registros ya existentes SHALL permanecer sin cambios y la interfaz SHALL informar sus IDs con el texto `La minipersona X ya se encontraba en tu inventario` para uno o `Las minipersonas X, Y ya se encontraban en tu inventario` para varios. Si el guardado falla, SHALL comunicarse el error sin mostrar un resultado de éxito.

#### Scenario: Guardar nuevas minipersonas del set
- **WHEN** el usuario guarda un set con una o más filas nuevas
- **THEN** se crean con la fecha elegida, precio de compra vacío, estado seleccionado y seguimiento seleccionado
- **AND** las filas ya existentes conservan íntegramente sus datos guardados

#### Scenario: Guardar metadatos opcionales de Brickset
- **WHEN** una minipersona nueva del set no tiene descripción o su precio Brickset es desconocido
- **THEN** el alta convierte la descripción ausente en texto vacío y omite el precio desconocido, igual que el alta individual
- **AND** esos campos opcionales no provocan el rechazo del lote

#### Scenario: Informar IDs que ya estaban en el inventario
- **WHEN** el set contiene una minipersona existente o varias
- **THEN** se muestra el mensaje singular o plural acordado con sus IDs
- **AND** ninguna minipersona existente se actualiza desde este flujo

#### Scenario: Error durante el guardado
- **WHEN** no se puede guardar el conjunto
- **THEN** la interfaz muestra un error
- **AND** no comunica que las nuevas minipersonas se guardaron correctamente
