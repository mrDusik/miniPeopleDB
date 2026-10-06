# Guía del Proyecto (OpenSpec + Copilot)

Este proyecto sigue un flujo Spec-Driven Development.

## Reglas del agente
- Lee siempre las especificaciones activas en `openspec/changes/` antes de escribir código.
- Todas las funcionalidades deben incluir tests automatizados.
- La persistencia de minifiguras y gamificación se realiza en Supabase (tablas con RLS por usuario); las categorías de Brickset se mantienen en archivos JSON locales. La única excepción de acceso global es el recálculo de gamificación disparado por cambios válidos de categorías: usa una RPC allowlisted desde un proceso backend con `service_role`, nunca desde rutas de usuario ni el navegador. Los tests de API deben usar `test-support/supabase-mock.js`; el RPC administrativo debe probarse con PGlite.