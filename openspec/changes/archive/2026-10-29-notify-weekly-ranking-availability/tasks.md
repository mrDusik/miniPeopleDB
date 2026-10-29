# Tasks

## 1. Publicacion transaccional

- [x] 1.1 Añadir el tipo de notificacion, estado privado por semana y trigger de finalizacion al schema y a una migracion SQL; verificar deduplicacion, disponibilidad y rollback con PGlite.
- [x] 1.2 Sembrar silenciosamente la semana actual en la migracion cuando ya tenga ranking disponible; verificar que no se genera un aviso retroactivo.

## 2. Bandeja de notificaciones

- [x] 2.1 Permitir `weekStart` en el payload publico y renderizar el aviso semanal; verificar el contrato del repositorio.
- [x] 2.2 Añadir la accion accesible para abrir el dialogo semanal sin marcar la notificacion como leida; verificarlo con pruebas web.

## 3. Verificacion

- [x] 3.1 Ejecutar las pruebas SQL, API y web afectadas y `openspec validate notify-weekly-ranking-availability --strict`; corregir cualquier regresion.