import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { categoriasMockRaw } from '../test-support/fixtures.js';
import { withSupabaseSession } from '../test-support/browser-auth.js';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const appScript = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const catalog = [{ id: 'A-1', nombre: 'Astronauta', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN' }];

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function startSyncApp({ statusStates = [], postState, session = undefined, dnaStates = [] } = {}) {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  const timers = new Map();
  let nextTimerId = 0;
  window.setTimeout = (callback, delay) => {
    const id = ++nextTimerId;
    if (delay === 2000) timers.set(id, callback);
    return id;
  };
  window.clearTimeout = (id) => timers.delete(id);
  const requests = [];
  let statusIndex = 0;
  let dnaIndex = 0;
  window.fetch = async (url, init = {}) => {
    requests.push({ url, method: init.method ?? 'GET' });
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(categoriasMockRaw) };
    if (url === '/minifiguras') return { ok: true, json: async () => catalog };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 0, enColeccion: 1, buscadas: 0, top5: [], top5Antiguas: [] }) };
    if (url === '/gamificacion') return { ok: true, json: async () => ({ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, siguienteNivel: null, progreso: { porcentaje: 0 } }) };
    if (url === '/gamificacion/dna') return { ok: true, json: async () => dnaStates[Math.min(dnaIndex++, dnaStates.length - 1)] ?? { principal: 'Newbie', porcentajes: { rarityHunter: 0, explorer: 0, collector: 0, fan: 0 } } };
    if (url === '/sincronizacion/brickset') {
      if (init.method === 'POST') return postState;
      return { ok: true, json: async () => statusStates[Math.min(statusIndex++, statusStates.length - 1)] ?? { estado: 'inactiva' } };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  window.eval(withSupabaseSession(appScript, { session }));
  return {
    dom,
    window,
    requests,
    timers,
    $: (selector) => window.document.querySelector(selector),
  };
}

test('muestra progreso, actualiza el sondeo y muestra el toast exacto al completar', async () => {
  const app = startSyncApp({
    postState: { ok: true, json: async () => ({ estado: 'en_curso', procesados: 0, total: 2, actualizados: [], fallidos: [] }) },
    dnaStates: [
      { principal: 'Explorer', porcentajes: { rarityHunter: 0, explorer: 100, collector: 0, fan: 0 } },
      { principal: 'Collector', porcentajes: { rarityHunter: 0, explorer: 0, collector: 100, fan: 0 } },
    ],
    statusStates: [
      { estado: 'inactiva' },
      { estado: 'en_curso', procesados: 1, total: 2, actualizados: ['A-1'], fallidos: [] },
      { estado: 'completada', procesados: 2, total: 2, actualizados: ['A-1'], fallidos: [{ id: 'B-2', error: 'BRICKSET_LIMITE' }] },
    ],
  });
  await tick();
  app.$('#sync-prices').click();
  await tick();

  assert.equal(app.$('#sync-prices').disabled, true);
  assert.equal(app.$('#sync-progress').hidden, false);
  assert.equal(app.$('#sync-progress-label').textContent, 'Actualizando precios: 0 / 2');
  assert.equal(app.$('#show-all').disabled, false);

  const poll = [...app.timers.values()][0];
  app.timers.clear();
  await poll();
  assert.equal(app.$('#sync-progress-label').textContent, 'Actualizando precios: 1 / 2');

  const finishPoll = [...app.timers.values()][0];
  app.timers.clear();
  await finishPoll();
  await tick();
  await tick();
  assert.equal(app.$('#sync-progress').hidden, true);
  assert.equal(app.$('#sync-prices').disabled, false);
  assert.equal(app.$('#gamification-dna-principal').textContent, 'Collector');
  assert.equal(app.requests.filter(({ url }) => url === '/gamificacion/dna').length, 2);
  const toast = app.$('#toast-region .toast-success');
  assert.equal(toast.textContent, 'Actualización de precios terminada: 1 actualizadas, 1 fallidas.');
  app.dom.window.close();
});

test('respuesta completada inicial no muestra barra y un error rehabilita el boton', async () => {
  const completed = startSyncApp({
    postState: { ok: true, json: async () => ({ estado: 'completada', procesados: 0, total: 0, actualizados: [], fallidos: [] }) },
    statusStates: [{ estado: 'inactiva' }],
  });
  await tick();
  completed.$('#sync-prices').click();
  await tick();
  assert.equal(completed.$('#sync-progress').hidden, true);
  assert.equal(completed.$('#sync-prices').disabled, false);
  completed.dom.window.close();

  const failed = startSyncApp({
    postState: { ok: false, json: async () => ({ error: 'BRICKSET_NO_DISPONIBLE' }) },
    statusStates: [{ estado: 'inactiva' }],
  });
  await tick();
  failed.$('#sync-prices').click();
  await tick();
  assert.equal(failed.$('#sync-prices').disabled, false);
  const errorToast = failed.$('#toast-region .toast-error');
  assert.equal(errorToast.textContent, 'No se pudieron actualizar los precios.');
  assert.doesNotMatch(errorToast.textContent, /Brickset/i);
  failed.dom.window.close();
});

test('retoma una tarea sin POST y cancela el sondeo al cerrar sesión', async () => {
  const app = startSyncApp({
    postState: { ok: true, json: async () => ({ estado: 'en_curso', procesados: 0, total: 1, actualizados: [], fallidos: [] }) },
    statusStates: [{ estado: 'en_curso', procesados: 1, total: 1, actualizados: [], fallidos: [] }],
  });
  await tick();
  assert.equal(app.$('#sync-progress').hidden, false);
  assert.equal(app.requests.filter(({ url, method }) => url === '/sincronizacion/brickset' && method === 'POST').length, 0);
  assert.equal(app.timers.size, 1);

  app.window.__supabaseStub.setSession('SIGNED_OUT', null);
  await tick();
  assert.equal(app.$('#sync-progress').hidden, true);
  assert.equal(app.timers.size, 0);
  assert.equal(app.requests.filter(({ url, method }) => url === '/sincronizacion/brickset' && method === 'POST').length, 0);
  app.dom.window.close();
});
