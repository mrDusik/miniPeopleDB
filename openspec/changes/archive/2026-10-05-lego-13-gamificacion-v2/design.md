# Design

## Context

Ver `proposal.md` para motivacion y alcance; los contratos se definen en los dos deltas de `specs/`.

- `public/app.js` concentra la interfaz sin framework. `updateFormMode` marca ID como `readOnly` en edicion, pero solo lo deshabilita en visualizacion. `buildPayloadFromForm` lee valores directamente, por lo que un ID deshabilitado puede seguir enviandose sin depender de FormData.
- `currentEditId` decide entre PUT y POST. Reutilizar literalmente el modo edit para un destacado ajeno produciria una actualizacion incorrecta.
- `renderGamification` actualiza a la vez panel principal, cabecera del modal y lista de logros. Usarlo con datos ajenos contaminaria el panel propio.
- Las filas tienen un boton `.ranking-expand` que contiene nombre e imagen de nivel. Las tarjetas ajenas son spans estaticos. No se deben anidar nuevos botones dentro del boton de expansion.
- `catalogCache` contiene el catalogo completo por sesion, mientras `currentCatalog` es su vista filtrada. `hasLoadedFullCatalog` distingue una cuenta vacia de una carga pendiente. Las mutaciones confirmadas actualizan cache y disparan `revalidate`.
- `ranking_global()` devuelve Top 5 por precio y antiguedad, aunque la interfaz muestra tres. Los JSON actuales no incluyen categoria y subcategoria, y el Top por precio tampoco anio. La imagen se deriva del ID con `imagenUrlPara`.
- RLS mantiene catalogos y gamificacion privados. Las RPC del ranking usan `security definer`, `auth.uid()`, search_path fijo y permisos restringidos. `GET /gamificacion` es propio y puede recalcular; no sirve para consultar usuarios ajenos.
- Tests existentes: Node test runner, JSDOM para web y cliente de `test-support/supabase-mock.js` para Supabase. No se preve ninguna dependencia nueva.
- El contrato `ranking-global` sigue en el cambio activo completo `lego-12-ranking-global`, no en specs principales. Este cambio lo complementa mediante `ranking-social`; no modifica sus ordenaciones ni regalos.
- Ampliacion DNA del 2026-10-05: `src/gamificacion.js` define 18 objetivos de coleccion y `LOGRO_REGALO`; `data/gamificacion.json` es una instantanea historica, no el catalogo completo vigente ni la fuente multiusuario. `gamificacion.logros` guarda ID y cantidad suficientes para calcular DNA sin modificar el historial.
- `GamificacionRepository.ensure` memoriza el estado inicial y `recalculate` persiste las cantidades tras mutaciones; no debe memorizarse DNA en ese estado. `ranking_global()` usa un retorno tabular SQL, mientras `ranking_logros()` ya proyecta campos permitidos.
- `test/supabase.test.js` dispone de PGlite para ejecutar SQL local; ampliar esa infraestructura y el mock existente, sin sustituir por ello la comprobacion de permisos en Supabase remoto.

## Goals / Non-Goals

**Goals:**
- Separar datos propios de la visualizacion publica y hacer explicita la diferencia entre editar y crear con ID bloqueado.
- Reutilizar la cache, los modales, el POST existente y el esquema de RPC acotadas, con pruebas sobre esas fronteras.
- Mantener el flujo utilizable por teclado y en movil sin alterar innecesariamente el diseno existente.
- Una unica regla SQL de DNA para lectura propia y caracter publico, sin matriz de pesos en frontend ni calculo paralelo en JavaScript de produccion.

**Non-Goals:**
- No crear perfiles navegables fuera del ranking, exponer catalogos completos ajenos, abrir RLS general ni usar claves de servicio.
- No recalcular logros ajenos al consultar, migrar datos JSON locales, cambiar concesion de Bricks o niveles ni crear ramas durante la propuesta. DNA es una ampliacion derivada de logros, no un reemplazo del sistema existente.
- No abrir DNA ajeno, publicar pesos individuales, implementar suscripciones Supabase Realtime ni almacenar porcentajes derivados. Tiempo real significa calcular al consultar y refrescar tras mutaciones confirmadas, no notificaciones entre sesiones.

## Decisions

### 1. Consulta publica independiente, bajo demanda

Agregar `GET /api/ranking/:userId/logros` a las rutas protegidas de `src/server.js`, validar UUID y resolver mediante un metodo nuevo de `RankingRepository`. Usar una RPC `ranking_logros(p_usuario_id uuid)` de solo lectura que compruebe `auth.uid()` y pertenencia al Top 10 vigente con los mismos desempates que `ranking_global`. Proyectar exclusivamente los campos publicos definidos en el delta; el repositorio mantiene una lista permitida de propiedades, incluida la proyeccion de cada logro. No devolver objetos privados completos.

La RPC no llama a recalculo ni realiza escrituras. Restringir EXECUTE a authenticated, revocar public/anon y fijar search_path siguiendo el esquema actual. Mantener intactas las politicas de las tablas. El parametro identifica el objetivo de una lectura publica, nunca el propietario de una escritura. Errores: 400 USUARIO_INVALIDO, 404 USUARIO_NO_ENCONTRADO, 500 LOGROS_NO_DISPONIBLES; 401 conserva el contrato existente.

Alternativas: incluir todos los logros en cada respuesta del ranking aumenta transferencia innecesaria; leer directamente gamificacion ajena exige abrir RLS; reutilizar la ruta propia introduce recalculo y contratos ambiguos. La consulta bajo demanda es una adicion compatible y acotada.

### 2. Separar renderizado de logros del panel propio

Extraer el renderizado de cabecera y lista del modal a una funcion que recibe un estado y titulo. Mantener el ultimo estado propio por sesion separado del objetivo del modal. Abrir desde el panel propio restaura siempre su titulo y estado; abrir desde ranking usa el nombre publico completo con textContent, no HTML ni el nombre abreviado de la fila. Toda fila, incluida la propia, tendra `Ver logros`.

Usar un contador de peticiones asociado al objetivo y sesion para descartar respuestas tras cierre, cambio de objetivo o logout. Mientras carga, vaciar la lista y mostrar estado; manejar lista vacia y error sin reutilizar datos previos. Las actualizaciones propias en segundo plano no sustituyen una vista ajena abierta ni cambian su titulo. Limpiar estado publico y propio al terminar la sesion.

Alternativa: un segundo modal duplica marcado y estilos; pasar datos ajenos a `renderGamification` altera el panel propio. Separar las dos responsabilidades permite reutilizar el modal sin ese efecto.

### 3. Acciones hermanas y foco entre modales

Reorganizar la fila para que expansion y `Ver logros` sean botones hermanos dentro de una estructura grid, nunca botones anidados. Conservar la accion de regalos independiente. Colocar `Ver logros` a la izquierda de la imagen de nivel y en la linea del nombre; reutilizar las clases visuales del boton del panel propio. Ajustar los tests que hoy fijan la lista exacta de hijos y columnas CSS para probar las nuevas posiciones y acciones.

Abrir el modal secundario sobre el dialogo de ranking sin cerrarlo, conservando el acordeon. Registrar el disparador y devolverle foco al cerrar mediante boton o Escape; si el alta elimina el boton, enfocar el control de expansion de esa fila o Cerrar del ranking. No permitir que la delegacion de eventos interprete logros o alta como expansion. Verificar en navegador real el apilado nativo de dialogos y en JSDOM los estados/foco.

Alternativa: cerrar y reconstruir el ranking pierde acordeon y contexto. Los dialogos apilados conservan el contexto, con gestion explicita de foco y cancelacion.

### 4. Completar metadatos publicos sin copiar datos personales

Ampliar los objetos JSON de ambos Top 5 en `ranking_global()` con categoria, subcategoria opcional, anio y precio. Mantener el retorno SQL, nombres `top5Precio`/`top5Antiguedad`, limites y ordenaciones. Derivar imagen del ID como ya hace la app. No agregar descripcion, seguimiento, precioCompra, fechaCompra ni FechaRegistro ajenos. El nombre publico existente sirve a la tarjeta, pero no se precarga en el formulario.

Si faltan metadatos obligatorios, usar la consulta individual existente `/minifiguras/:id/brickset` para completar datos oficiales y las reglas vigentes de categoria y fallback de anio. Inhibir la consulta automatica al cargar la imagen en el nuevo modo cuando los metadatos ya son validos; el listener actual consulta tambien en edicion y no debe iniciar solicitudes redundantes para el alta rapida.

Alternativa: consultar Brickset en cada clic anade latencia y dependencia externa incluso con datos suficientes. Ampliar solo JSON de destacados mantiene compatibilidad y permite usar Brickset unicamente como fallback.

### 5. Modo explicito de alta rapida

Agregar un modo `ranking-create` al modal unificado. Su presentacion puede usar `Editar minifigura`, pero `currentEditId` permanece null y Guardar ejecuta POST. Reiniciar el formulario antes de cargar ID y metadatos; dejar Nombre/Descripcion vacios, BUSCADA fijo, compra vacia y deshabilitada, seguimiento editable e inicialmente falso. Usar el mismo aspecto sombreado de campos bloqueados para ID en edit y ranking-create; el ID permanece habilitado en alta ordinaria. Restaurar permisos y titulo en cada apertura/cierre.

Forzar BUSCADA y ausencia de compras al construir el payload de ranking-create, no confiar solo en toggles deshabilitados. Leer ID directamente del control bloqueado. El seguimiento usa validacion y limite existentes. No enviar propietario origen ni copiar su FechaRegistro. Evitar doble envio con un estado de peticion en curso y bloquear Guardar durante carga/envio; comprobar modo/sesion antes de aplicar respuestas tardias. El servidor sigue siendo la autoridad de identidad y unicidad mediante POST y clave (user_id, id).

Alternativa: usar edit sin modificar la semantica de guardado puede producir PUT ajeno; usar create sin nuevo modo habilita ID y estado y arranca consulta innecesaria. Un modo adicional mantiene las fronteras explicitas sin otro formulario.

### 6. Elegibilidad sobre catalogo completo y estado confirmado

Construir la presencia por IDs canonicos desde `catalogCache`, nunca desde filas visibles. Mostrar la accion solo para filas ajenas cuando `hasLoadedFullCatalog` es verdadero. Comprobar de nuevo al activar y enviar. Recalcular elegibilidad tras carga/revalidacion, alta, eliminacion y cambios de sesion, conservando el acordeon abierto al actualizar botones.

Tras POST confirmado, reutilizar `upsertCached`, filtros y revalidacion, y retirar inmediatamente todas las acciones del mismo ID en ambos grupos y todas las filas. Ante 409, conservar el tratamiento de error y revalidar el catalogo para reconciliar la presencia sin inventar un registro. Ante otros errores no actualizar cache ni ocultar acciones como si se hubiera guardado. Los duplicados entre pestañas los resuelve la unicidad del servidor.

Alternativa: deducir presencia de la tabla falla con filtros; solicitar el catalogo por tarjeta multiplica peticiones. La cache completa existente permite comprobaciones locales y el servidor resuelve carreras.

### 7. Indicadores requeridos consistentes

Aplicar el rojo del sistema a los pseudo-elementos de `.required-label`, manteniendo su ocultacion en view-mode. Revisar los formularios existentes por asteriscos literales visibles; representarlos con un elemento de indicador comun solo donde sea necesario. No colorear etiquetas enteras ni modificar validacion o campos opcionales.

Alternativa: colorear el label completo cambia la jerarquia visual. Un indicador especifico mantiene el alcance solicitado.

### 8. Catalogo privado y calculo SQL unico de DNA

Crear `public.dna_ponderaciones` con ID de logro unico, cuatro pesos enteros entre 0 y 100 y una restriccion: los logros de coleccion suman 100; solo `someone-liked-your-collection` admite los cuatro ceros. Sembrar idempotentemente las 19 filas exactas de la tabla del delta de interfaz. Activar RLS sin politicas de cliente y revocar todos los privilegios para public, anon y authenticated. Los pesos no se mezclan con OBJETIVOS, `gamificacion.logros`, JSON locales, ni respuestas de logros. El acceso administrativo de despliegue no requiere una clave de servicio en la app.

Agregar un helper SQL privado, sin permisos de ejecucion para roles cliente, que recibe un usuario y une `jsonb_array_elements(gamificacion.logros)` por ID al catalogo de pesos. Tratar ausencia de fila o lista vacia como contribuciones cero; ignorar cantidades no positivas y exigir cantidades validas en los contratos de persistencia existentes. Los IDs desconocidos no contribuyen; los tests exigen cobertura de todos los objetivos vigentes para no ocultar olvidos. Los logros futuros requieren agregar sus pesos antes de su activacion DNA.

Para cada caracter k: `S_k = SUM(cantidad * peso_k)`, `T = SUM(S_k)` y `P_k = 100 * S_k / T`, usando numeric para evitar division entera y desbordamiento en productos. Excluir regalos tambien del denominador por tener suma de pesos cero. Con T cero devolver cuatro ceros y Newbie. Elegir el principal sobre S_k exactos con prioridad Explorer, Collector, Fan, Rarity Hunter, nunca sobre porcentajes redondeados. No ponderar por bricks o total. Redondear solo para texto de leyenda; la tarta usa proporciones sin redondeo de presentacion.

Alternativas: persistir DNA obliga a backfill y sincronizacion de cada cambio; calcularlo en app.js filtra los pesos. Una tabla privada y un helper compartido permiten actualizar datos historicos desde la primera lectura y mantener ambos consumidores consistentes. La matriz no se entrega al cliente, pero no se promete secreto matematico contra inferencia a partir de los agregados propios y cantidades conocidas.

### 9. Consulta propia fresca y proyeccion publica minima

Exponer `gamificacion_dna()` sin parametro de usuario como RPC estable de solo lectura, security definer con search_path fijo y usuario obtenido exclusivamente de auth.uid(). Rechazar falta de sesion; devolver `{ principal, porcentajes: { rarityHunter, explorer, collector, fan } }` desde el helper. Revocar public/anon y conceder EXECUTE solo a authenticated. No hacer escrituras ni recalcular logros al leer DNA.

Agregar `GET /gamificacion/dna` protegida en `src/server.js` y un metodo `dna()` de `GamificacionRepository` que llama siempre a la RPC, sin usar la promesa initialization. Validar y proyectar exclusivamente principal y cuatro proporciones; 401 sigue autenticacion existente y 500 usa `DNA_NO_DISPONIBLE`, sin detalles internos. Mantener `GET /gamificacion`, respuestas de mutaciones y persistencia sin matriz ni propiedades DNA en cada logro. No enviar cantidades o puntajes intermedios mediante la nueva ruta.

Ampliar `ranking_global()` con una columna `dna_principal`, calculada desde el helper solo para los diez usuarios seleccionados. `RankingRepository.list()` la proyecta como `dnaPrincipal`; no devuelve el objeto agregado del helper. `ranking_logros()` conserva su lista permitida y no incluye DNA. Como cambia RETURNS TABLE, no basta CREATE OR REPLACE: recrear `ranking_global()` dentro de una transaccion de migracion, restableciendo grants y conservando columnas, orden y limites previos. Revisar dependencias SQL antes de eliminar la firma; no usar CASCADE. Mantener RLS de gamificacion y minifiguras intacta.

Alternativa: incluir proporciones en ranking publicaria datos innecesarios; una RPC propia con parametro arbitrario ampliaria la frontera de privacidad. La ruta separada permite que un fallo DNA no sustituya nivel y Bricks por un error ni finja Newbie.

### 10. Estado propio, refrescos y modal independiente

Agregar estado DNA propio por sesion separado de ownGamification, achievementsTargetId y datos del ranking. Tras loadGamification satisfactorio consultar DNA para que la inicializacion/recalculo previo de logros ya se haya completado. Integrar ese refresco en el flujo existente de revalidacion tras altas, ediciones, eliminaciones, cambios de estado y sincronizaciones. Consultar otra vez al abrir el modal; secuenciar por sesion y peticion para que una respuesta mas antigua no sobrescriba otra nueva. Limpiar al logout; no reutilizar datos ajenos ni almacenar DNA en localStorage. Una mutacion fallida no cambia el DNA local como si hubiera sido confirmada.

Bajo nivel/nombre, colocar un boton independiente con emoji DNA y nombre accesible/tooltip DNA junto a texto del principal, reutilizando estilo del control Ranking. No anidar ese boton en `#gamification-level`. En `.summary-achievements-row`, dejar Ver Logros y DNA en mitades flex iguales con min-width: 0 y colocar el acceso existente Ranking Global en otra fila. En ranking anadir un span de texto no enfocable para dnaPrincipal, sin listener de DNA; conservar la expansion de la fila y los botones independientes.

Usar un dialogo DNA propio con las clases visuales de modal y grafica `conic-gradient`, sin nueva dependencia. Fijar aspect-ratio 1 y dimensiones responsive, con colores corporativos amarillo, rojo, azul y verde tomados de los estilos existentes o tokens dedicados cuando falte alguno. Orden de sectores/leyenda: Rarity Hunter, Explorer, Collector, Fan. Usar acumulados de proporciones validadas y limitar solo errores numericos marginales; no construir un sector completo para T cero. La leyenda muestra descripciones del delta y porcentajes agregados propios como alternativa textual accesible a la imagen CSS, sin pesos por logro.

Mantener estados carga/error/reintento y Newbie separados, cierre por boton y Escape, foco al disparador y actualizacion del modal abierto cuando llega un DNA propio mas reciente. Cerrar invalida las respuestas de apertura y cambio de sesion limpia ambos accesos. No alterar el modal de logros ajenos aunque siga abierto durante un refresco propio. Verificar escritorio/movil y apilado si otro dialogo esta abierto.

Alternativas: un grafico externo es innecesario para cuatro sectores; reutilizar el modal de logros mezclaria sus objetivos y estados. Conic-gradient y un dialogo pequeno independiente preservan la linea grafica y la separacion ya introducida por este cambio.

## Risks / Trade-offs

- [RPC security definer permite una lectura transversal] -> Lista permitida, comprobacion de sesion y Top 10 dentro de SQL, permisos de ejecucion restringidos y tests negativos; no abrir RLS privada.
- [JSDOM no ejecuta SQL ni reproduce completamente dialogos nativos] -> Tests con mock verifican contratos; inspeccionar grants/SQL y realizar comprobacion SQL controlada en entorno de pruebas durante despliegue. Verificacion de foco y layout en navegador real.
- [Usuario abandona Top 10 entre apertura y consulta] -> 404 controlado con mensaje, sin conservar logros previos ni ampliar la visibilidad fuera del ranking.
- [Metadatos de destacados antiguos incompletos] -> Fallback individual, Guardar bloqueado hasta tener datos validos y ningun relleno manual de campos oficiales.
- [Respuesta tardia o refresco propio sobrescribe modal ajeno] -> Objetivo y secuencia por sesion, invalidacion al cerrar/logout y renderizadores separados.
- [Re-render elimina el disparador o colapsa el ranking] -> Actualizar elegibilidad conservando acordeon y destino alternativo de foco por fila.
- [Estado restrictivo queda tras cerrar alta rapida] -> Reinicializacion por modo y pruebas de transicion a alta ordinaria, edit y view.
- [Dependencia lego-12 aun no sincronizada] -> Mantener esta propuesta aditiva y registrar esa base para su archivo futuro, sin alterarla ahora.
- [Filtracion de pesos por tablas, helpers o recursos] -> Revocar lectura/escritura/ejecucion directa, fijar permisos y search_path, proyectar campos permitidos y verificar SQL real ademas de ausencia de matriz en API y recursos estaticos. Los agregados no garantizan resistencia a inferencia matematica.
- [Cambio de firma de ranking_global] -> Migracion transaccional sin CASCADE, revisar dependencias y restablecer grants; probar reejecucion y compatibilidad del resto de columnas con PGlite.
- [DNA servido desde estado memorizado o respuesta obsoleta] -> RPC fresca por consulta y secuencia por sesion; pruebas con persistencia modificada entre lecturas y carreras de solicitudes.
- [Regalos diluyen personalidad o redondeo cambia ganador] -> Regalos excluidos del denominador y desempates sobre sumas exactas; tests de solo regalos, empates parciales y proporciones casi iguales.
- [Pesos desactualizados respecto a objetivos] -> Test de cobertura de los 18 objetivos y excepcion de regalos; nuevos objetivos no se habilitan para DNA sin pesos validos.

## Migration Plan

1. Implementar y validar con el mock de Supabase; ampliar README con ruta publica, limites de datos y pasos SQL.
2. Aplicar la actualizacion de `supabase/schema.sql` en un entorno de prueba y despues en el Supabase destino: nueva RPC de lectura y metadatos JSON, sin reescribir filas ni modificar politicas existentes.
3. Verificar que usuarios autenticados pueden consultar solo la proyeccion autorizada, anon/public no pueden ejecutar la RPC y las tablas siguen aisladas. Esta prueba SQL real no queda sustituida por el mock.
4. Desplegar backend y luego frontend. La ampliacion JSON mantiene clientes anteriores; frontend nuevo requiere la nueva ruta. Ejecutar pruebas focalizadas y la suite completa, ademas de comprobar escritorio/movil.
5. Rollback: restaurar frontend/backend anteriores y definicion previa de `ranking_global`; revocar y eliminar la RPC nueva si no tiene consumidores. Las buscadas creadas son registros normales propios y se conservan.

### Ampliacion DNA pendiente

1. Implementar los bloques DNA con el mock existente y PGlite; verificar matriz, formula, permisos, proyecciones, retroactividad y reejecucion del esquema. No desmarcar las tareas anteriores ni interpretar su verificacion historica como evidencia DNA.
2. Documentar en README la ruta propia, datos agregados, exclusion de regalos y despliegue. No publicar la matriz en documentacion servida al cliente ni utilizar el JSON local como migracion de usuarios.
3. Aplicar transaccionalmente tabla, pesos, helper, RPC y nueva firma de ranking_global en un Supabase de pruebas autorizado, preferentemente miniPeopleDB_prueba. Verificar cuentas y logros existentes, incluidos los usuarios sinteticos, sin volver a insertar figuras ni recalcular sus logros para forzar DNA.
4. Ejecutar controles como anon y authenticated: pesos/helper inaccesibles, RPC limitada a auth.uid(), ranking solo nombre principal, RLS privada vigente y consultas sin escrituras. Registrar resultados; la tarea 5.4 sigue pendiente y el despliegue queda bloqueado sin entorno autorizado.
5. Aplicar la misma migracion idempotente en produccion autorizada despues de validar pruebas, y desplegar backend y frontend en ese orden. Leer DNA de cuentas historicas con y sin logros; ausencia de nuevas altas demuestra retroactividad. Las sumas se calculan al consultar, sin columna porcentual ni backfill.
6. Rollback DNA: restaurar frontend/backend y la firma/grants anteriores de ranking_global en transaccion; revocar/eliminar gamificacion_dna y el helper si no tienen consumidores. Retirar la tabla de pesos solo despues de comprobar dependencias. Conservar sin cambios los logros, Bricks, regalos y minifiguras.