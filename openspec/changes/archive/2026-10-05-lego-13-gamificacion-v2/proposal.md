# Proposal

## Why

El Ranking Global permite comparar colecciones, pero no consultar los logros de otros coleccionistas ni incorporar sus destacados a las buscadas propias; ademas, la edicion necesita indicadores consistentes. El DNA permitira reconocer la personalidad de cada coleccionista a partir de sus logros, incluidos los historicos, sin publicar las ponderaciones individuales.

## What Changes

- Deshabilitar y sombrear ID al editar una figura existente, conservando Nombre, Descripcion, estado, seguimiento y datos de compra editables segun las reglas vigentes; los datos Brickset siguen sin admitir edicion manual.
- Mostrar en rojo todos los asteriscos de campos requeridos de los formularios, manteniendo su ocultacion en visualizacion.
- Incorporar `Ver logros` en cada fila del ranking, a la izquierda de la imagen de nivel y alineado con el nombre, reutilizando el estilo del panel propio.
- Abrir los logros con cabecera `Logros de [Nombre del Usuario]`, en solo lectura y sin alterar el panel ni la gamificacion propios.
- Ofrecer un boton compacto de lupa con mas en las tarjetas Top 3 por precio y antiguedad de otros usuarios solo cuando el ID no exista en la cuenta autenticada, en ninguno de sus estados.
- Abrir un alta rapida con apariencia del modal de edicion: ID deshabilitado y sombreado; categoria, subcategoria, anio, precio Brickset e imagen precargados; Nombre y Descripcion vacios; BUSCADA fijo y seguimiento editable. Guardar crea un registro propio, no modifica el registro ajeno.
- Incorporar DNA calculado dinamicamente en Supabase a partir de las cantidades de logros: Rarity Hunter (amarillo), Explorer (rojo), Collector (azul) y Fan (verde). Los 18 logros de coleccion usan las ponderaciones confirmadas; `someone-liked-your-collection` tiene pesos cero y queda excluido de sumas y denominador.
- Mantener las ponderaciones por logro privadas, sin enviarlas en API, recursos estaticos ni modales. Solo el usuario autenticado recibe sus proporciones agregadas; el ranking recibe unicamente el nombre del caracter principal.
- Mostrar `Newbie` sin contribuciones DNA y resolver empates exactos con Explorer > Collector > Fan > Rarity Hunter, sin usar porcentajes redondeados para decidir.
- Anadir bajo nivel y nombre un icono DNA clickable junto al caracter principal, sin porcentajes; abrir un modal propio con tarta y leyenda descriptiva. En el desplegable, `Ver Logros` y `DNA` comparten una fila flex al 50%, conservando el acceso a Ranking Global. El caracter de cada fila del ranking no es clickable.
- Aplicar el esquema retroactivamente en Supabase de pruebas y produccion, sin reotorgar logros ni reescribir historiales para almacenar porcentajes derivados.

## Capabilities

### New Capabilities

- `ranking-social`: consulta autenticada de logros publicos, visualizacion del caracter DNA principal y alta de buscadas a partir de destacados de otros usuarios, con aislamiento y prevencion de duplicados.

### Modified Capabilities

- `interfaz-web-minifiguras`: ID efectivamente deshabilitado en edicion, asteriscos rojos, alta rapida desde ranking y contrato de DNA propio, privacidad de pesos, calculo y visualizacion.

## Impact

- Frontend: `public/app.js`, `public/index.html` y `public/styles.css`; separar renderizado del panel propio y del modal de logros, manejar foco y peticiones obsoletas, reutilizar la cache completa del catalogo.
- Backend: `src/server.js`, `src/gamificacion-repository.js`, `src/ranking-repository.js` y `supabase/schema.sql`; consulta publica acotada de logros, metadatos de destacados y calculo DNA privado con RPC propia y caracter principal en ranking. Mantener RLS privada y el alta existente de minifiguras, sin claves de servicio; no persistir DNA en el JSON publico de logros.
- Pruebas: extender los tests web, API y repositorio existentes y `test-support/supabase-mock.js`, sin Supabase real ni nuevas dependencias previstas.
- Documentacion de API y despliegue SQL en `README.md`. Nombre de trabajo solicitado: `feature/lego-13-gamificacion-v2`; esta propuesta no crea ramas.
- Dependencia: `lego-12-ranking-global` esta completo pero aun activo; su contrato de ranking, regalos y Top 5 constituye la base. No se archiva ni se sincroniza ese cambio aqui. La nueva capacidad complementa `ranking-global`, no lo duplica.
- Fuera de alcance: cambiar el calculo de niveles o Bricks, Top 10, ordenaciones, concesion de regalos, permisos de escritura ajenos o altas ordinarias; no abrir modales DNA ajenos ni crear una suscripcion Realtime. La aclaracion del usuario conserva los controles existentes y permite seguimiento en el alta rapida.
- Ampliacion DNA confirmada el 2026-10-05: preservar las 19 tareas completadas y la comprobacion SQL real pendiente, agregando tareas DNA sin marcar implementacion ni despliegue como realizados.