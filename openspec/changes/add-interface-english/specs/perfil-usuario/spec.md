# Spec Delta

## MODIFIED Requirements

### Requirement: Configurar preferencias de perfil

El onboarding SHALL permitir establecer avatar, moneda, idioma y categorías favoritas. La configuración de usuario SHALL permitir actualizar esos mismos campos posteriormente. El avatar SHALL cargarse desde el dispositivo con botón Cargar y vista previa local, aceptando PNG/JPEG/WebP de hasta 2 MiB; solo Guardar SHALL subir el archivo y persistir su URL HTTP/HTTPS. Las URLs anteriores SHALL seguir siendo compatibles y podrá mantenerse la imagen del proveedor si no hay avatar personalizado. Euro SHALL ser la unica moneda activa, y Espanol e Ingles SHALL ser los idiomas activos mediante el selector existente. Dolar, Italiano y Frances SHALL mostrarse deshabilitados como opciones futuras. El nombre accesible y las etiquetas del formulario SHALL seguir el idioma activo. Las favoritas SHALL corresponder al catálogo vigente y admitir de cero a tres categorías.

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
- **WHEN** el usuario guarda un avatar válido, moneda Euro, idioma Espanol o Ingles y entre cero y tres categorías existentes
- **THEN** el sistema persiste las preferencias y las muestra al volver a abrir la configuración
- **AND** el avatar actualizado se refleja en la sesión y en la proyección pública existente donde corresponda
- **AND** el idioma confirmado se aplica a la interfaz y se recupera en futuras sesiones

#### Scenario: Opciones futuras no seleccionables
- **WHEN** el usuario abre los selectores de moneda e idioma
- **THEN** Euro, Espanol e Ingles son seleccionables y los idiomas conservan los valores `es` y `en`
- **AND** Dolar, Italiano y Frances aparecen deshabilitados con etiquetas localizadas de disponibilidad futura

#### Scenario: Avatar inválido
- **WHEN** el archivo no es PNG/JPEG/WebP, está vacío o supera 2 MiB, o la URL persistida no es HTTP/HTTPS válida
- **THEN** el sistema rechaza el guardado sin sustituir el avatar persistido

#### Scenario: Categoría no disponible
- **WHEN** una categoría favorita enviada no existe en el catálogo local vigente
- **THEN** el sistema rechaza esa preferencia y conserva el perfil anterior

#### Scenario: Idioma no soportado
- **WHEN** una peticion de perfil intenta guardar un idioma distinto de `es` o `en`, incluido un valor vacio o nulo
- **THEN** la API y la persistencia rechazan el valor sin guardar parcialmente el resto de preferencias
- **AND** no se habilitan Italiano, Frances ni otras monedas
