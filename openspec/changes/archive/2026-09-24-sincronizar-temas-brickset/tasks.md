# Tasks

## 1. Catálogo y scraper de temas

- [x] 1.1 Crear `data/temas-brickset.json` con el esquema `{ tema, total }`, todas las categorías actuales de Brickset y sin nombres duplicados; verificar que el JSON parsea y que los totales son enteros no negativos.
- [x] 1.2 Implementar la lectura y validación aislada del catálogo de temas con ruta configurable; verificar errores controlados para archivo ausente, JSON inválido, nombres repetidos y totales no válidos.
- [x] 1.3 Implementar el parser y cliente HTTP de categorías Brickset usando la página pública; añadir fixtures para HTML válido, HTML incompleto, errores HTTP y fallos de red, y verificar que solo se acepta un conjunto completo.
- [x] 1.4 Crear el comando manual de sincronización con escritura atómica y ruta/fetch sustituibles; verificar que una sincronización exitosa reemplaza el archivo y que cualquier fallo conserva el archivo anterior.

## 2. API y validación del catálogo

- [x] 2.1 Integrar el repositorio de temas en el servidor y exponer `GET /temas`; verificar respuesta `200` con el catálogo y respuestas `500` controladas ante archivos ausentes o inválidos.
- [x] 2.2 Extender la validación de `MinifigurasRepository` para exigir temas oficiales en lectura, creación y reemplazo; verificar `400` para temas desconocidos en POST/PUT y `500` para un catálogo persistido incompatible.
- [x] 2.3 Validar el parámetro `tema` de `GET /minifiguras` contra el catálogo oficial y conservar la comparación tolerante existente para consultas; verificar filtros oficiales válidos y rechazo `400` de temas inexistentes.
- [x] 2.4 Actualizar los helpers de tests y las pruebas de API para inyectar un catálogo de temas temporal y cubrir `GET /temas`, lectura, filtros y CRUD.

## 3. Migración de datos

- [x] 3.1 Revisar cada `tematica` de `data/minifiguras.json` contra el catálogo oficial y definir equivalencias explícitas para nombres históricos; verificar que `Series 5` se convierte en `Collectible Minifigures`.
- [x] 3.2 Aplicar la migración del JSON inicial conservando IDs, orden, estados, precios y fechas; verificar que todas las figuras pasan la validación y que los estados `COLECCIÓN` y `BUSCADA` no cambian.

## 4. Interfaz web

- [x] 4.1 Cambiar el selector de filtro y el campo de formulario `tematica` a opciones cargadas desde `GET /temas`; verificar que no aparecen temas derivados únicamente del catálogo filtrado ni entradas duplicadas.
- [x] 4.2 Gestionar carga, error y deshabilitado de controles dependientes del catálogo de temas sin borrar datos válidos; verificar los estados con tests JSDOM.
- [x] 4.3 Actualizar los flujos de alta y edición para enviar exclusivamente temas oficiales y conservar filtros tras una operación; verificar éxito y rechazo con Toasts.

## 5. Verificación final

- [x] 5.1 Añadir o ajustar tests de servidor, scraper, repositorio e interfaz para cubrir todos los escenarios de las deltas; verificar con `npm test`.
- [x] 5.2 Ejecutar `openspec validate sincronizar-temas-brickset --strict` y comprobar que todos los artefactos y requisitos están completos antes de aplicar el cambio.