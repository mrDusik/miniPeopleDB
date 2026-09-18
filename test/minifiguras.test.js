import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createServer } from '../src/server.js';

async function withServer(catalog, callback) {
  const directory = await mkdtemp(join(tmpdir(), 'minifiguras-'));
  const catalogPath = join(directory, 'minifiguras.json');
  if (catalog !== undefined) {
    await writeFile(catalogPath, catalog);
  }

  const server = createServer({ catalogPath });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
}

function makeMinifigura(overrides = {}) {
  return {
    id: 'mf-001',
    nombre: 'Explorador',
    descripcion: 'Figura espacial',
    tematica: 'Espacio',
    anio: 2023,
    estadoColeccion: 'coleccion',
    ...overrides,
  };
}

test('GET /minifiguras devuelve el catalogo y conserva su orden', async () => {
  const catalog = JSON.stringify([
    makeMinifigura({ id: 'a' }),
    makeMinifigura({ id: 'b', nombre: 'Segunda' }),
  ]);

  await withServer(catalog, async (baseUrl) => {
    const first = await fetch(`${baseUrl}/minifiguras`);
    const second = await fetch(`${baseUrl}/minifiguras`);

    assert.equal(first.status, 200);
    assert.equal(first.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.deepEqual(await first.json(), await second.json());
    assert.deepEqual(await (await fetch(`${baseUrl}/minifiguras`)).json(), JSON.parse(catalog));
  });
});

test('GET /minifiguras filtra por tema, anio y estado de coleccion', async () => {
  const catalog = JSON.stringify([
    makeMinifigura({ id: 'a', nombre: 'Explorador', tematica: 'Espacio', anio: 2023, estadoColeccion: 'coleccion' }),
    makeMinifigura({ id: 'b', nombre: 'Pirata', tematica: 'Mar', anio: 2023, estadoColeccion: 'venta' }),
    makeMinifigura({ id: 'c', nombre: 'Constructor', tematica: 'Espacio', anio: 2024, estadoColeccion: 'coleccion' }),
    makeMinifigura({ id: 'd', nombre: 'Samurái', tematica: 'Historia', anio: 2024, estadoColeccion: 'venta' }),
  ]);

  await withServer(catalog, async (baseUrl) => {
    const byTheme = await fetch(`${baseUrl}/minifiguras?tema=espacio`);
    assert.equal(byTheme.status, 200);
    assert.deepEqual(await byTheme.json(), [
      makeMinifigura({ id: 'a', nombre: 'Explorador', tematica: 'Espacio', anio: 2023, estadoColeccion: 'coleccion' }),
      makeMinifigura({ id: 'c', nombre: 'Constructor', tematica: 'Espacio', anio: 2024, estadoColeccion: 'coleccion' }),
    ]);

    const byYear = await fetch(`${baseUrl}/minifiguras?anio=2023`);
    assert.equal(byYear.status, 200);
    assert.deepEqual(await byYear.json(), [
      makeMinifigura({ id: 'a', nombre: 'Explorador', tematica: 'Espacio', anio: 2023, estadoColeccion: 'coleccion' }),
      makeMinifigura({ id: 'b', nombre: 'Pirata', tematica: 'Mar', anio: 2023, estadoColeccion: 'venta' }),
    ]);

    const byCollectionState = await fetch(`${baseUrl}/minifiguras?estadoColeccion=coleccion`);
    assert.equal(byCollectionState.status, 200);
    assert.deepEqual(await byCollectionState.json(), [
      makeMinifigura({ id: 'a', nombre: 'Explorador', tematica: 'Espacio', anio: 2023, estadoColeccion: 'coleccion' }),
      makeMinifigura({ id: 'c', nombre: 'Constructor', tematica: 'Espacio', anio: 2024, estadoColeccion: 'coleccion' }),
    ]);

    const combined = await fetch(`${baseUrl}/minifiguras?tema=espacio&anio=2023&estadoColeccion=coleccion`);
    assert.equal(combined.status, 200);
    assert.deepEqual(await combined.json(), [
      makeMinifigura({ id: 'a', nombre: 'Explorador', tematica: 'Espacio', anio: 2023, estadoColeccion: 'coleccion' }),
    ]);
  });
});

test('GET /minifiguras rechaza un anio no entero', async () => {
  await withServer('[]', async (baseUrl) => {
    for (const anio of ['abc', '2020.5']) {
      const response = await fetch(`${baseUrl}/minifiguras?anio=${anio}`);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: 'PARAMETRO_INVALIDO', parametro: 'anio' });
    }
  });
});

test('GET /minifiguras conserva la comparacion insensible a mayusculas y permite resultados vacios', async () => {
  const catalog = JSON.stringify([
    makeMinifigura({ id: 'a', tematica: 'Espacio', estadoColeccion: 'Coleccion' }),
  ]);

  await withServer(catalog, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/minifiguras?tema=ESPACIO&estadoColeccion=coleccion`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), JSON.parse(catalog));

    const emptyResponse = await fetch(`${baseUrl}/minifiguras?anio=2024`);
    assert.equal(emptyResponse.status, 200);
    assert.deepEqual(await emptyResponse.json(), []);
  });
});

test('una ruta existente con un metodo no permitido devuelve 405', async () => {
  await withServer('[]', async (baseUrl) => {
    const response = await fetch(`${baseUrl}/minifiguras`, { method: 'PATCH' });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET, POST');
    assert.deepEqual(await response.json(), { error: 'METODO_NO_PERMITIDO' });
  });
});

test('GET /minifiguras devuelve un arreglo vacio para un catalogo vacio', async () => {
  await withServer('[]', async (baseUrl) => {
    const response = await fetch(`${baseUrl}/minifiguras`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
  });
});

test('GET /minifiguras devuelve error controlado si falta el archivo', async () => {
  await withServer(undefined, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/minifiguras`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'CATALOGO_NO_DISPONIBLE' });
  });
});

test('GET /minifiguras devuelve error controlado para JSON o estructura invalida', async () => {
  for (const catalog of ['{', JSON.stringify([{ id: 'sin-nombre' }])]) {
    await withServer(catalog, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/minifiguras`);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: 'CATALOGO_INVALIDO' });
    });
  }
});

test('POST /minifiguras crea una minifigura y persiste el catalogo actualizado', async () => {
  const initialCatalog = JSON.stringify([
    makeMinifigura({ id: 'a' }),
  ]);

  await withServer(initialCatalog, async (baseUrl) => {
    const payload = makeMinifigura({ id: 'b', nombre: 'Constructora', tematica: 'Ciudad' });

    const response = await fetch(`${baseUrl}/minifiguras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), payload);

    const persisted = await fetch(`${baseUrl}/minifiguras`);
    assert.deepEqual(await persisted.json(), [
      makeMinifigura({ id: 'a' }),
      payload,
    ]);
  });
});

test('PUT /minifiguras/:id reemplaza una minifigura existente sin mover su posicion', async () => {
  const catalog = JSON.stringify([
    makeMinifigura({ id: 'a', nombre: 'Primera' }),
    makeMinifigura({ id: 'b', nombre: 'Segunda' }),
  ]);

  await withServer(catalog, async (baseUrl) => {
    const replacement = makeMinifigura({ id: 'b', nombre: 'Reemplazada', tematica: 'Aventura' });
    const response = await fetch(`${baseUrl}/minifiguras/b`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(replacement),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), replacement);

    const persisted = await fetch(`${baseUrl}/minifiguras`);
    assert.deepEqual(await persisted.json(), [
      makeMinifigura({ id: 'a', nombre: 'Primera' }),
      replacement,
    ]);
  });
});

test('DELETE /minifiguras/:id elimina la minifigura y devuelve 204', async () => {
  const catalog = JSON.stringify([
    makeMinifigura({ id: 'a' }),
    makeMinifigura({ id: 'b' }),
  ]);

  await withServer(catalog, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/minifiguras/b`, { method: 'DELETE' });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('content-length'), '0');
    assert.equal(await response.text(), '');

    const persisted = await fetch(`${baseUrl}/minifiguras`);
    assert.deepEqual(await persisted.json(), [
      makeMinifigura({ id: 'a' }),
    ]);
  });
});

test('POST /minifiguras rechaza cuerpo invalido, falta de tematica y duplicados', async () => {
  const initialCatalog = JSON.stringify([
    makeMinifigura({ id: 'a' }),
  ]);

  await withServer(initialCatalog, async (baseUrl) => {
    const invalidBody = await fetch(`${baseUrl}/minifiguras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(invalidBody.status, 400);
    assert.deepEqual(await invalidBody.json(), { error: 'MINIFIGURA_INVALIDA' });

    const duplicate = await fetch(`${baseUrl}/minifiguras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeMinifigura({ id: 'a' })),
    });
    assert.equal(duplicate.status, 409);
    assert.deepEqual(await duplicate.json(), { error: 'ID_DUPLICADO' });

    const persisted = await fetch(`${baseUrl}/minifiguras`);
    assert.deepEqual(await persisted.json(), JSON.parse(initialCatalog));
  });
});

test('PUT /minifiguras/:id rechaza id discrepante y recurso inexistente', async () => {
  const initialCatalog = JSON.stringify([
    makeMinifigura({ id: 'a' }),
  ]);

  await withServer(initialCatalog, async (baseUrl) => {
    const differentId = await fetch(`${baseUrl}/minifiguras/a`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeMinifigura({ id: 'b' })),
    });
    assert.equal(differentId.status, 400);
    assert.deepEqual(await differentId.json(), { error: 'MINIFIGURA_INVALIDA' });

    const missing = await fetch(`${baseUrl}/minifiguras/z`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeMinifigura({ id: 'z' })),
    });
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'MINIFIGURA_NO_ENCONTRADA' });

    const persisted = await fetch(`${baseUrl}/minifiguras`);
    assert.deepEqual(await persisted.json(), JSON.parse(initialCatalog));
  });
});

test('DELETE /minifiguras/:id rechaza un recurso inexistente', async () => {
  await withServer(JSON.stringify([makeMinifigura({ id: 'a' })]), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/minifiguras/b`, { method: 'DELETE' });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'MINIFIGURA_NO_ENCONTRADA' });

    const persisted = await fetch(`${baseUrl}/minifiguras`);
    assert.deepEqual(await persisted.json(), [makeMinifigura({ id: 'a' })]);
  });
});

test('el archivo inicial es JSON valido', async () => {
  const content = await readFile(new URL('../data/minifiguras.json', import.meta.url), 'utf8');
  const catalog = JSON.parse(content);
  assert.ok(Array.isArray(catalog));
  assert.ok(catalog.length > 0);
  assert.ok(catalog.every((minifigura) => minifigura.tematica && minifigura.anio));
});
