# Spec Delta

## ADDED Requirements

### Requirement: Proporcionar el tipo de cambio diario del BCE

El servidor SHALL proporcionar a usuarios autenticados el tipo de cambio diario BCE expresado como dólares estadounidenses por euro, reutilizando la cotización compartida con la conversión de precios Brickset. La respuesta SHALL identificar las monedas base y cotizada, el tipo de cambio positivo y finito, y la fecha de la cotización. El tipo de cambio SHALL poder reutilizarse durante su periodo de caché vigente. Si no existe una cotización utilizable y el BCE no está disponible, el servidor SHALL devolver un error controlado, sin inventar un valor ni degradar a una cotización inválida.

#### Scenario: Cotización BCE disponible
- **WHEN** un usuario autenticado solicita el tipo de cambio y existe una cotización diaria vigente
- **THEN** recibe EUR como moneda base, USD como moneda cotizada y la cotización BCE positiva y finita
- **AND** la misma cotización puede utilizarse para convertir precios Brickset y precios de usuario

#### Scenario: Reutilizar la cotización almacenada en caché
- **WHEN** se solicita de nuevo el tipo de cambio dentro de la vigencia de la caché
- **THEN** se devuelve la cotización vigente sin iniciar otra petición al BCE

#### Scenario: Tipo de cambio no disponible
- **WHEN** no existe una cotización vigente y la consulta al BCE falla, no contiene USD o devuelve un valor inválido
- **THEN** el servidor devuelve un error controlado de tipo de cambio no disponible
- **AND** no presenta una cotización falsa ni modifica precios persistidos

#### Scenario: Proteger la consulta del tipo de cambio
- **WHEN** una petición sin sesión solicita el tipo de cambio
- **THEN** el servidor la rechaza con el mismo requisito de autenticación que las demás operaciones ordinarias de valoración
