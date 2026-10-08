import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { categoriasMockRaw } from '../test-support/fixtures.js';
import { withSupabaseSession } from '../test-support/browser-auth.js';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const appScript = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const stylesheet = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');

function startApp({ fetchImpl, session } = {}) {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  const chartConfigs = [];
  const chartInstances = [];
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  window.HTMLCanvasElement.prototype.getContext = () => ({});
  const style = window.document.createElement('style');
  style.textContent = stylesheet;
  window.document.head.append(style);
  window.Chart = class ChartMock {
    constructor(context, configuration) {
      this.context = context;
      this.configuration = configuration;
      this.destroyed = false;
      chartConfigs.push(configuration);
      chartInstances.push(this);
    }

    destroy() { this.destroyed = true; }
  };
  const requests = [];
  window.fetch = async (url, init = {}) => {
    requests.push({ url, init });
    if (fetchImpl) {
      const response = await fetchImpl(url, init);
      if (response !== undefined) return response;
    }
    if (url === '/categorias') return { ok: true, status: 200, json: async () => JSON.parse(categoriasMockRaw) };
    if (url === '/minifiguras') return { ok: true, status: 200, json: async () => [] };
    if (url === '/valoracion') return { ok: true, status: 200, json: async () => ({ total: 0, enColeccion: 0, buscadas: 0, top5: [], top5Antiguas: [] }) };
    if (url === '/gamificacion') return { ok: true, status: 200, json: async () => ({ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, siguienteNivel: null, progreso: { porcentaje: 0 }, logros: [] }) };
    if (url === '/gamificacion/dna') return { ok: true, status: 200, json: async () => ({ principal: 'Newbie', porcentajes: { rarityHunter: 0, explorer: 0, collector: 0, fan: 0 } }) };
    if (url === '/api/ranking') return { ok: true, status: 200, json: async () => [] };
    if (url === '/sincronizacion/brickset') return { ok: true, status: 200, json: async () => ({ estado: 'inactiva' }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  window.eval(withSupabaseSession(appScript, { session }));
  return { dom, window, document: window.document, requests, chartConfigs, chartInstances };
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test('Progreso ofrece controles accesibles, dialog nativo y tablas alternativas', async () => {
  const { dom, window, document } = startApp();
  try {
    await tick();
    const trigger = document.querySelector('#open-analytics-history');
    const dialog = document.querySelector('#analytics-history-dialog');
    assert.equal(dialog.open, false);
    assert.equal(window.getComputedStyle(dialog).display, 'none');
    assert.equal(trigger.type, 'button');
    assert.equal(trigger.textContent.trim(), '📈 Progreso');
    assert.equal(trigger.title, 'Progreso');
    assert.equal(trigger.getAttribute('aria-controls'), dialog.id);
    assert.equal(trigger.parentElement.className, 'summary-achievements-row');
    assert.equal(dialog.getAttribute('aria-labelledby'), 'analytics-history-title');
    assert.equal(document.querySelector('#analytics-history-title').textContent, 'Progreso');
    assert.deepEqual([...document.querySelectorAll('[data-history-days]')].map((button) => button.dataset.historyDays), ['30', '90', '365']);
    assert.equal(document.querySelectorAll('.analytics-history-chart canvas').length, 3);
    assert.equal(document.querySelectorAll('.analytics-history-chart table').length, 3);
    assert.equal(document.querySelectorAll('.analytics-history-plot canvas').length, 3);
    assert.equal(document.querySelectorAll('details.analytics-history-table-wrap:not([open])').length, 3);
    assert.deepEqual([...document.querySelectorAll('.analytics-history-table-wrap summary')].map((summary) => summary.textContent), ['Datos', 'Datos', 'Datos']);
    assert.equal(document.querySelector('#analytics-history-value-title').textContent, 'Valor de colecci\u00f3n y progreso de minifiguras');
    assert.equal(document.querySelector('#analytics-history-custom-range input[name="from"]').type, 'date');
    assert.equal(document.querySelector('#analytics-history-custom-range input[name="to"]').type, 'date');
    assert.equal(window.getComputedStyle(document.querySelector('#analytics-history-custom-range')).gridTemplateRows, 'auto');
    assert.equal(window.getComputedStyle(document.querySelector('#dna-canvas')).zIndex, '1');
    assert.equal(window.getComputedStyle(document.querySelector('.dna-chart-label')).zIndex, '0');
  } finally {
    dom.window.close();
  }
});

test('Historico abre por boton, cierra con Escape o control y restaura el foco', async () => {
  const { dom, window, document } = startApp();
  try {
    await tick();
    const trigger = document.querySelector('#open-analytics-history');
    const dialog = document.querySelector('#analytics-history-dialog');
    const close = document.querySelector('#analytics-history-close');
    trigger.click();
    assert.equal(dialog.open, true);
    assert.equal(document.activeElement, close);
    dialog.dispatchEvent(new window.Event('cancel', { cancelable: true }));
    assert.equal(dialog.open, false);
    assert.equal(document.activeElement, trigger);

    trigger.click();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(dialog.open, false);
    assert.equal(document.activeElement, trigger);

    trigger.click();
    close.click();
    assert.equal(dialog.open, false);
    assert.equal(document.activeElement, trigger);
  } finally {
    dom.window.close();
  }
});

test('Historico envía rangos con apiFetch y descarta respuestas fuera de orden', async () => {
  const pending = [];
  const { dom, document, requests } = startApp({
    fetchImpl(url) {
      if (url.startsWith('/api/analytics/history?')) return new Promise((resolve) => pending.push({ url, resolve }));
      return undefined;
    },
  });
  try {
    await tick();
    document.querySelector('#open-analytics-history').click();
    await tick();
    const historyRequests = () => requests.filter(({ url }) => url.startsWith('/api/analytics/history?'));
    assert.equal(historyRequests().length, 1);
    assert.equal(historyRequests()[0].init.headers.Authorization, 'Bearer token-navegador');
    const defaultRange = new URL(historyRequests()[0].url, 'http://localhost');
    assert.equal(defaultRange.searchParams.has('from'), true);
    assert.equal(defaultRange.searchParams.has('to'), true);

    document.querySelector('[data-history-days="30"]').click();
    await tick();
    assert.equal(historyRequests().length, 2);
    const range30 = new URL(historyRequests()[1].url, 'http://localhost');
    assert.equal((Date.parse(`${range30.searchParams.get('to')}T00:00:00Z`) - Date.parse(`${range30.searchParams.get('from')}T00:00:00Z`)) / 86400000 + 1, 30);

    pending[1].resolve({ ok: true, status: 200, json: async () => ({ snapshots: [], baseline: null }) });
    await tick();
    assert.equal(document.querySelector('#analytics-history-status').textContent, 'No hay datos para este período.');
    pending[0].resolve({ ok: true, status: 200, json: async () => ({ snapshots: [{ snapshotDate: '2026-10-01' }], baseline: null }) });
    await tick();
    assert.equal(document.querySelector('#analytics-history-status').textContent, 'No hay datos para este período.');

    document.querySelector('#analytics-history-from').value = '2026-03-01';
    document.querySelector('#analytics-history-to').value = '2026-03-05';
    document.querySelector('#analytics-history-custom-range').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await tick();
    assert.equal(historyRequests().length, 3);
    const customRange = new URL(historyRequests()[2].url, 'http://localhost');
    assert.equal(customRange.searchParams.get('from'), '2026-03-01');
    assert.equal(customRange.searchParams.get('to'), '2026-03-05');
    pending[2].resolve({ ok: true, status: 200, json: async () => ({ snapshots: [], baseline: null }) });
    await tick();
  } finally {
    dom.window.close();
  }
});

test('Historico permite reintentar errores e invalida carga al cerrar o cambiar de cuenta', async () => {
  let attempts = 0;
  const { dom, window, document } = startApp({
    fetchImpl(url) {
      if (!url.startsWith('/api/analytics/history?')) return undefined;
      attempts += 1;
      if (attempts === 1) return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      if (attempts === 2) return Promise.resolve({ ok: true, status: 200, json: async () => ({ snapshots: [], baseline: null }) });
      return new Promise((resolve) => { window.resolvePendingHistory = resolve; });
    },
  });
  try {
    await tick();
    const trigger = document.querySelector('#open-analytics-history');
    const dialog = document.querySelector('#analytics-history-dialog');
    trigger.click();
    await tick();
    assert.equal(document.querySelector('#analytics-history-retry').hidden, false);
    document.querySelector('#analytics-history-retry').click();
    await tick();
    assert.equal(document.querySelector('#analytics-history-status').textContent, 'No hay datos para este período.');
    assert.equal(document.querySelector('#analytics-history-retry').hidden, true);

    trigger.click();
    await tick();
    assert.equal(attempts, 3);
    document.querySelector('#analytics-history-close').click();
    assert.equal(dialog.open, false);
    window.resolvePendingHistory({ ok: true, status: 200, json: async () => ({ snapshots: [{ snapshotDate: '2026-10-01' }], baseline: null }) });
    await tick();
    assert.equal(document.querySelector('#analytics-history-status').textContent, '');

    trigger.click();
    await tick();
    assert.equal(attempts, 4);
    window.__supabaseStub.setSession('SIGNED_IN', {
      access_token: 'other-token',
      user: { id: 'user-b', email: 'b@example.com', user_metadata: { full_name: 'Usuaria B' } },
    });
    assert.equal(dialog.open, false);
    window.resolvePendingHistory({ ok: true, status: 200, json: async () => ({ snapshots: [{ snapshotDate: '2026-10-02' }], baseline: null }) });
    await tick();
    assert.equal(document.querySelector('#analytics-history-status').textContent, '');
  } finally {
    dom.window.close();
  }
});

test('valor y cambio neto muestran baseline adyacente, descensos y huecos como null', async () => {
  const { dom, window, document, chartConfigs } = startApp({
    fetchImpl(url) {
      if (!url.startsWith('/api/analytics/history?')) return undefined;
      const query = new URL(url, 'http://localhost').searchParams;
      if (query.get('from') === '2026-10-01') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            baseline: { snapshotDate: '2026-09-30', totalFigures: 12 },
            snapshots: [
              { snapshotDate: '2026-10-01', totalFigures: 12, totalValue: 20, bricks: 1, level: 0, dna: { collector: 0, explorer: 0, rarityHunter: 0, fan: 0 } },
              { snapshotDate: '2026-10-02', totalFigures: 9, totalValue: 17, bricks: 2, level: 0, dna: { collector: 0, explorer: 0, rarityHunter: 0, fan: 0 } },
              { snapshotDate: '2026-10-04', totalFigures: 9, totalValue: 15, bricks: 3, level: 0, dna: { collector: 0, explorer: 0, rarityHunter: 0, fan: 0 } },
            ],
          }),
        });
      }
      if (query.get('from') === '2026-11-01') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            baseline: null,
            snapshots: [{ snapshotDate: '2026-11-01', totalFigures: 1, totalValue: 5, bricks: 0, level: 0, dna: { collector: 0, explorer: 0, rarityHunter: 0, fan: 0 } }],
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ snapshots: [], baseline: null }) });
    },
  });
  try {
    await tick();
    const trigger = document.querySelector('#open-analytics-history');
    trigger.click();
    await tick();
    document.querySelector('#analytics-history-from').value = '2026-10-01';
    document.querySelector('#analytics-history-to').value = '2026-10-04';
    document.querySelector('#analytics-history-custom-range').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await tick();

    const chart = [...chartConfigs].reverse().find(({ type }) => type === 'bar');
    const [valueDataset, deltaDataset] = chart.data.datasets;
    assert.deepEqual(Array.from(valueDataset.data, ({ y }) => y), [20, 17, null, 15]);
    assert.deepEqual(Array.from(deltaDataset.data, ({ y }) => y), [0, -3, null, null]);
    assert.equal(chart.options.scales.x.type, 'linear');
    assert.equal(chart.options.scales.x.min, Date.parse('2026-10-01T00:00:00.000Z'));
    assert.equal(chart.options.scales.x.max, Date.parse('2026-10-04T00:00:00.000Z'));
    assert.equal(chart.options.parsing, false);
    assert.equal(chart.options.plugins.tooltip.callbacks.title([{ parsed: { x: Date.parse('2026-10-02T00:00:00.000Z') } }]), '02/10/2026');
    assert.equal(chart.options.plugins.legend.position, 'bottom');
    assert.equal(chart.options.scales.x.grid.display, false);
    assert.equal(chart.options.scales.x.offset, false);
    assert.equal(chart.options.scales.x.ticks.maxRotation, 0);
    assert.equal(chart.options.scales.x.ticks.callback(Date.parse('2026-10-02T00:00:00.000Z'), 0, []), '02/10');
    assert.equal(valueDataset.tension, 0);
    assert.equal(deltaDataset.maxBarThickness, 18);
    assert.equal(chart.options.scales.figures.suggestedMin, -9);
    assert.equal(valueDataset.borderColor, window.getComputedStyle(document.documentElement).getPropertyValue('--dna-fan').trim());
    assert.equal(deltaDataset.borderColor, window.getComputedStyle(document.documentElement).getPropertyValue('--yellow').trim());
    assert.equal(deltaDataset.backgroundColor, 'rgba(255, 213, 0, 0.4)');
    assert.equal(deltaDataset.label, 'Progreso de minifiguras');
    assert.equal(chart.options.plugins.tooltip.callbacks.afterBody([{ parsed: { x: Date.parse('2026-10-02T00:00:00.000Z') } }]), 'Figuras en colecci\u00f3n: 9');
    assert.equal(chart.options.plugins.tooltip.callbacks.label({ datasetIndex: 0, parsed: { y: 17 } }), 'Valor de colección: 17,00 €');
    assert.equal(chart.options.plugins.tooltip.callbacks.label({ datasetIndex: 1, parsed: { y: -3 } }), 'Progreso de minifiguras: -3');
    const tableRows = [...document.querySelectorAll('#analytics-history-value-table tbody tr')];
    assert.equal(tableRows.length, 3);
    assert.deepEqual([...tableRows[1].children].map((cell) => cell.textContent), ['02/10/2026', '17,00 €', '9', '-3']);
    assert.equal(tableRows[2].lastElementChild.textContent, 'No disponible');

    document.querySelector('#analytics-history-close').click();
    trigger.click();
    await tick();
    document.querySelector('#analytics-history-from').value = '2026-11-01';
    document.querySelector('#analytics-history-to').value = '2026-11-02';
    document.querySelector('#analytics-history-custom-range').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await tick();
    const noBaselineChart = [...chartConfigs].reverse().find(({ type }) => type === 'bar');
    assert.equal(noBaselineChart.data.datasets[1].data[0].y, null);
  } finally {
    dom.window.close();
  }
});

test('DNA usa porcentajes guardados, mantiene Newbie en cero y respeta colores CSS', async () => {
  const { dom, window, document, chartConfigs } = startApp({
    fetchImpl(url) {
      if (!url.startsWith('/api/analytics/history?')) return undefined;
      const query = new URL(url, 'http://localhost').searchParams;
      if (query.get('from') !== '2026-10-01') return Promise.resolve({ ok: true, status: 200, json: async () => ({ snapshots: [], baseline: null }) });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          baseline: null,
          snapshots: [
            { snapshotDate: '2026-10-01', totalFigures: 1, totalValue: 10, bricks: 1, level: 0, dna: { collector: 60.12, explorer: 10.03, rarityHunter: 9.85, fan: 19.99 } },
            { snapshotDate: '2026-10-03', totalFigures: 0, totalValue: 0, bricks: 0, level: 0, dna: { collector: 0, explorer: 0, rarityHunter: 0, fan: 0 } },
          ],
        }),
      });
    },
  });
  try {
    await tick();
    document.querySelector('#open-analytics-history').click();
    await tick();
    document.querySelector('#analytics-history-from').value = '2026-10-01';
    document.querySelector('#analytics-history-to').value = '2026-10-03';
    document.querySelector('#analytics-history-custom-range').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await tick();

    const chart = chartConfigs.find(({ data }) => data.datasets.some(({ label }) => label === 'Rarity Hunter'));
    assert.equal(chart.options.scales.y.min, 0);
    assert.equal(chart.options.scales.y.max, 100);
    assert.equal(chart.options.scales.y.stacked, true);
    assert.deepEqual(Array.from(chart.data.datasets, ({ fill }) => fill), ['origin', '-1', '-1', '-1']);
    assert.equal(chart.options.parsing, false);
    const datasets = Object.fromEntries(chart.data.datasets.map((dataset) => [dataset.label, dataset]));
    assert.deepEqual(Array.from(datasets.Collector.data, ({ y }) => y), [60.12, null, 0]);
    assert.deepEqual(Array.from(datasets.Explorer.data, ({ y }) => y), [10.03, null, 0]);
    assert.deepEqual(Array.from(datasets['Rarity Hunter'].data, ({ y }) => y), [9.85, null, 0]);
    assert.deepEqual(Array.from(datasets.Fan.data, ({ y }) => y), [19.99, null, 0]);
    assert.equal(datasets.Collector.borderColor, window.getComputedStyle(document.documentElement).getPropertyValue('--dna-collector'));
    assert.equal(datasets.Explorer.borderColor, window.getComputedStyle(document.documentElement).getPropertyValue('--dna-explorer'));
    assert.equal(datasets['Rarity Hunter'].borderColor, window.getComputedStyle(document.documentElement).getPropertyValue('--dna-rarity'));
    assert.equal(datasets.Fan.borderColor, window.getComputedStyle(document.documentElement).getPropertyValue('--dna-fan'));
    assert.deepEqual([...document.querySelectorAll('#analytics-history-dna-table tbody tr')].map((row) => row.children[1].textContent), ['60,12%', '0%']);
    assert.doesNotMatch(appScript, /dna_ponderaciones|rarity_hunter|new-mini-person/);
  } finally {
    dom.window.close();
  }
});

test('Bricks y nivel usan ejes separados, admiten descensos y destruyen charts al cambiar rango/cerrar', async () => {
  const { dom, document, chartConfigs, chartInstances } = startApp({
    fetchImpl(url) {
      if (!url.startsWith('/api/analytics/history?')) return undefined;
      const query = new URL(url, 'http://localhost').searchParams;
      if (query.get('from') === '2026-11-01') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            baseline: null,
            snapshots: [{ snapshotDate: '2026-11-01', totalFigures: 1, totalValue: 5, bricks: 59, level: 2, dna: { collector: 0, explorer: 0, rarityHunter: 0, fan: 0 } }],
          }),
        });
      }
      if (query.get('from') === '2026-12-01') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            baseline: null,
            snapshots: [
              { snapshotDate: '2026-12-01', totalFigures: 3, totalValue: 30, bricks: 120, level: 3, dna: { collector: 0, explorer: 0, rarityHunter: 0, fan: 0 } },
              { snapshotDate: '2026-12-02', totalFigures: 2, totalValue: 20, bricks: 50, level: 2, dna: { collector: 0, explorer: 0, rarityHunter: 0, fan: 0 } },
              { snapshotDate: '2026-12-04', totalFigures: 1, totalValue: 10, bricks: 0, level: 0, dna: { collector: 0, explorer: 0, rarityHunter: 0, fan: 0 } },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ snapshots: [], baseline: null }) });
    },
  });
  try {
    await tick();
    const trigger = document.querySelector('#open-analytics-history');
    trigger.click();
    await tick();
    const from = document.querySelector('#analytics-history-from');
    const to = document.querySelector('#analytics-history-to');
    const rangeForm = document.querySelector('#analytics-history-custom-range');
    from.value = '2026-11-01';
    to.value = '2026-11-01';
    rangeForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await tick();

    const firstCharts = chartInstances.slice();
    const onePoint = chartConfigs.find(({ data }) => data.datasets.some(({ label }) => label === 'Bricks'));
    assert.deepEqual(Array.from(onePoint.data.datasets[0].data, ({ y }) => y), [59]);
    assert.deepEqual(Array.from(onePoint.data.datasets[1].data, ({ y }) => y), [2]);
    assert.equal(onePoint.data.datasets[0].borderColor, '#e3000b');
    assert.equal(onePoint.data.datasets[0].backgroundColor, '#e3000b');
    assert.equal(onePoint.data.datasets[1].borderColor, '#000000');
    assert.equal(onePoint.data.datasets[1].backgroundColor, '#000000');
    assert.equal(onePoint.data.datasets[1].stepped, 'after');
    assert.equal(onePoint.options.scales.bricks.position, 'left');
    assert.equal(onePoint.options.scales.level.position, 'right');
    assert.equal(document.querySelectorAll('#analytics-history-progression-table tbody tr').length, 1);

    from.value = '2026-12-01';
    to.value = '2026-12-04';
    rangeForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await tick();
    assert.ok(firstCharts.every((chart) => chart.destroyed));
    const progression = [...chartConfigs].reverse().find(({ data }) => data.datasets.some(({ label }) => label === 'Bricks'));
    assert.deepEqual(Array.from(progression.data.datasets[0].data, ({ y }) => y), [120, 50, null, 0]);
    assert.deepEqual(Array.from(progression.data.datasets[1].data, ({ y }) => y), [3, 2, null, 0]);
    assert.equal(progression.data.datasets[1].stepped, 'after');
    assert.equal(document.querySelectorAll('#analytics-history-progression-table tbody tr').length, 3);

    document.querySelector('#analytics-history-close').click();
    assert.ok(chartInstances.every((chart) => chart.destroyed));
  } finally {
    dom.window.close();
  }
});