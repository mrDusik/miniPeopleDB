# Proposal

## Why

Los usuarios necesitan una vía para comunicar problemas tanto si no pueden iniciar sesión como si ya están usando la aplicación. Un modal de contacto común evita bloquear la ayuda tras la autenticación y permite enviar al equipo los datos mínimos para responder.

## What Changes

- Añadir una acción con el emoji `✉️` que abra un modal titulado «Contacto» desde la pantalla de acceso y desde el desplegable del usuario, junto a Preferencias.
- En acceso, permitir enviar Email, Usuario y Mensaje, exigiendo Mensaje y al menos uno entre Email y Usuario.
- Con sesión, rellenar Email y Usuario desde la identidad autenticada y el perfil guardado, deshabilitarlos y exigir solo Mensaje.
- Enviar el mensaje a `mrdusik.gh@gmail.com` mediante el backend, con estados visibles de envío, éxito y error.
- Ofrecer la misma experiencia responsive en web, móvil y Android, que empaqueta los recursos web existentes.
- Validar y limitar los envíos en el backend para proteger el endpoint público de contacto.
- Compactar el espacio vertical de acceso y registro para evitar scroll innecesario en monitor, móvil y Android, manteniendo controles y errores accesibles.

## Capabilities

### New Capabilities

- `contacto-soporte`: acceso al formulario de contacto, validación según sesión y envío seguro del mensaje al soporte desde web y Android.

### Modified Capabilities

- `autenticacion-usuarios`: presentación compacta de los formularios de acceso y registro.

## Impact

- Interfaz: `public/index.html`, `public/app.js` y `public/styles.css`.
- Backend: `src/server.js` y la integración/configuración del servicio de correo.
- Android: distribución de los recursos web actualizados mediante el proceso existente que copia `public/`.
- Pruebas: cobertura del formulario, validaciones y envío/errores del endpoint.
- Configuración de despliegue: credenciales del proveedor de correo como secretos del backend; el destinatario es `mrdusik.gh@gmail.com`.
