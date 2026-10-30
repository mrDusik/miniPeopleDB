# Instalación Android de prueba

Esta versión empaqueta la interfaz localmente con Capacitor. La API Express y Supabase siguen siendo servicios remotos y requieren conexión HTTPS. No es un paquete de publicación ni incluye firma de lanzamiento, icono de marca o configuración de Play Store.

## Requisitos

- Node.js 22 o posterior.
- JDK 21. Android Studio 2026.2 incluye JDK 25, que no es compatible con el Gradle 8.14.3 del proyecto; instala un JDK 21 en tu carpeta de usuario y no necesitas permisos de administrador.
- Android Studio y Android SDK con Android platform 36, Android build-tools y platform-tools. El emulador es opcional.
- En macOS, configura el JDK y el SDK en la terminal:

```sh
export JAVA_HOME="$HOME/Library/Java/JavaVirtualMachines/jdk-21.0.13+9/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
```

Comprueba `node --version`, `java -version` y `adb version`. El identificador de aplicación y el nombre visibles ya están confirmados: `com.mrdusik.minipeopledb` y `MiniPeopleDB`.

## Compilar e instalar

Desde la raíz del repositorio:

```sh
npm ci
npm run android:apk
```

El build prepara los recursos locales de `public/`, copia los bundles locales de Supabase JS y Chart.js, registra el deep link Android y compila el APK debug. El backend se configura con la URL HTTPS confirmada `https://minipeopledb.onrender.com`. Para usar otro origen en un entorno autorizado, se puede sustituir al compilar:

```sh
ANDROID_API_BASE_URL="https://tu-backend.example" npm run android:apk
```

La variable debe ser un origen HTTPS sin credenciales ni ruta. La app web conserva sus rutas relativas. El APK queda en:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Conecta un dispositivo Android con la depuración USB autorizada y ejecuta:

```sh
"$ANDROID_HOME/platform-tools/adb" devices
"$ANDROID_HOME/platform-tools/adb" install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Si el dispositivo no aparece, acepta el diálogo de depuración USB y vuelve a ejecutar `adb devices`. Para abrir el proyecto en Android Studio, usa `npx cap open android`.

El APK se firma con la clave debug local de Android. No compartas esa clave ni la uses para una publicación de producción. Cambiar la identidad confirmada puede impedir actualizar una instalación existente.

## OAuth y servicios

El manifiesto Android registra el retorno `com.mrdusik.minipeopledb://auth/callback`. OAuth se abre en el navegador del sistema; la app valida el esquema, host y ruta del callback, y Supabase intercambia el código mediante PKCE. La API mantiene el bearer JWT/RLS; CORS permite el origen `https://localhost` con los métodos y headers necesarios, sin wildcard ni credenciales.

El build del APK no despliega el backend. Despliega primero la versión de `src/server.js` que incluye la política CORS y comprueba el preflight `OPTIONS` desde el origen Android antes de iniciar sesión.

Antes de probar OAuth real, configura en Supabase Auth la URL de retorno permitida `com.mrdusik.minipeopledb://auth/callback`. En Google Cloud, el URI de retorno autorizado debe seguir siendo el callback HTTPS que muestra la configuración de Google en Supabase (normalmente `https://<project-ref>.supabase.co/auth/v1/callback`); no lo sustituyas por el deep link Android. Conserva sin cambios el Site URL y los destinos web existentes. La configuración de Supabase y Google OAuth debe verificarse en sus dashboards antes de considerar terminado el inicio de sesión móvil.

El APK no contiene la clave `service_role`, secretos del backend ni credenciales de despliegue. El cliente obtiene la configuración pública de Supabase desde el backend. La interfaz y sus recursos estáticos se abren localmente, pero consultas, autenticación y cambios de datos requieren el backend y Supabase accesibles.

## Notificaciones push

La integración Capacitor incluye recepción FCM, un canal Android estable y permiso contextual. La bandeja autenticada y Realtime siguen funcionando aunque no se configure Firebase. Para habilitar push:

1. El propietario debe crear o elegir su propio proyecto Firebase y registrar `com.mrdusik.minipeopledb`.
2. Descarga el archivo cliente `google-services.json` para ese registro y colócalo localmente en `android/app/google-services.json`. El archivo está ignorado por Git. No contiene la credencial de servidor.
3. Configura el secreto `FIREBASE_SERVICE_ACCOUNT_JSON` del proyecto Firebase únicamente en el gestor de secretos del backend. Nunca lo pongas en el APK, assets, navegador ni `sup.env`.
4. Aplica la migración push mediante el procedimiento de `docs/android-push-runbook.md`, despliega el backend y luego compila:

```sh
npm run android:apk
```

La petición de permiso Android 13+ aparece solo después de pulsar «Activar avisos push» dentro de Notificaciones. Si se deniega o revoca, la bandeja continúa disponible. Los mensajes de sistema son genéricos; al tocarlos, la app valida el identificador, consulta la notificación propia con JWT y abre la bandeja sin marcarla como leída.

El TTL máximo es de 24 horas. FCM es de mejor esfuerzo; el modo force-stop de Android, una app desinstalada, restricciones del sistema o el vencimiento del TTL pueden impedir una alerta. La app refresca la bandeja al reanudarse o reconectar. Prueba en un dispositivo real con Firebase configurado: foreground, background, proceso terminado normalmente, sesión cerrada, permiso denegado/revocado, offline/reconexión, duplicado, vencimiento y token inválido. No consideres la integración end-to-end verificada solo porque el backend acepta el mensaje.

## Limitaciones de esta fase

- Es un APK debug para instalación directa; no se genera AAB ni se publica en Play Store.
- El nombre e identificador están confirmados, pero no se incorporan iconos de marca ni recursos de ficha comercial.
- La validación OAuth completa requiere los allowlists configurados en Supabase y Google, además de un dispositivo Android con una cuenta autorizada.
- La app no permite consultar ni modificar datos sin conexión.
