# Tasks

## 1. Catalogos y recursos de internacionalizacion

- [x] 1.1 Incorporar i18next a las dependencias y servir su bundle local desde Express siguiendo las rutas vendor existentes; verificar con un test HTTP que la libreria se entrega correctamente sin CDN.
- [x] 1.2 Crear el adaptador compartido y los catalogos JSON ES/EN con claves semanticas, parametros nombrados y plurales; verificar singular/plural para 0, 1 y varios, paridad de claves/parametros y renderizado de valores externos como texto seguro mediante tests Node.
- [x] 1.3 Implementar respaldo ES, diagnostico de claves ausentes y mensaje generico cuando falten ambas traducciones; verificar que nunca aparecen claves tecnicas en pantalla y que los diagnosticos no contienen parametros privados.
- [x] 1.4 Integrar inicializacion asincrona con el arranque existente, recursos preparados antes de aplicar/guardar un nuevo idioma, y error visible con reintento; verificar carga correcta, catalogo ausente, JSON invalido, peticion fallida y recuperacion sin falso exito mediante tests de navegador simulado.

## 2. Persistencia y validacion del perfil

- [x] 2.1 Ampliar a `es`/`en` la restriccion de `supabase/schema.sql` y crear una migracion SQL incremental transaccional y reejecutable que preserve default ES, NOT NULL, perfiles, RLS y grants; verificar en PGlite esquema nuevo, migracion del esquema anterior y segunda ejecucion.
- [x] 2.2 Permitir exclusivamente ES/EN en `src/user-profile-repository.js` y en `test-support/supabase-mock.js`; ampliar `test/profile-api.test.js` usando ese mock para verificar lectura/guardado de ingles, continuidad de espanol y rechazo de idiomas invalidos sin cambios parciales ni nuevas monedas.
- [x] 2.3 Ampliar las pruebas PGlite de `guardar_perfil_usuario` en `test/supabase.test.js` para cubrir ambos idiomas, idioma nulo/no soportado, rollback de preferencias/favoritas, aislamiento entre dos JWT y permisos anon/authenticated; verificar que no cambian la firma, `SECURITY INVOKER`, username inmutable ni la proyeccion publica.

## 3. Selector y ciclo de vida del idioma

- [x] 3.1 Habilitar `en` en `#profile-language` de onboarding y Preferencias y localizar las etiquetas del selector; actualizar `test/auth-web.test.js` para verificar ES/EN activos, IT/FR y USD deshabilitados y ausencia de un segundo selector.
- [x] 3.2 Implementar resolucion de idioma desde perfil activo, ultimo idioma confirmado local y ES inicial, sin deteccion de navegador; verificar primera visita, perfil nuevo, recarga y perfil EN en otro dispositivo con tests JSDOM.
- [x] 3.3 Aplicar el idioma global solo despues del guardado correcto del perfil y recordar unicamente el codigo localmente; verificar que cancelar/fallar conserva idioma confirmado y valores del formulario y que el fallo de storage se diagnostica sin invalidar un guardado correcto.
- [x] 3.4 Integrar las guardas de sesion con la lectura de perfil y las cargas de idioma pendientes; verificar con respuestas diferidas que una cuenta ES no recibe preferencias o renderizados tardios de una cuenta EN anterior.

## 4. Traduccion de las pantallas y mensajes propios

- [x] 4.1 Extraer a catalogos los textos de acceso, registro, recuperacion/cambio de contrasena, onboarding, preferencias, eliminacion de cuenta y contacto; verificar estados normales, validaciones y fallos en ES/EN en las suites de autenticacion y contacto, preservando errores genericos y comportamiento existente.
- [x] 4.2 Localizar inventario, alta individual/por set, consulta, edicion, eliminacion, observacion, filtros, tabla, paginacion, contadores y sincronizacion Brickset; verificar en las suites web y de filtros etiquetas y mensajes ES/EN, mismos resultados/valores canonicos y ausencia de nuevas peticiones de catalogo al traducir.
- [x] 4.3 Localizar rankings global/semanal, regalos, amigos, solicitudes, perfiles propios/ajenos y DNA; ampliar casos en las suites sociales/ranking/gamificacion para verificar encabezados, acciones, estados vacios/error y contenido creado tras cambiar idioma.
- [x] 4.4 Catalogar las descripciones de todos los logros por ID y localizar sus vistas propias, publicas y destacadas manteniendo nombres originales y datos fuente; verificar cobertura contra el catalogo real y casos ES/EN de descripcion traducida, nombre inalterado, toasts y Bricks sin cambios.
- [x] 4.5 Localizar bandeja de notificaciones, avisos historicos, resumen diario, toasts y errores de API a partir de tipos/codigos y datos estructurados; verificar mensajes ES/EN, variantes genericas diagnosticadas para desconocidos o datos insuficientes y preservacion de autores, lectura, fechas, importes y acciones.
- [x] 4.6 Actualizar textos propios estaticos y atributos accesibles de forma selectiva y retirar sustituciones terminologicas sobre nombres de logros y contenido Brickset; verificar `lang`, `aria-label`, `title`, alternativas de imagen, foco y parametros seguros sin sustitucion global ni mutacion de objetos.

## 5. Formatos, actualizacion en vivo y paginas auxiliares

- [x] 5.1 Centralizar formatos visibles con `Intl` ES/EN e integrar historico, graficos, tooltips, filtros y ordenacion textual; verificar `53 de 500 (10,6%)` frente a `53 of 500 (10.6%)`, EUR sin conversion y fechas/limites semanales invariantes en las suites web/analitica/ranking.
- [x] 5.2 Actualizar las vistas ya cargadas al confirmar idioma, sin recarga de pagina ni perdida de filtros, inputs, paginacion, expansion o foco; verificar cambios ES -> EN -> ES con estado activo y comparacion exacta de datos Brickset y nombres de logros.
- [x] 5.3 Integrar el adaptador en las paginas propias de confirmacion de email web y Android; verificar mensajes de carga/exito/fallo en ambos idiomas y que siguen rechazandose parametros adicionales, sin alterar limpieza de URL, tokens ni handoff.
- [x] 5.4 Incluir libreria y catalogos en `scripts/build-android-web.js` y comprobar las rutas locales de Capacitor; ejecutar `npm run android:web` y verificar recursos generados y orden de carga, con una prueba automatizada del empaquetado.

## 6. Documentacion y validacion integrada

- [x] 6.1 Actualizar README y la documentacion existente de despliegue/Android con idiomas disponibles, selector, momento de aplicacion, exclusiones, catalogos y migracion previa del perfil; verificar que las instrucciones coinciden con los comandos y recursos implementados.
- [x] 6.2 Ejecutar una seleccion conjunta de tests Node que cubra internacionalizacion, perfil API/PGlite, autenticacion, inventario/filtros, gamificacion, ranking/social, notificaciones, analitica y confirmacion Android afectadas; verificar cobertura representativa de cada area y todos los escenarios nuevos, ampliando a `npm test` solo si los resultados indican riesgo de regresion transversal.
- [ ] 6.3 Validar ambos idiomas en navegador de escritorio y viewport smartphone, incluyendo Preferencias, rankings, logros, errores, texto largo y tooltips; verificar visualmente ausencia de solapamiento/recorte y funcionamiento de teclado, foco y retorno de los modales.
- [x] 6.4 Ejecutar `openspec validate add-interface-english --strict` y contrastar el resultado implementado con cada requisito/escenario del cambio; verificar que no quedan claves ausentes, areas sin traducir fuera de exclusiones ni tareas marcadas sin evidencia.

## Evidencia y cierre pendiente

- Seleccion integrada de 18 archivos: 365 pruebas, 362 correctas y tres fallos preexistentes reproducidos con los recursos de `HEAD` (`a985b8c`): orden de segmentos DNA y dos aserciones de selectores CSS en `design-system.test.js`. No se han modificado esos comportamientos ajenos al cambio ni se presenta la suite como completamente verde.
- Los tests de catalogos verifican paridad de claves y parametros, plurales y las descripciones de los 115 logros vigentes. Los tests de perfil y migracion usan el mock compartido y PGlite. La prueba de recursos construye y comprueba el paquete Android real.
- `npm run android:web` y `openspec validate add-interface-english --strict` ejecutados correctamente.
- Navegador con backend sintetico, escritorio 1440x1000 y smartphone 375x812: Preferencias ES/EN, guardado, formatos, filtros conservados, rankings, logros con nombres largos, DNA, tooltips y fallo HTTP con reintento. Se corrigieron desbordamientos de botones y encabezado de Logros y la sustitucion incorrecta de un error DNA por datos anteriores al cambiar idioma.
- La tarea 6.3 permanece abierta: las capturas y los eventos de entrada del navegador integrado dejaron de reflejar consistentemente el DOM. Falta completar la comprobacion visual final y el recorrido con teclado nativo; las pruebas automatizadas de foco, Escape y retorno de modales pasan, pero no sustituyen esa comprobacion.
- No se ha aplicado SQL remoto, desplegado ni archivado el cambio. Aplicar `supabase/interface-languages.sql` antes de desplegar.
