import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { categoriasMockRaw } from '../test-support/fixtures.js';
import { withSupabaseSession } from '../test-support/browser-auth.js';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const script = withSupabaseSession(await readFile(new URL('../public/app.js', import.meta.url), 'utf8'));

function createDom() {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  dom.window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  dom.window.HTMLCanvasElement.prototype.getContext = () => ({});
  dom.window.__dnaCharts = [];
  dom.window.Chart = class ChartMock {
    constructor(context, configuration) {
      this.configuration = configuration;
      this.destroyed = false;
      dom.window.__dnaCharts.push(this);
    }
    destroy() { this.destroyed = true; }
  };
  return dom;
}

function baseFetch(catalogo, gamificacion, postResponse, dnaState) {
  return async (url, options = {}) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(categoriasMockRaw) };
    if (url === '/minifiguras' && options.method === 'POST') return { ok: true, status: 201, json: async () => postResponse };
    if (url === '/minifiguras' || url.startsWith('/minifiguras?')) return { ok: true, json: async () => catalogo };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 0, enColeccion: catalogo.length, buscadas: 0, top5: [], top5Antiguas: [] }) };
    if (url === '/gamificacion') return { ok: true, json: async () => gamificacion };
    if (url === '/gamificacion/dna') {
      if (dnaState === false) return { ok: false, status: 500, json: async () => ({ error: 'DNA_NO_DISPONIBLE' }) };
      const value = typeof dnaState === 'function' ? await dnaState() : dnaState ?? {
        principal: 'Newbie', porcentajes: { rarityHunter: 0, explorer: 0, collector: 0, fan: 0 },
      };
      return { ok: true, status: 200, json: async () => value };
    }
    return { ok: false, json: async () => ({}) };
  };
}

function state(overrides = {}) {
  return {
    bricks: 820,
    nivel: { id: 8, nombre: 'Redbeard', umbral: 750 },
    siguienteNivel: { id: 9, nombre: 'Forestman', umbral: 1000 },
    progreso: { actual: 820, desde: 750, hasta: 1000, porcentaje: 28 },
    logros: [{ id: 'new-mini-person', nombre: 'New mini person', descripcion: 'Añadir una nueva minifigura.', bricks: 1, cantidad: 12, total: 12 }],
    ...overrides,
  };
}

test('renderiza el nivel, progreso y modal de desglose', async () => {
  const dom = createDom();
  const { window } = dom;
  window.fetch = baseFetch([], state({ nivel: { id: 8, nombre: 'Three-Seven-Five', umbral: 750 } }));
  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(window.document.querySelector('#gamification-title').textContent, '8 Three-Seven-Five');
  assert.equal(window.document.querySelector('.gamification-level-image').getAttribute('src'), '/level_images/8_redbearb.png');
  assert.equal(window.document.querySelector('.achievements-heading-icon').getAttribute('src'), '/level_images/8_redbearb.png');
  assert.equal(window.document.querySelector('#gamification-bricks').textContent, '820');
  assert.equal(window.document.querySelector('#gamification-dialog-bricks').textContent, '820');
  assert.equal(window.document.querySelector('#gamification-progress').value, 28);
  assert.equal(window.document.querySelector('#gamification-percentage').textContent, '28%');
  assert.equal(window.document.querySelector('#gamification-percentage').textContent, '28%');
  window.document.querySelector('#gamification-bricks').click();
  assert.equal(window.document.querySelector('#gamification-dialog').open, false);
  window.document.querySelector('#gamification-level-name').click();
  assert.equal(window.document.querySelector('#gamification-dialog').open, true);
  assert.equal(window.document.querySelector('#gamification-dialog-level').textContent, '8 Three-Seven-Five');
  const achievement = window.document.querySelector('#gamification-achievements li');
  assert.equal(achievement.className, 'achievement-item');
  assert.equal(achievement.querySelector('.achievement-icon').getAttribute('src'), '/toast_images/75206.png');
  assert.equal(achievement.querySelector('.achievement-name').textContent, 'New mini person');
  assert.equal(achievement.querySelector('.achievement-description').textContent, 'Añadir una nueva minifigura.');
  assert.equal(achievement.querySelector('.achievement-count').textContent, 'x12');
  assert.equal(achievement.querySelector('.achievement-bricks strong').textContent, '12');
  assert.equal(achievement.querySelector('.achievement-brick-icon').getAttribute('src'), '/toast_images/hero_2026-01-05_16-38-47-871.webp');
  window.document.querySelector('#gamification-close').click();
  assert.equal(window.document.querySelector('#gamification-dialog').open, false);
  window.document.querySelector('#gamification-toggle').click();
  const achievementsButton = window.document.querySelector('#open-achievements');
  assert.equal(achievementsButton.textContent.trim(), '🏆 Logros');
  achievementsButton.click();
  assert.equal(window.document.querySelector('#gamification-dialog').open, true);
  assert.equal(window.document.activeElement.id, 'gamification-close');
  assert.equal(window.document.querySelector('#gamification-close').parentElement.className, 'achievements-heading');
  assert.equal(window.document.querySelector('.achievements-actions'), null);
  window.document.querySelector('#gamification-close').click();
  window.document.querySelector('#gamification-level').click();
  assert.equal(window.document.querySelector('#gamification-dialog').open, true);
  dom.window.close();
});

test('renderizar logros ajenos no cambia el panel y abrir propios restaura su contenido', async () => {
  const dom = createDom();
  dom.window.fetch = baseFetch([], state());
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));
  dom.window.eval("renderAchievements({ bricks: 50, nivel: { id: 1, nombre: 'Stud' }, logros: [] }, 'Logros de Ada')");
  const document = dom.window.document;
  assert.equal(document.querySelector('#gamification-dialog-title').textContent, 'Logros de Ada');
  assert.equal(document.querySelector('#gamification-dialog-bricks').textContent, '50');
  assert.equal(document.querySelector('#gamification-bricks').textContent, '820');
  assert.equal(document.querySelector('#gamification-level-number').textContent, '8');
  assert.equal(document.querySelector('#gamification-progress').value, 28);
  document.querySelector('#open-achievements').click();
  assert.equal(document.querySelector('#gamification-dialog-title').textContent, 'Logros');
  assert.equal(document.querySelector('#gamification-dialog-bricks').textContent, '820');
  assert.equal(document.querySelector('.achievement-name').textContent, 'New mini person');
  dom.window.close();
});

test('usa la imagen disponible de cada nivel y Forestman como fallback', async () => {
  const levels = [
    [0, '/level_images/0_duplo.png'], [1, '/level_images/1_stud.png'],
    [2, '/level_images/2_plate.png'],
    [3, '/level_images/3_threesevenfive.png'], [4, '/level_images/4_citizen.png'],
    [5, '/level_images/5_skeleton.png'], [6, '/level_images/6_pirate.png'],
    [7, '/level_images/7_captain.png'], [8, '/level_images/8_redbearb.png'],
    [9, '/level_images/9_forestman.png'], [10, '/level_images/10_wolfpack.png'],
    [11, '/level_images/11_wolfpackmaster.png'], [12, '/level_images/12_ninja.png'],
    [13, '/level_images/13_rx.png'], [14, '/level_images/14_dragonform.png'],
    [15, '/level_images/15_spacebaby.jpg'], [16, '/level_images/16_spaceman.jpg'],
    [17, '/level_images/17_blacktron.png'], [18, '/level_images/18_technic.png'],
    [19, '/level_images/19_majisto.png'], [20, '/level_images/20_castleknight.png'],
    [21, '/level_images/21_chromegold.png'], [22, '/level_images/22_woodenduck.png'],
    [23, '/level_images/23_billund.png'], [24, '/level_images/24_mrkirk.png'],
    [25, '/level_images/25_mrgold.png'], [26, '/level_images/0_duplo.png'],
  ];
  for (const [levelId, imagePath] of levels) {
    const dom = createDom();
    const { window } = dom;
    window.fetch = baseFetch([], state({ nivel: { id: levelId, nombre: 'Nivel de prueba' } }));
    window.eval(script);
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(window.document.querySelector('#gamification-level-number').textContent, String(levelId));
    assert.equal(window.document.querySelector('.gamification-level-image').getAttribute('src'), imagePath);
    assert.equal(window.document.querySelector('.achievements-heading-icon').getAttribute('src'), imagePath);
    dom.window.close();
  }
});

test('usa regalo.jpg en logros de tipo regalo y conserva la copa en los demás', async () => {
  const dom = createDom();
  const { window } = dom;
  window.fetch = baseFetch([], state({ logros: [
    { id: 'gift', type: 'regalo', nombre: 'Someone liked your collection', descripcion: 'Regalo', bricks: 50, cantidad: 20, total: 1000 },
    { id: 'normal', nombre: 'Normal', descripcion: 'Normal', bricks: 1, cantidad: 1, total: 1 },
    { id: 'high', nombre: 'High', descripcion: 'High', bricks: 10, cantidad: 10, total: 100 },
  ] }));
  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const items = [...window.document.querySelectorAll('.achievement-item')];
  assert.deepEqual(items.map((item) => item.querySelector('.achievement-name').textContent), ['High', 'Normal', 'Someone liked your collection']);
  const gift = items[2];
  const normal = items[1];
  assert.equal(gift.querySelector('.achievement-icon').getAttribute('src'), '/toast_images/regalo.jpg');
  assert.equal(gift.querySelector('.achievement-icon').alt, 'Regalo');
  assert.equal(normal.querySelector('.achievement-icon').getAttribute('src'), '/toast_images/75206.png');
  dom.window.close();
});

test('muestra una ampliación del nivel al pasar el ratón por la imagen', async () => {
  const dom = createDom();
  const { window } = dom;
  window.fetch = baseFetch([], state({ nivel: { id: 16, nombre: 'Spaceman' } }));
  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const image = window.document.querySelector('.gamification-level-image');
  const preview = window.document.querySelector('.gamification-level-tooltip');
  assert.ok(preview);
  assert.equal(preview.querySelector('img').getAttribute('src'), '/level_images/16_spaceman.jpg');
  assert.equal(preview.style.display, 'none');
  image.dispatchEvent(new window.MouseEvent('mouseenter', { bubbles: true }));
  assert.equal(preview.style.display, 'block');
  image.dispatchEvent(new window.MouseEvent('mouseleave', { bubbles: true }));
  assert.equal(preview.style.display, 'none');
  dom.window.close();
});

test('el panel mantiene los recuentos visibles y despliega acciones y valor con la flecha', async () => {
  const dom = createDom();
  const { window } = dom;
  window.fetch = baseFetch([], state());
  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const toggle = window.document.querySelector('#gamification-toggle');
  const details = window.document.querySelector('#gamification-details');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(details.hidden, true);
  assert.equal(window.document.querySelector('#collection-count').closest('.gamification-main') !== null, true);
  assert.equal(window.document.querySelector('#wanted-count').closest('.gamification-main') !== null, true);
  assert.equal(details.querySelector('.collection-counts-panel'), null);
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(details.hidden, false);
  assert.deepEqual([...details.children].map((element) => element.className), ['gamification-progress', 'summary-achievements-row', 'summary-ranking-row', 'summary-sync-row', 'sync-progress']);
  assert.equal(window.document.querySelector('#open-dna').parentElement, window.document.querySelector('#open-achievements').parentElement);
  assert.equal(window.document.querySelector('#open-dna').getAttribute('aria-controls'), 'dna-dialog');
  assert.equal(window.document.querySelector('#open-dna-inline').tagName, 'BUTTON');
  assert.equal(window.document.querySelector('#open-dna-inline').getAttribute('aria-label'), 'Abrir DNA: Newbie');
  assert.equal(window.document.querySelector('#gamification-dna-principal').textContent, 'Newbie');
  window.eval("renderGamificationDna({ principal: 'Explorer', porcentajes: { explorer: 100 } })");
  assert.equal(window.document.querySelector('#gamification-dna-principal').textContent, 'Explorer');
  assert.equal(window.document.querySelector('#open-dna-inline').getAttribute('aria-label'), 'Abrir DNA: 100% Explorer / 0% Rarity Hunter');
  toggle.click();
  assert.equal(details.hidden, true);
  dom.window.close();
});

test('el resumen DNA conserva el principal y muestra el segundo por porcentaje, limpiando estados vacios', async () => {
  const dom = createDom();
  const { window } = dom;
  window.fetch = baseFetch([], state(), undefined, { principal: 'Explorer', porcentajes: { rarityHunter: 25, explorer: 25, collector: 25, fan: 25 } });
  try {
    window.eval(script);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const button = window.document.querySelector('#open-dna-inline');
    assert.equal(button.textContent, '25% Explorer / 25% Rarity Hunter');
    window.eval("renderGamificationDna({ principal: 'Rarity Hunter', porcentajes: { rarityHunter: 40.5, explorer: 30.5, collector: 20, fan: 9 } })");
    assert.equal(button.textContent, '40,5% Rarity Hunter / 30,5% Explorer');
    assert.equal(button.title, button.textContent);
    for (const dna of [{ principal: 'Newbie', porcentajes: { rarityHunter: 0, explorer: 0, collector: 0, fan: 0 } }, null]) {
      window.eval(`renderGamificationDna(${JSON.stringify(dna)})`);
      assert.equal(button.textContent, dna ? 'Newbie' : 'DNA no disponible');
      assert.equal(window.document.querySelector('#gamification-dna-percentage').hidden, true);
      assert.equal(window.document.querySelector('#gamification-dna-secondary').hidden, true);
    }
  } finally {
    dom.window.close();
  }
});

test('el dialogo DNA representa proporciones, leyenda, reintento, Newbie y foco de retorno', async () => {
  const dom = createDom();
  const document = dom.window.document;
  const dnaState = { principal: 'Fan', porcentajes: { rarityHunter: 10, explorer: 20, collector: 30, fan: 40 } };
  dom.window.fetch = baseFetch([], state(), undefined, dnaState);
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const inlineTrigger = document.querySelector('#open-dna-inline');
  inlineTrigger.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const dialog = document.querySelector('#dna-dialog');
  const chart = document.querySelector('#dna-chart');
  assert.equal(dialog.open, true);
  assert.equal(document.activeElement.id, 'dna-close');
  assert.equal(document.querySelector('#gamification-dna-principal').textContent, 'Fan');
  assert.equal(document.querySelector('#open-dna-inline').textContent, '40% Fan / 30% Collector');
  assert.equal(document.querySelector('#open-dna-inline').getAttribute('aria-label'), 'Abrir DNA: 40% Fan / 30% Collector');
  const instance = dom.window.__dnaCharts.at(-1);
  assert.equal(instance.configuration.type, 'doughnut');
  assert.deepEqual(Array.from(instance.configuration.data.datasets[0].data), [10, 20, 30, 40]);
  assert.equal(instance.configuration.options.plugins.tooltip.callbacks.label({ label: 'Fan', raw: 40 }), 'Fan: 40%');
  assert.equal(document.querySelector('#dna-chart-percentage').textContent, '40%');
  assert.equal(document.querySelector('#dna-chart-trait').textContent, 'Fan');
  assert.match(chart.getAttribute('aria-label'), /Fan 40%/);
  assert.deepEqual([...document.querySelectorAll('.dna-legend-item strong:first-of-type')].map((item) => item.textContent), [
    'Fan', 'Collector', 'Explorer', 'Rarity Hunter',
  ]);
  assert.deepEqual([...document.querySelectorAll('.dna-percentage')].map((item) => item.textContent), ['40%', '30%', '20%', '10%']);
  assert.deepEqual([...document.querySelectorAll('.dna-swatch')].map((item) => item.className), [
    'dna-swatch dna-swatch-fan', 'dna-swatch dna-swatch-collector', 'dna-swatch dna-swatch-explorer', 'dna-swatch dna-swatch-rarity',
  ]);
  assert.equal(document.querySelector('#dna-status').parentElement, document.querySelector('#dna-legend').parentElement);
  assert.match(document.querySelector('.dna-legend').textContent, /Busca piezas raras y valiosas/);
  assert.match(document.querySelector('.dna-legend').textContent, /Descubre categorías y subcategorías/);
  assert.match(document.querySelector('.dna-legend').textContent, /Amplía y completa la colección/);
  assert.match(document.querySelector('.dna-legend').textContent, /afinidad por temáticas y personajes/);
  document.querySelector('#dna-close').click();
  dialog.dispatchEvent(new dom.window.Event('close'));
  assert.equal(dialog.open, false);
  assert.equal(instance.destroyed, true);
  assert.equal(document.activeElement, inlineTrigger);

  const dropdownTrigger = document.querySelector('#open-dna');
  dropdownTrigger.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  dialog.dispatchEvent(new dom.window.Event('close'));
  assert.equal(dialog.open, false);
  assert.equal(document.activeElement, dropdownTrigger);
  dom.window.close();
});

test('DNA muestra estado de error con reintento y Newbie sin segmentos inventados', async () => {
  const dom = createDom();
  const document = dom.window.document;
  const success = baseFetch([], state(), undefined, { principal: 'Newbie', porcentajes: { rarityHunter: 0, explorer: 0, collector: 0, fan: 0 } });
  let attempts = 0;
  dom.window.fetch = async (url, options) => {
    if (url === '/gamificacion/dna') {
      attempts += 1;
      if (attempts === 2) return { ok: false, status: 500, json: async () => ({ error: 'DNA_NO_DISPONIBLE' }) };
    }
    return success(url, options);
  };
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(attempts, 1);
  document.querySelector('#open-dna').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(document.querySelector('#dna-status').textContent, 'No se pudo cargar el DNA.');
  const retry = document.querySelector('#dna-retry');
  assert.equal(retry.hidden, false);
  retry.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const chart = document.querySelector('#dna-chart');
  assert.equal(chart.hidden, false);
  assert.equal(chart.classList.contains('dna-chart-empty'), true);
  assert.equal(dom.window.__dnaCharts.length, 0);
  assert.equal(document.querySelector('#dna-status').textContent, 'Newbie');
  assert.equal(document.querySelector('#dna-status').parentElement, document.querySelector('#dna-legend').parentElement);
  assert.deepEqual([...document.querySelectorAll('.dna-percentage')].map((item) => item.textContent), ['0%', '0%', '0%', '0%']);
  dom.window.close();
});

test('los paneles de rankings y seguimiento se comprimen y expanden con su flecha', async () => {
  const dom = createDom();
  const { window } = dom;
  window.fetch = baseFetch([], state());
  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(window.document.querySelector('#rankings-title').textContent, 'Rankings');
  for (const [panelSelector, contentId] of [['.rankings-panel', 'rankings-content'], ['.watchlist-panel', 'watchlist-list']]) {
    const panel = window.document.querySelector(panelSelector);
    const toggle = panel.querySelector('.panel-toggle');
    const content = window.document.getElementById(contentId);
    assert.equal(toggle.getAttribute('aria-controls'), contentId);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(content.hidden, true);
    toggle.click();
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(content.hidden, false);
    assert.ok(!panel.classList.contains('panel-collapsed'));
    toggle.click();
    assert.equal(content.hidden, true);
    assert.ok(panel.classList.contains('panel-collapsed'));
  }
  assert.ok(window.document.querySelector('.rankings-panel #top-five-list'));
  assert.ok(window.document.querySelector('.rankings-panel #oldest-five-list'));
  dom.window.close();
});

test('ordena los Toasts de logros por Bricks y separa su aparición', async () => {
  const dom = createDom();
  const { window } = dom;
  const catalogo = [];
  const fetchCatalog = baseFetch(catalogo, state({ bricks: 0, nivel: { id: 0, nombre: 'Duplo', umbral: 0 }, siguienteNivel: { id: 1, nombre: 'Stud', umbral: 20 }, progreso: { actual: 0, desde: 0, hasta: 20, porcentaje: 0 }, logros: [] }), {
    gamificacion: {
      logrosNuevos: [
        { nombre: 'Masterpiece', bricksNuevos: 100 },
        { nombre: 'New mini person', bricksNuevos: 1 },
        { nombre: 'WOAH!', bricksNuevos: 10 },
      ],
      nivelesAlcanzados: [{ id: 5, nombre: 'Skeleton' }],
    },
  });
  window.fetch = async (url, options = {}) => {
    if (url.endsWith('/brickset')) return { ok: true, json: async () => ({ id: 'NEW-FIGURE', categoria: 'Space', anio: 2024, precio: 12 }) };
    return fetchCatalog(url, options);
  };
  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));
  window.document.querySelector('#new-minifigura').click();
  window.document.querySelector('#form-id').value = 'new-figure';
  window.document.querySelector('#form-id').dispatchEvent(new window.Event('input', { bubbles: true }));
  window.document.querySelector('#form-preview-image').dispatchEvent(new window.Event('load'));
  await new Promise((resolve) => setTimeout(resolve, 10));
  window.document.querySelector('#form-nombre').value = 'Nueva';
  window.document.querySelector('#form-descripcion').value = 'Figura';
  window.document.querySelector('#form-categoria').value = 'Space';
  window.document.querySelector('#form-anio').value = '2024';
  window.document.querySelector('#minifigura-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 10));
  const taskToast = [...window.document.querySelectorAll('.toast')].find((toast) => /New mini person \+1 Bricks/.test(toast.textContent));
  assert.ok(taskToast);
  assert.ok(taskToast.classList.contains('toast-task'));
  await new Promise((resolve) => setTimeout(resolve, 620));
  assert.ok([...window.document.querySelectorAll('.toast')].some((toast) => /WOAH! \+10 Bricks/.test(toast.textContent) && toast.classList.contains('toast-task')));
  await new Promise((resolve) => setTimeout(resolve, 320));
  const levelToast = [...window.document.querySelectorAll('.toast')].find((toast) => toast.classList.contains('toast-level'));
  assert.equal(levelToast.textContent, 'NIVEL 5 Skeleton');
  dom.window.close();
});

test('pagina la tabla en bloques de diez filas', async () => {
  const dom = createDom();
  const { window } = dom;
  const catalogo = Array.from({ length: 21 }, (_, index) => ({
    id: `figure-${index + 1}`,
    nombre: `Figura ${index + 1}`,
    descripcion: 'Figura',
    categoria: 'Space',
    anio: 2024,
    estadoColeccion: 'COLECCIÓN',
  }));
  window.fetch = baseFetch(catalogo, state());
  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const rows = () => window.document.querySelectorAll('#catalog-body tr');
  assert.equal(rows().length, 10);
  assert.equal(window.document.querySelector('#page-status').textContent, 'Página 1 de 3');
  assert.equal(window.document.querySelector('#previous-page').disabled, true);
  window.document.querySelector('#next-page').click();
  assert.equal(rows().length, 10);
  assert.equal(window.document.querySelector('#page-status').textContent, 'Página 2 de 3');
  window.document.querySelector('#next-page').click();
  assert.equal(rows().length, 1);
  assert.equal(window.document.querySelector('#next-page').disabled, true);
  dom.window.close();
});
