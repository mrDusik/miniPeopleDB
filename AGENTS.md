# Guía del Proyecto (OpenSpec + Copilot)

Este proyecto sigue un flujo Spec-Driven Development.

## Reglas del agente
- Lee siempre las especificaciones activas en `openspec/changes/` antes de escribir código.
- Todas las funcionalidades deben incluir tests automatizados.
- La persistencia de minifiguras, gamificación e histórico diario se realiza en Supabase; las categorías de Brickset se mantienen en archivos JSON locales. Las operaciones ordinarias de usuario usan JWT y RLS, nunca `service_role`. El recálculo de gamificación disparado por cambios válidos de categorías y el worker backend de analítica diaria son las únicas excepciones de acceso global: solo pueden usar sus RPC allowlisted, y nunca desde rutas ordinarias ni el navegador. Los tests de API deben usar `test-support/supabase-mock.js`; los RPC administrativos deben probarse con PGlite.