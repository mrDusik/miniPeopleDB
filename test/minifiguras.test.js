import assert from 'node:assert/strict';
import test from 'node:test';
import { MinifigurasRepository } from '../src/minifiguras-repository.js';
import { categoriasMock, categoriasMockRaw } from '../test-support/fixtures.js';
import {
  OTHER_TOKEN,
  OTHER_USER,
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
    assert.deepEqual(await sync.json(), { estado: 'en_curso', procesados: 0, total: 2, actualizados: [], sinPrecio: [], fallidos: [] });

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
          sinPrecio: [],
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

test('sincronizacion/brickset rechaza metodos distintos de GET, POST y PATCH', async () => {
  await withServer('[]', async (baseUrl) => {
    const response = await fetch(`${baseUrl}/sincronizacion/brickset`, { method: 'DELETE' });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET, POST, PATCH');
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

test('permite consultar y crear una minifigura cuyo precio Brickset es Not known', async () => {
  const fetchImpl = async (url) => {
    if (!url.endsWith('/SH1159')) throw new Error('URL inesperada');
    return new Response(
      '<dl><dt>Name</dt><dd>Figura Nueva</dd><dt>Category</dt><dd>Space</dd><dt>Year released</dt><dd>2026</dd></dl><p>Current Value - New</p><span>Not known</span>',
      { status: 200 },
    );
  };

  await withServerOptions('[]', { fetchImpl, minIntervalMs: 0 }, async (baseUrl) => {
    const lookup = await fetch(`${baseUrl}/minifiguras/SH1159/brickset`);
    assert.equal(lookup.status, 200);
    assert.deepEqual(await lookup.json(), {
      id: 'SH1159', nombre: 'Figura Nueva', descripcion: null, categoria: 'Space', anio: 2026, precio: null,
    });

    const created = await fetch(`${baseUrl}/minifiguras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'SH1159', nombre: 'Figura Nueva', categoria: 'Space', anio: 2026,
        estadoColeccion: 'COLECCIÓN', observada: false,
      }),
    });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).id, 'SH1159');
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

test('los nombres Brickset se parsean y persisten sin entrada manual', async () => {
  const cases = [
    ['CAS056', 'Ninja - Shogun, Blue with Armor', 'Ninja', 'Shogun, Blue with Armor'],
    ['COL047', 'Baseball Player, Series 3 (Minifigure Only without Stand and Accessories)', 'Baseball Player', null],
    ['NIKE002', 'Basketball Player', 'Basketball Player', null],
    ['NJO1029', 'Lloyd - Dragon Form', 'Lloyd', 'Dragon Form'],
  ];
  const fetchImpl = async (url) => {
    const [, title] = cases.find(([id]) => url.endsWith(`/${id}`));
    return new Response(`<dl><dt>Name</dt><dd>${title}</dd><dt>Category</dt><dd>Space</dd><dt>Year released</dt><dd>2026</dd></dl><p>Current Value - New €5</p>`);
  };
  await withServerOptions('[]', { fetchImpl, minIntervalMs: 0 }, async (baseUrl, supabase) => {
    for (const [id, fullName, nombre, descripcion] of cases) {
      const response = await fetch(`${baseUrl}/minifiguras/${id}/brickset`);
      assert.equal(response.status, 200);
      const details = await response.json();
      assert.equal(details.nombre, nombre);
      assert.equal(details.descripcion, descripcion);
      assert.equal('nombreCompleto' in details, false);
      const created = await fetch(`${baseUrl}/minifiguras`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...details, descripcion: details.descripcion ?? '' }),
      });
      assert.equal(created.status, 201);
    }
    const catalog = await (await fetch(`${baseUrl}/minifiguras`)).json();
    for (const [id, fullName, nombre, descripcion] of cases) {
      const stored = catalog.find((figure) => figure.id === id);
      assert.equal(stored.nombre, nombre);
      assert.equal(stored.descripcion || null, descripcion);
      assert.equal('nombreCompleto' in stored, false);
      assert.equal(supabase.rows('minifiguras', TEST_USER.id).find((figure) => figure.id === id).nombre_completo, fullName);
    }
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

test('la API reutiliza metadatos publicos recientes entre usuarios sin saltar autenticacion', async () => {
  let requests = 0;
  const fetchImpl = async () => {
    requests += 1;
    return new Response('<dl><dt>Name</dt><dd>Space Pilot</dd><dt>Category</dt><dd>Space</dd><dt>Year released</dt><dd>2020</dd></dl><p>Current Value - New</p><span>\u20ac5</span>');
  };
  await withServerOptions('[]', { fetchImpl, minIntervalMs: 0 }, async (baseUrl, supabase) => {
    const [own, other] = await Promise.all([
      fetch(`${baseUrl}/minifiguras/COL079/brickset`),
      authFetch(OTHER_TOKEN)(`${baseUrl}/minifiguras/col079/brickset`),
    ]);
    assert.equal(own.status, 200);
    assert.equal(other.status, 200);
    const details = await own.json();
    assert.equal(details.nombre, 'Space Pilot');
    assert.equal(details.precio, 5);
    assert.deepEqual(await other.json(), details);
    assert.equal((await fetch(`${baseUrl}/minifiguras/col079/brickset`)).status, 200);
    assert.equal(requests, 1);
    assert.equal((await globalThis.fetch(`${baseUrl}/minifiguras/col079/brickset`)).status, 401);
    assert.deepEqual(supabase.rows('minifiguras'), []);
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

test('las respuestas de mutacion no devuelven propiedades DNA persistidas en logros previos', async () => {
  const supabase = createTestSupabase();
  supabase.seed('gamificacion', TEST_USER.id, [{
    bricks: 1,
    nivel: { id: 0, nombre: 'Duplo' },
    siguiente_nivel: { id: 1, nombre: 'Stud' },
    progreso: { actual: 1, desde: 0, hasta: 20, porcentaje: 5 },
    logros: [{
      id: 'new-mini-person', nombre: 'New mini person', bricks: 1, repetible: true, cantidad: 1, total: 1,
      rarity_hunter: 5, dna_weights: { fan: 20 }, dna: { porcentajes: { collector: 60 } },
    }],
  }]);
  const server = await startTestServer({ supabase });
  try {
    const response = await fetch(`${server.baseUrl}/minifiguras`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-gamificacion': 'true' },
      body: JSON.stringify(makeMinifigura()),
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.ok(Array.isArray(body.gamificacion.state.logros));
    for (const logro of body.gamificacion.state.logros) {
      assert.equal('rarity_hunter' in logro, false);
      assert.equal('dna_weights' in logro, false);
      assert.equal('dna' in logro, false);
    }
  } finally {
    await server.close();
  }
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

function setInventoryArticle(id) {
  return `<article class='set'><div class="meta"><h1><a href="/minifigs/${id.toLowerCase()}/figure-name">${id}</a></h1></div></article>`;
}

function setLookupPage(setId, hasMinifigures = true) {
  const inventoryLink = hasMinifigures
    ? `<a href="/ajax/sets/minifigs?setID=${setId}">Minifigs</a>`
    : '<a href="/ajax/sets/nominifigs">Minifigs</a>';
  return `<a href="/ajax/sets/mainImage?setID=${setId}">Image</a>${inventoryLink}`;
}

test('GET /minifiguras/sets/:number normaliza set y combina Brickset con datos propios', async () => {
  const savedA = makeMinifigura({
    id: 'njo1030', nombre: 'Nombre guardado', categoria: 'Space', anio: 1999,
    estadoColeccion: 'BUSCADA', observada: true, fechaCompra: '2020-01-02',
  });
  const savedB = makeMinifigura({
    id: 'njo1030', nombre: 'Registro de B', categoria: 'Castle', anio: 2001,
  });
  const supabase = createTestSupabase([savedA]);
  supabase.seed('minifiguras', OTHER_USER.id, [savedB].map((figure) => ({
    id: figure.id,
    nombre: figure.nombre,
    descripcion: figure.descripcion,
    categoria: figure.categoria,
    anio: figure.anio,
    estado_coleccion: figure.estadoColeccion,
    observada: figure.observada,
    fecha_compra: figure.fechaCompra,
    fecha_registro: figure.FechaRegistro,
  })));
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    if (url === 'https://brickset.com/sets?query=71851') {
      return new Response('<div class="results">1 to 1 of 1 matches</div><h1><a href="/sets/71851-1/set-name">Battle Pack</a></h1>');
    }
    if (url === 'https://brickset.com/sets/71851-1') return new Response(setLookupPage('51787'));
    if (url === 'https://brickset.com/ajax/sets/minifigs?setID=51787') {
      return new Response(`${setInventoryArticle('NJO1030')}${setInventoryArticle('NJO1034')}`);
    }
    if (url === 'https://brickset.com/minifigs/NJO1034') {
      return new Response('<dl><dt>Name</dt><dd>Sora - Dragon Form</dd><dt>Category</dt><dd>Space</dd><dt>Year released</dt><dd>2025</dd></dl><p>Current Value - New €7.50</p>');
    }
    throw new Error(`URL inesperada: ${url}`);
  };
  const server = await startTestServer({ supabase, options: { fetchImpl, minIntervalMs: 0 } });

  try {
    const ownResponse = await fetch(`${server.baseUrl}/minifiguras/sets/71851`);
    assert.equal(ownResponse.status, 200);
    const ownResult = await ownResponse.json();
    assert.equal(ownResult.setNumber, '71851-1');
    assert.deepEqual(ownResult.minifigures, [
      { ...savedA, existente: true },
      {
        id: 'NJO1034', nombre: 'Sora', descripcion: 'Dragon Form', categoria: 'Space',
        anio: 2025, precio: 7.5, existente: false,
      },
    ]);

    const otherResponse = await authFetch(OTHER_TOKEN)(`${server.baseUrl}/minifiguras/sets/71851`);
    assert.equal(otherResponse.status, 200);
    const otherResult = await otherResponse.json();
    assert.deepEqual(otherResult.minifigures[0], { ...savedB, existente: true });
    assert.equal(otherResult.minifigures[1].existente, false);
    assert.equal(requests.filter(({ url }) => url.endsWith('/NJO1030')).length, 0);
    assert.equal(requests.filter(({ url }) => url.endsWith('/NJO1034')).length, 1);
    assert.equal(requests.filter(({ options }) => options.headers?.['x-requested-with'] === 'XMLHttpRequest').length, 2);
  } finally {
    await server.close();
  }
});

test('GET /minifiguras/sets/:number resuelve Complete de una CMF y devuelve todas sus figuras con duplicados propios', async () => {
  const ids = Array.from({ length: 16 }, (_, index) => `COL${145 + index}`);
  const saved = makeMinifigura({
    id: 'COL145', nombre: 'Nombre guardado', categoria: 'Collectible Minifigures',
    subcategoria: 'Series 10 Minifigures', anio: 2013,
  });
  const detailRequests = [];
  const server = await startTestServer({
    catalog: [saved],
    themesRaw: JSON.stringify([{
      categoria: 'Collectible Minifigures', total: 16,
      subcategorias: [{ subcategoria: 'Series 10 Minifigures', total: 16 }],
    }]),
    options: {
      minIntervalMs: 0,
      fetchImpl: async (url) => {
        if (url === 'https://brickset.com/sets?query=71001') {
          return new Response('<div class="results">1 to 2 of 2 matches</div><h1><a href="/sets/71001-1/Librarian">Librarian</a></h1><h1><a href="/sets/71001-17/Complete">Series 10 - Complete (except Mr. Gold)</a></h1>');
        }
        if (url === 'https://brickset.com/sets/71001-17') return new Response(setLookupPage('22589'));
        if (url === 'https://brickset.com/ajax/sets/minifigs?setID=22589') {
          return new Response(ids.map(setInventoryArticle).join(''));
        }
        const id = url.match(/^https:\/\/brickset\.com\/minifigs\/(COL\d+)$/)?.[1];
        if (id) {
          detailRequests.push(id);
          return new Response(`<dl><dt>Name</dt><dd>Figure ${id}</dd><dt>Category</dt><dd>Collectible Minifigures</dd><dt>Subcategory</dt><dd>Series 10 Minifigures</dd><dt>Year released</dt><dd>2013</dd></dl><p>Current Value - New €4.00</p>`);
        }
        throw new Error(`URL inesperada: ${url}`);
      },
    },
  });
  try {
    const response = await fetch(`${server.baseUrl}/minifiguras/sets/71001`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.setNumber, '71001-17');
    assert.deepEqual(result.minifigures.map(({ id }) => id), ids);
    assert.deepEqual(result.minifigures[0], { ...saved, existente: true });
    assert.ok(result.minifigures.slice(1).every((figure) => (
      figure.existente === false && figure.subcategoria === 'Series 10 Minifigures'
    )));
    assert.deepEqual(detailRequests, ids.slice(1));
  } finally {
    await server.close();
  }
});

test('GET /minifiguras/sets/:number diferencia set sin minifiguras de errores de Brickset', async () => {
  const emptyServer = await startTestServer({
    options: {
      minIntervalMs: 0,
      fetchImpl: async (url) => new Response(url.includes('?query=')
        ? '<div class="results">0 to 0 of 0 matches</div>'
        : setLookupPage('48994', false)),
    },
  });
  try {
    const empty = await fetch(`${emptyServer.baseUrl}/minifiguras/sets/31154`);
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), { setNumber: '31154-1', minifigures: [] });
  } finally {
    await emptyServer.close();
  }

  const missingServer = await startTestServer({
    options: { minIntervalMs: 0, fetchImpl: async () => new Response('', { status: 404 }) },
  });
  try {
    const missing = await fetch(`${missingServer.baseUrl}/minifiguras/sets/999999`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'BRICKSET_NO_ENCONTRADO' });
  } finally {
    await missingServer.close();
  }

  const unavailableServer = await startTestServer({
    options: { minIntervalMs: 0, fetchImpl: async () => new Response('', { status: 503 }) },
  });
  try {
    const unavailable = await fetch(`${unavailableServer.baseUrl}/minifiguras/sets/71851`);
    assert.equal(unavailable.status, 502);
    assert.deepEqual(await unavailable.json(), { error: 'BRICKSET_NO_DISPONIBLE' });
  } finally {
    await unavailableServer.close();
  }
});

test('GET /minifiguras/sets/:number exige autenticacion y solo acepta GET', async () => {
  await withServer('[]', async (baseUrl) => {
    const anonymous = await globalThis.fetch(`${baseUrl}/minifiguras/sets/71851`);
    assert.equal(anonymous.status, 401);
    assert.deepEqual(await anonymous.json(), { error: 'NO_AUTENTICADO' });

    const unsupported = await fetch(`${baseUrl}/minifiguras/sets/71851`, { method: 'POST' });
    assert.equal(unsupported.status, 405);
    assert.equal(unsupported.headers.get('allow'), 'GET');
    assert.deepEqual(await unsupported.json(), { error: 'METODO_NO_PERMITIDO' });
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
  }, {
    cronSecret: 'cron-secret-sentinel',
    adminConfig: { url: 'https://proyecto.supabase.test', serviceRoleKey: 'service-role-sentinel' },
  });

  await withServer('[]', async (baseUrl) => {
    const response = await globalThis.fetch(`${baseUrl}/config/supabase`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'CONFIGURACION_NO_DISPONIBLE' });
  }, { supabaseConfig: null });
});

test('MinifigurasRepository.createMany valida el lote, aplica valores por defecto y notifica una vez', async () => {
  const saved = makeMinifigura({
    id: 'EXISTENTE',
    nombre: 'Registro guardado',
    estadoColeccion: 'BUSCADA',
    observada: true,
  });
  const supabase = createTestSupabase([saved]);
  const notifications = [];
  const repository = new MinifigurasRepository({
    client: createTestClient(supabase),
    userId: TEST_USER.id,
    categoriasRepository: { read: async () => categoriasMock },
    onCatalogPersisted: async (catalog) => {
      notifications.push(catalog);
      return null;
    },
  });

  const result = await repository.createMany([
    { id: 'nuevo-1', nombre: 'Primera', categoria: 'Space', anio: 2025, fechaCompra: '2025-02-03' },
    { id: 'nuevo-2', nombre: 'Segunda', categoria: 'Castle', anio: 2024 },
    { ...saved, nombre: 'No debe reemplazar el registro' },
  ], {
    nombreCompletoPorId: new Map([['NUEVO-1', 'Primera figura completa']]),
  });

  assert.deepEqual(result.creadas.map(({ id }) => id), ['NUEVO-1', 'NUEVO-2']);
  assert.deepEqual(result.duplicadas, ['EXISTENTE']);
  assert.deepEqual(result.creadas.map(({ observada, estadoColeccion }) => ({ observada, estadoColeccion })), [
    { observada: false, estadoColeccion: 'COLECCIÓN' },
    { observada: false, estadoColeccion: 'COLECCIÓN' },
  ]);
  assert.equal(result.creadas[0].fechaCompra, '2025-02-03');
  assert.equal(supabase.rows('minifiguras').find(({ id }) => id === 'NUEVO-1').nombre_completo, 'Primera figura completa');
  assert.equal(supabase.rows('minifiguras').find(({ id }) => id === 'EXISTENTE').nombre, 'Registro guardado');
  assert.equal(supabase.rows('minifiguras').find(({ id }) => id === 'EXISTENTE').observada, true);
  assert.equal(notifications.length, 1);
});

test('MinifigurasRepository.createMany ignora conflictos concurrentes sin alterar el registro existente', async () => {
  const { repository, supabase } = repositoryWith([]);
  const readCatalog = repository.readCatalog.bind(repository);
  let seedConcurrentRecord = true;
  repository.readCatalog = async (...args) => {
    const catalog = await readCatalog(...args);
    if (seedConcurrentRecord) {
      seedConcurrentRecord = false;
      supabase.seed('minifiguras', TEST_USER.id, [{
        id: 'RACE',
        nombre: 'Guardada durante la operación',
        categoria: 'Space',
        anio: 2024,
        estado_coleccion: 'BUSCADA',
        observada: true,
        fecha_registro: '2025-01-02T00:00:00.000Z',
      }]);
    }
    return catalog;
  };

  const result = await repository.createMany([
    { id: 'race', nombre: 'Propuesta obsoleta', categoria: 'Space', anio: 2025 },
    { id: 'nuevo', nombre: 'Nueva', categoria: 'Space', anio: 2025 },
  ]);

  assert.deepEqual(result.creadas.map(({ id }) => id), ['NUEVO']);
  assert.deepEqual(result.duplicadas, ['RACE']);
  const race = supabase.rows('minifiguras').find(({ id }) => id === 'RACE');
  assert.equal(race.nombre, 'Guardada durante la operación');
  assert.equal(race.estado_coleccion, 'BUSCADA');
  assert.equal(race.observada, true);
});

test('MinifigurasRepository.createMany no persiste un lote parcialmente si falla la escritura', async () => {
  const { repository, supabase } = repositoryWith([]);
  supabase.failNext('minifiguras', { code: 'PGRST000', message: 'fallo de escritura' }, 'upsert');

  await assert.rejects(repository.createMany([
    { id: 'primera', nombre: 'Primera', categoria: 'Space', anio: 2025 },
    { id: 'segunda', nombre: 'Segunda', categoria: 'Castle', anio: 2025 },
  ]), { code: 'CATALOGO_NO_DISPONIBLE' });
  assert.deepEqual(supabase.rows('minifiguras'), []);
});

test('MinifigurasRepository.createMany rechaza el lote completo si una fila es inválida', async () => {
  const { repository, supabase } = repositoryWith([]);

  await assert.rejects(repository.createMany([
    { id: 'valida', nombre: 'Válida', categoria: 'Space', anio: 2025 },
    { id: 'invalida', nombre: 'Inválida', categoria: 'No oficial', anio: 2025 },
  ]), { code: 'MINIFIGURA_INVALIDA' });
  assert.deepEqual(supabase.rows('minifiguras'), []);
});

test('POST /minifiguras/lote guarda el lote con fecha común y devuelve el estado derivado', async () => {
  await withServer('[]', async (baseUrl, supabase) => {
    const response = await fetch(`${baseUrl}/minifiguras/lote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-gamificacion': 'true' },
      body: JSON.stringify({
        minifiguras: [
          makeMinifigura({
            id: 'primera',
            fechaCompra: '2025-03-04',
            estadoColeccion: 'COLECCIÓN',
            observada: true,
          }),
          makeMinifigura({
            id: 'segunda',
            fechaCompra: '2025-03-04',
            estadoColeccion: 'BUSCADA',
            observada: false,
          }),
        ],
      }),
    });

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.deepEqual(body.creadas.map(({ id }) => id), ['PRIMERA', 'SEGUNDA']);
    assert.deepEqual(body.duplicadas, []);
    assert.ok(body.gamificacion?.state);
    assert.deepEqual(supabase.rows('minifiguras').map(({ id, fecha_compra, precio_compra }) => ({
      id,
      fecha_compra,
      precio_compra,
    })), [
      { id: 'PRIMERA', fecha_compra: '2025-03-04', precio_compra: null },
      { id: 'SEGUNDA', fecha_compra: '2025-03-04', precio_compra: null },
    ]);
  });
});

test('POST /minifiguras/lote conserva duplicados y permite una respuesta solo de duplicados', async () => {
  const saved = makeMinifigura({ id: 'EXISTENTE', nombre: 'Registro guardado', observada: true });
  await withServer(JSON.stringify([saved]), async (baseUrl, supabase) => {
    const response = await fetch(`${baseUrl}/minifiguras/lote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ minifiguras: [{ ...saved, nombre: 'No reemplazar' }] }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { creadas: [], duplicadas: ['EXISTENTE'] });
    assert.equal(supabase.rows('minifiguras').length, 1);
    assert.equal(supabase.rows('minifiguras')[0].nombre, 'Registro guardado');
    assert.equal(supabase.rows('minifiguras')[0].observada, true);
  });
});

test('POST /minifiguras/lote rechaza lotes inválidos sin guardar filas', async () => {
  await withServer('[]', async (baseUrl, supabase) => {
    const response = await fetch(`${baseUrl}/minifiguras/lote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        minifiguras: [
          makeMinifigura({ id: 'valida' }),
          makeMinifigura({ id: 'invalida', categoria: 'No oficial' }),
        ],
      }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'MINIFIGURA_INVALIDA' });
    assert.deepEqual(supabase.rows('minifiguras'), []);
  });
});

test('POST /minifiguras/lote no persiste filas parciales ante un fallo de Supabase', async () => {
  await withServer('[]', async (baseUrl, supabase) => {
    supabase.failNext('minifiguras', { code: 'PGRST000', message: 'fallo de escritura' }, 'upsert');
    const response = await fetch(`${baseUrl}/minifiguras/lote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        minifiguras: [makeMinifigura({ id: 'primera' }), makeMinifigura({ id: 'segunda' })],
      }),
    });

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'CATALOGO_NO_DISPONIBLE' });
    assert.deepEqual(supabase.rows('minifiguras'), []);
  });
});

test('POST /minifiguras/lote exige autenticación y solo acepta POST', async () => {
  await withServer('[]', async (baseUrl) => {
    const anonymous = await globalThis.fetch(`${baseUrl}/minifiguras/lote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ minifiguras: [] }),
    });
    assert.equal(anonymous.status, 401);
    assert.deepEqual(await anonymous.json(), { error: 'NO_AUTENTICADO' });

    const unsupported = await fetch(`${baseUrl}/minifiguras/lote`, { method: 'GET' });
    assert.equal(unsupported.status, 405);
    assert.equal(unsupported.headers.get('allow'), 'POST');
    assert.deepEqual(await unsupported.json(), { error: 'METODO_NO_PERMITIDO' });
  });
});
