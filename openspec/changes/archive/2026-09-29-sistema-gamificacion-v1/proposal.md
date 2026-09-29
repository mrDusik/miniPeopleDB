# Proposal

## Why

La aplicación gestiona el inventario de minifiguras, pero todavía no ofrece una progresión persistente que convierta las altas y el estado de la colección en objetivos visibles para el usuario. Un sistema basado en un recálculo determinista del catálogo evita que las ediciones y eliminaciones dejen puntos o logros obsoletos, y proporciona una base extensible para incorporar nuevos niveles y objetivos.

## What Changes

- Añadir un catálogo versionado de niveles y logros de gamificación, con Bricks, reglas repetibles/no repetibles y umbrales configurables.
- Persistir el estado calculado del usuario en `data/gamificacion.json`, incluyendo Bricks totales, nivel actual y desglose de logros.
- Evaluar el catálogo completo automáticamente después de cada alta, edición, eliminación o actualización persistente que modifique minifiguras, e inicializar el estado existente al activar la funcionalidad.
- Exponer una API para consultar el estado de gamificación y devolver los logros obtenidos por una mutación del catálogo para que la interfaz pueda notificarlos.
- Incorporar en la pantalla principal el nivel, los Bricks, el progreso hacia el siguiente nivel, el detalle modal de logros y una cola de Toasts ordenada por Bricks con 300 ms entre avisos.
- Añadir cobertura automatizada de la lógica determinista, persistencia, integración API, inicialización, CRUD y comportamiento DOM de la interfaz.

## Capabilities

### New Capabilities

- `gamificacion`: Define niveles, Bricks, catálogo de objetivos, recálculo determinista, persistencia, inicialización y consulta del estado de gamificación.

### Modified Capabilities

- `minifiguras`: Las mutaciones del catálogo deberán disparar el recálculo de gamificación y mantener consistente el estado derivado después de altas, ediciones, eliminaciones y actualizaciones persistentes.
- `interfaz-web-minifiguras`: La interfaz deberá mostrar el estado de gamificación, permitir consultar el desglose de logros y presentar notificaciones de logros completados tras operaciones del catálogo.

## Impact

- Código: `src/minifiguras-repository.js`, `src/server.js`, un nuevo módulo/repositorio de gamificación y utilidades compartidas para reglas y cálculo.
- Persistencia: nuevo archivo `data/gamificacion.json`, con rutas inyectables para pruebas y escritura atómica coherente con los repositorios existentes.
- API: nuevo endpoint de estado y contrato de respuesta de las operaciones de catálogo para informar logros recién completados.
- Interfaz: `public/index.html`, `public/app.js` y `public/styles.css`, incluyendo barra de progreso, modal y cola visual de Toasts.
- Pruebas: ampliación de `test/minifiguras.test.js` y `test/web.test.js`, además de pruebas específicas del motor/repositorio de gamificación.
- No se modifica el cálculo de valoración económica en Euros ni el formato del catálogo de categorías; se reutilizan sus datos de categorías, subcategorías y totales conocidos.
