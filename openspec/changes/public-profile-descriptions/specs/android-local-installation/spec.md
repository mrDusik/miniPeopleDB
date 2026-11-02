# Spec Delta

## ADDED Requirements

### Requirement: Incluir y validar las descripciones en Android

La aplicación Android instalada SHALL mostrar la variante propia en segunda persona dentro del modal DNA y la variante ajena en tercera persona neutra dentro del perfil de usuario, con el mismo comportamiento de ausencia y privacidad que la aplicación web. Los recursos cliente SHALL incluir la interfaz actualizada en el APK; desplegar únicamente el backend SHALL NOT considerarse suficiente cuando cambie la interfaz empaquetada. La tarea Android SHALL poder validarse independientemente en un entorno con Android SDK/dispositivo y SHALL permanecer incompleta hasta que se compile, instale y pruebe el APK.

#### Scenario: Mostrar las dos variantes en Android
- **WHEN** una persona autenticada abre DNA propio o el perfil de otra cuenta en un APK actualizado
- **THEN** ve la variante correspondiente, con voz y género correctos
- **AND** el APK no expone secretos de servidor ni la lista directa de categorías favoritas

#### Scenario: APK desactualizado
- **WHEN** el backend sirve una descripción nueva a una aplicación instalada con una interfaz que no contiene el espacio para mostrarla
- **THEN** el backend conserva sus contratos y la actualización visual se habilita al regenerar, instalar y ejecutar un APK nuevo

#### Scenario: Validación Android pendiente en otro entorno
- **WHEN** las tareas web/backend se completan sin un entorno Android disponible
- **THEN** las tareas Android permanecen explícitamente pendientes y no se declaran verificadas por los tests web
- **AND** se pueden continuar desde otra máquina con la misma rama y los artefactos de esta spec