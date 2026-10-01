import assert from 'node:assert/strict';
import test from 'node:test';
import { createBricksetSyncJobs } from '../src/brickset-sync-jobs.js';

function repository(catalog, updates = []) {
  return {
    async readCatalog() { return catalog; },
    async updatePrice(id, precio) {
      updates.push({ id, precio });
      return catalog.find((item) => item.id === id) ? { id, precio } : null;
    },
  };
}

async function waitForCompletion(jobs, userId) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const state = jobs.status(userId);
    if (state.estado === 'completada') return state;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('La tarea no terminó');
}

test('crea una tarea, avanza por figura y separa actualizados y fallidos', async () => {
  const jobs = createBricksetSyncJobs({
    brickset: {
      async getPrice(id) {
        if (id === 'B') throw Object.assign(new Error(), { code: 'BRICKSET_LIMITE' });
        return id.length;
      },
    },
  });
  const updates = [];
  const start = await jobs.start('user-a', repository([{ id: 'A' }, { id: 'B' }], updates));
  assert.deepEqual(start, { estado: 'en_curso', procesados: 0, total: 2, actualizados: [], fallidos: [] });
  const done = await waitForCompletion(jobs, 'user-a');
  assert.deepEqual(done.actualizados, ['A']);
  assert.deepEqual(done.fallidos, [{ id: 'B', error: 'BRICKSET_LIMITE' }]);
  assert.equal(done.procesados, 2);
  assert.deepEqual(updates, [{ id: 'A', precio: 1 }]);
});

test('mantiene una sola tarea por usuario y aisla los estados', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const jobs = createBricksetSyncJobs({ brickset: { getPrice: async () => { await gate; return 1; } } });
  const catalog = [{ id: 'A' }];
  const first = await jobs.start('user-a', repository(catalog));
  const second = await jobs.start('user-a', repository(catalog));
  assert.deepEqual(second, first);
  assert.deepEqual(jobs.status('user-b'), { estado: 'inactiva' });
  release();
  await waitForCompletion(jobs, 'user-a');
});

test('marca un catalogo vacio como completado', async () => {
  const jobs = createBricksetSyncJobs({ brickset: { getPrice: async () => 1 } });
  assert.deepEqual(await jobs.start('user-a', repository([])), {
    estado: 'completada', procesados: 0, total: 0, actualizados: [], fallidos: [],
  });
});

test('usa el repositorio refrescado para las escrituras posteriores', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const firstUpdates = [];
  const secondUpdates = [];
  const firstRepository = {
    async readCatalog() { return [{ id: 'A' }, { id: 'B' }]; },
    async updatePrice(id, precio) {
      firstUpdates.push({ id, precio });
      await gate;
      return { id, precio };
    },
  };
  const jobs = createBricksetSyncJobs({
    brickset: { async getPrice(id) { return id === 'A' ? 1 : 2; } },
  });
  const catalog = [{ id: 'A' }, { id: 'B' }];
  await jobs.start('user-a', firstRepository);
  while (firstUpdates.length === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  jobs.refreshRepository('user-a', repository(catalog, secondUpdates));
  release();
  await waitForCompletion(jobs, 'user-a');
  assert.deepEqual(firstUpdates, [{ id: 'A', precio: 1 }]);
  assert.deepEqual(secondUpdates, [{ id: 'B', precio: 2 }]);
});
