# Spec Delta

## MODIFIED Requirements

### Requirement: Actualizar precios de Brickset de forma resiliente

El sistema SHALL ofrecer una operación individual y una operación masiva para consultar Brickset. La actualización masiva SHALL ejecutarse como una tarea en segundo plano por usuario que procese cada figura persistida de forma aislada y secuencial, respetando el límite global de peticiones a Brickset, conserve precios anteriores cuando falle una consulta y persista cada precio válido en cuanto se obtenga. `POST /sincronizacion/brickset` SHALL iniciar la tarea y responder HTTP `202` con su estado sin esperar a que termine. El estado SHALL incluir `estado` (`en_curso` o `completada`), `procesados`, `total`, `actualizados` (IDs) y `fallidos` (pares `id`/`error`).

#### Scenario: Iniciar la actualización masiva
- **WHEN** un usuario autenticado sin tarea en curso solicita `POST /sincronizacion/brickset`
- **THEN** el sistema responde HTTP `202` con `estado: "en_curso"`, `procesados: 0` y `total` igual al número de figuras persistidas del usuario
- **AND** continúa consultando Brickset después de responder

#### Scenario: Catálogo vacío
- **WHEN** el usuario inicia la actualización masiva sin figuras persistidas
- **THEN** el sistema responde HTTP `202` con `estado: "completada"` y `total: 0`

#### Scenario: Tarea ya en curso
- **WHEN** el usuario solicita `POST /sincronizacion/brickset` mientras su tarea sigue en curso
- **THEN** el sistema responde HTTP `202` con el estado de la tarea existente
- **AND** no inicia una segunda tarea

#### Scenario: Actualización masiva completada
- **WHEN** Brickset responde con precios válidos
- **THEN** el sistema persiste cada nuevo valor de `precio` al obtenerlo
- **AND** al terminar el estado es `completada` e incluye los elementos actualizados

#### Scenario: Fallo parcial
- **WHEN** Brickset responde correctamente para unas figuras y falla para otras
- **THEN** el sistema persiste solo los precios válidos
- **AND** informa por separado elementos actualizados y fallidos
- **AND** las consultas locales continúan funcionando

#### Scenario: Actualización de todas las figuras persistidas
- **WHEN** se inicia una actualización masiva con figuras `COLECCIÓN` y `BUSCADA`
- **THEN** el sistema consulta Brickset para cada figura persistida
- **AND** `BUSCADA` solo se excluye del valor total y de los rankings

#### Scenario: Figura eliminada durante la tarea
- **WHEN** una figura se elimina mientras la tarea está en curso
- **THEN** el sistema no persiste su precio ni recrea la figura
- **AND** el resto de la tarea continúa

#### Scenario: Interrupción de la tarea
- **WHEN** el proceso del servidor se reinicia con una tarea en curso
- **THEN** los precios persistidos antes de la interrupción se conservan

## ADDED Requirements

### Requirement: Consultar el estado de la actualización masiva

El sistema SHALL exponer `GET /sincronizacion/brickset`, autenticado y aislado por usuario, que devuelva HTTP `200` con el estado de la tarea en curso o de la última tarea del usuario, con la misma forma que la respuesta de inicio. Si el usuario no tiene ninguna tarea registrada SHALL devolver `estado: "inactiva"`.

#### Scenario: Consultar una tarea en curso
- **WHEN** el usuario consulta el estado mientras su tarea avanza
- **THEN** el sistema devuelve `estado: "en_curso"` con `procesados` y `total` actualizados

#### Scenario: Sin tarea registrada
- **WHEN** el usuario nunca ha iniciado una actualización masiva en el proceso actual
- **THEN** el sistema devuelve `estado: "inactiva"`

#### Scenario: Aislamiento entre usuarios
- **WHEN** el usuario A tiene una tarea en curso y el usuario B consulta el estado
- **THEN** el usuario B no recibe información de la tarea del usuario A

### Requirement: Respetar el límite de peticiones de Brickset

El servidor SHALL enviar las peticiones a Brickset de una en una y con un intervalo mínimo configurable entre el inicio de dos peticiones consecutivas, compartido por todos los usuarios y por las consultas masivas e individuales. Ante una respuesta HTTP `429`, SHALL esperar el tiempo indicado por la cabecera `Retry-After` (en segundos o como fecha HTTP) o, si falta o no es interpretable, un tiempo de espera por defecto, y SHALL reintentar la misma figura un número acotado de veces. Si se agotan los reintentos, la figura SHALL registrarse como fallida con el código `BRICKSET_LIMITE`. Ningún otro error HTTP SHALL reintentarse sin espera previa.

#### Scenario: Intervalo entre peticiones
- **WHEN** se solicitan varias consultas a Brickset seguidas, aunque procedan de usuarios distintos
- **THEN** cada petición comienza al menos el intervalo mínimo después de la anterior
- **AND** nunca hay dos peticiones a Brickset simultáneas

#### Scenario: 429 con Retry-After
- **WHEN** Brickset responde `429` con `Retry-After: 30`
- **THEN** el servidor no envía ninguna petición a Brickset durante 30 segundos
- **AND** después reintenta la misma figura

#### Scenario: 429 persistente
- **WHEN** Brickset responde `429` en todos los reintentos permitidos para una figura
- **THEN** la figura se registra como fallida con `BRICKSET_LIMITE`
- **AND** la tarea continúa con la siguiente figura

#### Scenario: Consulta individual durante una tarea masiva
- **WHEN** un usuario consulta los datos de Brickset desde el formulario mientras hay una tarea masiva en curso
- **THEN** la consulta individual respeta el mismo límite global
