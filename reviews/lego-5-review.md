# Informe de Revisión - LEGO-5

## Primera Ejecución (/revisar) - Veredicto: WARNINGS

Veredicto: WARNINGS
No se modificaron archivos; solo se revisó la especificación de lego-5-dashboard-interactivo-minifiguras contra la implementación en public, server.js y test.

Hallazgos
1. Toasts no cubren todos los flujos POST/PUT/DELETE — app.js (líneas ~250-270, minifiguraForm.addEventListener('submit', ...))

El requisito habla de "notificaciones toast integradas con endpoints POST/PUT/DELETE".
En el flujo de creación/edición (POST/PUT), los errores de validación del servidor solo se muestran con formError.textContent = messageForErrorCode(errorCode) (inline en el modal), no con showToast(...).
En cambio, el flujo de DELETE sí usa showToast(..., 'error') para errores.
Esto es una inconsistencia respecto al criterio de "toasts integradas con POST/PUT/DELETE": solo el éxito de POST/PUT dispara toast, pero el error no. Revisar si specs/interfaz-web-minifiguras/spec.md exige toast también para errores de creación/edición.
2. Tests basados en patrones de texto, no en comportamiento funcional — web.test.js (test "app.js gestiona alta, edicion y eliminacion...")

Los tests nuevos ('la pagina referencia los modales...', 'app.js gestiona alta, edicion y eliminacion...') verifican presencia de strings/regex en el HTML/JS servido (assert.match(script, /showToast/), etc.), pero no ejecutan comportamiento real (p. ej. no hay test que dispare un click en "Editar" y compruebe que el modal se llena con los datos, ni que un POST fallido muestre el mensaje esperado end-to-end, ni que el badge se renderice con la clase correcta para un valor real).
AGENTS.md exige "Todas las funcionalidades deben incluir tests automatizados" — la cobertura actual es superficial (smoke/pattern tests) para la lógica de interacción del dashboard, no verifica funcionalmente los flujos create/edit/delete/badges/toasts.
3. formIdInput.readOnly en edición no impide envío de un id modificado por DevTools — app.js (openFormDialog, línea ~140)

readOnly es solo una restricción de UI; si el valor cambia igual se enviaría a PUT /minifiguras/${currentEditId} con un payload id distinto al de la URL, y el servidor lo rechaza correctamente (MINIFIGURA_INVALIDA si id no coincide, ver server.js, bloque PUT). El comportamiento del servidor es correcto; el fallback de UI (mensaje "Los datos de la minifigura no son validos.") es genérico y no explica al usuario el motivo real (mismatch de id). No es un fallo funcional, pero reduce la calidad de la UX de error.
4. Falta manejo explícito de ID_INVALIDO en cliente — app.js (messageForErrorCode)

server.js puede devolver { error: 'ID_INVALIDO', mensaje: ... } (bloque match al decodificar id), pero ERROR_MESSAGES en app.js no tiene entrada para ID_INVALIDO; cae al mensaje genérico "Ocurrio un error inesperado." Es aceptable pero no ideal si la especificación pide mensajes específicos por tipo de error.
Lo que sí cumple
Modal de alta/edición con formulario único reutilizado (#form-dialog), consistente con design.md (decisión de un solo <dialog> reutilizable).
Modal de confirmación de borrado (#delete-dialog) separado, con cancelar/confirmar.
Acciones por fila (Editar/Eliminar) presentes vía actionsCell.
Badges de estado con badgeClassFor mapeando coleccion/deseada/vendida/otro.
Toasts de éxito para create/edit/delete.
Endpoints POST/PUT/DELETE en server.js correctamente invocados desde app.js con manejo de errores HTTP.
Recomendación
No requiere bloqueo, pero antes de archivar la change conviene:

Decidir si los errores de create/edit deben mostrarse también como toast (o documentar explícitamente que el inline-error es la decisión de diseño).
Añadir al menos un test de comportamiento (no solo de patrón) para el ciclo completo abrir-modal → enviar → refrescar tabla, y para el flujo de eliminación con confirmación.

## Segunda Ejecución (/revisar) - Veredicto: FAIL

Veredicto: FAIL
Solo análisis; no se modificó ningún archivo.

Hallazgo crítico (bloqueante)
1. Test roto por referencia a document inexistente — web.test.js (líneas ~187-191, test 'El formulario de alta invoca la API y limpia los campos tras un POST exitoso')


Este test se ejecuta con node:test (entorno Node, sin DOM). document no está definido en ese contexto → lanzará ReferenceError: document is not defined y hará fallar toda la suite (npm test).
Además, aunque document existiera, nunca se carga el HTML servido ni se hace fetch/JSDOM, por lo que el test no comprueba nada real: es un placeholder que no verifica ni el POST ni la limpieza de campos, contradiciendo su propio nombre.
Viola la regla de AGENTS.md "Todas las funcionalidades deben incluir tests automatizados" (el test no prueba la funcionalidad que declara) y hace que la suite no compile/ejecute correctamente.
Hallazgos WARNING (no bloqueantes, mismos que revisión previa, siguen vigentes)
2. Errores de creación/edición no muestran toast en el mismo camino de éxito — app.js (bloque minifiguraForm.addEventListener('submit', ...), líneas ~250-268)

Sí llama showToast(errorMessage, 'error') en el if (!response.ok), correcto — revisado de nuevo, en realidad sí se llama tanto en formError.textContent como en showToast. Esto contradice mi hallazgo anterior: al releer el código actual, el flujo POST/PUT sí invoca showToast en error. Se retira esa observación como incorrecta en la revisión anterior.
3. Tests basados en patrones de texto en vez de comportamiento — web.test.js

Los tests 'la pagina referencia los modales...' y 'app.js gestiona alta, edicion y eliminacion...' solo verifican presencia de strings/regex en el HTML/JS servido, no ejecutan comportamiento real (no simulan clicks, no verifican DOM tras editar, no comprueban que un error real muestre el toast/badge esperado). Esto deja la cobertura funcional real por debajo de lo que exige AGENTS.md.
4. Falta de entrada específica para ID_INVALIDO en algunos casos y mensaje genérico en mismatch de id — app.js (ERROR_MESSAGES, messageForErrorCode)

Ya existe ID_INVALIDO en el mapa (a diferencia de mi revisión previa, que fue incorrecta en este punto — está presente). Se retira esta observación también.
Resumen de correcciones a la revisión anterior
Tras releer el código con más detalle: los puntos 1 y 4 de la revisión previa ya no aplican (ambos ya están implementados correctamente). El bloqueador real de esta revisión es el test roto (document is not defined), que impide confiar en que npm test pase, y la calidad superficial de los tests de patrón (punto 3), que sigue siendo un WARNING.

Recomendación
Eliminar o reescribir el test roto de web.test.js (línea ~187) usando un entorno DOM real (p. ej. cargar el HTML servido y usar jsdom) o eliminarlo si es un placeholder no intencional, antes de considerar la change lista para archivar.
Reforzar los tests de modales/toasts con verificación de comportamiento real, no solo de patrones de texto.

## Tercera Ejecución (/revisar) - Veredicto: WARNINGS

Veredicto: WARNINGS
Solo análisis; no se modificó ningún archivo.

Hallazgos
1. formIdInput.readOnly no bloquea el envío real del campo id en edición — app.js, línea ~140 (openFormDialog)


readOnly no es disabled: el valor se sigue enviando en FormData, pero un usuario no puede editarlo desde el input (correcto por diseño). Sin embargo, si se manipula vía DevTools, se enviaría PUT /minifiguras/${currentEditId} con un id de payload distinto al de la URL. El servidor (server.js, bloque PUT) ya rechaza esto correctamente con MINIFIGURA_INVALIDA, así que no es un fallo funcional — solo un mensaje de error poco específico para ese caso (punto 2).
2. Mensaje de error genérico para mismatch de id en edición — app.js, ERROR_MESSAGES (líneas ~30-37)

No hay distinción entre "datos inválidos" genéricos y "el id no coincide con el de edición"; ambos casos devuelven MINIFIGURA_INVALIDA → mismo texto "Los datos de la minifigura no son validos." Aceptable, pero reduce claridad de UX si la especificación pedía mensajes específicos por escenario.
3. Cobertura de tests basada en patrones de texto, no en comportamiento — web.test.js, tests 'la pagina referencia los modales...' (línea ~85) y 'app.js gestiona alta, edicion y eliminacion...' (línea ~108)

Estos tests hacen assert.match(html/script, /regex/) sobre el HTML/JS servido como texto plano; no ejecutan el DOM ni simulan interacción (clicks, submit, apertura de modal, actualización de tabla).
No verifican funcionalmente: que al hacer clic en "Editar" se rellene el formulario con los datos correctos, que un POST fallido muestre el toast de error, que el badge se renderice con la clase CSS correcta para un valor real, o que "Eliminar" abra el modal de confirmación y solo tras confirmar dispare el DELETE.
Esto dejaría pasar regresiones de comportamiento real aunque las cadenas de texto sigan presentes en el código fuente. Se recomienda usar un entorno DOM (p. ej. jsdom o happy-dom) para probar estos flujos de extremo a extremo, en línea con la exigencia de AGENTS.md de que "todas las funcionalidades deben incluir tests automatizados" (entendido como pruebas funcionales, no solo de presencia de texto).
Lo que sí cumple con la especificación (lego-5-dashboard-interactivo-minifiguras)
Modal de alta/edición (#form-dialog) reutilizado para ambos flujos, según decisión de design.md.
Modal de confirmación de borrado (#delete-dialog) separado, con cancelar/confirmar y sin borrado accidental (deleteConfirmButton requiere pendingDeleteId activo).
Acciones por fila (Editar/Eliminar) presentes en actionsCell, con data-action/data-id correctamente delegados via un solo listener en catalogBody.
Badges de estado (badgeClassFor) mapean coleccion/deseada/vendida/otro a clases CSS definidas en styles.css (.badge-coleccion, .badge-deseada, .badge-vendida, .badge-otro).
Toasts de éxito y error para los tres flujos (POST/PUT en minifiguraForm submit, DELETE en deleteConfirmButton), consistentes con el requisito de "notificaciones toast integradas con endpoints POST/PUT/DELETE".
Servidor (server.js) expone correctamente POST /minifiguras, PUT /minifiguras/:id, DELETE /minifiguras/:id con los códigos de error (MINIFIGURA_INVALIDA, ID_DUPLICADO, MINIFIGURA_NO_ENCONTRADA, ID_INVALIDO) que el cliente mapea vía ERROR_MESSAGES.
Suite minifiguras.test.js cubre exhaustivamente la API REST subyacente (filtros, errores, persistencia), cumpliendo con la regla de persistencia en JSON local sin base de datos.
Recomendación
No bloquea el archivado de la change, pero antes de darla por completamente verificada conviene:

Añadir tests de comportamiento real (DOM) para los flujos clave: editar → prellenar formulario, eliminar → confirmar → refrescar tabla, error de API → toast visible.
Confirmar si specs/interfaz-web-minifiguras/spec.md exige mensajes de error diferenciados para el caso de mismatch de id en edición; si es así, añadir un código de error específico o mensaje más claro.