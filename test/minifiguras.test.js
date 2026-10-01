import assert from 'node:assert/strict';
import test from 'node:test';
import { MinifigurasRepository } from '../src/minifiguras-repository.js';
import { categoriasMock, categoriasMockRaw } from '../test-support/fixtures.js';
import {
  OTHER_TOKEN,
  TEST_USER,
  authFetch,
  createTestClient,
  createTestSupabase,
  startTestServer,
} from '../test-support/server.js';

const officialCategoriasRaw = categoriasMockRaw;
const officialCategoriaNames = new Set(categoriasMock.map(({ categoria }) => categoria));
const fetch = authFetch();

async function withServer(catalog, callback, options = {}) {
  const server = await startTestServer({ catalog: catalog === undefined ? [] : JSON.parse(catalog), options });
  try {
    await callback(server.baseUrl, server.supabase);
  } finally {
    await server.close();
  }
}

async function withServerOptions(catalog, options, callback) {
  await withServer(catalog, callback, options);
}

function makeMinifigura(overrides = {}) {
  const minifigura = {
    id: 'MF-001',
    nombre: 'Explorador',
    descripcion: 'Figura espacial',
    categoria: 'Space',
    anio: 2023,
    estadoColeccion: 'COLECCIÓN',
    FechaRegistro: '2026-01-01T00:00:00.000Z',
    observada: false,
    ...overrides,
  };
  minifigura.id = minifigura.id.trim().toUpperCase();
  minifigura.observada ??= false;
  return minifigura;
}

function repositoryWith(catalog, { categoriasRepository = { read: async () => categoriasMock } } = {}) {
  const supabase = createTestSupabase(catalog);
  const repository = new MinifigurasRepository({
    client: createTestClient(supabase),
    userId: TEST_USER.id,
    categoriasRepository,
  });
  return { repository, supabase };
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
    assert.deepEqual((await byId.json()).map((item) => item.id), ['COL079', 'COL080']);

    const bySubcategoria = await fetch(`${baseUrl}/minifiguras?subcategoria=${encodeURIComponent('Team GB')}`);
    assert.equal(bySubcategoria.status, 200);
    assert.deepEqual((await bySubcategoria.json()).map((item) => item.id), ['COL079']);

    const combined = await fetch(`${baseUrl}/minifiguras?categoria=${encodeURIComponent('Collectible Minifigures')}&subcategoria=${encodeURIComponent('The LEGO Movie')}`);
    assert.equal(combined.status, 200);
    assert.deepEqual((await combined.json()).map((item) => item.id), ['COL080']);
  });
});

test('GET /minifiguras filtra por nombre y observacion y rechaza observacion invalida', async () => {
  const catalog = JSON.stringify([
    makeMinifigura({ id: 'watched', nombre: 'Princesa Ámbar', observada: true }),
    makeMinifigura({ id: 'unwatched', nombre: 'Astronauta Azul', observada: false }),
  ]);

  await withServer(catalog, async (baseUrl) => {
    const filtered = await fetch(`${baseUrl}/minifiguras?nombre=ambar&observada=true`);
    assert.equal(filtered.status, 200);
    assert.deepEqual((await filtered.json()).map((item) => item.id), ['WATCHED']);

    const invalid = await fetch(`${baseUrl}/minifiguras?observada=yes`);
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { error: 'PARAMETRO_INVALIDO', parametro: 'observada' });
  });
});

test('readCatalog mapea filas de Supabase omitiendo nulos y normalizando FechaRegistro', async () => {
  const { repository, supabase } = repositoryWith([]);
  supabase.seed('minifiguras', TEST_USER.id, [{
    id: 'ROW-ID', nombre: 'Fila', descripcion: null, categoria: 'Space', subcategoria: null, anio: null,
    estado_coleccion: 'COLECCIÓN', precio_compra: 12.5, fecha_compra: '2024-01-15', precio: null,
    fecha_registro: '2026-01-01T00:00:00+00:00', observada: false,
  }]);

  assert.deepEqual(await repository.readCatalog(), [{
    id: 'ROW-ID', nombre: 'Fila', categoria: 'Space', estadoColeccion: 'COLECCIÓN', precioCompra: 12.5,
    fechaCompra: '2024-01-15', FechaRegistro: '2026-01-01T00:00:00.000Z', observada: false,
  }]);
});

test('rechaza un catalogo con observada de tipo invalido', async () => {
  await withServer(JSON.stringify([makeMinifigura({ id: 'invalid-observed', observada: 'yes' })]), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/minifiguras`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'CATALOGO_INVALIDO' });
  });
});

test('la API limita la watchlist a diez y permite liberar el cupo', async () => {
  const catalog = JSON.stringify(Array.from({ length: 11 }, (_, index) => makeMinifigura({
    id: `watch-${index}`,
    observada: index < 10,
  })));

  await withServer(catalog, async (baseUrl) => {
    const rejected = await fetch(`${baseUrl}/minifiguras/watch-10/observada`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ observada: true }),
    });
    assert.equal(rejected.status, 409);
    assert.deepEqual(await rejected.json(), { error: 'LIMITE_OBSERVADAS' });

    const released = await fetch(`${baseUrl}/minifiguras/watch-0/observada`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ observada: false }),
    });
    assert.equal(released.status, 200);

    const accepted = await fetch(`${baseUrl}/minifiguras/watch-10/observada`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ observada: true }),
    });
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json()).observada, true);
  });
});

test('valoracion expone observadas ordenadas por precio incluyendo BUSCADA', async () => {
  const catalog = JSON.stringify([
    makeMinifigura({ id: 'low', precio: 10, observada: true }),
    makeMinifigura({ id: 'high', precio: 30, observada: true }),
    makeMinifigura({ id: 'wanted', estadoColeccion: 'BUSCADA', precio: 20, observada: true }),
    makeMinifigura({ id: 'none', observada: true }),
  ]);

  await withServer(catalog, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/valoracion`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).observadas.map(({ id }) => id), ['HIGH', 'WANTED', 'LOW', 'NONE']);
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
    const created = await response.json();
    assert.deepEqual({ ...created, FechaRegistro: payload.FechaRegistro }, payload);
    assert.match(created.FechaRegistro, /^\d{4}-\d{2}-\d{2}T/);
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
  const categorias = [{
    categoria: 'Collectible Minifigures',
    total: 3,
    subcategorias: [
      { subcategoria: 'Sin total definido' },
      { subcategoria: 'Total en cero', total: 0 },
      { subcategoria: 'Total numerico', total: 16 },
    ],
  }];
  const server = await startTestServer({ themesRaw: JSON.stringify(categorias) });

  try {
    for (const subcategoria of ['Sin total definido', 'Total en cero', 'Total numerico']) {
      const payload = makeMinifigura({ id: subcategoria, categoria: 'Collectible Minifigures', subcategoria });
      const response = await fetch(`${server.baseUrl}/minifiguras`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      assert.equal(response.status, 201, `la subcategoria "${subcategoria}" deberia aceptarse sin importar su total`);
    }

    const persisted = await fetch(`${server.baseUrl}/minifiguras`);
    assert.deepEqual((await persisted.json()).map((item) => item.subcategoria), [
      'Sin total definido',
      'Total en cero',
      'Total numerico',
    ]);
  } finally {
    await server.close();
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

test('GET /minifiguras devuelve error controlado si Supabase no esta disponible', async () => {
  await withServer('[]', async (baseUrl, supabase) => {
    supabase.failNext('minifiguras', { code: 'PGRST000', message: 'https://secreto.supabase.co caido' });
    const response = await fetch(`${baseUrl}/minifiguras`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'CATALOGO_NO_DISPONIBLE' });
  });
});

test('GET /minifiguras devuelve error controlado para registros con estructura invalida', async () => {
  for (const catalog of [JSON.stringify([{ id: 'SIN-NOMBRE' }]), JSON.stringify([{ id: 'X', nombre: 'X', categoria: 'Desconocida' }])]) {
    await withServer(catalog, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/minifiguras`);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: 'CATALOGO_INVALIDO' });
    });
  }
});

test('las operaciones de minifiguras informan errores del catalogo de temas', async () => {
  const catalog = [makeMinifigura({ id: 'a' })];
  const server = await startTestServer({ catalog, themesRaw: null });
  const baseUrl = server.baseUrl;

  try {
    const list = await fetch(`${baseUrl}/minifiguras`);
    assert.equal(list.status, 500);
    assert.deepEqual(await list.json(), { error: 'CATEGORIAS_NO_DISPONIBLES' });

    const create = await fetch(`${baseUrl}/minifiguras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeMinifigura({ id: 'b' })),
    });
    assert.equal(create.status, 500);
    assert.deepEqual(await create.json(), { error: 'CATEGORIAS_NO_DISPONIBLES' });

    const replace = await fetch(`${baseUrl}/minifiguras/a`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeMinifigura({ id: 'a' })),
    });
    assert.equal(replace.status, 500);
    assert.deepEqual(await replace.json(), { error: 'CATEGORIAS_NO_DISPONIBLES' });
    assert.deepEqual(server.supabase.rows('minifiguras').map(({ id, nombre }) => ({ id, nombre })), [{ id: 'A', nombre: 'Explorador' }]);
  } finally {
    await server.close();
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
    const created = await response.json();
    assert.deepEqual({ ...created, FechaRegistro: payload.FechaRegistro }, payload);
    assert.match(created.FechaRegistro, /^\d{4}-\d{2}-\d{2}T/);

    const persisted = await fetch(`${baseUrl}/minifiguras`);
    assert.deepEqual(await persisted.json(), [
      makeMinifigura({ id: 'a' }),
      created,
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
      { id: 'A', precioCompra: 20, fechaCompra: '2024-01-15', precio: 35 },
      { id: 'B', precioCompra: 12, precio: undefined, fechaCompra: undefined },
      { id: 'C', precioCompra: undefined, precio: undefined, fechaCompra: undefined },
    ]);

    const total = await fetch(`${baseUrl}/valoracion`);
    assert.equal(total.status, 200);
    assert.deepEqual(await total.json(), {
      total: 47,
      enColeccion: 3,
      buscadas: 0,
      observadas: [],
      top5: [
        { id: 'A', nombre: 'Explorador', precio: 35 },
        { id: 'C', nombre: 'Explorador' },
        { id: 'B', nombre: 'Explorador' },
      ],
      top5Antiguas: [
        { id: 'A', nombre: 'Explorador', anio: 2023, precio: 35 },
        { id: 'C', nombre: 'Explorador', anio: 2023 },
        { id: 'B', nombre: 'Explorador', anio: 2023 },
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
      observadas: [],
      top5: [{ id: 'COLECCION', nombre: 'Explorador', precio: 25 }],
      top5Antiguas: [{ id: 'COLECCION', nombre: 'Explorador', anio: 2023, precio: 25 }],
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
      { id: 'SAME-OLD', nombre: 'Misma fecha', precio: 50 },
      { id: 'OLD', nombre: 'Antigua', precio: 50 },
      { id: 'NEWER', nombre: 'Nueva', precio: 50 },
      { id: 'NO-DATE', nombre: 'Sin fecha', precio: 40 },
    ]);
    assert.deepEqual((await (await fetch(`${baseUrl}/valoracion`)).json()).top5Antiguas, [
      { id: 'NEWER', nombre: 'Nueva', anio: 1988, precio: 50 },
      { id: 'SAME-OLD', nombre: 'Misma fecha', anio: 1988, precio: 50 },
      { id: 'OLD', nombre: 'Antigua', anio: 1988, precio: 50 },
      { id: 'NO-DATE', nombre: 'Sin fecha', anio: 1988, precio: 40 },
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
      { id: 'PRICED', nombre: 'Explorador', precio: 25 },
      { id: 'UNPRICED', nombre: 'Explorador' },
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
  await withServer('[]', async (baseUrl, supabase) => {
    supabase.seed('minifiguras', TEST_USER.id, [{ id: 'SIN-ESTADO', nombre: 'Sin estado', categoria: 'Space', estado_coleccion: null }]);
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
    if (url.endsWith('/a') || url.endsWith('/A')) {
      return new Response(
        "<dl><dt>Category</dt><dd><a href='/minifigs/category-Space'>Space</a></dd><dt>Year released</dt><dd><a href='/minifigs/year-2023'>2023</a></dd></dl><span>Current Value - New</span><strong>€35.50</strong>",
        { status: 200 },
      );
    }
    if (url.endsWith('/b') || url.endsWith('/B')) {
      return new Response('sin precio', { status: 200 });
    }
    throw new Error('URL inesperada');
  };

  await withServerOptions(catalog, { fetchImpl, minIntervalMs: 0 }, async (baseUrl, supabase) => {
    const individual = await fetch(`${baseUrl}/minifiguras/a/brickset`);
    assert.equal(individual.status, 200);
    assert.deepEqual(await individual.json(), { id: 'A', categoria: 'Space', anio: 2023, precio: 35.5 });

    const sync = await fetch(`${baseUrl}/sincronizacion/brickset`, { method: 'POST' });
    assert.equal(sync.status, 202);
    assert.deepEqual(await sync.json(), { estado: 'en_curso', procesados: 0, total: 2, actualizados: [], fallidos: [] });

    let status;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      status = await fetch(`${baseUrl}/sincronizacion/brickset`);
      const result = await status.json();
      if (result.estado === 'completada') {
        assert.deepEqual(result, {
          estado: 'completada',
          procesados: 2,
          total: 2,
          actualizados: ['A'],
          fallidos: [{ id: 'B', error: 'BRICKSET_PRECIO_NO_DISPONIBLE' }],
        });
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    assert.equal(status?.status, 200);
    assert.equal(supabase.rows('minifiguras').find((item) => item.id === 'A').precio, 35.5);

    const persisted = await fetch(`${baseUrl}/minifiguras`);
    const items = await persisted.json();
    assert.equal(items.find((item) => item.id === 'A').precio, 35.5);
    assert.equal(items.find((item) => item.id === 'B').precio, 20);
  });
});

test('GET /sincronizacion/brickset exige autenticacion y aisla usuarios', async () => {
  await withServer(JSON.stringify([makeMinifigura({ id: 'a' })]), async (baseUrl) => {
    const anonymous = await globalThis.fetch(`${baseUrl}/sincronizacion/brickset`);
    assert.equal(anonymous.status, 401);

    const own = await fetch(`${baseUrl}/sincronizacion/brickset`);
    assert.deepEqual(await own.json(), { estado: 'inactiva' });
    const other = await authFetch(OTHER_TOKEN)(`${baseUrl}/sincronizacion/brickset`);
    assert.deepEqual(await other.json(), { estado: 'inactiva' });
  });
});

test('sincronizacion/brickset rechaza metodos distintos de GET y POST', async () => {
  await withServer('[]', async (baseUrl) => {
    const response = await fetch(`${baseUrl}/sincronizacion/brickset`, { method: 'PATCH' });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET, POST');
    assert.deepEqual(await response.json(), { error: 'METODO_NO_PERMITIDO' });
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
      id: 'CON-SUBCATEGORIA',
      categoria: 'Collectible Minifigures',
      subcategoria: 'Team GB',
      anio: 2012,
      precio: 9.07,
    });

    const subcategoriaDesconocida = await fetch(`${baseUrl}/minifiguras/subcategoria-desconocida/brickset`);
    assert.equal(subcategoriaDesconocida.status, 200);
    assert.deepEqual(await subcategoriaDesconocida.json(), {
      id: 'SUBCATEGORIA-DESCONOCIDA',
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

test('GET /minifiguras/:id/brickset usa el año actual cuando Brickset devuelve cero', async () => {
  const fetchImpl = async () => new Response(
    "<dl><dt>Category</dt><dd><a href='/minifigs/category-Space'>Space</a></dd><dt>Year released</dt><dd>0</dd></dl><p>Current Value - New</p><span>€6.28</span>",
    { status: 200 },
  );

  await withServerOptions('[]', { fetchImpl }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/minifiguras/YEAR-ZERO/brickset`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).anio, new Date().getFullYear());
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
    assert.deepEqual(await response.json(), { id: 'NEW-FIGURE', categoria: 'Space', anio: 2020, precio: 18.75 });
  });
});

test('updatePrices conserva los datos originales si falla la persistencia', async () => {
  const { repository, supabase } = repositoryWith([makeMinifigura({ id: 'a', precio: 10 })]);
  supabase.failNext('minifiguras', undefined, 'upsert');

  await assert.rejects(
    () => repository.updatePrices(new Map([['a', 99]])),
    (error) => error.code === 'CATALOGO_NO_DISPONIBLE',
  );
  assert.equal(supabase.rows('minifiguras')[0].precio, 10);
});

test('updatePrices rechaza precios invalidos antes de persistir', async () => {
  const { repository, supabase } = repositoryWith([makeMinifigura({ id: 'a', precio: 10 })]);
  await assert.rejects(
    () => repository.updatePrices(new Map([['a', -1]])),
    (error) => error.code === 'MINIFIGURA_INVALIDA',
  );
  assert.equal(supabase.rows('minifiguras')[0].precio, 10);
});

test('updatePrices rechaza IDs inexistentes y precios undefined', async () => {
  const { repository } = repositoryWith([makeMinifigura({ id: 'a', precio: 10 })]);
  await assert.rejects(() => repository.updatePrices(new Map([['missing', 20]])), (error) => error.code === 'MINIFIGURA_NO_ENCONTRADA');
  await assert.rejects(() => repository.updatePrices(new Map([['a', undefined]])), (error) => error.code === 'MINIFIGURA_INVALIDA');
});

test('updatePrices persiste solo los precios cambiados del usuario', async () => {
  const { repository, supabase } = repositoryWith([makeMinifigura({ id: 'a', precio: 10 }), makeMinifigura({ id: 'b', precio: 20 })]);
  await repository.updatePrices(new Map([['a', 15]]));
  assert.deepEqual(supabase.rows('minifiguras').map(({ id, precio, user_id }) => ({ id, precio, user_id })), [
    { id: 'A', precio: 15, user_id: TEST_USER.id },
    { id: 'B', precio: 20, user_id: TEST_USER.id },
  ]);
});

test('updatePrice actualiza solo el precio y notifica la persistencia', async () => {
  const { repository, supabase } = repositoryWith([makeMinifigura({ id: 'a', precio: 10 })], {
    onCatalogPersisted: async (catalog) => catalog,
  });

  await repository.updatePrice('a', 15);
  const row = supabase.rows('minifiguras')[0];
  assert.equal(row.precio, 15);
  assert.equal(row.id, 'A');
});

test('updatePrice no recrea figuras eliminadas y rechaza precios invalidos', async () => {
  const { repository, supabase } = repositoryWith([]);

  assert.equal(await repository.updatePrice('missing', 15), null);
  await assert.rejects(() => repository.updatePrice('missing', -1), (error) => error.code === 'MINIFIGURA_INVALIDA');
  assert.equal(supabase.rows('minifiguras').length, 0);
});

test('el repositorio no permite operar sin catálogo oficial de temas', async () => {
  const { repository } = repositoryWith([makeMinifigura({ id: 'a' })], { categoriasRepository: null });
  await assert.rejects(
    () => repository.list(),
    (error) => error.code === 'CATEGORIAS_NO_DISPONIBLES',
  );
});

test('las rutas de datos exigen autenticacion y /categorias sigue publica', async () => {
  await withServer(JSON.stringify([makeMinifigura({ id: 'a' })]), async (baseUrl) => {
    for (const [path, method] of [
      ['/minifiguras', 'GET'],
      ['/minifiguras', 'POST'],
      ['/minifiguras/a', 'PUT'],
      ['/minifiguras/a', 'DELETE'],
      ['/minifiguras/a/observada', 'PUT'],
      ['/minifiguras/a/brickset', 'GET'],
      ['/gamificacion', 'GET'],
      ['/valoracion', 'GET'],
      ['/valor-total', 'GET'],
      ['/sincronizacion/brickset', 'POST'],
    ]) {
      const anonymous = await globalThis.fetch(`${baseUrl}${path}`, { method });
      assert.equal(anonymous.status, 401, `${method} ${path}`);
      assert.deepEqual(await anonymous.json(), { error: 'NO_AUTENTICADO' });
    }

    const invalidToken = await authFetch('token-caducado')(`${baseUrl}/minifiguras`);
    assert.equal(invalidToken.status, 401);
    assert.deepEqual(await invalidToken.json(), { error: 'NO_AUTENTICADO' });

    const categorias = await globalThis.fetch(`${baseUrl}/categorias`);
    assert.equal(categorias.status, 200);
  });
});

test('cada usuario solo ve y modifica sus propias minifiguras aunque compartan id', async () => {
  const supabase = createTestSupabase([makeMinifigura({ id: 'shared', nombre: 'De A' })]);
  supabase.seed('minifiguras', 'otro-usuario-sin-token', [{ id: 'AJENA', nombre: 'Ajena', categoria: 'Space' }]);
  const server = await startTestServer({ supabase });
  const fetchB = authFetch(OTHER_TOKEN);

  try {
    const created = await fetchB(`${server.baseUrl}/minifiguras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeMinifigura({ id: 'shared', nombre: 'De B' })),
    });
    assert.equal(created.status, 201);

    assert.deepEqual((await (await fetch(`${server.baseUrl}/minifiguras`)).json()).map(({ nombre }) => nombre), ['De A']);
    assert.deepEqual((await (await fetchB(`${server.baseUrl}/minifiguras`)).json()).map(({ nombre }) => nombre), ['De B']);

    const deleted = await fetchB(`${server.baseUrl}/minifiguras/shared`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);
    assert.equal((await fetchB(`${server.baseUrl}/minifiguras/ajena`, { method: 'DELETE' })).status, 404);
    assert.deepEqual((await (await fetch(`${server.baseUrl}/minifiguras`)).json()).map(({ nombre }) => nombre), ['De A']);
  } finally {
    await server.close();
  }
});

test('POST /minifiguras rechaza un cuerpo con user_id y asocia el alta al usuario del token', async () => {
  await withServer('[]', async (baseUrl, supabase) => {
    const rejected = await fetch(`${baseUrl}/minifiguras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...makeMinifigura({ id: 'intruso' }), user_id: 'otro-usuario' }),
    });
    assert.equal(rejected.status, 400);
    assert.deepEqual(await rejected.json(), { error: 'MINIFIGURA_INVALIDA' });
    assert.deepEqual(supabase.rows('minifiguras'), []);

    const created = await fetch(`${baseUrl}/minifiguras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makeMinifigura({ id: 'propia' })),
    });
    assert.equal(created.status, 201);
    assert.deepEqual(supabase.rows('minifiguras').map(({ id, user_id }) => ({ id, user_id })), [{ id: 'PROPIA', user_id: TEST_USER.id }]);
  });
});

test('GET /config/supabase expone solo la configuracion publica', async () => {
  await withServer('[]', async (baseUrl) => {
    const response = await globalThis.fetch(`${baseUrl}/config/supabase`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { url: 'https://proyecto.supabase.test', anonKey: 'anon-key-publica' });

    const vendor = await globalThis.fetch(`${baseUrl}/vendor/supabase.js`);
    assert.equal(vendor.status, 200);
    assert.match(vendor.headers.get('content-type'), /javascript/);
  });

  await withServer('[]', async (baseUrl) => {
    const response = await globalThis.fetch(`${baseUrl}/config/supabase`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'CONFIGURACION_NO_DISPONIBLE' });
  }, { supabaseConfig: null });
});
