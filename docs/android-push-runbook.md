# Despliegue de notificaciones push Android

## Alcance y autorización

El propietario del proyecto aprobó el 30-10-2026 únicamente estas RPC `SECURITY DEFINER`, ejecutables solo por `service_role`:

- `public.android_push_claim_events(integer, integer)`: reclama eventos persistidos y emite una lease limitada.
- `public.android_push_resolve_event_tokens(uuid, uuid)`: resuelve tokens activos exclusivamente para el destinatario persistido del evento reclamado y su lease.
- `public.android_push_record_attempt(uuid, uuid, uuid, text, text, integer)`: registra el resultado para una instalación que ya pertenece a ese evento.

La aprobación no concede lectura o escritura directa de `service_role` a `notificaciones`, registros de instalación, outbox ni entregas. No se permite escoger un destinatario mediante parámetros. El registro y la revocación del dispositivo usan la sesión JWT del usuario y RLS.

## Migración

La migración `supabase/android-push-notifications.sql` es aditiva respecto del esquema base:

1. Confirma la base y el entorno de destino con el operador propietario.
2. Ejecuta `supabase/schema.sql` si el esquema base aún no está instalado.
3. Ejecuta `supabase/android-push-notifications.sql` una vez en el SQL Editor o con la herramienta PostgreSQL autorizada. El archivo puede repetirse para las definiciones incluidas; no modifica ni reenvía las filas de bandeja anteriores.
4. Comprueba los permisos: las tres RPC anteriores tienen `EXECUTE` para `service_role`, pero no para `anon` ni `authenticated`; `service_role` no tiene permisos de tabla directos en notificaciones, instalaciones, outbox o entregas.
5. Comprueba que un insert nuevo produce un evento en `private.android_push_outbox`, una actualización de la misma notificación no produce otro evento y el JWT de un usuario no puede gestionar registros ajenos.

Los tests automatizados PGlite de `test/android-push-supabase.test.js` ejercitan esos permisos y el alcance de las RPC. No sustituyen la revisión del proyecto Supabase propietario antes de ejecutar la migración remota. Esta migración no debe ejecutarse desde el arranque de la aplicación ni desde una ruta HTTP.

## Activación del servidor

- Carga `FIREBASE_SERVICE_ACCOUNT_JSON` únicamente como secreto del servicio backend. Debe contener la credencial de Firebase Admin del proyecto propietario; nunca la añadas a `sup.env.example`, al repositorio, a logs, al navegador, a `google-services.json` o al APK.
- La ausencia o invalidez estructural de la credencial desactiva el worker push sin interrumpir las rutas de notificaciones existentes. Si Firebase rechaza la credencial, el worker se deshabilita en ejecución, deja la lease expirar para recuperación y `/health/push` informa solamente `enabled` o `disabled`.
- El worker utiliza exclusivamente las tres RPC aprobadas. Los mensajes contienen identificador opaco, categoría permitida y texto genérico. El TTL máximo es 24 horas; los errores transitorios se reintentan con backoff exponencial acotado y un máximo de cinco intentos por instalación.
- Verifica con una cuenta de prueba y un token activo que la fila de bandeja siga siendo canónica. FCM aceptado no significa que Android haya mostrado el aviso.

## Android

Consulta `docs/android-installation.md`. Hace falta un proyecto Firebase controlado por el propietario y registrar exactamente `com.mrdusik.minipeopledb`. El archivo cliente `android/app/google-services.json` es opcional para compilar pero necesario para obtener tokens FCM; permanece local e ignorado por Git. No contiene la clave privada de servidor.

En Android se solicita `POST_NOTIFICATIONS` solo cuando el usuario pulsa «Activar avisos push». Denegar o revocar el permiso conserva la bandeja. La app actualiza el permiso al reanudarse; la revocación de sesión se intenta antes de cerrar sesión. Si el dispositivo estaba offline, conserva un marcador local sin credenciales y bloquea el registro de otra cuenta hasta que el propietario anterior pueda revocar el token con su propia sesión. No se intenta borrar una instalación ajena con el JWT de una cuenta nueva.

## Rollback

1. Deshabilita primero `FIREBASE_SERVICE_ACCOUNT_JSON` o el worker en el servicio backend y comprueba `/health/push`.
2. Retira la versión Android con push; conserva la API de bandeja y sus contratos existentes.
3. Cuando no queden workers en ejecución, ejecuta como operador:

```sql
begin;
drop trigger if exists enqueue_android_push_notification on public.notificaciones;
drop function if exists private.enqueue_android_push_notification();
drop function if exists public.android_push_claim_events(integer, integer);
drop function if exists public.android_push_resolve_event_tokens(uuid, uuid);
drop function if exists public.android_push_record_attempt(uuid, uuid, uuid, text, text, integer);
drop table if exists private.android_push_deliveries;
drop table if exists private.android_push_outbox;
drop table if exists public.android_push_installations;
commit;
```

El rollback elimina solo estructuras push. No elimina ni cambia filas de `public.notificaciones`, funciones ordinarias, políticas JWT/RLS de la bandeja ni datos de usuario ajenos a push. No ejecutes el rollback mientras haya un worker que pueda reclamar eventos.
