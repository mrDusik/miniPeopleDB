# Tasks

## 1. Preparar el servidor Express

- [x] 1.1 Añadir Express como dependencia de ejecución y verificar que la instalación y `npm test` se completan correctamente.
- [x] 1.2 Adaptar `src/server.js` para conservar `createServer({ catalogPath })`, las rutas CRUD existentes y sus respuestas, y servir la carpeta pública en `/`; verificar con las pruebas actuales y una solicitud `GET /`.
- [x] 1.3 Confirmar que la ruta raíz, los recursos estáticos y `GET /minifiguras` coexisten sin que la página capture rutas de la API; verificar respuestas HTTP y tipos de contenido.

## 2. Construir la interfaz estática

- [x] 2.1 Crear `public/index.html` con el panel de filtros para `tema`, `anio` y `estadoColeccion`, las acciones `Buscar` y `Mostrar todo`, el estado de consulta y la tabla con encabezados del catálogo; verificar que el HTML referencia los recursos publicados.
- [x] 2.2 Crear `public/styles.css` con una presentación legible y adaptable para formulario, estados y tabla; verificar visualmente la página en una ventana amplia y una estrecha.
- [x] 2.3 Crear `public/app.js` para consultar `GET /minifiguras`, construir parámetros omitiendo filtros vacíos, limpiar filtros con `Mostrar todo` y gestionar carga, resultados, vacío y error; verificar cada transición mediante pruebas de cliente o navegador.
- [x] 2.4 Renderizar las celdas con texto seguro, conservar el orden recibido y deshabilitar acciones durante la consulta; verificar resultados con valores especiales, respuesta vacía y respuesta fuera de orden.

## 3. Añadir cobertura automatizada

- [x] 3.1 Extender las pruebas HTTP con un catálogo temporal para comprobar `GET /`, `styles.css`, `app.js` y la compatibilidad con `GET /minifiguras`; verificar contenido, estados y tipos MIME.
- [x] 3.2 Añadir pruebas del flujo de filtros para `Buscar` y `Mostrar todo`, incluyendo parámetros combinados y formulario reiniciado; verificar que las filas de la tabla coinciden con la respuesta y conservan su orden.
- [x] 3.3 Añadir pruebas de estados vacío, carga y error de API sin modificar `data/minifiguras.json`; verificar que no aparecen datos parciales cuando la consulta falla.

## 4. Verificación integral

- [x] 4.1 Ejecutar `npm test` y corregir cualquier regresión en las rutas API existentes; verificar que toda la suite termina correctamente.
- [x] 4.2 Arrancar con `node src/server.js` y consultar la interfaz desde un navegador, comprobando búsqueda, mostrar todo, tabla y mensajes de estado; verificar que el catálogo inicial permanece válido.