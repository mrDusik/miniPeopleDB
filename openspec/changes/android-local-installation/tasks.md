# Tareas

## 1. Prerrequisitos e integración Android

- [x] 1.1 Confirmar con el propietario el nombre visible de prueba, `applicationId`, URL HTTPS del backend y valores de callback OAuth; verificar que ninguno se inventa ni se almacena como secreto en el cliente.
- [ ] 1.2 Verificar las versiones necesarias de Node, JDK, Android SDK y Android Studio para la versión de Capacitor elegida; comprobar que el entorno compila una app Android de prueba.
- [ ] 1.3 Añadir Capacitor y la plataforma Android, empaquetar los recursos frontend que hoy se sirven desde Express y verificar que la app abre sin depender de cargar la página web remota.

## 2. Servicios y autenticación

- [ ] 2.1 Centralizar el origen de API para Android sin cambiar las rutas relativas de web; añadir pruebas de URL/configuración, errores de red y regresión de llamadas web.
- [ ] 2.2 Configurar CORS con los orígenes mínimos requeridos y verificar peticiones Android autenticadas con JWT, conservando RLS y sin incluir claves administrativas en los recursos cliente.
- [ ] 2.3 Implementar el retorno OAuth Android con navegador externo, deep link y PKCE; verificar callbacks válidos, inválidos, cancelados y la recuperación de sesión con pruebas automatizadas.
- [ ] 2.4 Verificar en Supabase Auth y Google OAuth los destinos de retorno configurados y documentar los valores aplicados sin incluir secretos.

## 3. Instalador y validación en dispositivo

- [ ] 3.1 Ejecutar las pruebas web y de API afectadas y comprobar que la aplicación web conserva autenticación y operaciones existentes.
- [ ] 3.2 Generar el APK debug con identidad confirmada y verificar que el artefacto se produce sin claves privadas del servidor ni credenciales de despliegue.
- [ ] 3.3 Instalar el APK en el móvil del propietario y verificar apertura, navegación, inicio de sesión clásico, OAuth, sesión persistida, consulta de datos y un cambio confirmado por el servidor.
- [ ] 3.4 Documentar dependencias, configuración local requerida, comando de compilación e instalación, ubicación del APK y limitaciones de esta versión de prueba; validar la guía siguiendo los pasos desde cero.