# Proposal

## Why

MiniPeopleDB permite crear cuentas y ya ofrece el borrado autenticado desde Preferencias, pero no dispone de una política de privacidad enlazada desde la app ni de un recurso web público y directo para solicitar la baja sin instalar Android. Ambos puntos forman parte de los [requisitos de privacidad](https://support.google.com/googleplay/android-developer/answer/9859455?hl=es) y [eliminación de cuentas](https://support.google.com/googleplay/android-developer/answer/13327111?hl=es) de Google Play.

## What Changes

- Publicar una política de privacidad de MiniPeopleDB en HTML y enlazarla desde la app y la ficha de Google Play.
- Publicar una página de eliminación que se pueda abrir directamente desde Google Play sin sesión ni instalación. Explicará el alcance del borrado y ofrecerá un formulario para enviarlo a soporte, que verificará la titularidad antes de tramitarlo.
- Conservar el borrado autenticado existente; la solicitud pública no identificará ni eliminará cuentas por sí sola.
- Anonimizar el aviso histórico de una solicitud de amistad al rechazarla y limpiar los avisos ya desvinculados. Se conserva el aviso, no el username del emisor.
- Verificar datos, proveedores, retención y cobertura del borrado antes de publicar, y documentar las dos URL y su comprobación en Play Console.
- No incluye moderación, términos de UGC, empaquetado AAB ni otras declaraciones de lanzamiento.

## Capabilities

### New Capabilities

- `privacidad-y-borrado-web`: política pública, descubrimiento desde la app y recurso externo para solicitar el borrado seguro de cuenta y datos.

### Modified Capabilities

Ninguna. El nuevo requisito de privacidad complementa el cambio activo `delete-rejected-friend-requests`: se conserva el aviso histórico sin acción de aceptar. Se preservan los contratos existentes de Contacto y de eliminación autenticada del perfil propio.

## Impact

- Interfaz web y Android, páginas públicas servidas por Express, recursos localizados y correo de soporte existente.
- Esquema Supabase, migración de avisos de amistad rechazados y presentación de su historial.
- El propietario valida el contenido de la política, los plazos, los proveedores y la operación de soporte, y configura las URL en Play Console.
- No se añade acceso administrativo ni una interfaz pública que pueda consultar o borrar cuentas.
