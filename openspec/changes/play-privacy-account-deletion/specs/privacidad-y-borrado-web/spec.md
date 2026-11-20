# Spec Delta

## Purpose

Informar a las personas sobre el tratamiento de datos de MiniPeopleDB y permitirles solicitar la eliminación de su cuenta y datos asociados desde la web, incluso si ya no tienen instalada la aplicación.

## ADDED Requirements

### Requirement: Publicar una política de privacidad accesible desde la app y Google Play

MiniPeopleDB SHALL publicar su política en una URL HTTPS estable, accesible sin cuenta ni restricciones geográficas, como página HTML legible y no editable por el público. La política SHALL identificar la app y al responsable, ofrecer un contacto y describir las categorías de datos, su recogida, usos, visibilidad, destinatarios, medidas de protección, retención y eliminación según el funcionamiento real, incluidos los proveedores aplicables. SHALL indicar las excepciones de retención justificadas, si existen, y enlazar el recurso de borrado. La interfaz web y Android SHALL ofrecer un enlace visible a la política tanto antes de iniciar sesión como desde Preferencias. La ficha de Play SHALL enlazar la URL pública.

#### Scenario: Consultar la política antes o después del acceso
- **WHEN** una persona abre el enlace desde acceso, Preferencias o la ficha de Google Play
- **THEN** puede leer la política sin registro, inicio de sesión ni descarga de un archivo
- **AND** puede localizar el contacto de privacidad y el enlace de eliminación de cuenta

#### Scenario: Revisar la información publicada
- **WHEN** se coteja la política con los flujos y servicios desplegados
- **THEN** los datos, destinatarios, medidas, retención y eliminación declarados corresponden a las prácticas comprobadas
- **AND** no se presentan plazos, destinos ni garantías de borrado sin confirmar

### Requirement: Permitir solicitar la eliminación de cuenta desde un navegador

MiniPeopleDB SHALL ofrecer una página pública distinta, con URL HTTPS estable y título que identifique la app y la eliminación. La página SHALL explicar qué datos se eliminan, qué datos podrían conservarse y por qué, cómo se verifica la titularidad y qué plazo de tramitación puede esperar la persona. SHALL presentar un formulario de solicitud a soporte accesible desde móvil y escritorio, sin instalar la app ni iniciar sesión. El formulario SHALL requerir un correo de respuesta válido, permitir un username opcional y no solicitar contraseñas, códigos, tokens ni documentos de identidad. Las preguntas de eliminación de Seguridad de datos en Play Console SHALL indicar la URL directa.

#### Scenario: Solicitar la baja tras desinstalar Android
- **WHEN** una persona abre la URL pública, completa el formulario y el servicio de correo acepta el mensaje
- **THEN** soporte recibe una solicitud identificada como eliminación de cuenta y el correo de respuesta
- **AND** la página confirma el envío, no la eliminación, e indica el siguiente paso de verificación

#### Scenario: Entrada inválida o envío no confirmado
- **WHEN** faltan datos requeridos, se excede el límite de frecuencia o el servicio no acepta el mensaje
- **THEN** la página no confirma el envío, explica el fallo sin revelar datos internos y permite reintentar conforme al límite aplicable
- **AND** la respuesta no informa si el correo o el username pertenecen a una cuenta

### Requirement: Verificar la titularidad y preservar el borrado autenticado

La solicitud pública SHALL iniciar una gestión de soporte y SHALL NOT autenticar, buscar ni eliminar cuentas por los datos declarados. Soporte SHALL verificar la titularidad antes de tramitar el borrado y deberá atender también las solicitudes de personas que no pueden acceder a la cuenta, sin revelar si existe ni saltarse la verificación. El borrado en los sistemas propios SHALL conservar el flujo autenticado de cuenta propia. La tramitación SHALL abarcar los datos asociados, incluidos los que requieran gestión con proveedores, salvo retenciones legítimas descritas en la política.

#### Scenario: Recibir una solicitud sin titularidad verificada
- **WHEN** alguien envía un correo o username de otra persona, o no se dispone de verificación suficiente
- **THEN** no se borran datos ni se divulga la existencia de ninguna cuenta

#### Scenario: Tramitar una solicitud verificada
- **WHEN** soporte verifica la titularidad y la cuenta se elimina por el procedimiento autorizado
- **THEN** se comprueba la eliminación de los datos asociados en los sistemas propios y se tramita la eliminación con los proveedores aplicables
- **AND** solo se mantienen las excepciones justificadas y documentadas

### Requirement: Conservar el aviso de rechazo sin identificar al emisor

Al rechazar una solicitud de amistad, MiniPeopleDB SHALL conservar su aviso histórico en la bandeja del destinatario, con su fecha y estado de lectura, sin posibilidad de aceptar la solicitud. El aviso rechazado SHALL dejar de almacenar y mostrar el username o cualquier otro identificador del emisor. El mismo tratamiento SHALL aplicarse a los avisos históricos de rechazo ya desvinculados. Los avisos de solicitudes pendientes o aceptadas SHALL conservar su comportamiento.

#### Scenario: Anonimizar al rechazar
- **WHEN** la persona destinataria rechaza una solicitud pendiente
- **THEN** el aviso original permanece con la misma fecha y estado de lectura
- **AND** se muestra con texto genérico, sin nombre ni referencia al emisor y sin acción de aceptar

#### Scenario: Limpiar avisos antiguos sin alterar solicitudes vigentes
- **WHEN** se aplica la limpieza a avisos históricos de rechazo
- **THEN** se elimina la identidad del emisor de los avisos ya desvinculados sin borrarlos
- **AND** no se modifican los avisos pendientes, aceptados ni los creados al reenviar una solicitud
