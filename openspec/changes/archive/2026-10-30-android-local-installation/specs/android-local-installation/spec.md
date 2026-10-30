# Spec Delta

## Purpose

Esta capacidad permite generar e instalar en un dispositivo Android un paquete local de prueba de la aplicación existente. Sirve para validar la experiencia móvil y sus integraciones antes de decidir cualquier distribución pública.

## ADDED Requirements

### Requirement: Generar un instalador Android de prueba
El proyecto SHALL generar un APK debug instalable directamente en Android con la interfaz empaquetada localmente y SHALL documentar la generación e instalación. El proceso SHALL requerir los valores de identidad confirmados; si faltan, SHALL indicar cuáles y no SHALL inventarlos. Esta fase no incluye publicación ni recursos de marca.

#### Scenario: Generar e instalar el APK de prueba
- **WHEN** los valores confirmados y el entorno de compilación están disponibles
- **THEN** el proyecto produce un APK local instalable que abre la interfaz sin cargar una página web remota

#### Scenario: Faltan valores de identidad Android
- **WHEN** se solicita generar el APK y falta algún valor de identidad requerido
- **THEN** el proceso indica el dato pendiente y no sustituye el valor por uno inventado

### Requirement: Usar la identidad Android confirmada
El APK de prueba SHALL usar los valores confirmados por el propietario el 2026-10-29: nombre visible `MiniPeopleDB`, `applicationId` `com.mrdusik.minipeopledb`, backend `https://minipeopledb.onrender.com` y callback Android `com.mrdusik.minipeopledb://auth/callback`. El callback HTTPS de Supabase para Google OAuth es distinto y se configura por separado.

#### Scenario: Compilar con la identidad aprobada
- **WHEN** se genera el APK de prueba
- **THEN** la app muestra el nombre confirmado y utiliza el identificador, backend y callback aprobados

### Requirement: Conectar la aplicación instalada con los servicios remotos
La aplicación Android SHALL cargar los recursos cliente necesarios y conectarse por HTTPS al backend configurado para obtener configuración pública y ejecutar las operaciones de API existentes. Las solicitudes autenticadas SHALL seguir enviando la sesión del usuario. La configuración de red SHALL permitir únicamente los orígenes requeridos por los clientes soportados y SHALL NOT exponer secretos de servidor ni ampliar permisos de datos.

#### Scenario: Usar la aplicación con el backend disponible
- **WHEN** la aplicación instalada tiene conexión de red y el backend configurado está disponible
- **THEN** carga la configuración pública de autenticación y permite consultar y modificar los datos permitidos por la sesión del usuario

#### Scenario: Backend no disponible
- **WHEN** el dispositivo no puede alcanzar el backend configurado
- **THEN** la aplicación comunica un error recuperable y no presenta la operación como completada

#### Scenario: Mantener secretos fuera del instalador
- **WHEN** se genera o inspecciona el APK de prueba
- **THEN** no contiene claves de servicio, secretos del backend ni credenciales de despliegue

### Requirement: Completar autenticación desde Android
La aplicación SHALL conservar los métodos de autenticación existentes compatibles con el cliente y SHALL permitir que el flujo OAuth iniciado en Android regrese a la aplicación instalada mediante un destino configurado y validado. La sesión SHALL ser procesada por Supabase Auth con el flujo PKCE existente. La cancelación o el fallo del proveedor SHALL dejar la aplicación en un estado recuperable sin filtrar tokens en mensajes visibles ni logs.

#### Scenario: Inicio de sesión OAuth completado
- **WHEN** el usuario inicia OAuth desde la aplicación, se autentica correctamente y el proveedor devuelve el callback configurado
- **THEN** Android abre la aplicación y esta recupera la sesión autenticada antes de llamar a rutas protegidas

#### Scenario: OAuth cancelado o fallido
- **WHEN** el usuario cancela el proveedor o el callback no puede validarse
- **THEN** la aplicación conserva el acceso a la pantalla de autenticación, muestra un error genérico y permite reintentar

#### Scenario: Inicio de sesión clásico
- **WHEN** el usuario inicia sesión con Username y contraseña desde Android
- **THEN** la solicitud llega al endpoint configurado y la sesión resultante es establecida y validada por Supabase Auth como en la aplicación web

### Requirement: Mantener intacta la aplicación web
La incorporación del instalador Android SHALL NOT cambiar los flujos ni las URLs de producción de la aplicación web. Los ajustes compartidos SHALL conservar la autorización JWT, RLS y las restricciones actuales del backend.

#### Scenario: Regresión web
- **WHEN** se ejecutan los flujos web existentes después de añadir soporte Android
- **THEN** la interfaz web continúa cargando y sus llamadas autenticadas conservan el comportamiento actual