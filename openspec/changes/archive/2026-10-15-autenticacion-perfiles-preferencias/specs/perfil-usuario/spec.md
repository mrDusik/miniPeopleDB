# Spec Delta

## Purpose

Permite a cada usuario establecer una identidad única y preferencias personales desde un onboarding obligatorio, y mantenerlas desde una configuración accesible durante el uso normal de la plataforma.

## ADDED Requirements

### Requirement: Completar onboarding antes de usar la colección

La aplicación SHALL exigir un username válido y guardar las preferencias requeridas antes de habilitar el inventario. El requisito SHALL aplicarse a usuarios Google existentes sin perfil completo, nuevos usuarios Google y nuevos usuarios clásicos, incluso si el formulario clásico ya recogió un username. El usuario SHALL conservar su sesión durante el proceso y no podrá omitir el modal ni operar la aplicación hasta que el guardado se confirme.

#### Scenario: Usuario Google existente sin perfil completo
- **WHEN** una sesión Google válida no tiene perfil, username o onboarding completado
- **THEN** la aplicación abre el modal de onboarding antes de cargar datos del inventario
- **AND** la sesión sigue activa

#### Scenario: Nuevo usuario Google
- **WHEN** un usuario completa su primer inicio de sesión con Google sin perfil completo
- **THEN** la aplicación exige completar el onboarding antes de acceder al inventario

#### Scenario: Nuevo usuario clásico
- **WHEN** un usuario clásico inicia sesión por primera vez y aún no ha guardado todas sus preferencias
- **THEN** la aplicación exige completar el onboarding, aunque el registro ya haya recogido su username

#### Scenario: Perfil guardado y reanudación
- **WHEN** el perfil y las preferencias se guardan correctamente
- **THEN** se marca el onboarding como completo y se permite continuar al inventario
- **AND** en futuras recargas no se vuelve a mostrar el modal mientras el perfil siga completo

#### Scenario: Persistencia temporalmente indisponible
- **WHEN** falla la consulta o el guardado del perfil
- **THEN** el inventario permanece bloqueado y el usuario puede reintentar sin perder su sesión ni los valores del formulario

### Requirement: Validar y proteger el username

El username SHALL ser obligatorio, cumplir exactamente `/^[a-zA-Z0-9_]{3,20}$/` y ser único ignorando mayúsculas/minúsculas. El formulario SHALL informar cuando el username elegido ya está ocupado. Tras completar el onboarding, el username SHALL permanecer inmutable desde la configuración de usuario.

#### Scenario: Username válido y disponible
- **WHEN** se envía un username con entre 3 y 20 letras ASCII, números o guiones bajos y no está ocupado
- **THEN** el sistema lo guarda y completa el onboarding si las demás preferencias son válidas

#### Scenario: Username con caracteres o longitud inválidos
- **WHEN** se envía un username con espacios, caracteres distintos de letras ASCII, números o guion bajo, o longitud fuera de 3 a 20
- **THEN** la interfaz impide guardar y explica el formato requerido

#### Scenario: Username ocupado por diferencia de mayúsculas
- **WHEN** se intenta guardar un username que coincide con otro existente sin distinguir mayúsculas/minúsculas
- **THEN** el sistema rechaza la operación sin completar el onboarding y permite elegir otro username

#### Scenario: Username ya completado
- **WHEN** el usuario abre la configuración después de completar el onboarding
- **THEN** su username aparece bloqueado y no puede cambiarse desde ese flujo

### Requirement: Configurar preferencias de perfil

El onboarding SHALL permitir establecer avatar, moneda, idioma y categorías favoritas. La configuración de usuario SHALL permitir actualizar esos mismos campos posteriormente. El avatar SHALL cargarse desde el dispositivo con botón Cargar y vista previa local, aceptando PNG/JPEG/WebP de hasta 2 MiB; solo Guardar SHALL subir el archivo y persistir su URL HTTP/HTTPS. Las URLs anteriores SHALL seguir siendo compatibles y podrá mantenerse la imagen del proveedor si no hay avatar personalizado. Euro y Español SHALL ser las únicas opciones activas. Dólar, Inglés, Italiano y Francés SHALL mostrarse deshabilitados como opciones futuras. Las favoritas SHALL corresponder al catálogo vigente y admitir de cero a tres categorías.

#### Scenario: Formulario compacto y selección visible
- **WHEN** se abre Preferencias o el onboarding
- **THEN** la primera fila contiene Username y avatar con Cargar/vista previa, la segunda Idioma y Moneda y la tercera el selector de categorías
- **AND** las seleccionadas permanecen visibles aunque no coincidan con la búsqueda
- **AND** el contador muestra 0/3, 1/3, 2/3 o 3/3 y al llegar a tres se deshabilitan las restantes hasta quitar una

#### Scenario: Vista previa local y guardado de archivo
- **WHEN** se elige un archivo válido
- **THEN** se muestra su vista previa sin subirlo hasta pulsar Guardar
- **AND** Cerrar descarta la selección sin escribir en Storage
- **AND** si falla la subida o el guardado, se conserva el modal y sus valores y se intenta retirar una subida que no se llegó a guardar en el perfil

#### Scenario: Guardar preferencias compatibles
- **WHEN** el usuario guarda un avatar válido, Euro o Español y entre cero y tres categorías existentes
- **THEN** el sistema persiste las preferencias y las muestra al volver a abrir la configuración
- **AND** el avatar actualizado se refleja en la sesión y en la proyección pública existente donde corresponda

#### Scenario: Opciones futuras no seleccionables
- **WHEN** el usuario abre los selectores de moneda e idioma
- **THEN** Euro y Español son seleccionables
- **AND** Dólar, Inglés, Italiano y Francés aparecen deshabilitados

#### Scenario: Avatar inválido
- **WHEN** el archivo no es PNG/JPEG/WebP, está vacío o supera 2 MiB, o la URL persistida no es HTTP/HTTPS válida
- **THEN** el sistema rechaza el guardado sin sustituir el avatar persistido

#### Scenario: Categoría no disponible
- **WHEN** una categoría favorita enviada no existe en el catálogo local vigente
- **THEN** el sistema rechaza esa preferencia y conserva el perfil anterior

### Requirement: Acceder y guardar la configuración de usuario

La interfaz SHALL ofrecer un acceso identificable a la configuración desde el menú de la persona autenticada. Al guardar cambios, SHALL persistir el perfil y el conjunto de categorías favoritas de forma coherente; un fallo SHALL NOT dejar el onboarding completado con preferencias parciales ni descartar los valores editados.

#### Scenario: Abrir configuración con perfil completo
- **WHEN** un usuario autenticado elige configuración desde su menú
- **THEN** se abre un modal con sus preferencias actuales y username bloqueado

#### Scenario: Actualización correcta
- **WHEN** el usuario guarda cambios válidos de avatar, idioma, moneda o categorías favoritas
- **THEN** la configuración persistida y la presentación de la sesión reflejan los valores nuevos

#### Scenario: Fallo parcial al guardar preferencias
- **WHEN** falla la persistencia de cualquiera de los campos o favoritos del conjunto enviado
- **THEN** no se informa éxito ni se marca como completo un onboarding parcial
- **AND** se conservan los valores introducidos para poder reintentar

### Requirement: Mostrar username como identidad visible

La aplicación SHALL usar el username guardado en lugar del nombre OAuth o email para la identidad propia y el nombre público de rankings y avisos nuevos o guardados. Esta publicación del username está expresamente autorizada; emails y preferencias SHALL seguir siendo privados. La corrección de avisos históricos SHALL usar referencias fiables al autor, nunca coincidencias de nombres Google; si no hay identidad o perfil identificable, SHALL mostrar "Coleccionista". SHALL conservar IDs, fechas, estado de lectura, importes y recompensas. La referencia interna al autor SHALL NOT exponerse en los datos de la API. El menú junto a Notificaciones SHALL tener un ancho de 190.5px, la mitad de los 381px anteriores, limitado al viewport.

#### Scenario: Avisos con nombre público obsoleto
- **WHEN** se crea un regalo o agradecimiento, o se aplica la migración a avisos guardados con nombres Google
- **THEN** su autor y mensaje muestran el username guardado aunque el nombre público anterior esté desactualizado
- **AND** solo se modifica la identidad textual de los avisos sociales, manteniendo su lectura y fechas
- **AND** un autor histórico no identificable se muestra como Coleccionista sin revelar nombres OAuth ni IDs internos

#### Scenario: Cuenta con perfil completo
- **WHEN** una cuenta con username guardado inicia sesión o guarda preferencias
- **THEN** su nombre visible y tooltip muestran ese username
- **AND** la proyección pública usa ese valor como `display_name`
- **AND** cambios del nombre del proveedor no lo sustituyen

### Requirement: Eliminar la cuenta propia con confirmación

Preferencias SHALL incluir al final un botón "Eliminar cuenta" con el mismo estilo de "Cerrar sesión". SHALL abrir un diálogo separado de confirmación, similar al de eliminar minifiguras, que advierta del borrado irreversible y enfoque inicialmente Cancelar. SHALL NOT borrar datos al abrir o cancelar el diálogo. Solo confirmar SHALL enviar un DELETE autenticado del perfil propio, sin IDs en parámetros ni cuerpo. Tras éxito SHALL cerrar la sesión y limpiar los datos visibles; ante fallos SHALL conservar sesión y preferencias para reintentar. SHALL impedir peticiones duplicadas mientras la eliminación esté pendiente.

#### Scenario: Cancelar eliminación
- **WHEN** se abre la confirmación y se cancela con botón o Escape
- **THEN** no se envía ninguna petición de borrado
- **AND** se mantienen Preferencias y sus valores, restaurando el foco al botón de eliminación

#### Scenario: Confirmar eliminación
- **WHEN** la persona confirma y el servidor completa el borrado
- **THEN** se elimina la identidad propia y sus datos asociados en cascada
- **AND** se cierran los diálogos, se limpia la aplicación y se vuelve al acceso sin sesión

#### Scenario: Error o cambio de sesión durante el borrado
- **WHEN** el borrado falla
- **THEN** se muestra un error genérico y se permite reintentar sin perder valores ni sesión
- **AND** una respuesta pendiente de una sesión anterior, incluido un 401, no cierra otra cuenta activa