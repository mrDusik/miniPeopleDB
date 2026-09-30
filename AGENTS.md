# Guía del Proyecto (OpenSpec + Copilot)

Este proyecto sigue un flujo Spec-Driven Development.

## Reglas del agente
- Lee siempre las especificaciones activas en `openspec/changes/` antes de escribir código.
- Todas las funcionalidades deben incluir tests automatizados.
- La persistencia de minifiguras y gamificación se realiza en Supabase (tablas con RLS por usuario); las categorías de Brickset se mantienen en archivos JSON locales. Los tests deben usar el cliente simulado de `test-support/supabase-mock.js`.