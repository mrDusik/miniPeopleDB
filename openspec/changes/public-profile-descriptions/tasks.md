# Tasks

## 1. Plantilla y reglas de actividad

- [x] 1.1 Implementar un compositor puro y versionado para ambas voces usando solo las señales de la spec; verificar segunda persona, tercera persona neutra, tono de app, omisión de nombres/valores explícitos y límite de longitud con tests unitarios.
- [x] 1.2 Implementar la comparación contra el último snapshot generado y el umbral inicial; verificar casos de primer texto, actividad insuficiente, acumulación de DNA/logros y cada condición de regeneración.

## 2. Persistencia y autorización

- [~] 2.1 Obtener y registrar aprobación explícita del propietario para la allowlist exacta de RPC del worker; verificar que ninguna migración o llamada global se habilita antes de esa aprobación.
- [x] 2.2 Añadir la tabla privada de descripciones/snapshot y RPC allowlisted de reclamar, leer fuentes mínimas y guardar ambas variantes atómicamente; verificar grants, RLS, lease y cascada de cuenta con PGlite.
- [x] 2.3 Probar con PGlite que anon/authenticated no ejecutan RPCs administrativas, service_role no tiene acceso directo a tablas, no se puede seleccionar una identidad fuera del trabajo reclamado y un fallo no deja una variante parcial.

## 3. Job dominical

- [x] 3.1 Implementar repositorio y worker durable, paginado, idempotente, con lease, recuperación y errores por usuario; verificar tests de reintento, trigger duplicado, pérdida de lease y conservación de la descripción anterior.
- [x] 3.2 Añadir el trigger backend autenticado por CRON_SECRET y telemetría sin datos privados; verificar rechazo sin secreto, límites de método y que el job no se inicia dos veces para el mismo periodo.
- [x] 3.3 Documentar y configurar el scheduler externo dominical en el entorno de despliegue (UTC configurable); verificar una ejecución de prueba y su consulta de estado sin exponer secretos.

## 4. API y perfiles web

- [x] 4.1 Añadir la variante propia al contrato DNA y la pública a `amigos_perfil`; verificar tests de API para sesión, ausencia de texto, acceso solo autenticado y no exposición de favoritas, snapshot o fingerprint.
- [x] 4.2 Mostrar la variante propia en el modal DNA y la pública en el modal Usuario; verificar tests web de cambio de sesión/perfil, ausencia de descripción, voces y tamaños Monitor, Smartphone, Tablet portrait y Tablet landscape sin solapamientos.

## 5. Documentación y regresión

- [~] 5.1 Documentar el formato de plantilla, criterios de elegibilidad, operación del scheduler, aprobación de RPC y rollback; verificar que el runbook permite operar y detener el job sin tocar datos de colección.
- [~] 5.2 Ejecutar las suites relevantes de perfil, Amigos, gamificación, persistencia y UI web; verificar que pasan y que las respuestas públicas existentes conservan sus campos y límites.

## 6. Android (otro ordenador) [FUERA DE SCOPE]

- [ ] 6.1 En un entorno con Android SDK, regenerar recursos, sincronizar Capacitor y compilar un APK debug; verificar que el APK se construye con el backend aprobado y sin secretos.
- [ ] 6.2 Instalar el APK en un dispositivo y comprobar la variante propia en DNA y la pública en el perfil ajeno, incluidos ausencia de texto y vista estrecha; registrar resultado y fallos antes de marcar completado el grupo Android.