import assert from 'node:assert/strict';
import test from 'node:test';
import { TEST_USER, authFetch, startTestServer } from '../test-support/server.js';

const fetch = authFetch();

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
