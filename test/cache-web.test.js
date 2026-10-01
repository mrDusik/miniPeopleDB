import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { MinifigurasRepository } from '../src/minifiguras-repository.js';
import { DEFAULT_SESSION, withSupabaseSession } from '../test-support/browser-auth.js';
import { categoriasMock, categoriasMockRaw } from '../test-support/fixtures.js';
import { TEST_USER, createTestClient, createTestSupabase } from '../test-support/server.js';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const appScript = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const ok = (body, status = 200) => ({ ok: true, status, json: async () => body });
const emptyValuation = { total: 0, enColeccion: 0, buscadas: 0, top5: [], top5Antiguas: [], observadas: [] };
const gamification = { bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, siguienteNivel: null, progreso: { porcentaje: 0 }, logros: [] };

function figure(id, overrides = {}) {
  return {
    id,
    nombre: id,
    descripcion: 'Figura',
    categoria: 'Space',
    anio: 2024,
    estadoColeccion: 'COLECCIÓN',
    precio: 10,
    FechaRegistro: '2026-01-01T00:00:00.000Z',
    observada: false,
    ...overrides,
  };
}

// onFetch may return a response (or a pending promise) to override the default handlers.
async function setup({ catalog = [], valuation = emptyValuation, onFetch } = {}) {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  const state = { catalog };
  const requests = [];
  window.fetch = async (url, options = {}) => {
    const method = options.method ?? 'GET';
    requests.push({ url, method });
    const custom = onFetch?.(url, options);
    if (custom !== undefined) return custom;
    if (url === '/categorias') return ok(JSON.parse(categoriasMockRaw));
    if (url === '/valoracion') return ok(valuation);
    if (url === '/gamificacion') return ok(gamification);
    if (url === '/minifiguras' && method === 'GET') return ok(state.catalog);
    return { ok: false, status: 500, json: async () => ({ error: 'ERROR_INTERNO' }) };
  };
  window.eval(withSupabaseSession(appScript));
  await flush();
  const catalogGets = () => requests.filter(({ url, method }) => url.startsWith('/minifiguras') && !url.includes('/', 1) && method === 'GET');
  return { dom, window, document: window.document, state, requests, catalogGets };
}

function renderedIds(document) {
  return [...document.querySelectorAll('#catalog-body tr')].map((row) => row.children[2].textContent);
}

async function submitFilters(window) {
  window.document.querySelector('#filters-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flush();
}

test('la carga inicial pide el catálogo completo una sola vez y sin parámetros', async () => {
  const { dom, document, catalogGets } = await setup({ catalog: [figure('A'), figure('B')] });
  assert.deepEqual(catalogGets().map(({ url }) => url), ['/minifiguras']);
  assert.deepEqual(renderedIds(document).sort(), ['A', 'B']);
  dom.window.close();
});

test('Buscar y Mostrar todo filtran en memoria sin peticiones al servidor', async () => {
  const catalog = [figure('A', { nombre: 'Astronauta' }), figure('B', { nombre: 'Caballero', categoria: 'Castle' })];
  const { dom, window, document, catalogGets } = await setup({ catalog });
  const before = catalogGets().length;

  document.querySelector('#nombre').value = 'astro';
  await submitFilters(window);
  assert.deepEqual(renderedIds(document), ['A']);

  document.querySelector('#show-all').click();
  await flush();
  assert.deepEqual(renderedIds(document).sort(), ['A', 'B']);
  assert.equal(catalogGets().length, before);
  dom.window.close();
});

test('el filtrado sin coincidencias muestra el estado vacío sin pedir al servidor', async () => {
  const { dom, window, document, catalogGets } = await setup({ catalog: [figure('A')] });
  document.querySelector('#nombre').value = 'inexistente';
  await submitFilters(window);
  assert.deepEqual(renderedIds(document), []);
  assert.equal(document.querySelector('#status').textContent, 'No hay minifiguras que coincidan con la consulta.');
  assert.equal(catalogGets().length, 1);
  dom.window.close();
});

test('ordenar y paginar no realizan peticiones', async () => {
  const catalog = Array.from({ length: 12 }, (_, index) => figure(`F${index}`, { anio: 2000 + index }));
  const { dom, document, requests } = await setup({ catalog });
  const before = requests.length;
  document.querySelector('[data-sort="anio"]').click();
  document.querySelector('#next-page').click();
  await flush();
  assert.equal(document.querySelector('#page-status').textContent, 'Página 2 de 2');
  assert.equal(requests.length, before);
  dom.window.close();
});

test('el filtrado en cliente coincide con MinifigurasRepository.list', async () => {
  const seed = [
    figure('SP-001', { nombre: 'Astronauta Ágil', categoria: 'Space', anio: 2023, estadoColeccion: 'COLECCIÓN', observada: true }),
    figure('SP-002', { nombre: 'Robot espacial', categoria: 'Space', anio: 2024, estadoColeccion: 'BUSCADA' }),
    figure('CA-001', { nombre: 'Caballero Negro', categoria: 'Castle', anio: 2023, estadoColeccion: 'BUSCADA', observada: true }),
    figure('CM-001', { nombre: 'Atleta', categoria: 'Collectible Minifigures', subcategoria: 'Team GB', anio: 2012 }),
    figure('CM-002', { nombre: 'Emmet', categoria: 'Collectible Minifigures', subcategoria: 'The LEGO Movie', anio: 2014, estadoColeccion: 'BUSCADA' }),
  ];
  const repository = new MinifigurasRepository({
    client: createTestClient(createTestSupabase(seed)),
    userId: TEST_USER.id,
    categoriasRepository: { read: async () => categoriasMock },
  });
  const catalog = await repository.list({});
  const cases = [
    { ui: { nombre: 'agil' }, api: { nombre: 'agil' } },
    { ui: { nombre: 'ÁSTRO' }, api: { nombre: 'ÁSTRO' } },
    { ui: { id: 'sp' }, api: { id: 'sp' } },
    { ui: { categoria: 'Castle' }, api: { categoria: 'Castle' } },
    { ui: { categoria: 'Collectible Minifigures', subcategoria: 'Team GB' }, api: { categoria: 'Collectible Minifigures', subcategoria: 'Team GB' } },
    { ui: { anio: '2023' }, api: { anio: 2023 } },
    { ui: { coleccion: true }, api: { estadoColeccion: 'COLECCIÓN' } },
    { ui: { buscada: true }, api: { estadoColeccion: 'BUSCADA' } },
    { ui: { coleccion: true, buscada: true }, api: {} },
    { ui: { observada: true }, api: { observada: true } },
    { ui: { buscada: true, observada: true, anio: '2023' }, api: { estadoColeccion: 'BUSCADA', observada: true, anio: 2023 } },
  ];
  const { dom, window, document, catalogGets } = await setup({ catalog });

  for (const { ui, api } of cases) {
    document.querySelector('#filters-form').reset();
    document.querySelector('#id').value = ui.id ?? '';
    document.querySelector('#nombre').value = ui.nombre ?? '';
    document.querySelector('#categoria').value = ui.categoria ?? '';
    document.querySelector('#categoria').dispatchEvent(new window.Event('change'));
    document.querySelector('#subcategoria').value = ui.subcategoria ?? '';
    document.querySelector('#anio').value = ui.anio ?? '';
    document.querySelector('#filter-coleccion').checked = Boolean(ui.coleccion);
    document.querySelector('#filter-buscada').checked = Boolean(ui.buscada);
    document.querySelector('#observada').checked = Boolean(ui.observada);
    await submitFilters(window);
    const expected = (await repository.list(api)).map(({ id }) => id).sort();
    assert.deepEqual(renderedIds(document).sort(), expected, JSON.stringify(ui));
  }
  assert.equal(catalogGets().length, 1);
  dom.window.close();
});

function deferredCatalog(test) {
  const pending = [];
  test.pending = pending;
  return (url, options = {}) => {
    if (url === '/minifiguras' && (options.method ?? 'GET') === 'GET' && test.deferGets) {
      return new Promise((resolve) => { pending.push(resolve); });
    }
    return undefined;
  };
}

function controlsEnabled(document) {
  return !document.querySelector('#show-all').disabled && !document.querySelector('#filters-form button[type="submit"]').disabled;
}

test('la edición confirmada actualiza la tabla antes de la revalidación y sin bloquear controles', async () => {
  const control = { deferGets: false };
  const intercept = deferredCatalog(control);
  const { dom, window, document } = await setup({
    catalog: [figure('A', { nombre: 'Antiguo' }), figure('B')],
    onFetch: (url, options = {}) => {
      if (url === '/minifiguras/A' && options.method === 'PUT') {
        return ok({ ...JSON.parse(options.body), FechaRegistro: '2026-01-01T00:00:00.000Z', gamificacion: { logrosNuevos: [], nivelesAlcanzados: [] } });
      }
      return intercept(url, options);
    },
  });
  control.deferGets = true;
  document.querySelector('#catalog-body [data-action="edit"][data-id="A"]').click();
  document.querySelector('#form-nombre').value = 'Nuevo';
  document.querySelector('#minifigura-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flush();

  assert.equal(control.pending.length, 1, 'se lanza una revalidación en segundo plano');
  const row = [...document.querySelectorAll('#catalog-body tr')].find((tr) => tr.children[2].textContent === 'A');
  assert.equal(row.children[3].textContent, 'Nuevo');
  assert.ok(controlsEnabled(document));
  assert.match(document.querySelector('#toast-region').textContent, /Minifigura actualizada correctamente/);
  dom.window.close();
});

test('el alta confirmada añade la figura a la tabla antes de la revalidación', async () => {
  const control = { deferGets: false };
  const intercept = deferredCatalog(control);
  const { dom, window, document } = await setup({
    catalog: [figure('A')],
    onFetch: (url, options = {}) => {
      if (url === '/minifiguras' && options.method === 'POST') {
        return ok({ ...JSON.parse(options.body), id: 'NEW', FechaRegistro: '2026-02-01T00:00:00.000Z', gamificacion: null }, 201);
      }
      if (url === '/minifiguras/new/brickset') return ok({ categoria: 'Space', anio: 2024, precio: 12 });
      return intercept(url, options);
    },
  });
  control.deferGets = true;
  document.querySelector('#new-minifigura').click();
  document.querySelector('#form-id').value = 'new';
  document.querySelector('#form-id').dispatchEvent(new window.Event('input', { bubbles: true }));
  document.querySelector('#form-preview-image').dispatchEvent(new window.Event('load'));
  await flush();
  document.querySelector('#form-nombre').value = 'Nueva';
  document.querySelector('#minifigura-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flush();

  assert.equal(control.pending.length, 1);
  assert.deepEqual(renderedIds(document).sort(), ['A', 'NEW']);
  assert.ok(controlsEnabled(document));
  dom.window.close();
});

test('la eliminación confirmada quita la figura y conserva los filtros activos', async () => {
  const control = { deferGets: false };
  const intercept = deferredCatalog(control);
  const catalog = [figure('A', { categoria: 'Castle' }), figure('B', { categoria: 'Castle' }), figure('C')];
  const { dom, window, document } = await setup({
    catalog,
    onFetch: (url, options = {}) => {
      if (url === '/minifiguras/A' && options.method === 'DELETE') return { ok: true, status: 204, json: async () => ({}) };
      return intercept(url, options);
    },
  });
  document.querySelector('#categoria').value = 'Castle';
  await submitFilters(window);
  control.deferGets = true;
  document.querySelector('#catalog-body [data-action="delete"][data-id="A"]').click();
  document.querySelector('#delete-confirm').click();
  await flush();

  assert.equal(control.pending.length, 1);
  assert.deepEqual(renderedIds(document), ['B']);
  assert.ok(controlsEnabled(document));
  dom.window.close();
});

test('alternar observación reaplica el filtro activo sobre la caché', async () => {
  const control = { deferGets: false };
  const intercept = deferredCatalog(control);
  const catalog = [figure('A', { observada: true }), figure('B', { observada: true })];
  const { dom, window, document } = await setup({
    catalog,
    onFetch: (url, options = {}) => {
      if (url === '/minifiguras/A/observada' && options.method === 'PUT') return ok({ ...catalog[0], observada: false });
      return intercept(url, options);
    },
  });
  document.querySelector('#observada').checked = true;
  await submitFilters(window);
  control.deferGets = true;
  document.querySelector('#catalog-body [data-action="observe"][data-id="A"]').click();
  await flush();

  assert.equal(control.pending.length, 1);
  assert.deepEqual(renderedIds(document), ['B']);
  dom.window.close();
});

test('una mutación rechazada no modifica la tabla ni revalida', async () => {
  const { dom, window, document, catalogGets } = await setup({
    catalog: [figure('A', { nombre: 'Antiguo' })],
    onFetch: (url, options = {}) => (url === '/minifiguras/A' && options.method === 'PUT'
      ? { ok: false, status: 400, json: async () => ({ error: 'MINIFIGURA_INVALIDA' }) }
      : undefined),
  });
  document.querySelector('#catalog-body [data-action="edit"]').click();
  document.querySelector('#form-nombre').value = 'Nuevo';
  document.querySelector('#minifigura-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flush();

  assert.equal(document.querySelector('#catalog-body tr').children[3].textContent, 'Antiguo');
  assert.equal(catalogGets().length, 1);
  dom.window.close();
});

test('si la revalidación falla se conserva el cambio local sin error de carga', async () => {
  let failGets = false;
  const { dom, window, document } = await setup({
    catalog: [figure('A', { nombre: 'Antiguo' })],
    onFetch: (url, options = {}) => {
      if (url === '/minifiguras/A' && options.method === 'PUT') return ok({ ...JSON.parse(options.body) });
      if (url === '/minifiguras' && (options.method ?? 'GET') === 'GET' && failGets) return { ok: false, status: 500, json: async () => ({}) };
      return undefined;
    },
  });
  failGets = true;
  document.querySelector('#catalog-body [data-action="edit"]').click();
  document.querySelector('#form-nombre').value = 'Nuevo';
  document.querySelector('#minifigura-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  await flush();

  assert.equal(document.querySelector('#catalog-body tr').children[3].textContent, 'Nuevo');
  assert.notEqual(document.querySelector('#status').textContent, 'No se pudo cargar el catálogo. Inténtalo de nuevo.');
  assert.ok(controlsEnabled(document));
  dom.window.close();
});

test('una revalidación antigua que responde tarde no sobrescribe a la más reciente', async () => {
  const control = { deferGets: false };
  const intercept = deferredCatalog(control);
  const catalog = [figure('A'), figure('B')];
  const { dom, document } = await setup({
    catalog,
    onFetch: (url, options = {}) => {
      if (url === '/minifiguras/A/observada') return ok({ ...catalog[0], observada: true });
      if (url === '/minifiguras/B/observada') return ok({ ...catalog[1], observada: true });
      return intercept(url, options);
    },
  });
  control.deferGets = true;
  document.querySelector('#catalog-body [data-action="observe"][data-id="A"]').click();
  await flush();
  document.querySelector('#catalog-body [data-action="observe"][data-id="B"]').click();
  await flush();
  assert.equal(control.pending.length, 2);

  control.pending[1](ok([{ ...catalog[0], observada: true }, { ...catalog[1], observada: true }]));
  await flush();
  control.pending[0](ok([{ ...catalog[0], observada: true }, catalog[1]]));
  await flush();
  assert.equal(document.querySelectorAll('#catalog-body .eye-icon.active').length, 2);
  dom.window.close();
});

test('cerrar sesión vacía la caché y una nueva sesión no ve datos anteriores', async () => {
  const { dom, window, document, state } = await setup({ catalog: [figure('USER-A')] });
  assert.deepEqual(renderedIds(document), ['USER-A']);
  document.querySelector('#logout').click();
  await flush();
  assert.deepEqual(renderedIds(document), []);

  state.catalog = [figure('USER-B')];
  window.__supabaseStub.setSession('SIGNED_IN', { ...DEFAULT_SESSION, access_token: 'otro-token' });
  await flush();
  assert.deepEqual(renderedIds(document), ['USER-B']);
  document.querySelector('#nombre').value = 'user-a';
  await submitFilters(window);
  assert.deepEqual(renderedIds(document), []);
  dom.window.close();
});

test('las imágenes de tabla, rankings y watchlist se cargan de forma diferida y con dimensiones', async () => {
  const catalog = [figure('A', { observada: true })];
  const valuation = { ...emptyValuation, top5: [catalog[0]], top5Antiguas: [catalog[0]], observadas: [{ ...catalog[0], precioBrickset: 10 }] };
  const { dom, document } = await setup({ catalog, valuation });
  const images = [
    document.querySelector('.table-thumb'),
    ...document.querySelectorAll('.ranking-img'),
    document.querySelector('.watchlist-card img'),
  ];
  assert.equal(images.length, 4);
  for (const image of images) {
    assert.equal(image.getAttribute('loading'), 'lazy', image.className);
    assert.equal(image.getAttribute('decoding'), 'async', image.className);
    assert.ok(Number(image.getAttribute('width')) > 0, image.className);
    assert.ok(Number(image.getAttribute('height')) > 0, image.className);
  }
  dom.window.close();
});

test('las tarjetas declaran content-visibility y tamaño intrínseco', () => {
  for (const selector of ['\\.ranking-card', '\\.watchlist-card']) {
    assert.match(css, new RegExp(`${selector}\\s*\\{[^}]*content-visibility:\\s*auto[^}]*contain-intrinsic-size:`), selector);
  }
});

test('cada renderizado de página inserta las filas en una única operación', async () => {
  const catalog = Array.from({ length: 5 }, (_, index) => figure(`F${index}`, { anio: 2000 + index }));
  const { dom, document } = await setup({ catalog });
  const body = document.querySelector('#catalog-body');
  let replaceCalls = 0;
  let appendCalls = 0;
  const { replaceChildren, append, appendChild } = body;
  body.replaceChildren = function spy(...nodes) { replaceCalls += 1; return replaceChildren.apply(this, nodes); };
  body.append = function spy(...nodes) { appendCalls += 1; return append.apply(this, nodes); };
  body.appendChild = function spy(node) { appendCalls += 1; return appendChild.call(this, node); };

  document.querySelector('[data-sort="anio"]').click();
  assert.equal(replaceCalls, 1);
  assert.equal(appendCalls, 0);
  assert.equal(body.querySelectorAll('tr').length, 5);
  dom.window.close();
});
