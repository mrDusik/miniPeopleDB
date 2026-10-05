import assert from 'node:assert/strict';
import test from 'node:test';
import { TEST_USER, authFetch, createTestSupabase, startTestServer } from '../test-support/server.js';

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
    assert.equal(state.bricks, 164);
    assert.equal(state.nivel.nombre, 'Three-Seven-Five');
    assert.ok(state.logros.some(({ id, total }) => id === 'masterpiece' && total === 100));
    const [row] = supabase.rows('gamificacion');
    assert.equal(row.user_id, TEST_USER.id);
    assert.equal(row.bricks, 164);
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
    assert.equal(state.bricks, 14);

    const deleted = await fetch(`${baseUrl}/minifiguras/${payload.id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);
    state = await (await fetch(`${baseUrl}/gamificacion`)).json();
    assert.equal(state.bricks, 0);
    assert.equal(state.nivel.nombre, 'Duplo');
  });
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
      id: 'new-mini-person', nombre: 'New mini person', bricks: 1, repetible: true, cantidad: 1, total: 1,
      rarity_hunter: 5, dna_weights: { fan: 20 }, dna: { porcentajes: { collector: 60 } },
    }],
  }]);
  supabase.seed('gamificacion', PUBLIC_LOGROS_USER, [{
    bricks: 2,
    nivel: { id: 0, nombre: 'Duplo' },
    logros: [{
      id: 'new-mini-person', nombre: 'New mini person', bricks: 1, repetible: true, cantidad: 1, total: 1,
      rarity_hunter: 5, dna_weights: { fan: 20 }, dna: { porcentajes: { collector: 60 } },
    }],
  }]);
  const server = await startTestServer({ supabase });
  try {
    const own = await (await fetch(`${server.baseUrl}/gamificacion`)).json();
    assert.deepEqual(own.logros, [{ id: 'new-mini-person', nombre: 'New mini person', bricks: 1, repetible: true, cantidad: 1, total: 1 }]);
    const publicAchievements = await fetch(`${server.baseUrl}/api/ranking/${PUBLIC_LOGROS_USER}/logros`);
    assert.equal(publicAchievements.status, 200);
    const achievements = await publicAchievements.json();
    assert.deepEqual(achievements.logros, [{ id: 'new-mini-person', nombre: 'New mini person', bricks: 1, repetible: true, cantidad: 1, total: 1 }]);
    const ranking = await (await fetch(`${server.baseUrl}/api/ranking`)).json();
    assert.equal(ranking[0].userId, PUBLIC_LOGROS_USER);
    assert.equal(ranking[0].dnaPrincipal, 'Collector');
    assert.equal('porcentajes' in ranking[0], false);
    assert.doesNotMatch(JSON.stringify(ranking), /dna_weights|rarity_hunter/);
  } finally {
    await server.close();
  }
});
