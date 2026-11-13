# Tasks

## 1. Persistencia y API de revocación

- [x] 1.1 Añadir `amigos_revocar` a `supabase/schema.sql` y `supabase/friends-social-upgrade.sql`, limitando el borrado a solicitudes pendientes o rechazadas del emisor autenticado y recalculando ambos participantes atómicamente; validar titularidad, estados, cascadas, rollback y permisos de ejecución con PGlite.
- [x] 1.2 Añadir la operación del repositorio y la ruta autenticada `DELETE /api/amigos/solicitudes/:id`, con errores controlados y sin `service_role`; verificar éxito, solicitudes ajenas o aceptadas, IDs inválidos y fallos de persistencia en `test/amigos-api.test.js` con `test-support/supabase-mock.js`.

## 2. Actualizar el modal Amigos

- [x] 2.1 Mostrar un botón ✖ accesible en cada solicitud enviada y, al revocarla, quitarla de la lista, actualizar contadores y habilitar una nueva solicitud desde el buscador; verificar éxito y error en `test/friends-web.test.js`.
- [x] 2.2 Apilar Aceptar y Rechazar en una columna lateral estrecha para solicitudes recibidas pendientes en smartphone/Android portrait, conservando botones de 60px de ancho y 44px de alto mínimo; verificar reglas responsive y mayor ancho de la tarjeta en `test/friends-web.test.js`.

## 3. Documentar y validar

- [x] 3.1 Actualizar la sección Amigos de `README.md` con el SQL de actualización y el comportamiento de revocación y reintento; verificar que las instrucciones coincidan con la migración y la API.
- [x] 3.2 Ejecutar `node --test test/amigos-api.test.js test/friends-web.test.js test/supabase.test.js` y resolver regresiones en los flujos modificados.

Resultado: 66 pruebas correctas de 66 tras actualizar las expectativas obsoletas de la prueba del gráfico DNA y de las etiquetas del perfil. Las pruebas nuevas de revocación y disposición responsive pasan. La comprobación en navegador a 320px y 390px confirmó botones de 60×44px, 68px adicionales para la tarjeta y ausencia de desbordamiento; a 1280px se conserva la disposición horizontal. `npm run android:web` y la validación OpenSpec estricta finalizaron correctamente.
