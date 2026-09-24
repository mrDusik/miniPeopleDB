# Design

## Context

La aplicación usa Express, archivos JSON locales y módulos ES de Node. `MinifigurasRepository` valida y persiste `data/minifiguras.json`, mientras `BricksetScraper` consulta páginas individuales para precios. La interfaz construye actualmente las opciones de tema a partir del catálogo recibido, y el formulario aún usa un campo de texto para `tematica`.

## Goals / Non-Goals

**Goals:**

- Mantener un catálogo independiente de temas oficiales y sus totales.
- Reutilizar el patrón de scraper existente con dependencias HTTP sustituibles en tests.
- Validar temas en lectura, filtrado y operaciones CRUD sin consultar Brickset durante una petición normal.
- Servir los temas oficiales a la interfaz y usar selectores cerrados en búsqueda y edición.
- Migrar el JSON inicial conservando orden, estados y datos de valoración.

**Non-Goals:**

- No sincronizar temas automáticamente al arrancar el servidor ni desde una petición de usuario.
- No sustituir el campo público `tematica` ni rediseñar el resto del modelo de minifigura.
- No actualizar precios ni alterar el flujo existente de sincronización de precios.
- No crear una base de datos ni añadir autenticación para ejecutar la sincronización manual.

## Decisions

### Catálogo y contrato de lectura

- Crear `data/temas-brickset.json` como un arreglo de objetos `{ "tema": string, "total": number }`, sin duplicados y en el orden de Brickset.
- Añadir un repositorio pequeño y aislado para leer y validar ese archivo, con ruta inyectable para tests.
- Añadir `GET /temas`, que devuelve el arreglo validado y traduce ausencia o corrupción del archivo a un error JSON controlado.
- Elegimos un arreglo plano porque coincide con la respuesta que necesita un selector y permite preservar el orden de la fuente; no se introducirá un mapa que pierda orden o complique los totales.

### Scraping y ejecución manual

- Añadir un scraper de categorías que consulte `https://brickset.com/browse/minifigs`, elimine contenido no relevante y extraiga el nombre de cada categoría junto a su contador.
- Añadir un comando manual, por ejemplo `scripts/sync-brickset-themes.js`, que use ese scraper y persista el resultado mediante archivo temporal y renombrado atómico.
- El comando aceptará una ruta configurable y permitirá inyectar la respuesta HTTP desde tests; no se añadirá un endpoint de sincronización porque la operación está explícitamente destinada a ejecución manual.
- Se elegirá reemplazo completo del archivo frente a parches incrementales: una ejecución representa el estado completo de Brickset y un fallo no debe dejar una mezcla de versiones.

### Validación del dominio

- `MinifigurasRepository` recibirá el repositorio de temas o una ruta de temas junto con la ruta del catálogo.
- La lectura del catálogo de minifiguras comprobará que cada `tematica` pertenece al conjunto oficial; un catálogo persistido incompatible será inválido.
- Los filtros `tema` y las operaciones POST/PUT validarán contra el conjunto oficial y devolverán `400` cuando el nombre no exista. La comparación conservará la tolerancia actual a mayúsculas y acentos solo para buscar, pero persistirá el nombre oficial seleccionado.
- La migración de datos será un cambio explícito del JSON inicial, con equivalencias documentadas en el test; no se hará una traducción heurística en cada lectura.

### Interfaz

- La aplicación cargará `GET /temas` al iniciar y mantendrá una única lista de opciones reutilizable por el filtro y por `#form-tematica`.
- El filtro conservará la opción vacía `Todos los temas`; el formulario no ofrecerá texto libre y exigirá una opción oficial.
- Si la carga de temas falla, la interfaz mostrará el error y dejará deshabilitados los controles dependientes para evitar envíos inválidos.
- Se conservará el patrón actual de `fetch`, estados de carga, Toasts y tests con JSDOM.

## Risks / Trade-offs

- **[Cambios de HTML en Brickset]** -> El parser se cubrirá con fixtures representativos y fallará la sincronización completa si falta una categoría o un contador, conservando el archivo anterior.
- **[Brickset publica categorías con nombres repetidos o contadores no numéricos]** -> La validación rechazará el resultado completo y devolverá un error accionable en la ejecución manual.
- **[El archivo inicial contiene temas históricos no oficiales]** -> La migración se ejecutará antes de activar la validación estricta y tendrá tests que comprueben todos los valores persistidos.
- **[El catálogo oficial cambia mientras hay una edición]** -> Las peticiones usan el archivo local vigente; una nueva sincronización requiere revisar y migrar las figuras afectadas antes de aceptar el nuevo catálogo.
- **[El servidor deja de ser accesible si falta el archivo de temas]** -> `GET /temas` y las operaciones que necesitan validar temas devuelven errores controlados, mientras las respuestas no exponen rutas ni contenido bruto.

## Migration Plan

1. Añadir el catálogo local inicial de temas y el código de lectura, validación y scraping.
2. Poblar y validar el archivo con las categorías actuales de Brickset.
3. Normalizar `data/minifiguras.json`, incluyendo `Series 5` → `Collectible Minifigures`, sin modificar estados ni precios.
4. Activar la validación de temas en API y exponer `GET /temas`.
5. Cambiar filtros y formulario para usar opciones cargadas desde el endpoint.
6. Ejecutar la suite de tests y conservar como rollback los JSON anteriores hasta validar la migración.

## Open Questions

No quedan decisiones abiertas que cambien el alcance, el contrato o el desglose de tareas.