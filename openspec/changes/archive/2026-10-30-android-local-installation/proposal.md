# Propuesta

## Motivo

La aplicación solo puede validarse hoy desde el navegador y no existe un paquete Android que se pueda instalar en el móvil del propietario. El primer hito es obtener un instalador de prueba y comprobar en un dispositivo real la interfaz, autenticación y conexión con los servicios actuales antes de plantear una publicación en Play Store.

## Cambios

- Añadir una aplicación Android instalable para pruebas, reutilizando la interfaz y manteniendo la API y Supabase como servicios remotos.
- Adaptar las llamadas del cliente y los flujos de autenticación para funcionar desde Android, incluido el retorno de OAuth a la aplicación.
- Documentar y verificar la generación e instalación local del paquete de prueba en un dispositivo Android.
- No decidir ni inventar nombre visible, identificador de paquete, icono ni recursos de marca. Confirmar los valores necesarios con el propietario antes de generar el paquete.
- Dejar fuera de este cambio la publicación en Play Store, la ficha comercial, el icono definitivo y el proceso de firma de lanzamiento.

## Capacidades

### Capacidades nuevas

- `android-local-installation`: empaquetado Android local, integración con los servicios existentes y entrega de un instalador de prueba para validación en dispositivo.

### Capacidades modificadas

Ninguna. La interfaz web existente debe conservar su comportamiento.

## Impacto

- Frontend en `public/`, especialmente las llamadas a la API, la inicialización de Supabase y los destinos de autenticación.
- Backend Express para servir/configurar las solicitudes de la aplicación Android sin ampliar privilegios ni exponer secretos.
- Dependencias y configuración de compilación Android, pruebas automatizadas y documentación de desarrollo.
- Configuración de redirección OAuth de Supabase y de Google para permitir regresar a la aplicación instalada.