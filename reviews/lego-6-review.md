# REVISIÓN 1

Veredicto: WARNINGS
Hallazgos
src/minifiguras-repository.js:35-43
fechaCompra solo valida el formato YYYY-MM-DD, pero acepta fechas imposibles como 2024-02-31.

src/minifiguras-repository.js:49-52
Se aceptan variantes como coleccion o Coleccion, pero se conservan sin normalizar. Esto contradice el requisito de limitar los valores a COLECCIÓN y BUSCADA.

src/minifiguras-repository.js:149-159
Cualquier estado distinto de BUSCADA se contabiliza como colección. Aunque la validación limita los valores nuevos, los registros históricos o variantes aceptadas pueden entrar en el total incorrectamente.

src/server.js:142 y src/server.js:173
Las respuestas incluyen moneda: 'EUR'. El diseño indica moneda única y eliminación de lógica/campos de moneda; conviene confirmar que este campo siga formando parte del contrato API.

public/app.js:9
controls no incluye elementos select, por lo que los selectores de filtros no se deshabilitan durante la carga o sincronización.

public/app.js:310-312
La sincronización masiva solo deshabilita syncPricesButton; los botones de creación, edición y eliminación siguen disponibles durante la operación, pese al requisito de deshabilitar los controles relevantes.

test/minifiguras.test.js:44,66,69 y test/web.test.js:20
Los fixtures usan estadoColeccion: 'coleccion', aunque el contrato actual define COLECCIÓN. Esto mantiene una inconsistencia entre pruebas, datos y modelo.

# REVISIÓN 2

Veredicto: WARNINGS
Hallazgos
public/styles.css:31-33 y public/index.html:21-23
El contador collection-count hereda la tipografía Arial de .collection-summary, mientras que collection-total usa Georgia mediante strong. Esto contradice el requisito de que ambos tengan la misma tipografía.

src/minifiguras-repository.js:64-68
Se permite que estadoColeccion sea undefined. Aunque se interpreta como COLECCIÓN, los datos persistidos no quedan limitados estrictamente a los dos valores permitidos.

public/app.js:264-278
Al editar una minifigura sin estado persistido, el selector queda sin valor seleccionado ('') en lugar de mostrar COLECCIÓN por defecto.

web.test.js
Las pruebas de interfaz verifican principalmente texto y expresiones del código fuente; no prueban el comportamiento real del DOM para tipografía, ordenación, colores de diferencia, rankings ni estados deshabilitados.

brickset-scraper.test.js
No se prueba que los errores HTTP, los fallos de extracción y los errores de red generen los console.error descriptivos requeridos.

Especificaciones activas
Solo se adjuntó su estructura, no su contenido. Por tanto, no es posible verificar completamente la correspondencia entre la implementación actual y todas las reglas de specs.

# REVISIÓN 3

Veredicto: WARNINGS
src/minifiguras-repository.js:69-78, 237-241
create() y replace() conservan propiedades adicionales mediante spread. Esto permite persistir objetos anidados como valoracion o campos de moneda, contradiciendo el modelo plano en Euros de LEGO-6.

src/server.js:67-71
El filtro estadoColeccion acepta valores arbitrarios y devuelve 200 con una lista vacía. Debería validar explícitamente COLECCIÓN y BUSCADA y responder 400 para valores inválidos.

src/minifiguras-repository.js:199-204
updatePrices() persiste cambios sobre objetos que pueden contener campos no permitidos, perpetuando estructuras incompatibles si ya existen en el JSON.

src/server.js:181-184
La sincronización masiva procesa también figuras BUSCADA. La especificación excluye estas figuras del total y rankings, pero no aclara si deben actualizarse sus precios. Conviene documentar explícitamente esta decisión o limitar la sincronización a COLECCIÓN.

minifiguras.test.js
Faltan pruebas que verifiquen el rechazo de campos anidados/multimoneda y la respuesta ante filtros estadoColeccion inválidos.

# REVISIÓN 4

Veredicto: WARNINGS
minifiguras.test.js
No existe una prueba que simule un fallo de persist() durante updatePrices() y confirme explícitamente que el archivo original permanece intacto, aunque la implementación usa escritura atómica en src/minifiguras-repository.js:154-166.

src/server.js:181-184
La API acepta precio directamente en POST y PUT. La interfaz lo marca como readonly, pero un cliente externo puede establecerlo sin consultar Brickset. Conviene decidir si el servidor debe permitirlo o restringirlo a las operaciones de Brickset.

brickset-scraper.js
El contenido está resumido en los adjuntos, por lo que no puede verificarse completamente la implementación de timeout, reintentos y extracción frente a todos los escenarios especificados.

# REVISIÓN 5

Veredicto: WARNINGS
src/minifiguras-repository.js:193-204
updatePrices() no valida los valores recibidos antes de persistirlos. Un consumidor interno podría guardar precios negativos, NaN o valores no numéricos y dejar el catálogo inválido. Debe validar cada actualización como precio opcional válido.

src/minifiguras-repository.js:215-218
El ranking por precio excluye completamente las figuras COLECCIÓN sin precio. La especificación define un top 5 de figuras de colección y permite que el precio no exista; conviene documentar o probar explícitamente si esas figuras deben aparecer al final.

public/app.js:148-153
badgeClassFor() conserva compatibilidad con coleccion sin acento, aunque el modelo solo permite estados canónicos COLECCIÓN y BUSCADA. No afecta a la persistencia, pero mantiene lógica obsoleta en la interfaz.

web.test.js
La prueba de creación con estadoColeccion: '' se realiza indirectamente mediante comprobaciones estáticas y no ejecuta buildPayloadFromForm(). Falta una prueba funcional que confirme el valor enviado por el formulario.

brickset-scraper.js
El contenido está resumido en el adjunto; no puede verificarse completamente línea por línea la extracción, timeout, reintentos y cabeceras. Los tests adjuntos cubren esos escenarios, pero no sustituyen la revisión completa de la implementación.

# REVISIÓN 6

Veredicto: WARNINGS
src/minifiguras-repository.js:173-181
updatePrices() acepta IDs inexistentes y los ignora silenciosamente. Debería devolverlos como fallidos o rechazar la actualización para evitar falsos positivos.

src/minifiguras-repository.js:173-181
Una actualización con precio undefined se considera válida y no modifica nada. Para esta operación debería exigirse un número finito no negativo.

src/server.js:181-198
La sincronización masiva procesa las minifiguras secuencialmente. La especificación exige resiliencia, pero el diseño menciona concurrencia controlada; no hay límite ni estrategia de concurrencia configurable, lo que puede ralentizar colecciones grandes.

src/brickset-scraper.js:12-24
El parseo interpreta 1.234 como 1.234, aunque en formato europeo puede representar 1234. El tratamiento de separadores de miles y decimales sigue siendo ambiguo para importes sin decimales.

src/brickset-scraper.js:73
El User-Agent usa Chrome 131, que puede considerarse desactualizado frente al requisito de navegador moderno. Conviene actualizarlo o usar una cadena Firefox/Chrome vigente.

minifiguras.test.js
No hay pruebas para IDs inexistentes ni valores undefined en updatePrices(), ni para fallos reales durante rename()/writeFile() de la persistencia atómica.

# REVISIÓN 7

Veredicto: PASS
La implementación revisada cumple las especificaciones activas de LEGO-6:

Modelo plano en Euros y estados restringidos.
Validación de fechas y precios.
Scraping público con cabeceras, timeout, reintentos y errores diagnosticables.
Sincronización masiva resiliente con concurrencia limitada.
Total, contadores y rankings correctos.
Interfaz con formulario, ordenación, diferencias, rankings y Toasts.
Persistencia atómica y conservación de precios ante fallos.
Tests automatizados para los escenarios principales.