# Spec Delta

## ADDED Requirements

### Requirement: Mostrar la descripción en DNA propio y perfil ajeno

El modal DNA propio SHALL mostrar la descripción generada en segunda persona junto al gráfico y la leyenda, sin sustituir el DNA ni sus porcentajes. El modal de perfil ajeno SHALL mostrar la descripción pública en tercera persona neutra, dentro del resumen y antes de las listas de figuras. La interfaz SHALL omitir la sección o el texto cuando no haya descripción, conservar el resto del perfil y SHALL NOT inventar un texto local de fallback que parezca generado. El contenido SHALL ajustarse al ancho del modal, envolver líneas y permanecer legible y accesible en Monitor, Smartphone, Tablet portrait y Tablet landscape, sin scroll horizontal, recortes ni solapamientos.

#### Scenario: Abrir el DNA propio con descripción
- **WHEN** el usuario autenticado abre el modal DNA y el servidor devuelve una descripción propia
- **THEN** se muestra un texto breve dirigido al usuario en segunda persona
- **AND** se conservan el gráfico, la leyenda, los estados de carga/error y el retorno de foco

#### Scenario: Abrir el perfil de otra persona con descripción
- **WHEN** termina de cargar un perfil ajeno que contiene una descripción pública
- **THEN** el texto aparece en tercera persona y no presupone género
- **AND** el modal sigue siendo de solo lectura y conserva el resto de sus secciones

#### Scenario: Descripción no disponible
- **WHEN** la API indica que no se ha generado una descripción
- **THEN** la interfaz omite su texto sin mostrar un error ni ocultar DNA, logros o figuras

#### Scenario: Texto largo o viewport estrecho
- **WHEN** se muestra la descripción en cualquiera de las cuatro vistas soportadas
- **THEN** el texto se envuelve dentro del espacio disponible y no provoca desbordamiento horizontal, solapamiento ni recorte

#### Scenario: Cambiar de perfil o de sesión durante la carga
- **WHEN** una respuesta de descripción llega después de cerrar el modal, cambiar el usuario consultado o cambiar de sesión
- **THEN** la respuesta obsoleta no se muestra en el perfil nuevo ni en el DNA de otra cuenta