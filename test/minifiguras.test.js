import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { MinifigurasRepository } from '../src/minifiguras-repository.js';
import { createServer } from '../src/server.js';
import { CategoriasRepository } from '../src/categorias-repository.js';

const officialCategoriasRaw = await readFile(
  new URL('../data/categorias-brickset.json', import.meta.url),
  'utf8',
);
const officialCategoriaNames = new Set(JSON.parse(officialCategoriasRaw).map(({ categoria }) => categoria));

async function withServer(catalog, callback) {
  const directory = await mkdtemp(join(tmpdir(), 'minifiguras-'));
  const catalogPath = join(directory, 'minifiguras.json');
  const themesPath = join(directory, 'temas.json');
  if (catalog !== undefined) {
    await writeFile(catalogPath, catalog);
  }
  await writeFile(themesPath, officialCategoriasRaw);

  const server = createServer({ catalogPath, themesPath });
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
  const themesPath = join(directory, 'temas.json');
  await writeFile(catalogPath, catalog);
  await writeFile(themesPath, officialCategoriasRaw);
  const server = createServer({ catalogPath, themesPath, ...options });
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
    categoria: 'Space',
    anio: 2023,
    estadoColeccion: 'COLECCIÓN',
    FechaRegistro: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

async function repositoryWithOfficialCategorias(directory, catalogPath) {
  const themesPath = join(directory, 'temas.json');
  await writeFile(themesPath, officialCategoriasRaw);
  return new MinifigurasRepository(catalogPath, {
    categoriasRepository: new CategoriasRepository(themesPath),
  });
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

test('GET /categorias devuelve el catalogo oficial en el orden persistido', async () => {
  const catalog = JSON.stringify([makeMinifigura({ id: 'a', categoria: 'Space' })]);

  await withServer(catalog, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/categorias`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), JSON.parse(officialCategoriasRaw));
  });
});

test('GET /minifiguras filtra por categoria, anio y estado de coleccion', async () => {
  const catalog = JSON.stringify([
    makeMinifigura({ id: 'a', nombre: 'Explorador', categoria: 'Space', anio: 2023, estadoColeccion: 'COLECCIÓN' }),
      makeMinifigura({ id: 'b', nombre: 'Pirata', categoria: 'Castle', anio: 2023, estadoColeccion: 'BUSCADA' }),
    makeMinifigura({ id: 'c', nombre: 'Constructor', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN' }),
      makeMinifigura({ id: 'd', nombre: 'Samurái', categoria: 'Collectible Minifigures', anio: 2024, estadoColeccion: 'BUSCADA' }),
  ]);

  await withServer(catalog, async (baseUrl) => {
    const byTheme = await fetch(`${baseUrl}/minifiguras?categoria=space`);
    assert.equal(byTheme.status, 200);
    assert.deepEqual(await byTheme.json(), [
      makeMinifigura({ id: 'a', nombre: 'Explorador', categoria: 'Space', anio: 2023, estadoColeccion: 'COLECCIÓN' }),
      makeMinifigura({ id: 'c', nombre: 'Constructor', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN' }),
    ]);

    const byYear = await fetch(`${baseUrl}/minifiguras?anio=2023`);
    assert.equal(byYear.status, 200);
    assert.deepEqual(await byYear.json(), [
      makeMinifigura({ id: 'a', nombre: 'Explorador', categoria: 'Space', anio: 2023, estadoColeccion: 'COLECCIÓN' }),
        makeMinifigura({ id: 'b', nombre: 'Pirata', categoria: 'Castle', anio: 2023, estadoColeccion: 'BUSCADA' }),
    ]);

    const byCollectionState = await fetch(`${baseUrl}/minifiguras?estadoColeccion=coleccion`);
    assert.equal(byCollectionState.status, 200);
    assert.deepEqual(await byCollectionState.json(), [
      makeMinifigura({ id: 'a', nombre: 'Explorador', categoria: 'Space', anio: 2023, estadoColeccion: 'COLECCIÓN' }),
      makeMinifigura({ id: 'c', nombre: 'Constructor', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN' }),
    ]);

    const combined = await fetch(`${baseUrl}/minifiguras?categoria=space&anio=2023&estadoColeccion=coleccion`);
    assert.equal(combined.status, 200);
    assert.deepEqual(await combined.json(), [
      makeMinifigura({ id: 'a', nombre: 'Explorador', categoria: 'Space', anio: 2023, estadoColeccion: 'COLECCIÓN' }),
    ]);
  });
});

test('GET /minifiguras filtra por id y subcategoria', async () => {
  const catalog = JSON.stringify([
    makeMinifigura({ id: 'col079', nombre: 'Gangster', categoria: 'Collectible Minifigures', subcategoria: 'Team GB' }),
    makeMinifigura({ id: 'col080', nombre: 'Otro', categoria: 'Collectible Minifigures', subcategoria: 'The LEGO Movie' }),
    makeMinifigura({ id: 'other-id', nombre: 'Sin subcategoria', categoria: 'Space' }),
  ]);

  await withServer(catalog, async (baseUrl) => {
    const byId = await fetch(`${baseUrl}/minifiguras?id=col0`);
    assert.equal(byId.status, 200);
    assert.deepEqual((await byId.json()).map((item) => item.id), ['col079', 'col080']);

    const bySubcategoria = await fetch(`${baseUrl}/minifiguras?subcategoria=${encodeURIComponent('Team GB')}`);
    assert.equal(bySubcategoria.status, 200);
    assert.deepEqual((await bySubcategoria.json()).map((item) => item.id), ['col079']);

    const combined = await fetch(`${baseUrl}/minifiguras?categoria=${encodeURIComponent('Collectible Minifigures')}&subcategoria=${encodeURIComponent('The LEGO Movie')}`);
    assert.equal(combined.status, 200);
    assert.deepEqual((await combined.json()).map((item) => item.id), ['col080']);
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

test('POST y PUT rechazan una subcategoria que no pertenece a la categoria', async () => {
  const initialCatalog = JSON.stringify([makeMinifigura({ id: 'a', categoria: 'Space' })]);

  await withServer(initialCatalog, async (baseUrl) => {
    const invalidCreate = await fetch(`${baseUrl}/minifiguras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeMinifigura({ id: 'b', categoria: 'Collectible Minifigures', subcategoria: 'No existe' })),
    });
    assert.equal(invalidCreate.status, 400);
    assert.deepEqual(await invalidCreate.json(), { error: 'MINIFIGURA_INVALIDA' });

    const invalidReplace = await fetch(`${baseUrl}/minifiguras/a`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeMinifigura({ id: 'a', categoria: 'Space', subcategoria: 'No aplica' })),
    });
    assert.equal(invalidReplace.status, 400);
    assert.deepEqual(await (await fetch(`${baseUrl}/minifiguras`)).json(), JSON.parse(initialCatalog));
  });
});

test('POST acepta una subcategoria valida perteneciente a la categoria', async () => {
  const initialCatalog = JSON.stringify([makeMinifigura({ id: 'a', categoria: 'Space' })]);

  await withServer(initialCatalog, async (baseUrl) => {
    const payload = makeMinifigura({ id: 'b', categoria: 'Collectible Minifigures', subcategoria: 'Team GB' });
    const response = await fetch(`${baseUrl}/minifiguras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), payload);
  });
});

test('POST y PUT aceptan descripcion y anio ausentes y conservan FechaRegistro', async () => {
  await withServer('[]', async (baseUrl) => {
    const payload = { id: 'optional-fields', nombre: 'Sin datos extra', categoria: 'Space', estadoColeccion: 'COLECCIÓN' };
    const createdResponse = await fetch(`${baseUrl}/minifiguras`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    assert.equal(created.descripcion, undefined);
    assert.equal(created.anio, undefined);
    assert.match(created.FechaRegistro, /^\d{4}-\d{2}-\d{2}T/);

    const replacementResponse = await fetch(`${baseUrl}/minifiguras/optional-fields`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    assert.equal(replacementResponse.status, 200);
    const replacement = await replacementResponse.json();
    assert.equal(replacement.FechaRegistro, created.FechaRegistro);
  });
});

test('el total de una subcategoria (0, ausente o un numero) no afecta si una minifigura la acepta como valida', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'minifiguras-subcategoria-total-'));
  const catalogPath = join(directory, 'minifiguras.json');
  const themesPath = join(directory, 'temas.json');
  const categorias = [{
    categoria: 'Collectible Minifigures',
    total: 3,
    subcategorias: [
      { subcategoria: 'Sin total definido' },
      { subcategoria: 'Total en cero', total: 0 },
      { subcategoria: 'Total numerico', total: 16 },
    ],
  }];
  await writeFile(catalogPath, '[]');
  await writeFile(themesPath, JSON.stringify(categorias));

  const server = createServer({ catalogPath, themesPath });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    for (const subcategoria of ['Sin total definido', 'Total en cero', 'Total numerico']) {
      const payload = makeMinifigura({ id: subcategoria, categoria: 'Collectible Minifigures', subcategoria });
      const response = await fetch(`http://127.0.0.1:${port}/minifiguras`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      assert.equal(response.status, 201, `la subcategoria "${subcategoria}" deberia aceptarse sin importar su total`);
    }

    const persisted = await fetch(`http://127.0.0.1:${port}/minifiguras`);
    assert.deepEqual((await persisted.json()).map((item) => item.subcategoria), [
      'Sin total definido',
      'Total en cero',
      'Total numerico',
    ]);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test('GET /minifiguras conserva la comparacion insensible a mayusculas y permite resultados vacios', async () => {
  const catalog = JSON.stringify([
    makeMinifigura({ id: 'a', categoria: 'Space', estadoColeccion: 'COLECCIÓN' }),
  ]);

  await withServer(catalog, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/minifiguras?categoria=SPACE&estadoColeccion=coleccion`);
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

test('GET, POST y PUT rechazan temas que no pertenecen al catalogo oficial', async () => {
  const initialCatalog = JSON.stringify([makeMinifigura({ id: 'a', categoria: 'Space' })]);

  await withServer(initialCatalog, async (baseUrl) => {
    const invalidFilter = await fetch(`${baseUrl}/minifiguras?categoria=Desconocido`);
    assert.equal(invalidFilter.status, 400);
    assert.deepEqual(await invalidFilter.json(), { error: 'MINIFIGURA_INVALIDA', parametro: 'categoria' });

    const invalidCreate = await fetch(`${baseUrl}/minifiguras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeMinifigura({ id: 'b', categoria: 'Desconocido' })),
    });
    assert.equal(invalidCreate.status, 400);

    const invalidReplace = await fetch(`${baseUrl}/minifiguras/a`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeMinifigura({ id: 'a', categoria: 'Desconocido' })),
    });
    assert.equal(invalidReplace.status, 400);
    assert.deepEqual(await (await fetch(`${baseUrl}/minifiguras`)).json(), JSON.parse(initialCatalog));
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

test('las operaciones de minifiguras informan errores del catalogo de temas', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'minifiguras-temas-invalidos-'));
  const catalogPath = join(directory, 'minifiguras.json');
  const themesPath = join(directory, 'temas.json');
  const catalog = [makeMinifigura({ id: 'a' })];
  await writeFile(catalogPath, JSON.stringify(catalog));

  const server = createServer({ catalogPath, themesPath });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const list = await fetch(`http://127.0.0.1:${port}/minifiguras`);
    assert.equal(list.status, 500);
    assert.deepEqual(await list.json(), { error: 'CATEGORIAS_NO_DISPONIBLES' });

    const create = await fetch(`http://127.0.0.1:${port}/minifiguras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeMinifigura({ id: 'b' })),
    });
    assert.equal(create.status, 500);
    assert.deepEqual(await create.json(), { error: 'CATEGORIAS_NO_DISPONIBLES' });

    const replace = await fetch(`http://127.0.0.1:${port}/minifiguras/a`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeMinifigura({ id: 'a' })),
    });
    assert.equal(replace.status, 500);
    assert.deepEqual(await replace.json(), { error: 'CATEGORIAS_NO_DISPONIBLES' });
    assert.deepEqual(JSON.parse(await readFile(catalogPath, 'utf8')), catalog);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test('POST /minifiguras crea una minifigura y persiste el catalogo actualizado', async () => {
  const initialCatalog = JSON.stringify([
    makeMinifigura({ id: 'a' }),
  ]);

  await withServer(initialCatalog, async (baseUrl) => {
    const payload = makeMinifigura({ id: 'b', nombre: 'Constructora', categoria: 'Space' });

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
    const replacement = makeMinifigura({ id: 'b', nombre: 'Reemplazada', categoria: 'Space' });
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

test('POST /minifiguras rechaza cuerpo invalido, falta de categoria y duplicados', async () => {
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
  assert.ok(catalog.every((minifigura) => (
    officialCategoriaNames.has(minifigura.categoria)
    && minifigura.categoria !== 'Series 5'
    && minifigura.categoria !== 'Series 9'
    && minifigura.anio
  )));
});

test('la migracion conserva estados y todos los temas persistidos son oficiales', async () => {
  const content = await readFile(new URL('../data/minifiguras.json', import.meta.url), 'utf8');
  const catalog = JSON.parse(content);

  assert.ok(catalog.every((minifigura) => officialCategoriaNames.has(minifigura.categoria)));
  assert.ok(catalog.every((minifigura) => ['COLECCIÓN', 'BUSCADA'].includes(minifigura.estadoColeccion)));
  assert.equal(catalog.some((minifigura) => /^Series\s+/i.test(minifigura.categoria)), false);
});

test('la migracion conserva el orden y los datos de valoracion persistidos', async () => {
  const content = await readFile(new URL('../data/minifiguras.json', import.meta.url), 'utf8');
  const catalog = JSON.parse(content);
  const expected = [
    ['col079', 'BUSCADA', undefined, undefined, 9.07],
    ['ST008', 'COLECCIÓN', 35.49, '2026-07-22', 109.56],
    ['LOR139', 'COLECCIÓN', undefined, undefined, 33.53],
    ['EDI002', 'COLECCIÓN', 16.11, '2026-05-26', 11.32],
    ['IDEA106', 'COLECCIÓN', undefined, undefined, 16.85],
    ['EDI003', 'COLECCIÓN', 15.2, '2026-05-26', 10.81],
    ['NIKE001', 'COLECCIÓN', undefined, undefined, 18.32],
    ['DIM018', 'COLECCIÓN', 25.69, '2026-09-20', 26.57],
    ['DIM040', 'COLECCIÓN', 21.28, '2026-07-09', 77.49],
    ['COL137', 'BUSCADA', undefined, undefined, 18.68],
    ['DIM030', 'BUSCADA', undefined, undefined, 30.18],
    ['DIM033', 'BUSCADA', undefined, undefined, 21.66],
    ['DIM032', 'BUSCADA', undefined, undefined, 20.98],
    ['NJO1048', 'COLECCIÓN', 7.99, undefined, 14.88],
    ['COLSH10', 'COLECCIÓN', undefined, undefined, 40.92],
    ['ST014', 'COLECCIÓN', undefined, undefined, 36.86],
    ['CAS215', 'COLECCIÓN', undefined, undefined, 17.53],
    ['WW008', 'COLECCIÓN', undefined, undefined, 10.53],
    ['NJO1051', 'COLECCIÓN', 7.99, undefined, 17.93],
    ['SH1152', 'COLECCIÓN', undefined, undefined, 51.87],
    ['NJO1035', 'COLECCIÓN', 0, '2026-09-23', 17.65],
    ['SW1278', 'COLECCIÓN', 0, '2026-09-23', 3.06],
    ['SW0879', 'COLECCIÓN', undefined, undefined, 22.49],
    ['HP035', 'COLECCIÓN', undefined, undefined, 8.88],
    ['COL450', 'COLECCIÓN', 3.99, undefined, 9.26],
  ];

  assert.deepEqual(catalog.map((item) => [
    item.id,
    item.estadoColeccion,
    item.precioCompra,
    item.fechaCompra,
    item.precio,
  ]), expected);
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

test('consulta los datos individuales de Brickset y actualiza precios de forma masiva aunque haya fallos', async () => {
  const catalog = JSON.stringify([
    makeMinifigura({ id: 'a', precio: 10 }),
    makeMinifigura({ id: 'b', precio: 20 }),
  ]);
  const fetchImpl = async (url) => {
    if (url.endsWith('/a')) {
      return new Response(
        "<dl><dt>Category</dt><dd><a href='/minifigs/category-Space'>Space</a></dd><dt>Year released</dt><dd><a href='/minifigs/year-2023'>2023</a></dd></dl><span>Current Value - New</span><strong>€35.50</strong>",
        { status: 200 },
      );
    }
    if (url.endsWith('/b')) {
      return new Response('sin precio', { status: 200 });
    }
    throw new Error('URL inesperada');
  };

  await withServerOptions(catalog, { fetchImpl }, async (baseUrl) => {
    const individual = await fetch(`${baseUrl}/minifiguras/a/brickset`);
    assert.equal(individual.status, 200);
    assert.deepEqual(await individual.json(), { id: 'a', categoria: 'Space', anio: 2023, precio: 35.5 });

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

test('GET /minifiguras/:id/brickset resuelve subcategoria conocida y omite una desconocida', async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith('/con-subcategoria')) {
      return new Response(
        "<dl><dt>Category</dt><dd><a href='/minifigs/category-Collectible-Minifigures'>Collectible Minifigures</a></dd><dt>Subcategory</dt><dd><a href='/minifigs/category-Collectible-Minifigures/subcategory-Team-GB'>Team GB</a></dd><dt>Year released</dt><dd><a href='/minifigs/year-2012'>2012</a></dd></dl><p>Current Value - New</p><span>€9.07</span>",
        { status: 200 },
      );
    }
    if (url.endsWith('/subcategoria-desconocida')) {
      return new Response(
        "<dl><dt>Category</dt><dd><a href='/minifigs/category-Space'>Space</a></dd><dt>Subcategory</dt><dd><a href='/minifigs/category-Space/subcategory-General'>General</a></dd><dt>Year released</dt><dd><a href='/minifigs/year-2015'>2015</a></dd></dl><p>Current Value - New</p><span>€3</span>",
        { status: 200 },
      );
    }
    if (url.endsWith('/categoria-desconocida')) {
      return new Response(
        "<dl><dt>Category</dt><dd><a href='/minifigs/category-Inexistente'>Inexistente</a></dd><dt>Year released</dt><dd><a href='/minifigs/year-2015'>2015</a></dd></dl><p>Current Value - New</p><span>€3</span>",
        { status: 200 },
      );
    }
    throw new Error('URL inesperada');
  };

  await withServerOptions('[]', { fetchImpl }, async (baseUrl) => {
    const conSubcategoria = await fetch(`${baseUrl}/minifiguras/con-subcategoria/brickset`);
    assert.equal(conSubcategoria.status, 200);
    assert.deepEqual(await conSubcategoria.json(), {
      id: 'con-subcategoria',
      categoria: 'Collectible Minifigures',
      subcategoria: 'Team GB',
      anio: 2012,
      precio: 9.07,
    });

    const subcategoriaDesconocida = await fetch(`${baseUrl}/minifiguras/subcategoria-desconocida/brickset`);
    assert.equal(subcategoriaDesconocida.status, 200);
    assert.deepEqual(await subcategoriaDesconocida.json(), {
      id: 'subcategoria-desconocida',
      categoria: 'Space',
      anio: 2015,
      precio: 3,
    });

    const categoriaDesconocida = await fetch(`${baseUrl}/minifiguras/categoria-desconocida/brickset`);
    assert.equal(categoriaDesconocida.status, 502);
    assert.deepEqual(await categoriaDesconocida.json(), { error: 'BRICKSET_CATEGORIA_DESCONOCIDA' });
  });
});

test('GET /minifiguras/:id/brickset resuelve COL041 aunque Brickset duplique espacios', async () => {
  const fetchImpl = async () => new Response(
    "<dl><dt>Category</dt><dd><a href='/minifigs/category-Collectible-Minifigures'>Collectible Minifigures</a></dd><dt>Subcategory</dt><dd><a href='/minifigs/category-Collectible-Minifigures/subcategory-Series-3-Minifigures'>Series  3 Minifigures</a></dd><dt>Year released</dt><dd>2011</dd></dl><p>Current Value - New</p><span>€6.28</span>",
    { status: 200 },
  );

  await withServerOptions('[]', { fetchImpl }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/minifiguras/COL041/brickset`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      id: 'COL041',
      categoria: 'Collectible Minifigures',
      subcategoria: 'Series 3 Minifigures',
      anio: 2011,
      precio: 6.28,
    });
  });
});

test('una ruta existente /brickset con un metodo no permitido devuelve 405', async () => {
  await withServer('[]', async (baseUrl) => {
    const response = await fetch(`${baseUrl}/minifiguras/a/brickset`, { method: 'POST' });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET');
    assert.deepEqual(await response.json(), { error: 'METODO_NO_PERMITIDO' });
  });
});

test('consulta los datos de Brickset para un id todavía no persistido', async () => {
  const fetchImpl = async (url) => {
    assert.equal(url, 'https://brickset.com/minifigs/new-figure');
    return new Response(
      "<dl><dt>Category</dt><dd><a href='/minifigs/category-Space'>Space</a></dd><dt>Year released</dt><dd><a href='/minifigs/year-2020'>2020</a></dd></dl><span>Current Value - New</span><strong>€18.75</strong>",
      { status: 200 },
    );
  };

  await withServerOptions(JSON.stringify([makeMinifigura({ id: 'existing' })]), { fetchImpl }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/minifiguras/new-figure/brickset`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: 'new-figure', categoria: 'Space', anio: 2020, precio: 18.75 });
  });
});

test('updatePrices conserva el archivo original si falla la persistencia', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'minifiguras-persist-failure-'));
  const catalogPath = join(directory, 'minifiguras.json');
  const originalCatalog = JSON.stringify([makeMinifigura({ id: 'a', precio: 10 })]);
  await writeFile(catalogPath, originalCatalog);

  try {
    const repository = await repositoryWithOfficialCategorias(directory, catalogPath);
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
    const repository = await repositoryWithOfficialCategorias(directory, catalogPath);
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
    const repository = await repositoryWithOfficialCategorias(directory, catalogPath);
    await assert.rejects(() => repository.updatePrices(new Map([['missing', 20]])), (error) => error.code === 'MINIFIGURA_NO_ENCONTRADA');
    await assert.rejects(() => repository.updatePrices(new Map([['a', undefined]])), (error) => error.code === 'MINIFIGURA_INVALIDA');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('el repositorio no permite operar sin catálogo oficial de temas', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'minifiguras-required-themes-'));
  const catalogPath = join(directory, 'minifiguras.json');
  await writeFile(catalogPath, JSON.stringify([makeMinifigura({ id: 'a' })]));

  try {
    const repository = new MinifigurasRepository(catalogPath);
    await assert.rejects(
      () => repository.list(),
      (error) => error.code === 'CATEGORIAS_NO_DISPONIBLES',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
