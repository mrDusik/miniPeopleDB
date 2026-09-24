import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const categorias = await readFile(new URL('../data/categorias-brickset.json', import.meta.url), 'utf8');

function baseFetch(catalogo, gamificacion, postResponse) {
  return async (url, options = {}) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(categorias) };
    if (url === '/minifiguras' && options.method === 'POST') return { ok: true, status: 201, json: async () => postResponse };
    if (url === '/minifiguras' || url.startsWith('/minifiguras?')) return { ok: true, json: async () => catalogo };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 0, enColeccion: catalogo.length, buscadas: 0, top5: [], top5Antiguas: [] }) };
    if (url === '/gamificacion') return { ok: true, json: async () => gamificacion };
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
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  window.fetch = baseFetch([], state());
  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(window.document.querySelector('#gamification-title').textContent, '8 Redbeard');
  assert.equal(window.document.querySelector('#gamification-bricks').textContent, '820 Bricks');
  assert.equal(window.document.querySelector('#gamification-progress').value, 28);
  window.document.querySelector('#gamification-level').click();
  assert.equal(window.document.querySelector('#gamification-dialog').open, true);
  const achievement = window.document.querySelector('#gamification-achievements li');
  assert.match(achievement.textContent, /New mini person \(x12\) - 12 Bricks/);
  assert.equal(achievement.title, 'Añadir una nueva minifigura.');
  window.document.querySelector('#gamification-close').click();
  assert.equal(window.document.querySelector('#gamification-dialog').open, false);
  dom.window.close();
});

test('coloca el panel de nivel antes del panel de valoracion', () => {
  const dom = new JSDOM(html);
  const panels = [...dom.window.document.querySelector('.summary-row').children];
  assert.equal(panels[0].className, 'gamification-summary');
  assert.equal(panels[1].className, 'collection-summary');
  dom.window.close();
});

test('ordena los Toasts de logros por Bricks y separa su aparición', async () => {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  const catalogo = [];
  window.fetch = baseFetch(catalogo, state({ bricks: 0, nivel: { id: 0, nombre: 'Duplo', umbral: 0 }, siguienteNivel: { id: 1, nombre: 'Stud', umbral: 20 }, progreso: { actual: 0, desde: 0, hasta: 20, porcentaje: 0 }, logros: [] }), {
    gamificacion: {
      logrosNuevos: [
        { nombre: 'Masterpiece', bricksNuevos: 100 },
        { nombre: 'New mini person', bricksNuevos: 1 },
        { nombre: 'WOAH!', bricksNuevos: 10 },
      ],
      nivelesAlcanzados: [{ id: 5, nombre: 'Skeleton' }],
    },
  });
  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));
  window.document.querySelector('#new-minifigura').click();
  window.document.querySelector('#form-id').value = 'new-figure';
  window.document.querySelector('#form-nombre').value = 'Nueva';
  window.document.querySelector('#form-descripcion').value = 'Figura';
  window.document.querySelector('#form-categoria').value = 'Space';
  window.document.querySelector('#form-anio').value = '2024';
  window.document.querySelector('#minifigura-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.match(window.document.querySelector('.toast').textContent, /New mini person \+1 Bricks/);
  await new Promise((resolve) => setTimeout(resolve, 620));
  assert.ok([...window.document.querySelectorAll('.toast')].some((toast) => /WOAH! \+10 Bricks/.test(toast.textContent)));
  await new Promise((resolve) => setTimeout(resolve, 320));
  const levelToast = [...window.document.querySelectorAll('.toast')].find((toast) => toast.classList.contains('toast-level'));
  assert.equal(levelToast.textContent, 'Has alcanzado el nivel 5 Skeleton');
  dom.window.close();
});

test('pagina la tabla en bloques de diez filas', async () => {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
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
