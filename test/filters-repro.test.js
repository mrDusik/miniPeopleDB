import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const categorias = await readFile(new URL('../data/categorias-brickset.json', import.meta.url), 'utf8');

function figure(id, categoria, subcategoria = undefined) {
  return { id, nombre: id, descripcion: 'Figura', categoria, subcategoria, anio: 2024, estadoColeccion: 'COLECCIÓN' };
}

test('repro: Buscar envía filtros y muestra solo el resultado filtrado', async () => {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  const catalog = [figure('space-1', 'Space'), figure('castle-1', 'Castle')];
  const requests = [];
  window.fetch = async (url) => {
    requests.push(url);
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(categorias) };
    if (url === '/minifiguras') return { ok: true, json: async () => catalog };
    if (url.startsWith('/minifiguras?')) return { ok: true, json: async () => [catalog[1]] };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 0, enColeccion: 1, buscadas: 0, top5: [], top5Antiguas: [] }) };
    if (url === '/gamificacion') return { ok: true, json: async () => ({ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, siguienteNivel: null, progreso: { porcentaje: 100 }, logros: [] }) };
    return { ok: false, json: async () => ({}) };
  };
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));
  window.document.querySelector('#categoria').value = 'Castle';
  window.document.querySelector('#filters-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(requests.includes('/minifiguras?categoria=Castle'));
  assert.deepEqual([...window.document.querySelectorAll('#catalog-body tr')].map((row) => row.children[1].textContent), ['castle-1']);
  dom.window.close();
});
