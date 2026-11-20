# Tasks

## 1. Contenido y tramitación de soporte

- [x] 1.1 Inventariar datos, usos, destinatarios, retenciones, cascadas y borrados fuera del flujo autenticado; verificar el resultado con una matriz que distinga lo comprobado de lo pendiente en cada servicio.
- [x] 1.2 Preparar la política y el texto de eliminación con los datos del responsable, contacto y plazo validados por el propietario; cotejar ambos textos con la matriz y documentar el procedimiento autorizado de verificación, recuperación, escalado y eliminación con proveedores.

## 2. Páginas públicas y navegación

- [x] 2.1 Servir `/privacidad` y `/eliminar-cuenta` y enlazarlas entre sí; comprobar por HTTP que cargan directamente como HTML sin sesión, también con el modo mantenimiento activo, sin reabrir el API ordinario.
- [x] 2.2 Enlazar la política desde Acceso y Preferencias y localizar los controles; comprobar que web y Android abren el recurso correcto y que Android usa la URL HTTPS configurada, no el origen local de Capacitor.

## 3. Solicitud web de borrado

- [x] 3.1 Implementar el POST de solicitudes con validación, límite compartido y correo a soporte identificado como solicitud de borrado; probar con dobles de correo y Supabase que un envío válido no consulta ni borra cuentas, que las entradas inválidas o limitadas no envían correo y que un rechazo del proveedor no devuelve éxito.
- [x] 3.2 Implementar el formulario accesible y responsive, estados de envío y reintento; probar en navegador el flujo sin sesión, la diferencia entre solicitud enviada y cuenta eliminada, y el comportamiento ante errores.
- [x] 3.3 Ejecutar las regresiones de Contacto, perfil y autenticación, y comprobar en las pruebas de PGlite que el borrado autenticado sigue limitado a la cuenta propia y conserva sus cascadas.

## 4. Historial de solicitudes rechazadas

- [x] 4.1 Actualizar el esquema y añadir una migración idempotente para quitar la identidad del emisor al rechazar y limpiar los avisos ya desvinculados; comprobar en PGlite que se preservan fecha y lectura, que la migración puede repetirse y que no modifica avisos de solicitudes pendientes, aceptadas o reenviadas.
- [x] 4.2 Mostrar un texto genérico localizado en la bandeja para avisos anonimizados; verificar en API y navegador que el historial sigue visible sin username ni acción de aceptar, y que un reenvío genera un aviso nuevo con el comportamiento habitual.

## 5. Validación y publicación

- [ ] 5.1 Documentar el despliegue y el procedimiento de soporte; tras el despliegue autorizado, verificar ambas URL sin sesión, la recepción de una solicitud de prueba y los recorridos de titularidad verificada, pérdida de acceso y borrado con cuentas de prueba autorizadas.
- [ ] 5.2 Con aprobación del propietario y comprobaciones previas superadas, registrar las URL de privacidad y borrado en los campos correspondientes de Play Console y verificar que ambas quedan guardadas y apuntan a páginas públicas funcionales.
