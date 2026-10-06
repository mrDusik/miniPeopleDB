import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CategoryGamificationRecalculator } from '../src/category-gamification-recalculator.js';
import { CategoriasRepository } from '../src/categorias-repository.js';
import { OBJETIVOS } from '../src/gamificacion.js';

function createAdminClient({ version = null, gamificacion = [], minifiguras = [], regalos = [] } = {}) {
  const tables = { gamificacion, minifiguras, regalos_enviados: regalos };
  const applications = [];
  const client = {
    from(table) {
      let filter = null;
      return {
        select() {
          return this;
        },
        eq(column, value) {
          filter = [column, value];
          return this;
        },
        async maybeSingle() {
          return { data: table === 'gamificacion_categoria_version' && version ? { fingerprint: version } : null, error: null };
        },
        async range(from, to) {
          const rows = tables[table] || [];
          return { data: rows.filter((row) => !filter || row[filter[0]] === filter[1]).slice(from, to + 1), error: null };
        },
      };
    },
    async rpc(name, parameters) {
      applications.push({ name, parameters });
      version = parameters.p_fingerprint;
      return { data: true, error: null };
    },
  };
  return { client, applications };
}

test('recalcula todos los usuarios existentes, conservando regalos y usando el total de subcategoría', async () => {
  const { client, applications } = createAdminClient({
    gamificacion: [{ user_id: 'user-a' }, { user_id: 'user-b' }],
    minifiguras: [
      { user_id: 'user-a', id: 'COL1', categoria: 'Collectible Minifigures', subcategoria: 'Series 26', estado_coleccion: 'COLECCIÓN' },
      { user_id: 'user-b', id: 'COL2', categoria: 'Collectible Minifigures', subcategoria: 'Series 26', estado_coleccion: 'COLECCIÓN' },
    ],
    regalos: [{ receptor_id: 'user-b' }, { receptor_id: 'user-b' }],
  });
  const recalculator = new CategoryGamificationRecalculator({
    client,
    categoriasRepository: {
      filePath: 'categories.json',
      read: async () => [{
        categoria: 'Collectible Minifigures',
        total: 845,
        subcategorias: [{ subcategoria: 'Series 26', total: 1 }],
      }],
    },
  });

  const result = await recalculator.reconcile();

  assert.equal(result.recalculated, true);
  assert.equal(result.users, 2);
  assert.equal(applications.length, 1);
  assert.equal(applications[0].name, 'aplicar_recalculo_gamificacion_categorias');
  const states = applications[0].parameters.p_estados;
  const userA = states.find(({ user_id }) => user_id === 'user-a');
  const userB = states.find(({ user_id }) => user_id === 'user-b');
  assert.equal(userA.logros.find(({ id }) => id === 'collector')?.cantidad, 1);
  assert.equal(userB.logros.find(({ id }) => id === 'someone-liked-your-collection')?.cantidad, 2);
  assert.equal(userB.logros.find(({ id }) => id === 'someone-liked-your-collection')?.total, 100);
});

test('no recalcula cuando el fingerprint de categorías y objetivos ya está aplicado', async () => {
  const categories = [{ categoria: 'Space', total: 230, subcategorias: [] }];
  const fingerprint = await import('node:crypto').then(({ createHash }) => createHash('sha256').update(JSON.stringify({ categorias: categories, objetivos: OBJETIVOS })).digest('hex'));
  const { client, applications } = createAdminClient({ version: fingerprint, gamificacion: [{ user_id: 'user-a' }] });
  const recalculator = new CategoryGamificationRecalculator({
    client,
    categoriasRepository: { filePath: 'categories.json', read: async () => categories },
  });

  const result = await recalculator.reconcile();

  assert.equal(result.recalculated, false);
  assert.equal(result.users, 0);
  assert.equal(applications.length, 0);
});

test('una huella anterior recalcula los nuevos logros de usuarios actuales aunque no cambien las categorías', async () => {
  const categories = [{ categoria: 'The Legend of Zelda', total: 1, subcategorias: [] }];
  const oldFingerprint = await import('node:crypto').then(({ createHash }) => createHash('sha256').update(JSON.stringify(categories)).digest('hex'));
  const { client, applications } = createAdminClient({
    version: oldFingerprint,
    gamificacion: [{ user_id: 'user-a' }, { user_id: 'user-empty' }],
    minifiguras: [{ user_id: 'user-a', id: 'SH0129', categoria: 'The Legend of Zelda', estado_coleccion: 'COLECCIÓN' }],
    regalos: [{ receptor_id: 'user-a' }],
  });
  const recalculator = new CategoryGamificationRecalculator({
    client, categoriasRepository: { filePath: 'categories.json', read: async () => categories },
  });
  const result = await recalculator.reconcile();
  assert.equal(result.users, 2);
  assert.notEqual(result.fingerprint, oldFingerprint);
  const state = applications[0].parameters.p_estados.find(({ user_id }) => user_id === 'user-a');
  assert.equal(state.bricks, 4764);
  assert.equal(state.progreso.actual, state.bricks);
  assert.equal(state.nivel.nombre, 'RX');
  for (const id of ['the-legend', 'mental-breakdown', 'youre-shooting-for-the-stars', 'strike', 'someone-liked-your-collection']) {
    assert.equal(state.logros.find((logro) => logro.id === id).cantidad, 1);
  }
  assert.equal(applications[0].parameters.p_estados.find(({ user_id }) => user_id === 'user-empty').bricks, 0);
});

test('subir los totales retira hitos y bajarlos los recupera automáticamente conservando regalos', async () => {
  let categories = [{ categoria: 'Space', total: 2, subcategorias: [{ subcategoria: 'Classic', total: 2 }] }];
  const { client, applications } = createAdminClient({
    gamificacion: [{ user_id: 'user-a' }],
    minifiguras: ['SPACE-1', 'SPACE-2'].map((id) => ({ user_id: 'user-a', id, categoria: 'Space', subcategoria: 'Classic', estado_coleccion: 'COLECCIÓN' })),
    regalos: [{ receptor_id: 'user-a' }],
  });
  const recalculator = new CategoryGamificationRecalculator({
    client, categoriasRepository: { filePath: 'categories.json', read: async () => categories },
  });
  await recalculator.reconcile();
  const initial = applications[0].parameters.p_estados[0];
  assert.equal(initial.bricks, 1810);
  categories = [{ categoria: 'Space', total: 5, subcategorias: [{ subcategoria: 'Classic', total: 3 }] }];
  await recalculator.reconcile();
  const lost = applications[1].parameters.p_estados[0];
  assert.equal(lost.bricks, 60);
  assert.equal(lost.nivel.nombre, 'Plate');
  assert.equal(lost.progreso.actual, 60);
  assert.equal(lost.logros.some(({ id }) => ['collector', 'strike', 'youre-shooting-for-the-stars'].includes(id)), false);
  assert.equal(lost.logros.find(({ id }) => id === 'someone-liked-your-collection').total, 50);
  categories = [{ categoria: 'Space', total: 2, subcategorias: [{ subcategoria: 'Classic', total: 2 }] }];
  await recalculator.reconcile();
  assert.deepEqual(applications[2].parameters.p_estados[0], initial);
  assert.equal((await recalculator.reconcile()).recalculated, false);
  assert.equal(applications.length, 3);
});

test('el watcher detecta cambios de archivo y vuelve a reconciliar', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'category-recalculator-'));
  const filePath = join(directory, 'categorias.json');
  const initial = [{ categoria: 'Space', total: 230, subcategorias: [] }];
  await writeFile(filePath, JSON.stringify(initial));
  let notifyChange;
  const watcher = { on() { return this; }, close() {} };
  const { client, applications } = createAdminClient({ gamificacion: [{ user_id: 'user-a' }] });
  const recalculator = new CategoryGamificationRecalculator({
    client,
    categoriasRepository: new CategoriasRepository(filePath),
    watchImpl: (_directory, callback) => {
      notifyChange = callback;
      return watcher;
    },
    debounceMs: 5,
    logger: { error() {} },
  });

  try {
    await recalculator.start();
    assert.equal(applications.length, 1);
    await writeFile(filePath, JSON.stringify([{ categoria: 'Space', total: 231, subcategorias: [] }]));
    notifyChange('change', 'categorias.json');
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(applications.length, 2);
    recalculator.close();
  } finally {
    recalculator.close();
    await rm(directory, { recursive: true, force: true });
  }
});