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

test('GET /minifiguras devuelve el catalogo y conserva su orden', async () => {
  const catalog = JSON.stringify([
    { id: 'a', nombre: 'Primera', descripcion: 'Una figura' },
    { id: 'b', nombre: 'Segunda', descripcion: 'Otra figura' },
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
    { id: 'a', nombre: 'Explorador', descripcion: 'Figura espacial', tema: 'Espacio', anio: 2023, estadoColeccion: 'coleccion' },
    { id: 'b', nombre: 'Pirata', descripcion: 'Figura marina', tema: 'Mar', anio: 2023, estadoColeccion: 'venta' },
    { id: 'c', nombre: 'Constructor', descripcion: 'Figura urbana', tema: 'Espacio', anio: 2024, estadoColeccion: 'coleccion' },
    { id: 'd', nombre: 'Samurái', descripcion: 'Figura histórica', tema: 'Historia', anio: 2024, estadoColeccion: 'venta' },
  ]);

  await withServer(catalog, async (baseUrl) => {
    const byTheme = await fetch(`${baseUrl}/minifiguras?tema=espacio`);
    assert.equal(byTheme.status, 200);
    assert.deepEqual(await byTheme.json(), [
      { id: 'a', nombre: 'Explorador', descripcion: 'Figura espacial', tema: 'Espacio', anio: 2023, estadoColeccion: 'coleccion' },
      { id: 'c', nombre: 'Constructor', descripcion: 'Figura urbana', tema: 'Espacio', anio: 2024, estadoColeccion: 'coleccion' },
    ]);

    const byYear = await fetch(`${baseUrl}/minifiguras?anio=2023`);
    assert.equal(byYear.status, 200);
    assert.deepEqual(await byYear.json(), [
      { id: 'a', nombre: 'Explorador', descripcion: 'Figura espacial', tema: 'Espacio', anio: 2023, estadoColeccion: 'coleccion' },
      { id: 'b', nombre: 'Pirata', descripcion: 'Figura marina', tema: 'Mar', anio: 2023, estadoColeccion: 'venta' },
    ]);

    const byCollectionState = await fetch(`${baseUrl}/minifiguras?estadoColeccion=coleccion`);
    assert.equal(byCollectionState.status, 200);
    assert.deepEqual(await byCollectionState.json(), [
      { id: 'a', nombre: 'Explorador', descripcion: 'Figura espacial', tema: 'Espacio', anio: 2023, estadoColeccion: 'coleccion' },
      { id: 'c', nombre: 'Constructor', descripcion: 'Figura urbana', tema: 'Espacio', anio: 2024, estadoColeccion: 'coleccion' },
    ]);

    const combined = await fetch(`${baseUrl}/minifiguras?tema=espacio&anio=2023&estadoColeccion=coleccion`);
    assert.equal(combined.status, 200);
    assert.deepEqual(await combined.json(), [
      { id: 'a', nombre: 'Explorador', descripcion: 'Figura espacial', tema: 'Espacio', anio: 2023, estadoColeccion: 'coleccion' },
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
    { id: 'a', nombre: 'Explorador', descripcion: 'Figura espacial', tema: 'Espacio', anio: 2023, estadoColeccion: 'Coleccion' },
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
    const response = await fetch(`${baseUrl}/minifiguras`, { method: 'POST' });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET');
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

test('el archivo inicial es JSON valido', async () => {
  const content = await readFile(new URL('../data/minifiguras.json', import.meta.url), 'utf8');
  const catalog = JSON.parse(content);
  assert.ok(Array.isArray(catalog));
  assert.ok(catalog.length > 0);
});