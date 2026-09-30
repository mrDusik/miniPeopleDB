# Spec Delta

## Purpose

Almacena el catálogo de minifiguras y el estado de gamificación de cada usuario en Supabase, protegido por RLS, con errores controlados y un cliente sustituible en pruebas.

## ADDED Requirements

### Requirement: Persistir los datos por usuario en Supabase

El sistema SHALL leer y escribir el catálogo de minifiguras en la tabla `minifiguras` y el estado de gamificación en la tabla `gamificacion` de Supabase, usando la identidad del usuario autenticado para que las políticas RLS se apliquen en cada operación. El sistema SHALL NOT usar claves de servicio que omitan RLS y SHALL NOT aceptar un `user_id` proporcionado por el cliente.

#### Scenario: Alta asociada al usuario autenticado
- **WHEN** un usuario autenticado crea una minifigura
- **THEN** el registro se guarda en `minifiguras` con el `user_id` del usuario del token

#### Scenario: Cuerpo con user_id ajeno
- **WHEN** un cliente envía una minifigura que incluye `user_id`
- **THEN** el sistema responde `400` con `MINIFIGURA_INVALIDA` y no persiste nada

#### Scenario: Estado de gamificación inexistente
- **WHEN** un usuario autenticado sin fila en `gamificacion` consulta `GET /gamificacion`
- **THEN** el sistema calcula el estado a partir de su catálogo, lo guarda en `gamificacion` y lo devuelve

### Requirement: Conservar el contrato de la API

El sistema SHALL mantener el formato JSON de las respuestas existentes (`id`, `nombre`, `descripcion`, `categoria`, `subcategoria`, `anio`, `estadoColeccion`, `precioCompra`, `fechaCompra`, `precio`, `FechaRegistro`, `observada` para minifiguras; `bricks`, `nivel`, `siguienteNivel`, `progreso`, `logros` para gamificación), omitiendo los campos opcionales sin valor en lugar de devolverlos como `null`, y SHALL devolver el catálogo ordenado por `FechaRegistro` ascendente.

#### Scenario: Minifigura sin campos opcionales
- **WHEN** una minifigura almacenada no tiene `descripcion`, `subcategoria`, `precioCompra`, `fechaCompra` ni `precio`
- **THEN** `GET /minifiguras` la devuelve sin esas propiedades

#### Scenario: Orden estable del catálogo
- **WHEN** se realizan dos `GET /minifiguras` consecutivos sin cambios
- **THEN** ambas respuestas contienen la misma colección en el mismo orden por `FechaRegistro`

### Requirement: Reportar errores de persistencia de forma controlada

Los fallos de comunicación o de consulta con Supabase SHALL traducirse a respuestas HTTP consistentes sin exponer mensajes, códigos internos, URLs ni claves de Supabase. Una violación de clave primaria en el alta SHALL traducirse en `409 ID_DUPLICADO`.

#### Scenario: Supabase no disponible
- **WHEN** Supabase devuelve un error al leer el catálogo
- **THEN** el sistema responde `500` con `{ "error": "CATALOGO_NO_DISPONIBLE" }`

#### Scenario: Id duplicado en base de datos
- **WHEN** el alta falla por clave primaria duplicada para el mismo usuario
- **THEN** el sistema responde `409` con `{ "error": "ID_DUPLICADO" }`

#### Scenario: Registro almacenado inválido
- **WHEN** una fila leída de `minifiguras` no cumple el modelo de dominio
- **THEN** el sistema responde `500` con `{ "error": "CATALOGO_INVALIDO" }` sin incluir el contenido de la fila

### Requirement: Permitir sustituir el cliente de persistencia en pruebas

La implementación SHALL permitir inyectar el cliente de Supabase, incluido su resultado de verificación mediante `auth.getUser`, de modo que la suite automatizada se ejecute sin red ni credenciales reales.

#### Scenario: Ejecución de la suite sin credenciales
- **WHEN** se ejecuta `npm test` sin `sup.env` ni variables `SUPABASE_*`
- **THEN** todas las pruebas se ejecutan contra un cliente simulado en memoria y pasan
