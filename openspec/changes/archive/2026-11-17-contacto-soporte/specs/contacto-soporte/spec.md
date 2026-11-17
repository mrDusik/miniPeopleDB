# Spec Delta

## Purpose

Permite a las personas contactar con soporte tanto desde la pantalla de acceso como desde la aplicación autenticada, en web, móvil y Android, sin hacer depender la ayuda de poder iniciar sesión.

## ADDED Requirements

### Requirement: Abrir el modal de Contacto desde acceso y la aplicación
La interfaz SHALL ofrecer una acción `Contacto` sin emoji en la pantalla de acceso y una acción `✉️ Contacto` en el desplegable del usuario, junto a Preferencias. Ambas acciones SHALL abrir el mismo modal titulado `Contacto`. El emoji del desplegable SHALL ser decorativo para accesibilidad y ambos controles SHALL conservar un nombre accesible claro. El modal SHALL poder cerrarse de forma accesible y devolver el foco al control que lo abrió.

#### Scenario: Abrir contacto desde la pantalla de acceso
- **WHEN** una persona sin sesión activa el control `Contacto`
- **THEN** se abre el modal `Contacto` sobre la pantalla de acceso
- **AND** aparecen los campos Email, Usuario y Mensaje

#### Scenario: Abrir contacto desde el desplegable del usuario
- **WHEN** una persona autenticada activa `✉️ Contacto` desde el desplegable que contiene Preferencias
- **THEN** se abre el mismo modal `Contacto`
- **AND** el desplegable se cierra sin abrir Preferencias

#### Scenario: Cerrar contacto y restaurar el foco
- **WHEN** la persona cierra el modal con su control de cierre o con Escape
- **THEN** el modal se cierra y el foco vuelve al control válido que lo abrió
- **AND** el modal ofrece `Cerrar` en la cabecera y `Enviar` como única acción inferior, sin botón `Cancelar`

### Requirement: Validar el contacto sin sesión
Cuando no haya sesión activa, el modal SHALL mostrar Email, Usuario y Mensaje editables. Mensaje SHALL ser obligatorio y contener texto no vacío; al menos uno de Email o Usuario SHALL contener un valor. Si se proporciona Email, SHALL tener formato válido; si se proporciona Usuario, SHALL cumplir el formato de Username existente. La interfaz SHALL impedir el envío y explicar la validación mientras esos requisitos no se cumplan.

#### Scenario: Enviar un contacto con Email
- **WHEN** una persona sin sesión completa un Email válido y un Mensaje no vacío, dejando Usuario vacío
- **THEN** puede enviar el formulario de contacto

#### Scenario: Enviar un contacto con Usuario
- **WHEN** una persona sin sesión completa un Usuario válido y un Mensaje no vacío, dejando Email vacío
- **THEN** puede enviar el formulario de contacto

#### Scenario: Rechazar un contacto incompleto o inválido
- **WHEN** Email y Usuario están vacíos, Mensaje está vacío, o un valor proporcionado no es válido
- **THEN** no se envía la solicitud y se informa qué dato debe corregirse

### Requirement: Mostrar el límite de caracteres del mensaje
El campo Mensaje SHALL limitar la entrada a 1.000 caracteres y mostrar un contador actualizado al escribir o pegar texto. El backend SHALL rechazar mensajes de más de 1.000 caracteres sin enviarlos al proveedor. Al alcanzar el límite SHALL mostrar un aviso accesible; al borrar caracteres SHALL retirar el aviso. El contador SHALL volver a cero al reiniciar el formulario o tras un envío correcto, sin borrar el mensaje cuando falle el envío.

#### Scenario: Alcanzar el límite y seguir editando
- **WHEN** la persona completa los 1.000 caracteres del Mensaje
- **THEN** el contador muestra `1000 / 1000` y aparece un aviso de límite alcanzado
- **AND** al borrar un carácter el contador muestra `999 / 1000` y desaparece el aviso

#### Scenario: Reiniciar el contador
- **WHEN** se abre de nuevo el formulario o el backend confirma un envío correcto
- **THEN** el Mensaje queda vacío, el contador muestra `0 / 1000` y no aparece el aviso

### Requirement: Rellenar el contacto de una persona autenticada
Con una sesión válida, el modal SHALL rellenar Email con el email de la identidad autenticada y Usuario con el Username guardado del perfil. Ambos campos SHALL estar deshabilitados y solo Mensaje SHALL ser editable y obligatorio. El envío autenticado SHALL asociar el contacto con la identidad verificada por el servidor; el servidor SHALL obtener Email y Usuario de esa identidad y su perfil, y NOT SHALL confiar en valores de contacto modificables enviados por el cliente.

#### Scenario: Mostrar los datos de contacto autenticados
- **WHEN** una persona con sesión válida abre `Contacto`
- **THEN** Email y Usuario aparecen rellenados y deshabilitados
- **AND** Mensaje permanece habilitado y es obligatorio

#### Scenario: Enviar un contacto autenticado
- **WHEN** una persona autenticada escribe un Mensaje no vacío y lo envía
- **THEN** el backend valida la sesión y envía el mensaje con el Email y Usuario de la identidad autenticada
- **AND** no usa valores de Email o Usuario proporcionados por el cliente para sustituir esa identidad

#### Scenario: Rechazar una sesión inválida en el envío autenticado
- **WHEN** una solicitud que se presenta como autenticada contiene una sesión inválida o vencida
- **THEN** el backend rechaza el envío sin tratarlo como un contacto anónimo
- **AND** no envía ningún correo

### Requirement: Enviar el contacto al soporte
El formulario SHALL enviar el mensaje al destinatario `mrdusik.gh@gmail.com` mediante el backend. El endpoint de contacto SHALL aceptar solicitudes anónimas para que se pueda contactar desde la pantalla de acceso y solicitudes autenticadas para la experiencia dentro de la aplicación. SHALL validar los datos, limitar el tamaño de la solicitud y aplicar límites de frecuencia al endpoint público. La configuración y credenciales del proveedor de correo SHALL permanecer en el backend. La interfaz SHALL mostrar confirmación solo cuando el backend confirme que el proveedor aceptó el mensaje; ante un fallo SHALL mostrar un error genérico y permitir reintentar sin presentar el envío como exitoso.

#### Scenario: Envío anónimo aceptado
- **WHEN** el backend recibe una solicitud anónima válida y el proveedor acepta el correo
- **THEN** envía el mensaje a `mrdusik.gh@gmail.com`
- **AND** la interfaz confirma que el mensaje se envió

#### Scenario: Envío autenticado aceptado
- **WHEN** el backend recibe una solicitud autenticada válida y el proveedor acepta el correo
- **THEN** el correo incluye el mensaje y los datos de contacto verificados del usuario
- **AND** la interfaz confirma que el mensaje se envió

#### Scenario: Proveedor de correo no disponible
- **WHEN** el proveedor rechaza el mensaje o no está disponible
- **THEN** el backend devuelve un error controlado
- **AND** la interfaz informa que no se pudo enviar y no muestra una confirmación de éxito

#### Scenario: Solicitud inválida o límite de frecuencia excedido
- **WHEN** la solicitud no cumple la validación del backend o excede el límite de frecuencia
- **THEN** el backend rechaza el envío con un error controlado
- **AND** no contacta al proveedor de correo

### Requirement: Mantener Contacto consistente en web, móvil y Android
La experiencia de Contacto SHALL estar disponible en la interfaz web responsive, en la vista móvil y en la aplicación Android. El modal SHALL ajustarse al viewport, permitir leer y completar sus controles en pantallas pequeñas y no SHALL requerir una pantalla ni un flujo de contacto separado para Android.

#### Scenario: Usar Contacto en la web móvil
- **WHEN** la persona abre el modal en un viewport móvil
- **THEN** todos los campos, mensajes de validación y acciones permanecen visibles o accesibles mediante desplazamiento interno
- **AND** no se produce desbordamiento horizontal

#### Scenario: Usar Contacto en Android
- **WHEN** una persona abre Contacto desde la pantalla de acceso o el desplegable de la aplicación Android
- **THEN** se presenta el mismo comportamiento y validación que en web
- **AND** el envío llega al backend configurado para Android
