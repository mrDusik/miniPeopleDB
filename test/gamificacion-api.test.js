import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularGamificacion } from '../src/gamificacion.js';
import { OTHER_TOKEN, OTHER_USER, TEST_USER, authFetch, createTestSupabase, startTestServer } from '../test-support/server.js';
import { categoriasMock } from '../test-support/fixtures.js';

const fetch = authFetch();
const PUBLIC_LOGROS_USER = '00000000-0000-4000-8000-0000000000aa';

function figura(overrides = {}) {
  return {
    id: 'MF-API', nombre: 'Figura API', descripcion: 'Figura', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN', ...overrides,
  };
}

async function withServer(catalogo, callback) {
  const server = await startTestServer({ catalog: catalogo });
  try {
    await callback(server.baseUrl, server.supabase);
  } finally {
    await server.close();
  }
}

test('GET /gamificacion inicializa el estado desde el catalogo actual', async () => {
  await withServer([figura({ precio: 135 })], async (baseUrl, supabase) => {
    const response = await fetch(`${baseUrl}/gamificacion`);
    assert.equal(response.status, 200);
    const state = await response.json();
    const expected = calcularGamificacion([figura({ precio: 135 })], categoriasMock);
    assert.equal(state.bricks, expected.bricks);
    assert.equal(state.nivel.nombre, 'Three-Seven-Five');
    assert.deepEqual(state.logros, expected.logros);
    assert.ok(state.logros.some(({ id, total }) => id === 'epic-piece' && total === 100));
    const [row] = supabase.rows('gamificacion');
    assert.equal(row.user_id, TEST_USER.id);
    assert.equal(row.bricks, expected.bricks);
  });
});

test('las mutaciones del catalogo recalculan y persisten gamificacion', async () => {
  await withServer([], async (baseUrl) => {
    const payload = figura({ precio: 20 });
    const created = await fetch(`${baseUrl}/minifiguras`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    assert.equal(created.status, 201);
    let state = await (await fetch(`${baseUrl}/gamificacion`)).json();
    assert.equal(state.bricks, calcularGamificacion([payload], categoriasMock).bricks);

    const deleted = await fetch(`${baseUrl}/minifiguras/${payload.id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);
    state = await (await fetch(`${baseUrl}/gamificacion`)).json();
    assert.equal(state.bricks, 0);
    assert.equal(state.nivel.nombre, 'Duplo');
  });
});

test('GET /gamificacion deriva fuentes sociales del JWT e ignora selectores de identidad', async () => {
  const supabase = createTestSupabase();
  supabase.seed('friend_requests', undefined, [{
    id: 'own-pending', sender_id: TEST_USER.id, recipient_id: OTHER_USER.id, status: 'pending',
  }]);
  const server = await startTestServer({ supabase });
  try {
    const ownResponse = await fetch(`${server.baseUrl}/gamificacion?userId=${OTHER_USER.id}`);
    const otherResponse = await authFetch(OTHER_TOKEN)(`${server.baseUrl}/gamificacion?userId=${TEST_USER.id}`);
    assert.equal(ownResponse.status, 200);
    assert.equal(otherResponse.status, 200);
    const own = await ownResponse.json();
    const other = await otherResponse.json();
    assert.equal(own.logros.find(({ id }) => id === 'first-contact')?.cantidad, 1);
    assert.equal(own.logros.some(({ id }) => id === 'handshake'), false);
    assert.equal(other.logros.some(({ id }) => id === 'first-contact' || id === 'handshake'), false);
  } finally {
    await server.close();
  }
});

test('cambiar COLECCIÓN a BUSCADA retira logros y actualiza Bricks, nivel y DNA; volver los recupera', async () => {
  const categories = [{ categoria: 'Space', total: 2, subcategorias: [{ subcategoria: 'Classic', total: 2 }] }];
  const figures = [
    figura({ id: 'SPACE-1', subcategoria: 'Classic', precio: 20 }),
    figura({ id: 'SPACE-2', subcategoria: 'Classic', precio: 500 }),
  ];
  const server = await startTestServer({
    catalog: figures,
    themesRaw: JSON.stringify(categories),
  });
  try {
    const initial = await (await fetch(`${server.baseUrl}/gamificacion`)).json();
    const initialDna = await (await fetch(`${server.baseUrl}/gamificacion/dna`)).json();
    const initialExpected = calcularGamificacion(figures, categories);
    assert.equal(initial.bricks, initialExpected.bricks);
    assert.deepEqual(initial.logros, initialExpected.logros);
    for (const estadoColeccion of ['BUSCADA', 'COLECCIÓN']) {
      const response = await fetch(`${server.baseUrl}/minifiguras/SPACE-2`, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...figures[1], estadoColeccion }),
      });
      assert.equal(response.status, 200);
      const state = await (await fetch(`${server.baseUrl}/gamificacion`)).json();
      const dna = await (await fetch(`${server.baseUrl}/gamificacion/dna`)).json();
      const expected = calcularGamificacion([
        figures[0], { ...figures[1], estadoColeccion },
      ], categories);
      const [persisted] = server.supabase.rows('gamificacion', TEST_USER.id);
      assert.equal(persisted.bricks, state.bricks);
      assert.deepEqual(persisted.logros, state.logros);
      assert.equal(state.bricks, expected.bricks);
      assert.deepEqual(state.logros, expected.logros);
      if (estadoColeccion === 'BUSCADA') {
        assert.equal(state.logros.some(({ id }) => ['category-halfway', 'category-conquest'].includes(id)), false);
        assert.notDeepEqual(dna, initialDna);
      } else {
        assert.deepEqual(state, initial);
        assert.deepEqual(dna, initialDna);
      }
    }
  } finally {
    await server.close();
  }
});

test('GET /gamificacion/dna exige sesion, proyecta datos propios y controla errores', async () => {
  await withServer([], async (baseUrl, supabase) => {
    const before = supabase.rows('gamificacion');
    const response = await fetch(`${baseUrl}/gamificacion/dna`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      principal: 'Newbie', porcentajes: { rarityHunter: 0, explorer: 0, collector: 0, fan: 0 },
    });
    assert.deepEqual(supabase.rows('gamificacion'), before);
    const anonymous = await globalThis.fetch(`${baseUrl}/gamificacion/dna`);
    assert.equal(anonymous.status, 401);
    assert.deepEqual(await anonymous.json(), { error: 'NO_AUTENTICADO' });

    supabase.failNext('gamificacion_dna');
    const failed = await fetch(`${baseUrl}/gamificacion/dna`);
    assert.equal(failed.status, 500);
    assert.deepEqual(await failed.json(), { error: 'DNA_NO_DISPONIBLE' });
  });
});

test('gamificacion y logros publicos eliminan propiedades DNA por logro', async () => {
  const supabase = createTestSupabase();
  supabase.seed('gamificacion', TEST_USER.id, [{
    bricks: 1,
    nivel: { id: 0, nombre: 'Duplo' },
    siguiente_nivel: { id: 1, nombre: 'Stud' },
    progreso: { actual: 1, desde: 0, hasta: 20, porcentaje: 5 },
    logros: [{
      id: 'solid-investment', nombre: 'Solid Investment', bricks: 1, repetible: false, cantidad: 1, total: 1,
      rarity_hunter: 5, dna_weights: { fan: 20 }, dna: { porcentajes: { collector: 60 } },
    }],
  }]);
  supabase.seed('gamificacion', PUBLIC_LOGROS_USER, [{
    bricks: 2,
    nivel: { id: 0, nombre: 'Duplo' },
    logros: [{
      id: 'solid-investment', nombre: 'Solid Investment', bricks: 1, repetible: false, cantidad: 1, total: 1,
      rarity_hunter: 5, dna_weights: { fan: 20 }, dna: { porcentajes: { collector: 60 } },
    }],
  }]);
  const server = await startTestServer({ supabase });
  try {
    const own = await (await fetch(`${server.baseUrl}/gamificacion`)).json();
    assert.deepEqual(own.logros, [{ id: 'solid-investment', nombre: 'Solid Investment', bricks: 1, repetible: false, cantidad: 1, total: 1 }]);
    const publicAchievements = await fetch(`${server.baseUrl}/api/ranking/${PUBLIC_LOGROS_USER}/logros`);
    assert.equal(publicAchievements.status, 200);
    const achievements = await publicAchievements.json();
    assert.deepEqual(achievements.logros, [{ id: 'solid-investment', nombre: 'Solid Investment', bricks: 1, repetible: false, cantidad: 1, total: 1 }]);
    const ranking = await (await fetch(`${server.baseUrl}/api/ranking`)).json();
    assert.equal(ranking[0].userId, PUBLIC_LOGROS_USER);
    assert.equal(ranking[0].dnaPrincipal, 'Collector');
    assert.equal('porcentajes' in ranking[0], false);
    assert.doesNotMatch(JSON.stringify(ranking), /dna_weights|rarity_hunter/);
  } finally {
    await server.close();
  }
});
