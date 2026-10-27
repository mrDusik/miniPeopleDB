# Proposal

## Why

El catalogo V1 no representa la progresion, las acciones sociales y las afinidades definidas en el documento de logros V2. Se necesita sustituirlo integramente, recalcular a los usuarios existentes desde sus datos vigentes y empezar un historico comparable sin arrastrar recompensas de prueba de V1.

## What Changes

- **BREAKING**: sustituir todos los logros V1 por el catalogo normativo V2 transcrito del PDF y las decisiones confirmadas en esta conversacion. Mantener titulos, textos, Bricks y repetibilidad, salvo las correcciones expresamente acordadas.
- Permitir pesos DNA privados de suma 0 o 100; los cuatro hitos DNA tendran suma 0. Los hitos de 5/10/20/50/100 figuras de franquicia aportaran 5 Collector y 95 Fan; las primeras figuras de categoria mantienen 10 Collector y 90 Explorer.
- Derivar logros, cantidades, Bricks, nivel y progreso del estado vigente, con ganancias y perdidas. Incorporar amistades actuales, regalos V2 y agradecimientos emitidos; no premiar por recibir agradecimientos mediante el antiguo logro.
- Acotar los logros de series a todas las subcategorias de Collectible Minifigures, incluida Other. Clasificar por el menor anio de todas las minifiguras de la serie: antigua hasta 2016 inclusive, moderna desde 2017. Completar la extraccion y el reporte Brickset de este dato publico.
- Aplicar limites explicitos: series estrictamente por encima del 80%; valor de coleccion y DNA al alcanzar el umbral; decadas completas. Acumular hitos de progreso, pero usar exclusivamente el tramo de tamano mas alto de cada categoria.
- Conservar 50 Bricks directos por regalo global y 5 por regalo semanal, independientes de los nuevos hitos por 1 y 10 regalos. Unificar su contador sin reintroducir los logros repetibles V1.
- **BREAKING**: migracion unica que conserva cuentas, perfiles, minifiguras y relaciones sociales; elimina regalos y agradecimientos V1, notificaciones, snapshots completos y estado derivado V1, y reconstruye V2 sin avisos masivos. No ejecutar este reset en cada arranque ni durante la fase de propuesta.
- Recalcular el ranking global desde el estado V2. Reactivar el semanal el lunes estrictamente posterior al despliegue efectivo en produccion, en Europe/Madrid, solo con base dominical y captura semanal V2 comparables.
- No dar significado funcional ni visual a los grupos editoriales del documento ni a su columna Total. Conservar los niveles y sus umbrales vigentes, la interfaz existente y la privacidad de los pesos.

## Capabilities

### New Capabilities

- `logros-v2`: catalogo completo normativo, reglas de conteo, condiciones, recompensas, pesos privados y sustitucion de V1.

### Modified Capabilities

- `interfaz-web-minifiguras`: derivacion V2, DNA sin contribuciones y presentacion de logros/regalos sin grupos editoriales ni recompensas V1.
- `categorias-brickset`: anio minimo por serie, evidencia publica completa y fingerprint sensible a metadatos y definiciones V2.
- `persistencia-supabase`: fuentes sociales acotadas, recompensas V2, migracion puntual protegida y recalculos coherentes sin ampliar acceso global ordinario.
- `amigos`: recalcular las consecuencias de cada cambio de relacion para los dos participantes.
- `ranking-global`: regalos directos separados de los nuevos hitos y agradecimientos emitidos sin el antiguo logro receptor.
- `ranking-semanal`: disponibilidad relativa al despliegue V2, comparacion de capturas V2 y regalos sin logro repetible anterior.
- `ranking-social`: DNA publico calculado desde pesos V2, incluidos logros de coleccion con suma cero.
- `notificaciones`: recompensas y mensajes de agradecimiento V2, reset y migracion inicial sin eventos sinteticos.
- `analitica-historica`: nuevo historico V2, sin reanudacion de trabajos ni comparaciones que recuperen datos V1.

## Impact

Motor y repositorios de `src/gamificacion.js`, `src/gamificacion-repository.js`, recalculo global de categorias, worker diario, RPC SQL de regalos/agradecimientos/amistades/DNA y ranking; validacion del JSON local y extraccion Brickset; `public/app.js` para refrescos y mensajes sin redisenar la UI; instrucciones del agente `.github/agents/brickset.agent.md`; pruebas existentes de dominio, API, SQL PGlite y web.

El descubrimiento confirma que el motor actual cuenta logros de coleccion en JavaScript, DNA se obtiene mediante RPC y pesos privados SQL, las solicitudes aceptadas conservan emisor/receptor y la disponibilidad semanal tiene una fecha fija tambien validada por el repositorio. La implementacion debe mantener consistentes esos caminos, no limitarse a cambiar titulos.

No se requiere un servicio externo nuevo. No se autorizan en este cambio una ruta HTTP de reset, claves privilegiadas en navegador, acceso directo global con service_role, borrado de identidades ni alteraciones de la autenticacion. La migracion se planifica como SQL de despliegue operado por el propietario de la base de datos, probado con PGlite y con copia de seguridad previa.