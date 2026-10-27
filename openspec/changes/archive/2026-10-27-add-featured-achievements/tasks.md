# Tasks

## 1. Persistencia y permisos

- [x] 1.1 Crear migracion incremental y actualizar `supabase/schema.sql` con tabla de destacados, clave por usuario/ID, cascada de cuenta, RLS propia y revocacion de DML directo; verificar con PGlite que cuentas existentes parten sin estrellas y que `anon` y otra cuenta no pueden leer o escribir la seleccion.
- [x] 1.2 Implementar RPC autenticada idempotente para establecer el estado de un ID propio, bloquear primero la fila de gamificacion y validar obtencion y cupo; verificar con PGlite regalos, cantidades repetidas, cinco IDs, sexto rechazado, duplicados, desmarcado repetido, IDs invalidos y ausencia de selector de cuenta.
- [x] 1.3 Incorporar trigger transaccional de limpieza al cambiar logros vigentes sin tocar recompensas; verificar con PGlite perdida/recuperacion sin restauracion de estrella, cantidad veinte a uno conservada y rollback conjunto ante fallo.
- [x] 1.4 Cubrir las carreras del ultimo hueco y seleccion contra perdida con pruebas de transacciones y bloqueos; demostrar que nunca quedan seis estrellas ni IDs ausentes, usando PostgreSQL de pruebas con dos conexiones si PGlite no permite demostrar concurrencia real y dejando explicita cualquier limitacion no verificada.
- [x] 1.5 Anadir proyeccion propia coherente de estado e IDs y extender las RPC `ranking_logros` y `amigos_perfil` con indicador publico, orden comun y limite de cinco en el perfil; verificar en PGlite tipo ausente, regalos, empate estable, destacado originalmente fuera del Top 5, acceso semanal conservado y ausencia de escrituras durante lecturas publicas.

## 2. API y repositorios

- [x] 2.1 Incorporar al repositorio de gamificacion el guardado por RPC y la lectura de `logrosDestacados` sin persistir estrellas dentro del JSON calculado; ampliar `test-support/supabase-mock.js` y `test/gamificacion-repository.test.js` para verificar contratos y conservacion de recompensas.
- [x] 2.2 Anadir `PUT /gamificacion/logros/:logroId/destacado`, su contexto por JWT y la proteccion expresa en `protectedPath`; ampliar `test/gamificacion-api.test.js` usando el mock compartido para verificar `200`, `400`, `401`, `409`, `500`, cuerpo estricto y rechazo de identidades o campos adicionales sin filtraciones.
- [x] 2.3 Incluir el campo propio en las lecturas/revalidaciones de gamificacion y preservar o refrescar su valor tras respuestas de mutaciones; verificar con tests de API y repositorio que cambios ordinarios de coleccion no borran estrellas validas ni mantienen las de logros perdidos.
- [x] 2.4 Ampliar allowlists de ranking y amigos con `destacado` y `featured` respectivamente, manteniendo sus contratos de acceso y campos privados; verificar en las suites existentes de repositorios y API que se ordena antes del recorte, el perfil devuelve hasta cinco y usa exclusivamente la seleccion del titular.

## 3. Modal y renderizado

- [x] 3.1 Reutilizar un comparador comun para listas con prioridad de destacados, tipo, total y origen; ampliar tests de gamificacion y ranking web con fixtures de empates, regalos, ningun destacado y seleccion distinta entre observador y titular, comprobando que los toasts siguen por Bricks nuevos ascendentes.
- [x] 3.2 Anadir estrella Lucide al final de las filas propias con tooltip, nombre accesible, `aria-pressed`, foco visible y area estable; verificar en `test/gamificacion-web.test.js` acciones por teclado, estados activo/inactivo y ausencia de controles de escritura en vistas ajenas o consultas desde ranking.
- [x] 3.3 Implementar guardado inmediato confirmado y bloqueo de envios duplicados sin cerrar el modal ni anadir Guardar; verificar con respuestas diferidas que no se reordena antes de confirmar, se conserva foco por ID, el sexto muestra `Puedes destacar hasta 5 logros` y un error mantiene estado/orden con reintento.
- [x] 3.4 Integrar secuencias de sesion, vista y peticion para lectura/guardado; verificar en tests web cierre durante guardado, reapertura, lectura anterior que responde despues, cambio de cuenta y apertura ajena sin reapertura ni contaminacion de la vista actual.
- [x] 3.5 Mostrar indicadores de estrella no editables y el orden del titular en perfil y consultas de logros publicos; ampliar `test/friends-web.test.js` y `test/ranking-web.test.js` para verificar cinco resultados, relleno con no destacados, regalo destacado prioritario y separacion respecto a `ownGamification`.

## 4. Dispositivos e integracion

- [x] 4.1 Ampliar solo el maximo de Logros de 600px a 660px para Monitor y Tablet, limitado al viewport, y reservar columna de estrella; ampliar pruebas CSS/DOM existentes para verificar ambas orientaciones de Tablet y ausencia de cambios en otros modales.
- [x] 4.2 Ajustar exclusivamente las filas de Logros en Smartphone sin alterar otros layouts; verificar en tests responsive y navegador real 320px, 390px y landscape tactil con nombres largos, cantidades y Bricks grandes, sin scroll horizontal ni solapamientos y conservando scroll interno y cierre.
- [x] 4.3 Validar visualmente mediante capturas y medidas de navegador Monitor, Smartphone, Tablet portrait y Tablet landscape con cero, cinco y muchos logros; comprobar estrella activa/inactiva/pendiente, indicador publico, foco y legibilidad sin desplazamientos de controles ni cambios en el modal de perfil ajenos al indicador.
- [x] 4.4 Ejecutar las suites focalizadas de gamificacion, amigos y ranking con `npm.cmd test -- <archivos afectados>` y despues `npm.cmd test`; documentar resultados y cualquier fallo preexistente sin corregir asuntos ajenos. Verificar con pruebas de integracion que persistencia, orden y perdida de estrellas funcionan extremo a extremo sin afectar Bricks, DNA ni snapshots.
- [x] 4.5 Documentar en `README.md` el guardado de estrellas y los pasos de despliegue/rollback de la migracion sin aplicarla a remoto; comprobar que las instrucciones corresponden a los artefactos SQL entregados y ejecutar `openspec validate add-featured-achievements --strict` antes de dar por terminada la implementacion.

## Verification

- 2026-10-27: `npm.cmd test`: 474 tests, 473 correctos, cero fallos, uno omitido por requerir `FEATURED_TEST_DATABASE_URL`.
- La prueba omitida en la ejecucion habitual se ejecuto por separado con dos conexiones reales a PostgreSQL 18 portable, cluster local UTF-8 efimero: paso el bloqueo del ultimo hueco y las dos intercalaciones de seleccion/perdida. Se detuvo el proceso y se eliminaron sus datos al terminar, sin usar credenciales del proyecto.
- PGlite valida migracion nueva/reaplicada, RLS con roles no superusuario, cupo, idempotencia, regalos, reduccion/perdida/recuperacion, rollback transaccional, rollback de despliegue y proyeccion SQL propia sin pesos privados.
- Navegador: 1440x1000, 320x740, 390x844, 844x390, 768x1024 y 1024x768; cero, cinco y 24 logros por viewport, nombres sin separadores y cantidades/totales grandes. Sin overflow horizontal ni solapamientos medidos. Capturas revisadas de Monitor, Smartphone y Tablet en ambas orientaciones; caso tactil real 844x390 con `pointer: coarse`.
- Estrella 36x36 antes, durante y despues del guardado; Enter confirma la seleccion, conserva foco por ID y no cierra el modal. Perfil ajeno devuelve cinco logros, muestra solo indicador de su titular y ningun boton de estrella en los cuatro formatos.
- `git diff --check`, diagnosticos del editor y `openspec validate add-featured-achievements --strict`: correctos. No se ha aplicado SQL a ningun proyecto Supabase remoto.