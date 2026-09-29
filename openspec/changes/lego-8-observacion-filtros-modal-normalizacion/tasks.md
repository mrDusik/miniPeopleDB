# Tasks

## 1. Modelo, migracion y normalizacion

- [x] 1.1 Ampliar la validacion del repositorio para aceptar `observada` como booleano, aplicar `false` por defecto y persistir la migracion de forma atomica; verificar con pruebas de catalogo antiguo, segunda lectura idempotente y tipo invalido.
- [x] 1.2 Centralizar la normalizacion `id.toUpperCase().trim()` en lecturas de ruta, creacion, reemplazo, borrado y actualizacion de precios; verificar altas, duplicados y reemplazos con variantes de casing y espacios.
- [x] 1.3 Migrar `data/minifiguras.json` con IDs canonicos y `observada: false`, conservando orden y resto de datos; verificar que el JSON parsea, todos los IDs son unicos y una lectura posterior no genera cambios.

## 2. API de filtros y observacion

- [x] 2.1 Añadir filtros de API para `nombre` y `observada`, incluyendo coincidencia parcial insensible a mayusculas y acentos y errores `400` para valores booleanos invalidos; verificar combinaciones con categoria, estado e ID.
- [x] 2.2 Implementar la mutacion persistente para marcar y desmarcar observacion, con limite de 10, estados `COLECCIÓN` y `BUSCADA`, error controlado para la undécima y proteccion frente a mutaciones concurrentes; verificar persistencia, liberacion de cupo y ausencia de cambios al rechazar.
- [x] 2.3 Exponer la operacion de observacion mediante una ruta API coherente con el CRUD y mapear sus errores a respuestas JSON estables; verificar exito, `404`, limite y metodo no permitido desde pruebas HTTP.

## 3. Valoracion y sincronizacion Brickset

- [x] 3.1 Extender el resumen de valoracion con la coleccion de observadas, ordenada por `precioBrickset` descendente con ausentes al final y orden estable; verificar que rankings, total y contadores existentes no cambian.
- [x] 3.2 Aplicar el año actual como fallback cuando los detalles Brickset devuelvan `0` o ausencia, tanto en la respuesta del servidor como en el flujo de formulario; verificar con fixtures de Brickset y el año del reloj de prueba.

## 4. Filtros y tabla web

- [x] 4.1 Añadir el campo de nombre, toggle de observadas y opciones dinámicas de categoría/subcategoría calculadas desde el catálogo con contadores y cascada; verificar el DOM tras carga, selección de categoría y `Mostrar todo`.
- [x] 4.2 Añadir la acción de ojo por fila con clases `.eye-icon.active`/`.eye-icon.inactive`, actualización optimista controlada y Toast `warning` exacto al alcanzar el límite; verificar éxito, rollback tras error y accesibilidad del control.
- [x] 4.3 Convertir la celda ID en `.id-link` para abrir visualización y mantener las URLs de imagen en minúsculas; verificar clicks, preview y ausencia de mutación desde el enlace.
- [x] 4.4 Añadir la galería horizontal "En Observación" debajo de rankings con leyenda `ID - ESTADO - PRECIO`, orden recibido del resumen y apertura del preview; verificar catálogo vacío, tarjeta con precio y tarjeta sin precio.
- [x] 4.5 Representar los estados con `📦` y `🔍`, sustituir el selector de estado por dos toggles y aplicar el estilo visual inspirado en LEGO; verificar búsqueda individual, ambos/ninguno y presentación en la galería.

## 5. Modal unificado

- [x] 5.1 Reestructurar el HTML/CSS del modal en dos columnas con preview BrickLink de 250px y clase `.input-readonly`, manteniendo responsive y selección/copia de campos; verificar estructura y estilos en pruebas web.
- [x] 5.2 Implementar la matriz de permisos para modos `create`, `edit` y `view`, incluyendo campos obligatorios, botones visibles, toggle de observación y conservación de `FechaRegistro`; verificar cada modo y sus transiciones con JSDOM.
- [x] 5.3 Ajustar sincronizacion individual y validacion de formulario para bloquear alta hasta obtener datos, aplicar fallback de año y mostrar el Toast de error exacto; verificar éxito, ID inexistente, error de red y guardado deshabilitado/habilitado.
- [x] 5.4 Abrir las tarjetas de rankings y observadas en el modal unificado `view`, recuperando el registro completo por ID cuando el catálogo esté filtrado.

## 6. Cobertura de pruebas y compatibilidad

- [x] 6.1 Actualizar fixtures y pruebas de `test/minifiguras.test.js` para incluir `observada`, IDs canonicos, migracion, filtros, limite, CRUD y respuestas API; verificar con `node --test test/minifiguras.test.js`.
- [x] 6.2 Ampliar `test/web.test.js` para filtros dinámicos, watchlist, galería, modal por modos, preview, clases visuales, fallback de año y accesibilidad; verificar con `node --test test/web.test.js`.
- [x] 6.3 Actualizar pruebas de valoración y Brickset afectadas por el nuevo resumen y fallback de año; verificar con la selección de tests relacionada y corregir expectativas incompatibles documentadas.
- [x] 6.4 Verificar que las tarjetas de rankings y observadas abren el modal de visualización con todos los datos, incluso fuera del catálogo cargado.

## 7. Verificacion final

- [x] 7.1 Ejecutar la suite completa con `npm test` y verificar que todos los tests pasan sin alterar contratos no incluidos en este cambio.
- [x] 7.2 Validar el cambio OpenSpec con `openspec validate --strict` y verificar que proposal, tres deltas, diseño y tareas aparecen completos.

## 8. Ajustes visuales

- [x] 8.1 Centrar rankings, seguimiento, filtros y tabla; mantener textos azules a la izquierda y el inventario con su distribución original.
- [x] 8.2 Ubicar el crédito junto al nombre, mantener el resumen total/botón/contadores en la jerarquía acordada y quitar la línea amarilla de ancho completo.
- [x] 8.3 Mostrar icono, ID y precio sin guiones en seguimiento; actualizar los títulos y la preview del modal de imagen.
- [x] 8.4 Usar toggles de icono exclusivos para estado y seguimiento, alineando etiquetas y limpiando el fondo de la preview.
- [x] 8.5 Alinear filas ID/Nombre y centrar verticalmente la preview, haciendo que la fila ID ocupe todo el ancho en visualización y ocultando los asteriscos.
- [x] 8.6 Cubrir el layout por modo y las transiciones de toggles con pruebas web.
- [x] 8.7 Integrar ID, sincronización y Nombre en una línea del ancho del formulario, eliminar scroll del modal y ocultar el botón sin reservar espacio en visualización.
- [x] 8.8 Distribuir nivel, recuento y valor en tres paneles, mostrando solo iconos/cifras en el recuento y colocando 🔄 junto al valor.
- [x] 8.9 Aplicar colores de botones y paneles, alinear el valor total y mostrar porcentaje en la barra de progreso.
- [x] 8.10 Hacer que la altura del modal siga el contenido y alinear Nombre con los otros campos de la columna.
- [x] 8.11 Mantener ID, 🔄 y Nombre en la misma fila y ubicar el título del modal sobre Preview, alineado a la derecha.
- [x] 8.12 Centrar título y Preview en un mismo contenedor, y ocultar el título con todos los controles de edición en view-mode.
- [x] 8.13 Alinear el título arriba y sombrear controles deshabilitados en visualización.
- [x] 8.14 Asignar azul a Toasts de tareas, rojo a subidas de nivel y blanco a los demás eventos.
- [x] 8.15 Mostrar visualmente el estado real de los toggles en view-mode manteniéndolos deshabilitados.
