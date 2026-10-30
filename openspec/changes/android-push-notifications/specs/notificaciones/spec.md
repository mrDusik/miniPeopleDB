# Spec Delta

## ADDED Requirements

### Requirement: Entregar notificaciones Android en segundo plano
Una notificacion persistida SHALL generar una entrega FCM a cada instalacion Android activa y autorizada del destinatario cuando la app este en segundo plano o su proceso haya terminado normalmente. La bandeja persistida SHALL seguir siendo la fuente de verdad; la entrega FCM SHALL NOT reemplazar ni alterar el contrato web, la persistencia o la recepcion foreground mediante Realtime.

#### Scenario: Notificacion nueva con la app cerrada
- **WHEN** se confirma una notificacion y el destinatario tiene una instalacion Android activa con permiso
- **THEN** el servidor solicita a FCM una alerta para esa instalacion aunque el proceso de la app no este ejecutandose
- **AND** la fila persistida conserva su estado de lectura hasta una accion explicita

#### Scenario: Notificacion mientras la app esta visible
- **WHEN** la app esta en foreground y recibe la notificacion por Realtime o FCM
- **THEN** la interfaz actualiza el indicador y la bandeja sin mostrar una segunda alerta del sistema para el mismo evento

#### Scenario: Sin instalacion elegible
- **WHEN** no existe token activo o el permiso de notificaciones esta denegado
- **THEN** no se envia una alerta a esa instalacion y la notificacion permanece disponible en la bandeja

### Requirement: Registrar y revocar tokens FCM por cuenta e instalacion
El registro de un token FCM SHALL requerir una sesion autenticada; el servidor SHALL derivar la cuenta del JWT y SHALL NOT aceptar un `user_id` objetivo. Cada token SHALL pertenecer a una sola cuenta activa, y la app SHALL actualizar tokens rotados y revocar el registro al cerrar sesion o eliminar la cuenta.

#### Scenario: Registrar o renovar un token
- **WHEN** una cuenta autenticada autoriza notificaciones y Android emite o rota el token
- **THEN** el servidor asocia el token unicamente con esa cuenta e instalacion, sin exponerlo en respuestas publicas ni logs

#### Scenario: Cambio de cuenta o cierre de sesion
- **WHEN** el usuario cierra sesion o cambia de cuenta en la instalacion
- **THEN** la app revoca el registro anterior antes de registrar el nuevo propietario y el backend no conserva dos propietarios activos para el mismo token

#### Scenario: Eliminar cuenta o invalidar token
- **WHEN** se elimina la cuenta o FCM informa que un token ya no es valido
- **THEN** se elimina o desactiva el registro correspondiente y no se vuelve a intentar enviar a ese token

### Requirement: Respetar permiso Android y canal de notificaciones
La app SHALL crear un canal Android estable y solicitar `POST_NOTIFICATIONS` en Android 13 o posterior en un contexto comprensible. El estado concedido o denegado SHALL controlar las alertas del sistema sin impedir el uso de la bandeja ni de Realtime.

#### Scenario: Permiso concedido
- **WHEN** el usuario concede el permiso requerido
- **THEN** la app actualiza el estado del registro de esa instalacion y puede mostrar alertas en el canal configurado

#### Scenario: Permiso denegado o revocado en ajustes
- **WHEN** el usuario deniega el permiso o lo revoca en ajustes del sistema
- **THEN** la app no presenta alertas del sistema, conserva la bandeja y sincroniza el estado cuando vuelve a estar activa

### Requirement: Minimizar el payload y validar el destino al abrir
El payload FCM SHALL limitarse a un identificador opaco de notificacion, una categoria permitida y los campos genericos necesarios para presentar la alerta; SHALL NOT incluir nombres, mensajes, importes, payload de negocio, JWT ni tokens FCM. Al tocarla, la app SHALL consultar el registro propio mediante JWT antes de mostrar detalles o ejecutar una accion.

#### Scenario: Abrir una alerta valida
- **WHEN** el usuario toca una alerta y su sesion es valida
- **THEN** la app abre la bandeja en la notificacion identificada y obtiene su contenido actual desde la API autenticada
- **AND** abrirla no la marca automaticamente como leida

#### Scenario: Abrir sin sesion o con identificador no disponible
- **WHEN** el usuario toca la alerta sin sesion o la notificacion ya no puede consultarse
- **THEN** la app solicita autenticacion y reanuda solo el destino permitido tras validar la sesion, o abre la bandeja con un estado recuperable
- **AND** ignora destinos arbitrarios incluidos en el mensaje

### Requirement: Deduplicar y recuperar entregas push
El despacho SHALL identificar cada envio por notificacion e instalacion, reintentar fallos transitorios de FCM con backoff y detener los reintentos para tokens invalidos o mensajes expirados. La app SHALL evitar alertas duplicadas para el mismo identificador; la recuperacion SHALL consultar la bandeja persistida al reanudar o reconectar.

#### Scenario: Reintento o entrega repetida
- **WHEN** FCM reintenta o entrega mas de una vez el mismo identificador
- **THEN** la app presenta como maximo una alerta visible para esa notificacion y no duplica filas de la bandeja

#### Scenario: Dispositivo desconectado o entrega expirada
- **WHEN** el dispositivo esta offline mas alla del TTL configurado o FCM no confirma la entrega
- **THEN** el despacho no crea ni modifica la notificacion persistida y aplica la politica de reintento/expiracion
- **AND** la app recupera la notificacion desde la bandeja al reanudar con conectividad

#### Scenario: Error transitorio o permanente de FCM
- **WHEN** FCM devuelve un error transitorio o indica que el token es invalido
- **THEN** el servidor reintenta solo el error transitorio con backoff y desactiva el token invalido sin exponer detalles al usuario
