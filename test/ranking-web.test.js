import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { categoriasMockRaw } from '../test-support/fixtures.js';
import { withSupabaseSession } from '../test-support/browser-auth.js';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const script = withSupabaseSession(await readFile(new URL('../public/app.js', import.meta.url), 'utf8'));
const styles = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');

function createDom() {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  dom.window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new dom.window.Event('close'));
  };
  return dom;
}

function entry(overrides = {}) {
  return {
    userId: 'user-b', avatarUrl: 'https://example.com/b.png', displayName: 'Grace', bricks: 200,
    nivel: 4, nombreNivel: 'Citizen', imagenNivel: '/level_images/9_forestman.png', totalColeccion: 2,
    top5Precio: [{ id: 'HIGH', nombre: 'High', precio: 50 }],
    top5Antiguedad: [{ id: 'OLD', nombre: 'Old', anio: 1980, precio: 5 }], regaloEnviado: false,
    ...overrides,
  };
}

function installFetch(window, ranking) {
  const calls = [];
  window.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === '/categorias') return { ok: true, status: 200, json: async () => JSON.parse(categoriasMockRaw) };
    if (url === '/minifiguras' || url.startsWith('/minifiguras?')) return { ok: true, status: 200, json: async () => [] };
    if (url === '/valoracion') return { ok: true, status: 200, json: async () => ({ total: 0, enColeccion: 0, buscadas: 0, top5: [], top5Antiguas: [] }) };
    if (url === '/gamificacion') return { ok: true, status: 200, json: async () => ({ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, progreso: { porcentaje: 0 }, logros: [] }) };
    if (url === '/api/ranking/regalar') {
      ranking.find(({ userId }) => userId === JSON.parse(options.body).receptorId).regaloEnviado = true;
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
    if (url === '/api/ranking') return { ok: true, status: 200, json: async () => structuredClone(ranking) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return calls;
}

test('el panel de nivel y el modal limitan su ancho en móvil', () => {
  assert.match(styles, /\.gamification-summary \{ flex: 1 1 auto; width: 100%; min-width: 0;/);
  assert.match(styles, /\.gamification-details \{[^}]*width: max-content/s);
  assert.match(styles, /\.collection-summary \{ display: grid; grid-template-columns: 40px minmax\(0, 1fr\)/);
  assert.match(styles, /\.summary-ranking-link \{ grid-column: 1 \/ -1; justify-self: start;/);
  assert.match(styles, /\.modal-ranking \{ width: min\(1100px, calc\(100% - 24px\)\)/);
  assert.match(styles, /\.ranking-expand \{ grid-template-columns: 32px 16px 38px minmax\(0, 1fr\) 34px 20px;/);
  assert.match(styles, /\.ranking-expand \{[^}]*justify-items: start;[^}]*text-align: left;/);
  assert.match(styles, /\.ranking-level \{ color: var\(--ink\); font: 700 1rem 'Arial Rounded MT Bold', 'Trebuchet MS', Arial, sans-serif;/);
});

test('abre el Top 10 desde la tercera fila del panel de nivel, distingue la sesión y usa acordeón no interactivo', async () => {
  const dom = createDom();
  const ranking = [entry({ userId: 'user-a', displayName: 'Usuaria Ana Pérez', bricks: 300 }), entry()];
  installFetch(dom.window, ranking);
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 10));

  const details = dom.window.document.querySelector('#gamification-details');
  assert.equal(details.children[2].querySelector('#open-global-ranking').textContent.trim(), '🌐 Ranking Global');
  assert.equal(details.children[2].children[2].id, 'open-global-ranking');
  assert.equal(dom.window.document.querySelector('#ranking-main-star').hidden, false);
  dom.window.document.querySelector('#gamification-toggle').click();
  assert.equal(details.hidden, false);
  dom.window.document.querySelector('#open-global-ranking').click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(dom.window.document.querySelector('#ranking-dialog').open, true);
  assert.equal(dom.window.document.activeElement.id, 'ranking-close');
  assert.equal(dom.window.document.querySelectorAll('.global-ranking-entry').length, 2);
  assert.equal(dom.window.document.querySelector('[data-user-id="user-a"] .ranking-star').hidden, false);
  assert.equal(dom.window.document.querySelector('[data-user-id="user-a"] .ranking-gift'), null);
  const firstEntry = dom.window.document.querySelector('[data-user-id="user-a"]');
  assert.equal(firstEntry.querySelector('.ranking-identity strong').textContent, 'Usuaria A. P.');
  assert.equal(firstEntry.querySelector('.ranking-bricks strong').textContent, '300');
  assert.equal(firstEntry.querySelector('.ranking-bricks img').alt, 'Bricks');
  assert.equal(firstEntry.querySelector('.ranking-level').textContent, '4 Citizen');

  const entries = [...dom.window.document.querySelectorAll('.global-ranking-entry')];
  entries[0].querySelector('.ranking-expand').click();
  assert.equal(entries[0].querySelector('.ranking-user-details').hidden, false);
  entries[1].querySelector('.ranking-expand').click();
  assert.equal(entries[0].querySelector('.ranking-user-details').hidden, true);
  assert.equal(entries[1].querySelector('.ranking-user-details').hidden, false);
  const cards = entries[1].querySelectorAll('.ranking-card-static');
  assert.equal(cards.length, 2);
  assert.ok([...cards].every((card) => card.tagName === 'SPAN' && !card.dataset.action));
  dom.window.document.querySelector('#ranking-close').click();
  assert.equal(dom.window.document.querySelector('#ranking-dialog').open, false);
  assert.equal(dom.window.document.activeElement.id, 'open-global-ranking');
  dom.window.close();
});

test('envía una vez, bloquea dobles clics y limpia ranking al cerrar sesión', async () => {
  const dom = createDom();
  const ranking = [entry({ userId: 'user-a', displayName: 'Usuaria A', bricks: 300 }), entry()];
  const calls = installFetch(dom.window, ranking);
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 10));
  dom.window.document.querySelector('#open-global-ranking').click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  const gift = dom.window.document.querySelector('[data-gift-user="user-b"]');
  gift.click();
  gift.click();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(calls.filter(({ url }) => url === '/api/ranking/regalar').length, 1);
  assert.equal(dom.window.document.querySelector('[data-gift-user="user-b"]').disabled, true);
  assert.equal(dom.window.document.querySelector('[data-gift-user="user-b"]').textContent, 'Regalo enviado');

  dom.window.__supabaseStub.setSession('SIGNED_OUT', null);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(dom.window.document.querySelector('#ranking-main-star').hidden, true);
  assert.equal(dom.window.document.querySelectorAll('.global-ranking-entry').length, 0);
  assert.equal(dom.window.document.querySelector('#ranking-dialog').open, false);
  dom.window.close();
});

test('muestra un error controlado si falla el ranking', async () => {
  const dom = createDom();
  dom.window.fetch = async (url) => {
    if (url === '/categorias') return { ok: true, status: 200, json: async () => JSON.parse(categoriasMockRaw) };
    if (url === '/minifiguras') return { ok: true, status: 200, json: async () => [] };
    if (url === '/valoracion' || url === '/gamificacion') return { ok: true, status: 200, json: async () => ({}) };
    return { ok: false, status: 500, json: async () => ({ error: 'RANKING_NO_DISPONIBLE' }) };
  };
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 10));
  dom.window.document.querySelector('#open-global-ranking').click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(dom.window.document.querySelector('#ranking-status').textContent, 'No se pudo cargar el ranking global.');
  assert.equal(dom.window.document.querySelectorAll('.global-ranking-entry').length, 0);
  dom.window.close();
});

test('respeta regalos previos y rehabilita el botón si falla el envío', async () => {
  const dom = createDom();
  const ranking = [
    entry({ userId: 'user-a', displayName: 'Usuaria A', bricks: 300 }),
    entry({ regaloEnviado: true }),
    entry({ userId: 'user-c', displayName: 'Lin', avatarUrl: null }),
  ];
  installFetch(dom.window, ranking);
  const originalFetch = dom.window.fetch;
  dom.window.fetch = async (url, options) => url === '/api/ranking/regalar'
    ? { ok: false, status: 500, json: async () => ({ error: 'RANKING_NO_DISPONIBLE' }) }
    : originalFetch(url, options);
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 10));
  dom.window.document.querySelector('#open-global-ranking').click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(dom.window.document.querySelector('[data-gift-user="user-b"]').disabled, true);
  const failingGift = dom.window.document.querySelector('[data-gift-user="user-c"]');
  assert.equal(failingGift.closest('.global-ranking-row').querySelector('.ranking-avatar-fallback').hidden, false);
  failingGift.click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(failingGift.disabled, false);
  assert.ok([...dom.window.document.querySelectorAll('.toast-error')].some((toast) => toast.textContent.includes('No se pudo enviar el regalo')));
  dom.window.close();
});