# Design

## Context

El servidor actual se construye con `node:http`, expone `/minifiguras` y delega la lectura y filtrado al repositorio JSON local. Las pruebas ya arrancan el servidor en un puerto efímero y sustituyen el archivo de catálogo por uno temporal. La nueva capacidad descrita en `specs/interfaz-web-minifiguras/spec.md` necesita servir recursos del navegador y conservar las rutas API existentes.

## Goals / Non-Goals

**Goals:**

- Ejecutar una aplicación Express que mantenga el contrato actual de `GET`, `POST`, `PUT` y `DELETE` de minifiguras.
- Servir una página estática desde una carpeta pública con una separación clara entre estructura, estilos y comportamiento.
- Traducir los controles del formulario a los parámetros ya soportados por `GET /minifiguras`.
- Renderizar resultados de forma segura, con estados de carga, vacío y error previsibles.
- Cubrir el contrato HTTP y el comportamiento del cliente sin modificar el catálogo de producción.

**Non-Goals:**

- No añadir autenticación, edición de minifiguras, paginación ni persistencia en el navegador.
- No cambiar los nombres ni el significado de los parámetros existentes de la API.
- No convertir la interfaz en una aplicación con build step o framework de frontend.

## Decisions

### Usar Express como adaptador HTTP

Se añadirá Express como dependencia de ejecución y `src/server.js` creará una instancia de aplicación que sirva estáticos y conserve los controladores actuales. Express se elige porque es un requisito explícito del cambio y ofrece middleware estable para archivos estáticos y parseo HTTP; mantener `node:http` obligaría a duplicar ese enrutamiento manual. La función pública `createServer({ catalogPath })` seguirá devolviendo un servidor arrancable por las pruebas, envolviendo la aplicación Express en `createHttpServer` si es necesario para conservar el ciclo de vida actual.

### Carpeta pública sin compilación

Los archivos `public/index.html`, `public/styles.css` y `public/app.js` serán recursos estáticos versionados. Esta estructura evita dependencias de bundling y permite que el HTML se abra con el mismo contrato que se sirve en producción. La página usará elementos semánticos: formulario de filtros, botones con texto solicitado y tabla con encabezados estables.

### Cliente basado en `fetch` y estado explícito

`app.js` mantendrá la colección actual y una referencia a la solicitud activa. Al buscar, construirá `URLSearchParams` omitiendo valores vacíos; `Mostrar todo` reiniciará el formulario y solicitará la ruta sin parámetros. Antes de cada petición mostrará carga, deshabilitará las acciones relevantes y, al completarla, validará que la respuesta sea un arreglo antes de renderizar. Las celdas se crearán con nodos de texto, no con HTML interpolado, para que los datos del catálogo no se interpreten como marcado.

### Pruebas por capas

Las pruebas de servidor verificarán `GET /`, la entrega de CSS y JavaScript y la coexistencia con `GET /minifiguras`. El comportamiento del cliente se cubrirá con pruebas de navegador o un DOM de prueba disponible en el proyecto; se comprobarán la construcción de parámetros, las acciones `Buscar` y `Mostrar todo`, el orden de filas y los estados vacío y error. Los casos seguirán usando catálogos temporales para aislar la persistencia.

## Risks / Trade-offs

- [Migración de `node:http` a Express] -> Mantener la firma de `createServer` y ejecutar toda la suite existente antes y después de la migración para detectar cambios de contrato.
- [El navegador puede solicitar recursos inexistentes] -> Referenciar únicamente archivos versionados y añadir pruebas HTTP para cada recurso publicado.
- [Respuestas de API lentas o fuera de orden] -> Deshabilitar acciones durante la consulta y aceptar únicamente la respuesta asociada al estado de consulta vigente.
- [Datos del catálogo contienen texto no confiable] -> Construir las celdas mediante APIs DOM de texto y no insertar valores con `innerHTML`.

## Migration Plan

1. Añadir Express y los recursos estáticos, y adaptar el arranque del servidor manteniendo la opción `catalogPath`.
2. Ejecutar las pruebas existentes y las nuevas pruebas de interfaz con el catálogo temporal.
3. Arrancar el servicio con `npm start` y verificar que `/` muestra la tabla y que la API sigue respondiendo.
4. Para revertir, retirar el middleware y los recursos estáticos y restaurar el arranque HTTP anterior; el archivo JSON no requiere migración.