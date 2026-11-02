# Spec Delta

## MODIFIED Requirements

### Requirement: Mostrar username como identidad visible

La aplicación SHALL usar el username guardado en lugar del nombre OAuth o email para la identidad propia y el nombre público de rankings y avisos nuevos o guardados. Esta publicación del username está expresamente autorizada; emails y la lista directa de preferencias SHALL seguir siendo privados. Como excepción expresamente autorizada por `descripciones-perfil`, las categorías favoritas SHALL poder usarse como contexto de una descripción pública derivada; esa descripción puede reflejar indirectamente las preferencias, pero SHALL NOT devolver la lista de categorías ni otros campos privados. La corrección de avisos históricos SHALL usar referencias fiables al autor, nunca coincidencias de nombres Google; si no hay identidad o perfil identificable, SHALL mostrar "Coleccionista". SHALL conservar IDs, fechas, estado de lectura, importes y recompensas. La referencia interna al autor SHALL NOT exponerse en los datos de la API. El menú junto a Notificaciones SHALL tener un ancho de 190.5px, la mitad de los 381px anteriores, limitado al viewport.

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

#### Scenario: Usar favoritas como contexto sin publicar la lista
- **WHEN** el job genera una descripción pública a partir de las preferencias del usuario
- **THEN** el texto puede reflejar sus categorías favoritas conforme a `descripciones-perfil`
- **AND** las respuestas de preferencias y perfil SHALL NOT exponer la lista directa de favoritas a otros usuarios