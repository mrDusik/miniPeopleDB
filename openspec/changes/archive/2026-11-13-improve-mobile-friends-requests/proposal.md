# Proposal

## Why

En pantallas de smartphone, las acciones de las solicitudes recibidas reducen demasiado el ancho disponible para identificar a quien solicita amistad. Además, quien envía una solicitud pendiente no puede retirarla desde el modal, por lo que no puede iniciar de nuevo el proceso si cambia de decisión.

## What Changes

- Añadir a las solicitudes enviadas una acción con ✖ que permita al emisor revocar solicitudes pendientes o rechazadas sin revelar cuál es su estado.
- Al revocar, retirar la solicitud para que deje de aparecer en las listas de enviadas y recibidas, y permitir iniciar una solicitud nueva posteriormente, incluso si la anterior fue rechazada.
- En las solicitudes recibidas pendientes, apilar Aceptar y Rechazar verticalmente en una columna lateral estrecha para ampliar la tarjeta del emisor en smartphone y Android.

## Capabilities

### New Capabilities

### Modified Capabilities

- `amigos`: permitir revocar solicitudes propias pendientes o rechazadas y definir la disposición móvil de las acciones en las listas de solicitudes.

## Impact

- Interfaz del modal Amigos y estilos responsive de la aplicación web empaquetada para Android.
- API y persistencia de solicitudes para autorizar la revocación únicamente al emisor de su solicitud pendiente o rechazada.
- Pruebas automatizadas de interfaz y API y documentación de actualización de instalaciones existentes; no se prevén cambios de identidad ni acceso global a datos.
