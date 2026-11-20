# Design

## Context

Ver [proposal.md](proposal.md) para motivacion y alcance.

- La web usa HTML estatico y un script clasico extenso, `public/app.js`, sin framework ni compilacion web obligatoria. Los textos estan tanto en HTML como en renderizadores, errores y templates JavaScript.
- `#profile-language` ya ofrece `es`, `en`, `it` y `fr`; solo `es` esta habilitado. El formulario envia `language` a `PUT /api/profile` y recupera ese valor al abrirse.
- `src/user-profile-repository.js` valida exclusivamente `es`, y `supabase/schema.sql` contiene `user_profiles_language_check`, tambien restringida a `es`. `guardar_perfil_usuario` es una RPC `SECURITY INVOKER`, transaccional y ligada al usuario autenticado; no hace falta crear otra RPC.
- `test-support/supabase-mock.js` replica la restriccion de espanol. `test/auth-web.test.js` verifica actualmente que ingles esta deshabilitado. `test/supabase.test.js` ya tiene infraestructura PGlite para perfil y rollback.
- `interfaceText` sustituye terminologia espanola al renderizar, incluso sobre nombres y descripciones de logros; no es un sistema de traduccion. Las filas de logros contienen identificador estable, nombre y descripcion.
- Hay formatos `es-ES` y ordenaciones con locale fijo en la interfaz. Otros formateadores extraen partes de fecha para calculos internos: no todos los locales fijos deben cambiarse.
- Las notificaciones ofrecen tipos y datos estructurados, pero algunas vistas consumen directamente `data.message` en espanol. Las descripciones de logros proceden del servidor.
- Express sirve dependencias locales mediante rutas `/vendor/`. El empaquetado Android copia `public` y determinadas dependencias a `dist/android`. Las paginas propias de confirmacion de email tienen scripts independientes y validaciones estrictas de URL.

## Goals / Non-Goals

**Goals:**

- Anadir internacionalizacion compartida sin migrar de framework ni reescribir los renderizadores.
- Mantener separado el contenido original de los textos de presentacion, con contratos de API y gamificacion invariantes.
- Aprovechar el selector, el guardado atomico del perfil y los mecanismos existentes de aislamiento de sesion.
- Detectar catalogos incompletos y errores de recursos antes de dar el cambio por correcto.

**Non-Goals:**

- No construir un CMS de traducciones, introducir traduccion automatica, duplicar tablas de datos por idioma ni traducir mediante busqueda/reemplazo global.
- No habilitar nuevas monedas, deteccion automatica por navegador, selector publico adicional, cambios de autenticacion ni traducciones de servicios externos.
- No localizar los nombres de logros ni los datos Brickset. Las descripciones de logros SI forman parte del catalogo traducible.

## Decisions

### 1. i18next con catalogos JSON locales y claves semanticas

Usar i18next como unica dependencia nueva y catalogos `public/locales/es.json` y `public/locales/en.json`. Un pequeno adaptador compartido, por ejemplo `public/i18n.js`, expondra inicializacion, traduccion, idioma activo y formateadores `Intl`. No anadir plugins de deteccion ni backends externos: las dos rutas JSON son conocidas y pueden cargarse con el `fetch` existente.

Usar claves por dominio (`auth`, `profile`, `inventory`, `notifications`, `achievements`), parametros nombrados y frases completas, con las formas plurales soportadas por i18next. Las descripciones se identifican por ID de logro. Los nombres de logros nunca se pasan por traduccion ni por sustitucion terminologica.

En ES se conserva minipersona/minipersonas; como convencion inicial de producto EN se usa miniperson/minipeople, manteniendo MiniPeopleDB y Bricks como nombres. Esta convencion se recoge explicitamente en el delta de interfaz para que sea revisable antes de implementar.

Alternativas descartadas:
- `.properties`: reproduce la idea de catalogo, pero requiere un parser adicional en esta app JavaScript.
- Diccionario casero con ternarios: parece menor al inicio, pero obliga a mantener plurales, interpolacion y diagnosticos propios.
- React u otro framework: no aporta valor proporcional al alcance.

### 2. Recursos locales y arranque coordinado

Servir el bundle de navegador de i18next desde una ruta `/vendor/` siguiendo el patron de Supabase y Chart.js, y copiarlo tambien al paquete Android. Los JSON y el adaptador se copian con `public`. Cargar libreria y adaptador antes de los scripts consumidores en la pagina principal y en ambas confirmaciones.

Inicializar el idioma y sus recursos antes del primer renderizado normal de la aplicacion; mantener el HTML base espanol como pantalla de arranque legible. Cargar el catalogo espanol como respaldo y disponer del ingles antes de confirmar un guardado con `en`. Compartir una promesa de preparacion para impedir carreras, sin introducir una compilacion web nueva ni bloquear indefinidamente el arranque.

Ante recursos ausentes, rechazar explicitamente la inicializacion/cambio, mostrar el error de recursos en el idioma disponible y ofrecer reintento. Si no hay catalogo cargado, mantener un mensaje base espanol de recuperacion en HTML. No fingir exito ni cambiar el perfil para ocultar el error. La ausencia puntual de una clave sigue el respaldo ES y un diagnostico; es distinta de un fallo de carga de todo el catalogo.

### 3. Perfil como autoridad y cambio tras guardar

Resolver el idioma siguiendo este ciclo:

```text
Inicio sin perfil --> ultimo idioma confirmado local o es
Perfil activo leido --> language del perfil prevalece
Formulario editado --> aun no cambia el idioma global
Guardado correcto --> aplicar language + recordar solo es/en
Cerrar o fallo --> conservar idioma confirmado anterior
```

La preferencia local solo contiene `es` o `en`, nunca usuario ni tokens. Se permite conservarla al cerrar sesion para traducir acceso, contacto y confirmaciones en el mismo dispositivo. Un nuevo perfil sigue empezando con `es`, como hasta ahora; no se convierte automaticamente en ingles por el idioma del dispositivo o de otra cuenta. Las paginas de confirmacion leen esa preferencia local sin agregar parametros a URLs sensibles; otro dispositivo sin preferencia usa espanol.

Aplicar el idioma despues del exito de `PUT /api/profile` y antes de reabrir el inventario tras onboarding. En la lectura del perfil aplicar su idioma antes de renderizar datos privados. Reutilizar contadores de peticiones y comprobaciones de usuario activo para descartar respuestas obsoletas, tambien si una carga de traducciones termina despues de cambiar de cuenta.

Si falla `localStorage`, registrar un diagnostico acotado y continuar con el idioma del perfil en memoria; no comunicar un fallo de persistencia del perfil cuando ese guardado si tuvo exito.

Alternativa descartada: cambiar globalmente con el evento `change` del selector. Exigiria previsualizacion y rollback al cancelar que el guardado existente no ofrece y no son necesarios para este alcance.

### 4. Localizar los puntos de renderizado, no el DOM completo

Marcar solo nodos propios estaticos traducibles y atributos concretos, y reemplazar literales dinamicos en sus renderizadores por llamadas al adaptador. No traducir por valor textual ni usar observadores que recorran y sustituyan todo el DOM.

Al cambiar idioma actualizar nodos estaticos, estados visibles propios y componentes dinamicos desde su estado en memoria: filtros/opciones, tablas, contadores, modales, rankings, notificaciones y graficos. Conservar inputs, selecciones, paginacion, ordenacion, elementos expandidos y foco conforme al flujo existente. No recargar la pagina, volver a descargar el catalogo de figuras ni reconstruir todo el formulario para traducir.

Actualizar `document.documentElement.lang`. Usar `textContent` y atributos de texto para datos y traducciones; si una notificacion requiere enfasis o iconos, componer nodos/slots de forma segura sin concatenar HTML con parametros.

El requisito nuevo de internacionalizacion establece que los literales ES de otras specs son la presentacion espanola, no una prohibicion de sus equivalentes ingleses. Los deltas de interfaz actualizan expresamente los requisitos que fijaban terminologia, idioma accesible y formatos de filtro.

### 5. Separar mensajes propios, identificadores y datos externos

- Traducir errores por codigos de API; mantener sin cambios codigos, contratos HTTP y la politica de errores genericos de autenticacion.
- Traducir avisos por `notification.type` y sus campos disponibles, incluyendo los historicos. No leer la frase espanola para determinar el significado ni migrar el historial. Si faltan campos para una frase especifica, usar la variante generica del mismo tipo sin inventar posicion, autor o importe.
- Traducir descripciones de logros mediante su ID estable en vistas propias, publicas y destacados; conservar literalmente `nombre`, incluso en toasts.
- Traducir etiquetas de estados, rasgos, niveles y otros conceptos propios mediante identificadores estables disponibles; no mutar enums, payloads o nombres persistidos.
- Retirar el uso de `interfaceText` sobre contenido externo y nombres de logros; la terminologia de textos propios queda en los catalogos. Si aun hace falta compatibilidad transitoria de mensajes, limitarla a mensajes propios y no usarla como mecanismo de traduccion.
- Un codigo/tipo/ID de descripcion desconocido usa texto generico localizado y diagnostico sin contenido sensible; nunca se interpreta el texto recibido como una clave arbitraria.

### 6. Formatos `Intl` solo para presentacion

Mapear `es` a `es-ES` y `en` a `en-GB`. Centralizar la creacion de formateadores para numeros, fechas y moneda, preservando precision, EUR, zona temporal y semantica de cada vista. Revisar cada locale fijo antes de reemplazarlo: los extractores que calculan claves de dia o semana mantienen su semantica y no dependen del idioma visual.

El idioma cambia los separadores, no el formato de los valores HTML `date`/`number`, ni el formato de las peticiones, las magnitudes o el dominio de busqueda. Ordenar texto visible con el locale activo, sin cambiar comparaciones numericas o normalizacion de filtros.

### 7. Ampliar la validacion existente, sin nuevos privilegios

Permitir exactamente `es`/`en` en el repositorio de perfil y en el mock compartido. Actualizar la restriccion del esquema base y anadir una migracion SQL incremental y transaccional que sustituya solo `user_profiles_language_check`, conservando `default 'es'`, `NOT NULL`, el contenido existente, RLS y grants.

La RPC `guardar_perfil_usuario` conserva firma, `SECURITY INVOKER`, comprobacion de `auth.uid()`/rol y atomicidad. Verificarla con PGlite al guardar ambos idiomas y al rechazar idiomas invalidos. No introducir `service_role`, acceso global ni preferencias en proyecciones publicas.

### 8. Verificacion enfocada y criterios de cierre

- Catalogos: paridad de claves semanticas, formas plurales, parametros y cobertura de IDs de logros; validar que no hay claves expuestas ni interpolacion insegura. No basta con comprobar que existe un archivo ingles.
- Node/JSDOM: carga en ambos idiomas, guardado ES/EN, recarga, cancelacion/fallo, cambio de cuenta con respuestas pendientes, storage no disponible y fallo/reintento de recursos.
- Cobertura representativa de cada area listada en la spec, incluidos mensajes dinamicos, errores, accesibilidad, graficos y confirmaciones; reutilizar los tests y helpers existentes, no duplicar suites enteras.
- Comparar los mismos registros Brickset y nombres de logros antes/despues, junto con descripciones que SI cambian y objetos fuente que permanecen iguales.
- API con `test-support/supabase-mock.js`: guardar y leer `en`, rechazar valores no soportados y no admitir cambios de username/moneda por esta ampliacion.
- PGlite: esquema nuevo, migracion sobre esquema previo y reejecucion, conservacion de perfiles ES, RPC con JWT de dos usuarios, permisos, RLS y rollback atomico ante fallo de favoritas o idioma invalido.
- Recursos: probar con Express que vendor/catalogos estan disponibles y comprobar su presencia y rutas en el resultado de `npm run android:web`.
- Validar manualmente en navegador ambos idiomas, escritorio y smartphone, especialmente Preferencias, rankings, modales, tooltips y textos largos. JSDOM no acredita medidas visuales.

## Risks / Trade-offs

- [Textos repartidos en un script grande] -> Migrar por areas y mantener una matriz de cobertura de pantallas/estados en los tests; comprobar tambien errores y contenidos creados tras la carga inicial.
- [Descripciones nuevas de logros sin traducir] -> Test que contrasta los IDs del catalogo real contra ES/EN y falla cuando falta alguno.
- [Mensajes historicos almacenados en espanol] -> Derivar la presentacion de tipos/campos; no reescribir avisos ni parsear frases.
- [Estado perdido al volver a renderizar] -> Actualizacion acotada y tests con filtros, modal y cuenta cambiados durante respuestas pendientes.
- [Recursos no cargados tras guardar ingles] -> Preparar los recursos antes de permitir completar ese guardado, con fallo visible y reintento.
- [Cliente nuevo antes de migrar DB] -> Desplegar primero la migracion compatible hacia atras.
- [Rollback a cliente antiguo con perfiles EN] -> No desplegar un backend antiguo que solo acepte ES mientras existan perfiles EN; deshabilitar temporalmente el selector manteniendo soporte de lectura/guardado ES/EN.
- [Catalogos editados con sintaxis insegura o placeholders incompatibles] -> Pruebas de parseo, parametros y renderizado de texto, sin `innerHTML` con interpolacion.

## Migration Plan

1. Implementar y probar la migracion incremental junto al esquema base, sin actualizar masivamente perfiles.
2. Aplicar primero la migracion de la restriccion. El frontend anterior sigue enviando `es` y permanece compatible.
3. Desplegar backend que acepte ES/EN y los recursos web completos; publicar el paquete Android con catalogos y libreria incluidos.
4. Verificar guardar `en`, recargar, volver a `es` y consultar otra cuenta sin mezcla de idiomas; comprobar exclusiones y fallos de guardado.
5. Si es necesario retirar la funcionalidad, deshabilitar la seleccion de ingles manteniendo la validacion ampliada y los perfiles existentes. No estrechar la restriccion a ES con perfiles EN presentes ni cambiar su preferencia de forma silenciosa. Una eventual retirada total y conversion de preferencias requiere una decision separada.
