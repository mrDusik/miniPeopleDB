# Proposal

## Why

Los perfiles muestran datos de colección y gamificación, pero no ofrecen una síntesis breve de la trayectoria de cada cuenta. Una descripción determinista y actualizada semanalmente puede dar contexto a esos datos sin coste de inferencia ni afirmaciones ajenas a las señales disponibles.

## What Changes

- Añadir una capability para producir y guardar descripciones de perfil con una plantilla versionada, incluyendo una versión propia en segunda persona y otra pública en tercera persona neutra.
- Usar nivel, porcentajes DNA, logros obtenidos y cantidades, logros destacados, las cinco figuras más recientes de cada estado y categorías favoritas como contexto. Las favoritas podrán reflejarse indirectamente en el texto público; la lista en sí seguirá siendo privada.
- Ejecutar un job backend cada domingo y regenerar solo cuando haya cambios relevantes respecto al último contexto generado. La hora y zona del scheduler serán configurables; el job será durable, idempotente y recuperable.
- Mostrar la descripción propia en el modal DNA y la pública en el modal de perfil ajeno de Amigos, con diseño responsive.
- Documentar las tareas Android en un grupo separado y pendiente de compilar/probar en el otro ordenador; la distribución web no sustituye la instalación de un APK actualizado.
- Extender el contrato de persistencia con almacenamiento privado y RPC allowlisted para el job. No se concederá acceso directo global con `service_role`; implementar y desplegar esa nueva excepción requerirá aprobación explícita de política.

## Capabilities

### New Capabilities
- `descripciones-perfil`: generar, persistir y servir descripciones propias y públicas mediante una plantilla determinista y job semanal.

### Modified Capabilities
- `amigos`: incluir la descripción pública en el resumen autenticado de perfil ajeno sin exponer la lista de favoritas.
- `interfaz-web-minifiguras`: mostrar las variantes en segunda persona en DNA propio y tercera persona neutra en perfiles ajenos.
- `perfil-usuario`: permitir que las categorías favoritas alimenten la descripción pública derivada, manteniendo privada la lista directa de preferencias.
- `persistencia-supabase`: añadir almacenamiento privado y una excepción de worker exclusivamente mediante RPC estrechas, condicionada a aprobación explícita.
- `android-local-installation`: incluir la descripción en los recursos empaquetados y separar compilación e instalación Android como validación pendiente.

## Impact

Backend Express y worker semanal; Supabase (tabla privada, RPCs y proyecciones de DNA/perfil); respuestas de `GET /gamificacion/dna` y `amigos_perfil`; modales DNA y Usuario en `public/`; tests Node/PGlite; pipeline local `android:web`/Capacitor. No se añade proveedor, clave ni coste de IA. La ejecución dependerá de un scheduler externo configurado para los domingos.