---
name: lego-json-validator
description: Valida el formato de las minifiguras de Lego en archivos JSON
---

# Reglas de Minifiguras
- Cada minifigura debe contener: `id` (string), `nombre` (string), `tematica` (string), `anio` (number).
- Valida que no haya registros duplicados por `id`.