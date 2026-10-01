# Proposal

## Why

MiniPeople DB necesita hacer visible la actividad de su comunidad para reconocer a los coleccionistas más activos y permitir interacciones positivas entre usuarios. Un ranking global con regalos únicos de Bricks aporta reconocimiento y participación sin comprometer la privacidad de los catálogos completos.

## What Changes

- Añadir un ranking global autenticado con los 10 usuarios con más Bricks, sus perfiles públicos de Google, nivel y total de minifiguras en `COLECCIÓN`.
- Exponer para cada usuario clasificado sus cinco minifiguras en `COLECCIÓN` de mayor precio y sus cinco más antiguas, usando los mismos criterios y datos visuales de la valoración principal.
- Incorporar un acceso "Ranking Global", un modal Top 10, un acordeón exclusivo por usuario y una distinción con estrella para el usuario autenticado cuando figure en el Top 10.
- Permitir que un usuario regale 50 Bricks una sola vez a cada destinatario, sin descontarlos al donante, con registro permanente y actualización atómica del receptor.
- Registrar en el receptor el logro especial "Someone liked your collection" y mostrar los logros de regalo con un icono de regalo.
- Persistir de forma segura una proyección pública del perfil (`display_name` y `avatar_url`) y las relaciones de regalos, manteniendo RLS y evitando exponer metadatos privados de autenticación.

## Capabilities

### New Capabilities

- `ranking-global`: Consulta del Top 10, detalles públicos de colección, posición del usuario autenticado y envío único de regalos de 50 Bricks.

### Modified Capabilities

- `autenticacion-usuarios`: Los endpoints de ranking y regalo requieren sesión válida y solo derivan las identidades del token autenticado.
- `interfaz-web-minifiguras`: El panel de nivel incorpora el acceso, modal, distinciones, acordeón y controles de regalo del ranking global, además del icono específico para logros de regalo.
- `persistencia-supabase`: Se almacenan perfiles públicos y regalos con RLS, y se habilitan lecturas globales limitadas y una mutación atómica entre usuarios sin aceptar identidades de donante proporcionadas por el cliente.

## Impact

- Esquema y políticas de Supabase para perfiles públicos, regalos, consultas agregadas y la operación atómica de donación.
- Servidor Express, autenticación, repositorios de gamificación/minifiguras y contratos `GET /api/ranking` y `POST /api/ranking/regalar`.
- Interfaz estática en `public/` para menú, modal, acordeón, distinciones y logros.
- Mock de Supabase y pruebas automatizadas de API, persistencia, seguridad y comportamiento web.