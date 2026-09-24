# Spec Delta

## Purpose

Esta capacidad mantiene una fuente local y reproducible de las categorías oficiales de minifiguras de Brickset y de los totales publicados para cada categoría, disponible para la API y para la interfaz.

## ADDED Requirements

### Requirement: Mantener el catálogo local de temas oficiales

El sistema SHALL mantener un archivo JSON local con una entrada por cada categoría de `https://brickset.com/browse/minifigs`. Cada entrada SHALL incluir el nombre oficial del tema y su número entero no negativo de minifiguras. El sistema SHALL exponer `GET /temas` devolviendo el catálogo completo en el mismo orden que el archivo local.

#### Scenario: Consultar temas disponibles
- **WHEN** un cliente realiza `GET /temas` y el archivo local es válido
- **THEN** el sistema responde con HTTP `200`
- **AND** devuelve todas las entradas con nombre oficial y total entero

#### Scenario: Rechazar un catálogo de temas inválido
- **WHEN** un cliente realiza `GET /temas` y el archivo falta o contiene nombres repetidos, totales inválidos o una estructura distinta a la esperada
- **THEN** el sistema responde con HTTP `500`
- **AND** devuelve un error controlado sin exponer el contenido del archivo

### Requirement: Sincronizar manualmente los temas desde Brickset

El sistema SHALL proporcionar un agente o comando manual que consulte la página pública de categorías de Brickset, extraiga todos los nombres oficiales y sus totales, y actualice el archivo JSON local únicamente cuando la respuesta completa sea válida.

#### Scenario: Sincronización exitosa
- **WHEN** una ejecución manual recibe una página de Brickset con categorías y totales válidos
- **THEN** reemplaza el catálogo local por el conjunto completo extraído
- **AND** conserva cada nombre y total sin añadir categorías inventadas

#### Scenario: Brickset no disponible durante la sincronización
- **WHEN** una ejecución manual no puede obtener la página, recibe un error HTTP o no puede extraer una categoría válida
- **THEN** informa el fallo con un resultado no exitoso
- **AND** conserva sin cambios el catálogo local anterior

### Requirement: Persistir el catálogo de temas de forma segura

La actualización del catálogo de temas SHALL ser atómica y SHALL permitir que las pruebas aíslen la ruta del archivo y la respuesta HTTP de Brickset.

#### Scenario: Fallo al reemplazar el archivo de temas
- **WHEN** la escritura o sustitución del nuevo archivo falla durante una sincronización
- **THEN** la ejecución informa un fallo controlado
- **AND** el archivo anterior permanece legible y completo