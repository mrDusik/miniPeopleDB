import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { MinifigurasRepository } from '../src/minifiguras-repository.js';
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

async function withServerOptions(catalog, options, callback) {
  const directory = await mkdtemp(join(tmpdir(), 'minifiguras-options-'));
  const catalogPath = join(directory, 'minifiguras.json');
  await writeFile(catalogPath, catalog);
  const server = createServer({ catalogPath, ...options });
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
    estadoColeccion: 'COLECCIÓN',
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
    makeMinifigura({ id: 'a', nombre: 'Explorador', tematica: 'Espacio', anio: 2023, estadoColeccion: 'COLECCIÓN' }),
      makeMinifigura({ id: 'b', nombre: 'Pirata', tematica: 'Mar', anio: 2023, estadoColeccion: 'BUSCADA' }),
    makeMinifigura({ id: 'c', nombre: 'Constructor', tematica: 'Espacio', anio: 2024, estadoColeccion: 'COLECCIÓN' }),
      makeMinifigura({ id: 'd', nombre: 'Samurái', tematica: 'Historia', anio: 2024, estadoColeccion: 'BUSCADA' }),
  ]);

  await withServer(catalog, async (baseUrl) => {
    const byTheme = await fetch(`${baseUrl}/minifiguras?tema=espacio`);
    assert.equal(byTheme.status, 200);
    assert.deepEqual(await byTheme.json(), [
      makeMinifigura({ id: 'a', nombre: 'Explorador', tematica: 'Espacio', anio: 2023, estadoColeccion: 'COLECCIÓN' }),
      makeMinifigura({ id: 'c', nombre: 'Constructor', tematica: 'Espacio', anio: 2024, estadoColeccion: 'COLECCIÓN' }),
    ]);

    const byYear = await fetch(`${baseUrl}/minifiguras?anio=2023`);
    assert.equal(byYear.status, 200);
    assert.deepEqual(await byYear.json(), [
      makeMinifigura({ id: 'a', nombre: 'Explorador', tematica: 'Espacio', anio: 2023, estadoColeccion: 'COLECCIÓN' }),
        makeMinifigura({ id: 'b', nombre: 'Pirata', tematica: 'Mar', anio: 2023, estadoColeccion: 'BUSCADA' }),
    ]);

    const byCollectionState = await fetch(`${baseUrl}/minifiguras?estadoColeccion=coleccion`);
    assert.equal(byCollectionState.status, 200);
    assert.deepEqual(await byCollectionState.json(), [
      makeMinifigura({ id: 'a', nombre: 'Explorador', tematica: 'Espacio', anio: 2023, estadoColeccion: 'COLECCIÓN' }),
      makeMinifigura({ id: 'c', nombre: 'Constructor', tematica: 'Espacio', anio: 2024, estadoColeccion: 'COLECCIÓN' }),
    ]);

    const combined = await fetch(`${baseUrl}/minifiguras?tema=espacio&anio=2023&estadoColeccion=coleccion`);
    assert.equal(combined.status, 200);
    assert.deepEqual(await combined.json(), [
      makeMinifigura({ id: 'a', nombre: 'Explorador', tematica: 'Espacio', anio: 2023, estadoColeccion: 'COLECCIÓN' }),
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
    makeMinifigura({ id: 'a', tematica: 'Espacio', estadoColeccion: 'COLECCIÓN' }),
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

test('GET /minifiguras rechaza un estado de filtro invalido', async () => {
  await withServer(JSON.stringify([makeMinifigura({ id: 'a' })]), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/minifiguras?estadoColeccion=VENDIDA`);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'PARAMETRO_INVALIDO', parametro: 'estadoColeccion' });
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

test('conserva los campos planos de precio y calcula el total priorizando precio', async () => {
  const catalog = JSON.stringify([
    makeMinifigura({ id: 'a', precioCompra: 20, fechaCompra: '2024-01-15', precio: 35 }),
    makeMinifigura({ id: 'b', precioCompra: 12 }),
    makeMinifigura({ id: 'c' }),
  ]);

  await withServer(catalog, async (baseUrl) => {
    const list = await fetch(`${baseUrl}/minifiguras`);
    assert.equal(list.status, 200);
    assert.deepEqual((await list.json()).map(({ id, precioCompra, fechaCompra, precio }) => ({ id, precioCompra, fechaCompra, precio })), [
      { id: 'a', precioCompra: 20, fechaCompra: '2024-01-15', precio: 35 },
      { id: 'b', precioCompra: 12, precio: undefined, fechaCompra: undefined },
      { id: 'c', precioCompra: undefined, precio: undefined, fechaCompra: undefined },
    ]);

    const total = await fetch(`${baseUrl}/valoracion`);
    assert.equal(total.status, 200);
    assert.deepEqual(await total.json(), {
      total: 47,
      enColeccion: 3,
      buscadas: 0,
      top5: [
        { id: 'a', nombre: 'Explorador', precio: 35 },
        { id: 'c', nombre: 'Explorador' },
        { id: 'b', nombre: 'Explorador' },
      ],
      top5Antiguas: [
        { id: 'a', nombre: 'Explorador', anio: 2023, precio: 35 },
        { id: 'c', nombre: 'Explorador', anio: 2023 },
        { id: 'b', nombre: 'Explorador', anio: 2023 },
      ],
    });
  });
});

test('excluye las minifiguras BUSCADA del valor total', async () => {
  const catalog = JSON.stringify([
    makeMinifigura({ id: 'coleccion', estadoColeccion: 'COLECCIÓN', precio: 25 }),
    makeMinifigura({ id: 'buscada', estadoColeccion: 'BUSCADA', precio: 90, precioCompra: 40 }),
  ]);

  await withServer(catalog, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/valoracion`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      total: 25,
      enColeccion: 1,
      buscadas: 1,
      top5: [{ id: 'coleccion', nombre: 'Explorador', precio: 25 }],
      top5Antiguas: [{ id: 'coleccion', nombre: 'Explorador', anio: 2023, precio: 25 }],
    });
  });
});

test('calcula el top cinco por precio, fecha y posicion posterior del JSON', async () => {
  const catalog = JSON.stringify([
    makeMinifigura({ id: 'old', nombre: 'Antigua', anio: 1988, precio: 50, fechaCompra: '2020-01-01' }),
    makeMinifigura({ id: 'same-old', nombre: 'Misma fecha', anio: 1988, precio: 50, fechaCompra: '2020-01-01' }),
    makeMinifigura({ id: 'newer', nombre: 'Nueva', anio: 1988, precio: 50, fechaCompra: '2021-01-01' }),
    makeMinifigura({ id: 'searched', nombre: 'Buscada', anio: 1988, precio: 999, estadoColeccion: 'BUSCADA' }),
    makeMinifigura({ id: 'no-date', nombre: 'Sin fecha', anio: 1988, precio: 40 }),
  ]);

  await withServer(catalog, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/valoracion`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).top5, [
      { id: 'same-old', nombre: 'Misma fecha', precio: 50 },
      { id: 'old', nombre: 'Antigua', precio: 50 },
      { id: 'newer', nombre: 'Nueva', precio: 50 },
      { id: 'no-date', nombre: 'Sin fecha', precio: 40 },
    ]);
    assert.deepEqual((await (await fetch(`${baseUrl}/valoracion`)).json()).top5Antiguas, [
      { id: 'newer', nombre: 'Nueva', anio: 1988, precio: 50 },
      { id: 'same-old', nombre: 'Misma fecha', anio: 1988, precio: 50 },
      { id: 'old', nombre: 'Antigua', anio: 1988, precio: 50 },
      { id: 'no-date', nombre: 'Sin fecha', anio: 1988, precio: 40 },
    ]);
  });
});

test('el top por precio incluye al final las figuras de coleccion sin precio', async () => {
  const catalog = JSON.stringify([
    makeMinifigura({ id: 'priced', precio: 25 }),
    makeMinifigura({ id: 'unpriced' }),
  ]);

  await withServer(catalog, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/valoracion`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).top5, [
      { id: 'priced', nombre: 'Explorador', precio: 25 },
      { id: 'unpriced', nombre: 'Explorador' },
    ]);
  });
});

test('rechaza estados distintos de COLECCIÓN y BUSCADA y aplica COLECCIÓN por defecto', async () => {
  await withServer(JSON.stringify([makeMinifigura({ id: 'a' })]), async (baseUrl) => {
    const invalid = await fetch(`${baseUrl}/minifiguras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeMinifigura({ id: 'invalid', estadoColeccion: 'VENDIDA' })),
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { error: 'MINIFIGURA_INVALIDA' });

    const created = await fetch(`${baseUrl}/minifiguras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...makeMinifigura({ id: 'default' }), estadoColeccion: undefined }),
    });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).estadoColeccion, 'COLECCIÓN');

    const createdWithEmptyState = await fetch(`${baseUrl}/minifiguras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...makeMinifigura({ id: 'empty' }), estadoColeccion: '' }),
    });
    assert.equal(createdWithEmptyState.status, 201);
    assert.equal((await createdWithEmptyState.json()).estadoColeccion, 'COLECCIÓN');

    const replacedWithEmptyState = await fetch(`${baseUrl}/minifiguras/empty`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...makeMinifigura({ id: 'empty', nombre: 'Editada' }), estadoColeccion: '' }),
    });
    assert.equal(replacedWithEmptyState.status, 200);
    assert.equal((await replacedWithEmptyState.json()).estadoColeccion, 'COLECCIÓN');
  });
});

test('rechaza variantes no canónicas del estado', async () => {
  await withServer(JSON.stringify([makeMinifigura({ id: 'a' })]), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/minifiguras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeMinifigura({ id: 'lowercase', estadoColeccion: 'coleccion' })),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'MINIFIGURA_INVALIDA' });
  });
});

test('rechaza campos anidados o de moneda en el modelo plano', async () => {
  await withServer(JSON.stringify([makeMinifigura({ id: 'a' })]), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/minifiguras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeMinifigura({
        id: 'nested',
        valoracion: { valorMercado: 20 },
        moneda: 'EUR',
      })),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'MINIFIGURA_INVALIDA' });

    const persisted = await fetch(`${baseUrl}/minifiguras`);
    assert.deepEqual(await persisted.json(), [makeMinifigura({ id: 'a' })]);
  });
});

test('rechaza campos planos de precio invalidos', async () => {
  for (const invalid of [
    { precioCompra: -1 },
    { precio: '12.5' },
    { fechaCompra: '15-01-2024' },
    { fechaCompra: '2024-02-31' },
  ]) {
    await withServer(JSON.stringify([makeMinifigura({ id: 'a', ...invalid })]), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/minifiguras`);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: 'CATALOGO_INVALIDO' });
    });
  }
});

test('rechaza un catálogo con estado ausente', async () => {
  const { estadoColeccion, ...sinEstado } = makeMinifigura({ id: 'sin-estado' });
  void estadoColeccion;

  await withServer(JSON.stringify([sinEstado]), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/minifiguras`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'CATALOGO_INVALIDO' });
  });
});

test('consulta el precio individual y actualiza precios de forma masiva aunque haya fallos', async () => {
  const catalog = JSON.stringify([
    makeMinifigura({ id: 'a', precio: 10 }),
    makeMinifigura({ id: 'b', precio: 20 }),
  ]);
  const fetchImpl = async (url) => {
    if (url.endsWith('/a')) {
      return new Response('<span>Current Value - New</span><strong>€35.50</strong>', { status: 200 });
    }
    if (url.endsWith('/b')) {
      return new Response('sin precio', { status: 200 });
    }
    throw new Error('URL inesperada');
  };

  await withServerOptions(catalog, { fetchImpl }, async (baseUrl) => {
    const individual = await fetch(`${baseUrl}/minifiguras/a/precio`);
    assert.equal(individual.status, 200);
    assert.deepEqual(await individual.json(), { id: 'a', precio: 35.5 });

    const sync = await fetch(`${baseUrl}/sincronizacion/brickset`, { method: 'POST' });
    assert.equal(sync.status, 200);
    assert.deepEqual(await sync.json(), {
      actualizados: ['a'],
      fallidos: [{ id: 'b', error: 'BRICKSET_PRECIO_NO_DISPONIBLE' }],
      total: 2,
    });

    const persisted = await fetch(`${baseUrl}/minifiguras`);
    const items = await persisted.json();
    assert.equal(items.find((item) => item.id === 'a').precio, 35.5);
    assert.equal(items.find((item) => item.id === 'b').precio, 20);
  });
});

test('consulta el precio individual para un id todavía no persistido', async () => {
  const fetchImpl = async (url) => {
    assert.equal(url, 'https://brickset.com/minifigs/new-figure');
    return new Response('<span>Current Value - New</span><strong>€18.75</strong>', { status: 200 });
  };

  await withServerOptions(JSON.stringify([makeMinifigura({ id: 'existing' })]), { fetchImpl }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/minifiguras/new-figure/precio`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: 'new-figure', precio: 18.75 });
  });
});

test('updatePrices conserva el archivo original si falla la persistencia', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'minifiguras-persist-failure-'));
  const catalogPath = join(directory, 'minifiguras.json');
  const originalCatalog = JSON.stringify([makeMinifigura({ id: 'a', precio: 10 })]);
  await writeFile(catalogPath, originalCatalog);

  try {
    const repository = new MinifigurasRepository(catalogPath);
    repository.persist = async () => {
      throw new Error('fallo de persistencia simulado');
    };

    await assert.rejects(
      () => repository.updatePrices(new Map([['a', 99]])),
      /fallo de persistencia simulado/,
    );
    assert.equal(await readFile(catalogPath, 'utf8'), originalCatalog);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('updatePrices rechaza precios invalidos antes de persistir', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'minifiguras-invalid-price-'));
  const catalogPath = join(directory, 'minifiguras.json');
  const originalCatalog = JSON.stringify([makeMinifigura({ id: 'a', precio: 10 })]);
  await writeFile(catalogPath, originalCatalog);

  try {
    const repository = new MinifigurasRepository(catalogPath);
    await assert.rejects(
      () => repository.updatePrices(new Map([['a', -1]])),
      (error) => error.code === 'MINIFIGURA_INVALIDA',
    );
    assert.equal(await readFile(catalogPath, 'utf8'), originalCatalog);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('updatePrices rechaza IDs inexistentes y precios undefined', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'minifiguras-update-validation-'));
  const catalogPath = join(directory, 'minifiguras.json');
  await writeFile(catalogPath, JSON.stringify([makeMinifigura({ id: 'a', precio: 10 })]));

  try {
    const repository = new MinifigurasRepository(catalogPath);
    await assert.rejects(() => repository.updatePrices(new Map([['missing', 20]])), (error) => error.code === 'MINIFIGURA_NO_ENCONTRADA');
    await assert.rejects(() => repository.updatePrices(new Map([['a', undefined]])), (error) => error.code === 'MINIFIGURA_INVALIDA');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
