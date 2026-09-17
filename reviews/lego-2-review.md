# Informe de Revisión - LEGO-2

## Revisión de resolución de warnings - Veredicto: PASS

**Fecha:** 2026-09-17
**Alcance:** Verificación de la resolución de los warnings de la revisión inicial contra la spec-delta LEGO-2, `src/minifiguras-repository.js`, `src/server.js` y `test/minifiguras.test.js`.

## Veredicto formal: **PASS**

La implementación cumple los requisitos funcionales y de diseño: filtros con semántica AND, orden preservado, compatibilidad sin filtros, normalización case-insensitive, validación explícita de `anio`, método HTTP adecuado y cobertura automatizada. La suite ejecutada finaliza con **9 tests pasados y 0 fallidos**.

---

## Hallazgos

### 1. `src/server.js` (parseo de `anio`) — RESUELTO / PASS
```js
const parsedAnio = Number(anio);
if (!Number.isInteger(parsedAnio)) {
  sendJson(response, 400, { error: 'PARAMETRO_INVALIDO', parametro: 'anio' });
  return;
}
filters.anio = parsedAnio;
```
**Resolución:** Se implementó el contrato de la spec: `anio` no numérico o no entero, como `?anio=abc` o `?anio=2020.5`, ya no se descarta silenciosamente. La API responde `400` con `{ error: 'PARAMETRO_INVALIDO', parametro: 'anio' }`. El comportamiento está documentado en `design.md` y cubierto por tests.

### 2. `src/server.js` (método no permitido) — RESUELTO / PASS
```js
if (request.method !== 'GET') {
  response.setHeader('allow', 'GET');
  sendJson(response, 405, { error: 'METODO_NO_PERMITIDO' });
  return;
}
```
**Resolución:** La ruta existente `/minifiguras` distingue ahora el método no permitido y responde `405`, incluyendo `Allow: GET` y el código estable `METODO_NO_PERMITIDO`. El comportamiento está cubierto por un test específico.

### 3. `src/minifiguras-repository.js` — `matchesFilters` — PASS
```js
function matchesFilters(minifigura, filters) {
  const tema = normalizeText(filters.tema);
  const estadoColeccion = normalizeText(filters.estadoColeccion);
  ...
}
```
**Motivo:** Cumple correctamente el requisito "Filtrado por tema" y "Filtrado por estado de colección" con comparación insensible a mayúsculas/minúsculas, tal como exige `design.md` (Decisión #3). El filtro por `anio` usa igualdad estricta numérica, adecuado dado que el modelo valida `anio` como `number` entero en `isMinifigura`.

### 4. `MinifigurasRepository.list` — orden y semántica AND — PASS
```js
return minifiguras.filter((minifigura) => matchesFilters(minifigura, activeFilters));
```
**Motivo:** `Array.prototype.filter` preserva el orden original del arreglo, cumpliendo el escenario "Filtrado por tema" y "Filtros combinados" (orden conservado) y la semántica AND exigida (todas las condiciones de `activeFilters` deben cumplirse).

### 5. Compatibilidad sin filtros — PASS
```js
if (Object.keys(activeFilters).length === 0) {
  return minifiguras;
}
```
**Motivo:** Cumple el requisito "Mantener compatibilidad con el listado base": sin parámetros de consulta, se devuelve la colección completa sin alterar orden ni contenido.

### 6. Validación de campos opcionales (`isMinifigura`) — PASS
```js
const hasValidOptionalMetadata =
  (value.tema === undefined || (typeof value.tema === 'string' && value.tema.trim().length > 0))
  && (value.anio === undefined || (typeof value.anio === 'number' && Number.isInteger(value.anio)))
  && (value.estadoColeccion === undefined || (typeof value.estadoColeccion === 'string' && value.estadoColeccion.trim().length > 0));
```
**Motivo:** Cumple con "Ajustar el catálogo local y la validación de registros para soportar metadatos opcionales de filtrado sin romper la estructura existente" (Tarea 1.2). Registros sin `tema`/`anio`/`estadoColeccion` siguen siendo válidos, alineado con el "Risk" de metadatos faltantes descrito en `design.md`.

### 7. Manejo de errores de persistencia (heredado de LEGO-1) — PASS
```js
} catch (error) {
  if (error instanceof CatalogoNoDisponibleError) { sendJson(response, 500, { error: error.code }); return; }
  if (error instanceof CatalogoInvalidoError) { sendJson(response, 500, { error: error.code }); return; }
  sendJson(response, 500, { error: 'ERROR_INTERNO' });
}
```
**Motivo:** Cumple el requisito de LEGO-1 "Validar y reportar errores de persistencia": no expone rutas ni contenido bruto, responde `500` con código estable.

### 8. Suite de pruebas — RESUELTO / PASS
**Resolución:** `test/minifiguras.test.js` contiene pruebas automatizadas para:
- Filtrado por `tema` solo.
- Filtrado por `anio` solo.
- Filtrado por `estadoColeccion` solo.
- Combinación de los tres filtros (AND).
- Caso límite: `anio` no numérico/no entero.
- Caso límite: catálogo vacío tras aplicar filtros.
- Comparación insensible a mayúsculas para `tema`/`estadoColeccion`.
Además, se ejecutó `npm test` con resultado **9 tests pasados, 0 fallidos**, completando la tarea 3.2 sin regresiones.

---

## Resumen de cumplimiento por requisito de la Spec Delta

| Requisito | Estado |
|---|---|
| Filtrar por `tema`, `anio`, `estadoColeccion` (AND) | ✅ PASS (código) |
| Catálogo sin filtros → comportamiento compatible | ✅ PASS |
| Orden preservado en filtrado | ✅ PASS |
| Validación de parámetros inválidos (`anio` no numérico) | ✅ PASS — responde `400` con `PARAMETRO_INVALIDO` |
| Metadatos opcionales sin romper estructura | ✅ PASS |
| Pruebas automatizadas por filtro y combinadas | ✅ PASS — cubiertas y ejecutadas; 9 pasaron, 0 fallaron |
| Manejo de errores de persistencia (`500`, sin detalles sensibles) | ✅ PASS |

## Resoluciones verificadas
1. El comportamiento ante `anio` inválido está definido en `design.md`, implementado como `400 Bad Request` y cubierto por tests.
2. La cobertura de aceptación y regresión está presente en `test/minifiguras.test.js`; `npm test` pasa completamente.
3. Los métodos no soportados en `/minifiguras` responden `405` con `Allow: GET`.