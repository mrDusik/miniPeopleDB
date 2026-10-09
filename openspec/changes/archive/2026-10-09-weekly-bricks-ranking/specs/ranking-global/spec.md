# Spec Delta

## ADDED Requirements

### Requirement: Distribuir los criterios a ancho completo en portrait

En orientacion portrait, el grupo de seis criterios del modal Ranking Global SHALL ocupar el mismo ancho util que la linea azul de su encabezado. Todos los botones SHALL tener igual ancho, sin desplazamiento horizontal ni recorte de texto. En pantallas donde seis columnas no permitan leer las etiquetas, SHALL distribuirse en filas manteniendo columnas de igual ancho y cubriendo todo el ancho util. Se SHALL conservar las etiquetas, aria-pressed, criterios, orden del Top 10 y comportamiento landscape existentes. Este ajuste no SHALL introducir selectores en el modal semanal.

#### Scenario: Movil portrait
- **WHEN** se abre el global en un viewport portrait estrecho
- **THEN** los seis criterios se distribuyen con igual ancho, el grupo cubre la linea azul y no hay scroll horizontal ni textos solapados

#### Scenario: Tablet portrait y landscape
- **WHEN** se abre el global en tablet portrait y despues en landscape
- **THEN** portrait mantiene igual ancho y ancho completo, mientras landscape conserva su comportamiento actual