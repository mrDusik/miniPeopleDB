# Design

## Context

Express ya sirve páginas públicas desde `public/`; Capacitor copia esos recursos y configura el origen HTTPS del backend mediante `runtime-config.js`. `POST /api/contact` ya valida entradas, limita la frecuencia y entrega a soporte mediante Resend. El flujo de cuenta propia usa `DELETE /api/profile`, JWT y la RPC `eliminar_cuenta_usuario` sin parámetros. Véanse [la propuesta](proposal.md) y [la especificación](specs/privacidad-y-borrado-web/spec.md).

## Goals / Non-Goals

**Goals:** mantener una única fuente pública para cada página, aprovechar el transporte de soporte y preservar la frontera entre recibir una solicitud y autorizar un borrado.

**Non-Goals:** crear un panel de administración, persistir solicitudes en una tabla nueva, añadir otro proveedor de correo o conceder permisos de borrado por email, username o token de soporte.

## Decisions

1. **Páginas canónicas en Express.** Servir `/privacidad` y `/eliminar-cuenta` como páginas completas, con enlaces entre ellas. La web y Android abrirán las URL públicas del origen configurado; Android usará el navegador externo, no `https://localhost` ni una copia de la política en el APK. Los textos propios de los controles seguirán los catálogos ES/EN/IT/FR activos. El texto publicado en la política lo aprobará el propietario antes del despliegue. Una página independiente por finalidad evita depender del login y da a Play dos destinos directos.
2. **Intake dedicado, transporte compartido.** Usar un POST del mismo origen para el formulario, con correo de respuesta obligatorio y username opcional, sin campo de texto libre. Reutilizar los validadores, el límite de tamaño y el presupuesto de envíos por origen del contacto; configurar del lado servidor el tipo y el asunto del correo. Mantener el contrato de `/api/contact`. Se prefiere este diseño a reutilizar un mensaje editable porque facilita clasificar las solicitudes y no invita a enviar secretos. Excluir contenido personal de URL y logs; no consultar Supabase durante el envío.
3. **Soporte verifica, no borra por identidad declarada.** Documentar recuperación y verificación con mecanismos autorizados; no considerar el correo declarado, los datos de perfil ni una afirmación del solicitante como prueba suficiente. Canalizar el borrado propio por el flujo web autenticado existente, con confirmación de la persona y sin compartir ni pedir credenciales. Si no puede acceder, soporte inicia la recuperación autorizada; si no logra verificar, no borra ni confirma la existencia de la cuenta. Cualquier caso verificado que no pueda completarse con el procedimiento autorizado se escala al propietario; no se amplían permisos en este cambio. Antes de publicar, probar el recorrido de pérdida de acceso y resolver los huecos operativos encontrados.
4. **Cobertura del borrado verificable.** Inventariar datos de Auth, perfiles, avatares, inventario, histórico, gamificación, relaciones, notificaciones, registros push y datos operativos o en proveedores aplicables. Distinguir cascadas y limpieza existentes de datos gestionados fuera de ese flujo, por ejemplo mensajes de soporte. Registrar el tratamiento, el responsable de limpieza y las excepciones de retención justificadas. No afirmar que eliminar MiniPeopleDB elimina una cuenta de Google.
5. **Historial de amistad sin identidad tras el rechazo.** La operación de rechazo quitará el username del contenido almacenado en la misma transacción que desvincula el aviso y elimina la solicitud. La migración limpiará solo los avisos de solicitud ya desvinculados, sin intentar reconstruir identidades. Adecuar la validación del contenido para distinguir avisos vinculados de avisos históricos anonimizados. La bandeja mostrará un texto genérico localizado, conservando la fecha y el estado de lectura.

## Risks / Trade-offs

- **El proveedor acepta el correo, pero soporte no lo recibe** → comprobar entrega en el buzón con un envío controlado y documentar seguimiento y plazo operativo; la UI solo confirma el envío.
- **Correo o username de otra persona** → respuesta uniforme y sin consulta de cuentas; ninguna solicitud activa el borrado.
- **Modo mantenimiento** → conservar accesibles las páginas y el envío dedicado mediante una excepción limitada a sus rutas y recursos imprescindibles; no reabrir el API ordinario ni desactivar el límite.
- **Política desactualizada** → documentar quién valida datos, proveedores y retención, y actualizar el texto antes de desplegar cambios que alteren esas prácticas.

## Migration Plan

1. Confirmar con el propietario el texto, el contacto, el plazo, las excepciones de retención, la cobertura de proveedores y el recorrido operativo de soporte.
2. Desplegar la migración de avisos después de la de rechazo de solicitudes, y coordinarla con la actualización de la bandeja. Desplegar las páginas y el formulario antes de distribuir la versión Android que los enlaza. Validar URLs y envío en un navegador sin sesión y el borrado con una cuenta de prueba autorizada.
3. Introducir las URL públicas en Política de privacidad y en las preguntas de eliminación de Seguridad de datos de Play Console. Si hay rollback tras declararlas, mantener los destinos y una vía operativa de solicitud; no dejar URLs rotas ni afirmar que el formulario funciona si no es así.
