# Minifiguras

## MODIFIED Requirements

### Requirement: Gestionar el catalogo mediante CRUD

Las operaciones existentes de alta, reemplazo y eliminacion SHALL conservar sus codigos HTTP y validaciones, y SHALL ejecutar el recalcule de gamificacion despues de cada persistencia exitosa del catalogo. Las respuestas de alta y reemplazo SHALL incluir el resultado de gamificacion necesario para actualizar la interfaz; la eliminacion SHALL dejar el estado persistido recalculado aunque no tenga cuerpo de respuesta.

#### Scenario: CRUD mantiene el contrato y recalcula
- **WHEN** un cliente crea, reemplaza o elimina una minifigura valida
- **THEN** se conserva el comportamiento HTTP existente de la operacion
- **AND** `GET /gamificacion` refleja inmediatamente el catalogo resultante
