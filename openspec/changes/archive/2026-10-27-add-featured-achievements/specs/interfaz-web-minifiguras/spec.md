# Spec Delta

## MODIFIED Requirements

### Requirement: Derivar todos los logros de colección del estado vigente

Todos los logros de coleccion SHALL representar requisitos cumplidos por las minifiguras actuales en `COLECCIÓN` y los totales conocidos actuales, no concesiones historicas permanentes. El catalogo y condiciones SHALL ser exclusivamente las de `logros-v2`. El recalcule SHALL reconstruir cantidades y Bricks, ajustar nivel y progreso tanto al alza como a la baja y conservar los umbrales de nivel vigentes. SHALL ganar, perder o recuperar logros tras altas, ediciones, eliminaciones, cambios entre COLECCIÓN y BUSCADA, cambios validos de metadatos de figuras, totales y anio de serie, y despliegues de objetivos. `repetible: false` SHALL limitar a una concesion vigente sin impedir perdida o recuperacion. Los logros sociales SHALL seguir igualmente sus fuentes vigentes V2. Las siguientes consultas de DNA, logros publicos, perfil y ranking SHALL reflejar el estado confirmado.

Los regalos y agradecimientos V2 persistidos SHALL conservar su contribucion vigente independientemente del inventario; la migracion unica autorizada SHALL retirar las fuentes V1. La UI SHALL mantener su presentacion de recompensas, sin grupos editoriales nuevos ni importar la columna Total, pero las listas de logros obtenidos SHALL usar la prioridad de `logros-destacados`. La seleccion de estrellas SHALL NOT alterar el calculo V2; el recalcule SHALL conservar solo las estrellas de logros que siguen obtenidos, retirar las de logros perdidos y no restaurarlas al recuperarlos. Los toasts de nuevos logros SHALL conservar su orden anterior por Bricks nuevos ascendentes. El saldo de Bricks SHALL admitir contribuciones directas que no se representan como logros repetibles.

#### Scenario: Aumento del total conocido
- **WHEN** el total de una categoria o subcategoria aumenta y deja de cumplirse un hito
- **THEN** se retiran o reducen los logros y sus Bricks, ajustando nivel y progreso sin borrar regalos V2
- **AND** se retiran las estrellas solo de IDs que dejan de estar obtenidos

#### Scenario: Pérdida y recuperación por estado de figura
- **WHEN** una figura necesaria pasa a BUSCADA y posteriormente vuelve a COLECCIÓN
- **THEN** se pierden y recuperan los logros cuyos requisitos cambian, incluidos los no repetibles
- **AND** recuperar un logro no restaura su estrella retirada

#### Scenario: Concesión retroactiva sin nueva adquisición
- **WHEN** se aplica V2 y el inventario conservado ya cumple requisitos nuevos
- **THEN** el recalcule los concede sin exigir altas nuevas y sin mantener el catalogo V1

#### Scenario: Revalidacion tras accion social
- **WHEN** se confirma un regalo, agradecimiento, envio, rechazo, aceptacion o eliminacion de amistad
- **THEN** el panel y los modales afectados revalidan Bricks, nivel, logros y DNA sin conservar resultados obsoletos de otra sesion
- **AND** las estrellas se conservan o retiran conforme a los IDs que siguen obtenidos
