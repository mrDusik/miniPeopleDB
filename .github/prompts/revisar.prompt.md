---
description: Revisa el diff contra la spec activa
agent: ask
---
Analiza todo el proyecto usando #codebase.

1. Examina las especificaciones en `openspec/changes/`.
2. Examina el código en `src/` y los tests en `tests/`.
3. Compara si la implementación cumple la especificación y emite un veredicto: PASS, WARNINGS o FAIL.
4. Lista los hallazgos con archivo, línea y motivo.
5. No realices modificaciones ni crees archivos.