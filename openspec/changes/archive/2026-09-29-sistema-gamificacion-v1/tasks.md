# Tasks

## 1. Motor y contrato de gamificacion

- [x] 1.1 Crear el catalogo declarativo de niveles 0-25 y objetivos V1, con IDs estables, nombres, valores en Bricks, regla y modo repetible.
- [x] 1.2 Implementar el evaluador puro del catalogo: reglas de precio acumulativas, IDs especiales, primeras categorias/subcategorias, objetivos de categorias concretas y completitud con totales positivos.
- [x] 1.3 Implementar la seleccion parametrica del nivel, el porcentaje de progreso, el siguiente nivel y el caso de nivel maximo.
- [x] 1.4 Implementar la comparacion entre estados anterior y posterior para producir logros nuevos sin que el cliente replique reglas.
- [x] 1.5 Añadir pruebas unitarias de fronteras de niveles, reglas de precio, acumulacion simultanea, objetivos repetibles/no repetibles y decrementos al eliminar o editar.

## 2. Persistencia e inicializacion

- [x] 2.1 Crear `GamificacionRepository` con ruta configurable, validacion del estado y escritura atomica en JSON.
- [x] 2.2 Añadir `data/gamificacion.json` inicializado con el resultado del inventario actual y comprobar que su formato es valido.
- [x] 2.3 Implementar inicializacion perezosa o equivalente con promesa compartida, de forma que el primer acceso concurrente no genere evaluaciones ni escrituras duplicadas.
- [x] 2.4 Probar rutas temporales, catalogo inicial existente, archivo ausente, estado invalido y fallos de escritura sin JSON parcial.

## 3. Integracion con el repositorio de minifiguras

- [x] 3.1 Inyectar el sincronizador de gamificacion en `MinifigurasRepository` sin duplicar la logica de recalcule en cada endpoint.
- [x] 3.2 Ejecutar el flujo de recalcule tras persistir correctamente altas, reemplazos, eliminaciones y actualizaciones de precio.
- [x] 3.3 Garantizar que un fallo al persistir el catalogo no cambia `gamificacion.json` y que el estado derivado se puede reparar mediante un recalcule posterior.
- [x] 3.4 Añadir pruebas de integracion para alta, edicion, borrado y cambios de precio que verifiquen Bricks, logros, nivel y decrementos.

## 4. API

- [x] 4.1 Añadir `GET /gamificacion` con inicializacion automatica, estado completo y errores controlados sin exponer rutas locales.
- [x] 4.2 Extender de forma aditiva las respuestas POST/PUT con estado y logros nuevos, conservando validaciones y codigos HTTP actuales.
- [x] 4.3 Mantener DELETE y sincronizacion masiva compatibles, asegurando que tambien recalculan el estado aunque no devuelvan un cuerpo de gamificacion.
- [x] 4.4 Añadir pruebas HTTP para lectura, inicializacion, respuestas de mutacion, logros nuevos, errores y coherencia tras CRUD.

## 5. Interfaz y notificaciones

- [x] 5.1 Añadir a `public/index.html` la barra de estado de nivel, Bricks, progreso, siguiente nivel y modal accesible de desglose.
- [x] 5.2 Implementar en `public/app.js` la carga y renderizado de `/gamificacion`, la apertura/cierre del modal y la actualizacion tras cada mutacion.
- [x] 5.3 Implementar la cola de Toasts con orden ascendente por Bricks, separacion de 300 ms y texto de nombre más ganancia.
- [x] 5.4 Añadir estilos responsivos y estados de error/carga sin solapar el catalogo ni romper los controles existentes.
- [x] 5.5 Añadir pruebas DOM para barra, nivel maximo e intermedio, modal, desglose, actualizacion y cola temporizada de Toasts.

## 6. Verificacion final

- [x] 6.1 Ejecutar `openspec validate --changes` y corregir cualquier incumplimiento de artefactos o deltas.
- [x] 6.2 Ejecutar `npm test` y confirmar que la suite completa pasa sin errores.
- [x] 6.3 Revisar que el estado de `data/gamificacion.json` corresponde al inventario persistido y que no quedan cambios de implementacion fuera del alcance.

## 7. Refinamientos de feedback de gamificacion

- [x] 7.1 Documentar y mostrar un Toast diferenciado por cada nivel alcanzado, incluyendo todos los niveles intermedios en un salto.
- [x] 7.2 Añadir descripciones declarativas de logros y mostrarlas como ayuda contextual en el modal de tareas completadas.
- [x] 7.3 Cubrir los nuevos Toasts, niveles intermedios y descripciones con pruebas de motor y DOM.
- [x] 7.4 Añadir paginación de 10 filas a la tabla, con navegación y reinicio al cargar nuevas consultas.
- [x] 7.5 Rediseñar el resumen de valoración para colocar el botón compacto de Brickset a la derecha del texto informativo.
