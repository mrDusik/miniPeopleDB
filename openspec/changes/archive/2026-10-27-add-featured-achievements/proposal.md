# Proposal

## Why

Los coleccionistas necesitan elegir que logros representan mejor su coleccion, sin depender exclusivamente de sus Bricks. Actualmente el modal ordena automaticamente y el perfil ya muestra hasta cinco logros, pero no existe una seleccion personal persistida que tenga prioridad en ambas vistas.

## What Changes

- Permitir destacar hasta cinco IDs distintos de logros propios obtenidos, incluidos regalos, desde el modal propio de Logros mediante una estrella toggle al final de cada fila.
- Guardar cada cambio inmediatamente por cuenta en Supabase, sin boton Guardar ni cierre del modal; confirmar antes de reordenar y conservar el estado anterior si falla.
- Priorizar destacados en todas las listas de logros obtenidos. Dentro de destacados y no destacados, conservar el criterio actual: no-regalos antes que regalos, `total` descendente y orden de origen para empates. No introducir orden manual ni por fecha de seleccion.
- Rechazar el sexto destacado con aviso, sin sustituciones automaticas. Cada ID ocupa un hueco, independientemente de su cantidad.
- Retirar la seleccion cuando se pierde un logro; no restaurarla al recuperarlo. Conservarla cuando disminuye su cantidad pero sigue obtenido.
- Mostrar la seleccion del usuario consultado como indicador no editable. El perfil conserva hasta cinco logros, seleccionados despues de aplicar el orden comun y completados con no destacados cuando proceda.
- Ampliar ligeramente el modal en Monitor y Tablet; ajustar filas en Smartphone sin scroll horizontal. Mantener teclado, tooltips, foco y aislamiento de sesion.
- Excluir los toasts de nuevos logros de esta prioridad: conservan su orden actual por Bricks nuevos ascendentes.

## Capabilities

### New Capabilities

- `logros-destacados`: seleccion propia de hasta cinco logros, persistencia segura, ciclo de vida, orden comun y controles accesibles responsive.

### Modified Capabilities

- `amigos`: aplicar el orden comun del usuario consultado antes de limitar su perfil a cinco logros y publicar el indicador de destacado.
- `ranking-social`: ampliar la proyeccion allowlisted con el indicador de destacado y reflejar la seleccion del titular sin habilitar edicion ajena.
- `interfaz-web-minifiguras`: sustituir la obligacion de conservar el orden anterior por la prioridad de destacados, manteniendo el calculo V2 y la presentacion de recompensas.

## Impact

- Frontend: `public/app.js`, `public/styles.css` y, si el marcado lo requiere, `public/index.html`; renderizado propio/ajeno, control de peticiones y estilos por dispositivo.
- Backend: `src/server.js`, repositorios de gamificacion, amigos y ranking; ruta autenticada de seleccion propia y proyecciones limitadas.
- Supabase: migracion incremental y `supabase/schema.sql`; persistencia separada del estado derivado, operacion atomica por JWT, limpieza al cambiar logros vigentes y lecturas publicas acotadas. Sin nuevos usos de `service_role` ni lectura global de tablas privadas.
- Tests: suites existentes de gamificacion, amigos y ranking, `test-support/supabase-mock.js` y pruebas PGlite para permisos, limite, rollback y limpieza; comprobacion visual en Monitor, Smartphone y ambas orientaciones de Tablet.
- No se modifican catalogo V2, Bricks, niveles, DNA, snapshots, regalos, requisitos de acceso a perfiles/rankings ni toasts. Sin nuevas dependencias previstas.