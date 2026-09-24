import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createServer } from '../src/server.js';

const categorias = await readFile(new URL('../data/categorias-brickset.json', import.meta.url), 'utf8');

function figura(overrides = {}) {
  return {
    id: 'mf-api', nombre: 'Figura API', descripcion: 'Figura', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN', ...overrides,
  };
}

async function withServer(catalogo, callback) {
  const directory = await mkdtemp(join(tmpdir(), 'gamificacion-api-'));
  const catalogPath = join(directory, 'minifiguras.json');
  const themesPath = join(directory, 'categorias.json');
  const gamificationPath = join(directory, 'gamificacion.json');
  await writeFile(catalogPath, JSON.stringify(catalogo));
  await writeFile(themesPath, categorias);
  const server = createServer({ catalogPath, themesPath, gamificationPath });
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await callback(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
}

test('GET /gamificacion inicializa el estado desde el catalogo actual', async () => {
  await withServer([figura({ precio: 135 })], async (baseUrl) => {
    const response = await fetch(`${baseUrl}/gamificacion`);
    assert.equal(response.status, 200);
    const state = await response.json();
    assert.equal(state.bricks, 164);
    assert.equal(state.nivel.nombre, 'Three-Seven-Five');
    assert.ok(state.logros.some(({ id, total }) => id === 'masterpiece' && total === 100));
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
