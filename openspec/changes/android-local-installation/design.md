# Diseño

## Contexto

La web estática se sirve desde Express y sus llamadas de API, la configuración pública de Supabase y los bundles de Supabase JS y Chart.js usan rutas del mismo origen. El cliente construye los destinos de OAuth con `window.location.origin` y ya usa PKCE. La API y la persistencia seguirán en sus servicios remotos; el APK no ejecutará ni incluirá el backend. Véanse [proposal.md](proposal.md) y [specs/android-local-installation/spec.md](specs/android-local-installation/spec.md).

## Objetivos / Fuera de alcance

**Objetivos:**

- Empaquetar la interfaz y sus recursos estáticos para Android y generar un APK de prueba instalable localmente.
- Configurar explícitamente el origen HTTPS del backend y reutilizar las rutas, sesiones y permisos actuales.
- Completar OAuth en navegador externo y devolver el callback validado a la aplicación instalada.
- Probar en móvil real tanto la instalación como las operaciones autenticadas esenciales.

**Fuera de alcance:**

- Alojar Express o Supabase dentro del dispositivo, persistir datos privados fuera de Supabase o cambiar el modelo de autorización.
- Publicar en Play Store, generar un AAB de lanzamiento, configurar firma de producción, crear ficha comercial o diseñar iconografía de marca.
- Elegir por cuenta propia el nombre visible, `applicationId`, esquema OAuth o URL de backend. Son entradas que debe confirmar el propietario antes de compilar y configurar los servicios.

## Decisiones

### Empaquetar la interfaz localmente y mantener servicios remotos

Usar Capacitor para distribuir una copia local de la interfaz y los recursos que hoy entrega Express por rutas especiales. La aplicación llamará por HTTPS al backend ya desplegado. Esto permite abrir la interfaz como app instalada y evita convertir el servidor Node o las credenciales privadas en parte del APK. Una página remota abierta en un WebView no se elige porque mantendría la experiencia dependiente de la web y no daría un paquete autónomo de interfaz.

### Centralizar el origen de API para la app

Introducir una configuración de compilación para el origen HTTPS del backend Android y centralizar en el cliente las llamadas que hoy usan rutas relativas, incluidas las cargas de configuración pública. Mantener el comportamiento relativo del navegador web. El backend permitirá los orígenes estrictamente necesarios para Android y web; no habilitar CORS global ni credenciales administrativas en el cliente. La URL real será suministrada por el propietario para el build.

### Retornar OAuth mediante deep link

Abrir el flujo OAuth en el navegador del sistema y registrar en Android el callback asociado a la identidad de paquete confirmada. La app procesará el enlace de retorno con Supabase JS y conservará el intercambio de código PKCE; el destino exacto deberá estar permitido en Supabase Auth y configurado en el cliente OAuth de Google cuando aplique. La gestión del callback debe rechazar destinos no esperados y evitar registrar códigos o tokens. Se descarta depender de la redirección web actual, porque su `window.location.origin` apunta al origen local de Capacitor y no completa por sí sola el retorno móvil.

### Usar un APK de depuración firmado localmente

Generar un APK debug para instalación directa en el dispositivo y mantener la firma local fuera del repositorio. No crear un release firmado ni reutilizar esa clave como firma de Play. Cambios futuros de `applicationId` pueden impedir actualizar una instalación existente, por lo que dicho valor se confirma antes del primer build instalable.

### Mantener identidad de marca fuera del hito

No diseñar icono ni ficha de tienda en esta fase. Android requiere valores técnicos de identidad para crear el paquete; el build debe solicitarlos al propietario y detenerse si no están confirmados, en vez de adoptar nombres o identificadores de ejemplo como definitivos.

## Riesgos / Compensaciones

- [Las rutas relativas actuales pueden fallar desde el origen local de Capacitor] -> Centralizar llamadas y verificar que toda llamada directa, incluido OAuth/configuración, usa el destino correcto sin cambiar la web.
- [El navegador externo o la configuración de Supabase pueden no devolver OAuth al móvil] -> Probar registro del deep link, PKCE, sesión persistida, cancelación y recuperación en un dispositivo real antes de aceptar el instalador.
- [La configuración CORS puede bloquear o ampliar indebidamente el acceso] -> Permitir solo los orígenes requeridos y probar la API con y sin sesión; conservar JWT, RLS y las restricciones del servidor.
- [La app instalada no ofrece operación completa sin conexión] -> Declarar que las operaciones requieren backend accesible por HTTPS y mostrar errores recuperables cuando no esté disponible.
- [La firma debug o el identificador pueden diferir en builds posteriores] -> Documentar que el APK es de prueba y mantener estables los valores confirmados durante esta etapa.

## Plan de entrega y reversión

No se necesitan migraciones de base de datos. Primero se configurarán los valores confirmados de backend e identidad y los destinos OAuth; después se compilará el APK debug, se instalará directamente en el móvil y se validarán los flujos definidos en la spec. Si hay problemas, se puede desinstalar el APK y revertir la configuración Android/CORS sin tocar datos de Supabase. Los cambios de backend deben conservar habilitado el origen web actual.