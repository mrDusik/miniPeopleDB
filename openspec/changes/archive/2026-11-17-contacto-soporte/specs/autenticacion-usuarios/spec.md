## ADDED Requirements

### Requirement: Presentación compacta de acceso y registro
La pantalla de acceso y creación de cuenta SHALL reducir el espacio superior e inferior de su tarjeta y adaptar el bloque del logo y las separaciones a la altura disponible, tanto en web como en móvil y Android. Los avisos vacíos SHALL NOT reservar espacio y los errores con contenido SHALL seguir siendo visibles. Los campos, requisitos de contraseña y acciones SHALL permanecer accesibles sin ocultarlos para eliminar el scroll.

#### Scenario: Acceso y registro sin scroll innecesario
- **WHEN** se muestra acceso o registro en un viewport de 1366x768, 1280x720, 390x844, 375x667 o 360x640 con tamaño de texto predeterminado
- **THEN** la tarjeta y sus controles caben en la altura disponible sin scroll vertical de la página

#### Scenario: Avisos y espacio insuficiente
- **WHEN** aparece un error, se aumenta el tamaño de texto o la altura disponible no permite mostrar todos los controles
- **THEN** el contenido permanece accesible mediante desplazamiento si es necesario
- **AND** no se recortan los mensajes ni se bloquea el scroll para ocultar el desbordamiento
