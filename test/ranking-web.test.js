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
    top5Antiguedad: [{ id: 'OLD', nombre: 'Old', anio: 1980, precio: 5 }], regaloEnviado: false, dnaPrincipal: 'Explorer',
    dnaRasgos: [{ nombre: 'Explorer', porcentaje: 60.5 }, { nombre: 'Collector', porcentaje: 30 }],
    ...overrides,
  };
}

function installFetch(window, ranking, orderedRankings = {}) {
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
    if (url.startsWith('/api/ranking?')) return { ok: true, status: 200, json: async () => structuredClone(orderedRankings[new URL(url, 'http://localhost').searchParams.get('criterio')] ?? ranking) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return calls;
}

test('el selector encima de los regalos solicita cada criterio y conserva la posicion principal por nivel', async () => {
  const dom = createDom();
  const normal = [entry({ userId: 'user-a' }), entry()];
  const alternative = [entry(), entry({ userId: 'user-a' })];
  const criteria = ['coleccion', 'rarityHunter', 'collector', 'explorer', 'fan'];
  const traitNames = { rarityHunter: 'Rarity Hunter', collector: 'Collector', explorer: 'Explorer', fan: 'Fan' };
  const calls = installFetch(dom.window, normal, Object.fromEntries(criteria.map((criterio) => [criterio,
    criterio === 'coleccion' ? alternative : alternative.map((row, index) => ({ ...row,
      dnaPrincipal: index === 1 ? 'Newbie' : row.dnaPrincipal,
      dnaRasgos: [{ nombre: traitNames[criterio], porcentaje: index === 1 ? 0 : 12.5 }],
    })),
  ])));
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 10));
  dom.window.document.querySelector('#open-global-ranking').click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  const criteriaGroup = dom.window.document.querySelector('#ranking-order');
  const criteriaButtons = [...criteriaGroup.querySelectorAll('[data-ranking-criterion]')];
  assert.equal(criteriaGroup.getAttribute('role'), 'group');
  assert.deepEqual(criteriaButtons.map(({ dataset }) => dataset.rankingCriterion), ['nivel', 'coleccion', 'rarityHunter', 'collector', 'explorer', 'fan']);
  assert.deepEqual(criteriaButtons.map((button) => button.getAttribute('aria-pressed')), ['true', 'false', 'false', 'false', 'false', 'false']);
  assert.equal(criteriaGroup.parentElement.nextElementSibling.id, 'global-ranking-list');
  assert.match(styles, /\.ranking-order-toolbar \{[^}]*justify-content: flex-start;/);
  for (const criterio of [...criteria, 'nivel']) {
    const button = criteriaButtons.find(({ dataset }) => dataset.rankingCriterion === criterio);
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.ok(calls.some(({ url }) => url === (criterio === 'nivel' ? '/api/ranking' : `/api/ranking?criterio=${criterio}`)));
    assert.equal(dom.window.document.querySelector('.global-ranking-entry').dataset.userId, criterio === 'nivel' ? 'user-a' : 'user-b');
    assert.equal(dom.window.document.querySelector('#ranking-main-position').textContent, '🥇');
    assert.deepEqual([...dom.window.document.querySelectorAll('.ranking-dna-principal')].map(({ textContent }) => textContent),
      traitNames[criterio] ? [`12,5% ${traitNames[criterio]}`, `0% ${traitNames[criterio]}`]
        : ['60,5% Explorer / 30% Collector', '60,5% Explorer / 30% Collector']);
  }
  dom.window.close();
});

test('cambios rapidos de criterio ignoran respuestas anteriores y el cierre de sesion restaura Nivel', async () => {
  const dom = createDom();
  installFetch(dom.window, [entry({ userId: 'user-a' })], { fan: [entry({ displayName: 'Fan winner' })] });
  const fetch = dom.window.fetch;
  let resolveOld;
  dom.window.fetch = (url, options) => url === '/api/ranking?criterio=coleccion'
    ? new Promise((resolve) => { resolveOld = resolve; }) : fetch(url, options);
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 10));
  dom.window.document.querySelector('#open-global-ranking').click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  const selectedCollection = dom.window.document.querySelector('[data-ranking-criterion="coleccion"]');
  const selectedFan = dom.window.document.querySelector('[data-ranking-criterion="fan"]');
  selectedCollection.click();
  selectedFan.click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  resolveOld({ ok: true, json: async () => [entry({ displayName: 'Old winner' })] });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(dom.window.document.querySelector('.ranking-name').textContent, 'Fan w.');
  dom.window.document.querySelector('#logout').click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(dom.window.document.querySelector('[data-ranking-criterion="nivel"]').getAttribute('aria-pressed'), 'true');
  dom.window.close();
});

test('el panel de nivel y el modal limitan su ancho en móvil', () => {
  assert.match(styles, /\.gamification-summary \{ flex: 1 1 auto; width: 100%; min-width: 0;/);
  assert.match(styles, /\.gamification-details \{[^}]*width: min\(381px, 100%\)/);
  assert.match(styles, /\.gamification-details \.button \{ min-height: 36px; padding: 0 12px; \}/);
  assert.match(styles, /\.summary-sync-row, \.summary-achievements-row, \.summary-ranking-row \{ display: flex; flex-wrap: nowrap; justify-content: center; align-items: center; gap: 12px; \}/);
  assert.match(styles, /\.achievements-heading \{[^}]*border-bottom: 4px solid var\(--blue\);/);
  assert.match(styles, /\.achievements-heading \{ display: flex; align-items: center;/);
  assert.match(styles, /\.achievements-heading-text \{ min-width: 0; \}/);
  assert.match(styles, /\.ranking-dialog-heading \{[^}]*border-bottom: 4px solid var\(--blue\);/);
  assert.match(styles, /\.modal-ranking \{ width: min\(960px, calc\(100% - 24px\)\)/);
  assert.doesNotMatch(styles, /\.modal-ranking \{[^}]*border-top:/);
  assert.match(styles, /\.ranking-highlight-group \.ranking-row \{ min-width: 252px; \}/);
  assert.match(styles, /\.ranking-expand \{[^}]*grid-template-columns: 34px 42px minmax\(0, 1fr\) 100px 85px 18px;/);
  assert.match(styles, /\.ranking-expand \{[^}]*grid-template-rows: 22px minmax\(30px, auto\);[^}]*min-height: 68px;/);
  assert.match(styles, /\.ranking-expand \{[^}]*border: 1px solid var\(--line\); border-left: 4px solid var\(--blue\);/);
  assert.match(styles, /\.ranking-expand-current \{ border-left-color: var\(--accent\);/);
  assert.doesNotMatch(styles, /\.ranking-expand \.ranking-star/);
  assert.match(styles, /\.ranking-bricks \{ grid-column: 4; grid-row: 1 \/ 3; grid-template-columns: minmax\(0, 1fr\) 1\.55rem; width: 100px; \}/);
  assert.match(styles, /\.ranking-bricks strong \{ justify-self: end;/);
  assert.match(styles, /\.ranking-collection-count \{ grid-column: 5; grid-row: 1 \/ 3; grid-template-columns: 1\.55rem minmax\(0, 1fr\); width: 85px; \}/);
  assert.match(styles, /\.ranking-bricks \.gamification-brick-icon \{ width: 1\.55rem; height: 1\.55rem; object-fit: contain; \}/);
  assert.match(styles, /\.ranking-collection-count \.ranking-collection-icon \{ width: 1\.55rem; height: 1\.55rem; object-fit: contain; transform: none; \}/);
  assert.match(styles, /\.global-ranking-entry \{ min-width: 0; \}/);
  assert.match(styles, /\.global-ranking-row \{[^}]*min-width: 0;/);
  assert.match(styles, /@media \(max-width: 1400px\) \{\s*\.ranking-user-details \{ grid-template-columns: 1fr; \}\s*\.ranking-highlight-group \{ max-width: 600px; \}/);
  assert.match(styles, /@media \(max-width: 850px\) \{[^}]*\.global-ranking-row \{ grid-template-columns: minmax\(0, 1fr\) auto;/);
  assert.match(styles, /\.ranking-expand \.ranking-bricks \{ grid-column: 2 \/ 4; grid-row: 3; justify-self: start; width: 85px; \}/);
  assert.match(styles, /\.ranking-expand \.ranking-collection-count \{ grid-column: 3 \/ 5; grid-row: 3; justify-self: end; width: 70px; \}/);
  assert.match(styles, /\.ranking-level-number \{[^}]*color: var\(--ink\); font-size: 0\.9rem; line-height: 1;/);
  assert.doesNotMatch(styles, /\.ranking-level-name, \.ranking-collection-count \{ display: none;/);
    assert.match(styles, /@media \(min-width: 761px\) and \(max-width: 1232px\) and \(orientation: landscape\) and \(hover: none\) and \(pointer: coarse\) \{\s*\.brand-heading \{ flex: 0 0 270px; \}\s*\.gamification-summary \{ flex: 1 1 800px; min-width: 0; \}/);
    assert.match(styles, /@media \(min-width: 761px\) and \(max-width: 1232px\) and \(hover: hover\), \(min-width: 761px\) and \(max-width: 1232px\) and \(orientation: portrait\)/);
});

test('abre el Top 10 desde la segunda fila del panel de nivel, distingue la sesión y usa acordeón no interactivo', async () => {
  const dom = createDom();
  const ranking = [entry({ userId: 'user-a', displayName: 'Usuaria Ana Pérez', bricks: 300 }), entry({ dnaPrincipal: 'Newbie', dnaRasgos: [] })];
  installFetch(dom.window, ranking);
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 10));

  const details = dom.window.document.querySelector('#gamification-details');
  assert.equal(details.querySelector('#open-global-ranking').textContent.trim(), '🌐 Ranking Global');
  assert.equal(details.querySelector('#sync-prices').textContent.trim(), '🔄 Sincronizar Precios');
  assert.equal(dom.window.document.querySelector('#ranking-main-globe').hidden, false);
  assert.equal(dom.window.document.querySelector('#ranking-main-globe > span').textContent, '🌐');
  assert.equal(dom.window.document.querySelector('#ranking-main-position').textContent, '🥇');
  dom.window.document.querySelector('#gamification-toggle').click();
  assert.equal(details.hidden, false);
  dom.window.document.querySelector('#open-global-ranking').click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(dom.window.document.querySelector('#ranking-dialog').open, true);
  assert.doesNotMatch(dom.window.document.querySelector('#ranking-dialog').textContent, /Comunidad/i);
  assert.equal(dom.window.document.activeElement.id, 'ranking-close');
  assert.equal(dom.window.document.querySelectorAll('.global-ranking-entry').length, 2);
  assert.equal(dom.window.document.querySelector('[data-user-id="user-a"] .ranking-star'), null);
  assert.equal(dom.window.document.querySelector('[data-user-id="user-a"] .ranking-gift'), null);
  const firstEntry = dom.window.document.querySelector('[data-user-id="user-a"]');
  assert.equal(firstEntry.querySelector('.ranking-name').textContent, 'Usuaria A. P.');
  assert.equal(firstEntry.querySelector('.ranking-bricks strong').textContent, '300');
  assert.equal(firstEntry.querySelector('.ranking-bricks img').alt, 'Bricks');
  assert.equal(firstEntry.querySelector('.ranking-level-number').textContent, '4');
  assert.equal(firstEntry.querySelector('.ranking-level-info .gamification-level-image').getAttribute('src'), '/level_images/4_citizen.png');
  assert.equal(firstEntry.querySelector('.ranking-level-name').textContent, 'Citizen');
  assert.equal(firstEntry.querySelector('.ranking-collection-count strong').textContent, '2');
  assert.equal(firstEntry.querySelector('.ranking-collection-icon').getAttribute('src'), '/status_images/caja.png');
  assert.deepEqual([...firstEntry.querySelector('.ranking-expand').children].map((element) => element.className), [
    'ranking-position', 'ranking-avatar-wrap', 'ranking-name', 'ranking-level-info',
    'gamification-bricks-value ranking-bricks', 'ranking-collection-count', 'ranking-row-chevron',
  ]);
  assert.deepEqual([...firstEntry.querySelector('.ranking-level-info').children].map((element) => element.className), [
    'gamification-level-image', 'ranking-level-number', 'ranking-level-name', 'ranking-dna-principal',
  ]);
  assert.equal(firstEntry.querySelector('.ranking-level-info').parentElement, firstEntry.querySelector('.ranking-expand'));
  assert.match(styles, /\.ranking-level-info \{[^}]*flex-wrap: wrap;[^}]*overflow: visible/);
  assert.match(styles, /\.ranking-level-info \{[^}]*color: var\(--ink\);/);
  assert.match(styles, /\.ranking-level-name \{[^}]*overflow-wrap: anywhere; white-space: normal;/);
  assert.match(styles, /\.ranking-dna-principal \{[^}]*overflow-wrap: anywhere;[^}]*white-space: normal;/);
  assert.match(styles, /\.ranking-dna-principal \{[^}]*color: var\(--ink\); font: italic 700 0\.68rem[^}]*text-transform: uppercase;/);
  assert.equal(firstEntry.querySelector('.ranking-dna-principal').textContent, '60,5% Explorer / 30% Collector');
  assert.equal(firstEntry.querySelector('.ranking-dna-principal').tagName, 'SPAN');
  assert.equal(firstEntry.querySelector('.ranking-dna-principal').tabIndex, -1);
  const otherEntry = dom.window.document.querySelector('[data-user-id="user-b"]');
  assert.equal(otherEntry.querySelector('.ranking-dna-principal').textContent, 'Newbie');
  assert.equal(otherEntry.querySelector('.ranking-gift').parentElement, otherEntry.querySelector('.global-ranking-row'));
  assert.equal(otherEntry.querySelector('.ranking-gift').previousElementSibling, otherEntry.querySelector('.ranking-summary'));
  assert.equal(firstEntry.querySelector('.ranking-achievements'), null);
  assert.match(styles, /\.ranking-summary \.ranking-expand \{ grid-template-columns: 34px 42px minmax\(0, 1fr\) 100px 70px 18px;/);
  assert.match(styles, /\.ranking-summary \.ranking-collection-count \{ grid-column: 5; width: 70px; \}/);
  assert.match(styles, /\.ranking-summary \.ranking-expand \.ranking-collection-count \{ grid-column: 1 \/ 3; grid-row: 3;/);
  assert.match(styles, /\.ranking-summary \.ranking-expand \{ grid-template-columns: 32px 40px minmax\(0, 1fr\) 18px; grid-template-rows: 40px minmax\(30px, auto\) 36px; \}/);
  assert.equal(firstEntry.querySelector('.ranking-gift-space').parentElement, firstEntry.querySelector('.global-ranking-row'));

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

test('las filas del ranking no ofrecen logros y conservan la expansion al clicar', async () => {
  const dom = createDom();
  const calls = installFetch(dom.window, [entry({ displayName: 'Grace Hopper' })]);
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const document = dom.window.document;
  document.querySelector('#open-global-ranking').click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  const entryElement = document.querySelector('.global-ranking-entry');
  assert.equal(entryElement.querySelector('.ranking-achievements'), null);
  entryElement.querySelector('.ranking-expand').click();
  assert.equal(entryElement.querySelector('.ranking-user-details').hidden, false);
  assert.equal(document.querySelector('#gamification-dialog').open, false);
  assert.equal(calls.some(({ url }) => url.endsWith('/logros')), false);
  dom.window.close();
});

test('el modal conserva cinco destacados y adapta tops y tarjetas a la orientación', async () => {
  const dom = createDom();
  const top5Precio = Array.from({ length: 5 }, (_, index) => ({
    id: `PRICE-${index}`, nombre: `Price ${index}`, precio: 50 - index,
  }));
  const top5Antiguedad = Array.from({ length: 5 }, (_, index) => ({
    id: `OLD-${index}`, nombre: `Old ${index}`, anio: 1980 + index, precio: 5,
  }));
  installFetch(dom.window, [entry({ top5Precio, top5Antiguedad })]);
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 10));
  dom.window.document.querySelector('#open-global-ranking').click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  dom.window.document.querySelector('.ranking-expand').click();

  const groups = [...dom.window.document.querySelectorAll('.ranking-highlight-group')];
  assert.deepEqual(groups.map((group) => [
    group.querySelector('.ranking-highlight-title-portrait').textContent,
    group.querySelector('.ranking-highlight-title-landscape').textContent,
  ]), [
    ['Top 3 por precio', 'Top 5 por precio'], ['Top 3 por antigüedad', 'Top 5 por antigüedad'],
  ]);
  for (const [index, items] of [top5Precio, top5Antiguedad].entries()) {
    const cards = [...groups[index].querySelectorAll('.ranking-card-static')];
    assert.equal(cards.length, 5);
    assert.deepEqual(cards.map((card) => card.querySelector('img').alt), items.map(({ nombre }) => nombre));
  }
  assert.match(styles, /@media \(orientation: portrait\) \{\s*\.ranking-highlight-group \.ranking-card-static:nth-child\(n \+ 4\) \{ display: none; \}/);
  assert.match(styles, /@media \(orientation: landscape\) \{\s*\.ranking-highlight-title-portrait \{ display: none; \}/);
  assert.match(styles, /\.modal-dialog-heading \{ margin-bottom: 12px; \}/);
  dom.window.close();
});

test('solo ofrece buscadas ajenas ausentes del catalogo completo independiente de filtros y pagina', async () => {
  const dom = createDom();
  const highlights = [{ id: 'owned', nombre: 'Owned', precio: 10 }, { id: 'wanted', nombre: 'Wanted', precio: 5 }, { id: 'NEW', nombre: 'New', precio: 1 }];
  installFetch(dom.window, [entry({ userId: 'user-a', top5Precio: highlights }), entry({ top5Precio: highlights, top5Antiguedad: highlights })]);
  const originalFetch = dom.window.fetch;
  const catalog = Array.from({ length: 11 }, (_, index) => ({ id: `F-${index}`, nombre: 'Figura', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN' }));
  catalog.push({ id: ' OWNED ', nombre: 'Fuera', categoria: 'Space', estadoColeccion: 'COLECCIÓN' }, { id: 'WANTED', nombre: 'Fuera', categoria: 'Space', estadoColeccion: 'BUSCADA' });
  dom.window.fetch = async (url, options) => url === '/minifiguras'
    ? { ok: true, json: async () => catalog } : originalFetch(url, options);
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const document = dom.window.document;
  document.querySelector('#nombre').value = 'sin coincidencias';
  document.querySelector('#filters-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  document.querySelector('#open-global-ranking').click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(document.querySelector('[data-user-id="user-a"] .ranking-add-wanted'), null);
  const buttons = [...document.querySelectorAll('.ranking-add-wanted')];
  assert.equal(buttons.length, 2);
  assert.ok(buttons.every((button) => button.dataset.wantedId === 'NEW' && button.title === 'Añadir a buscadas'));
  dom.window.close();
});

test('no ofrece alta mientras el catalogo completo esta pendiente', async () => {
  const dom = createDom();
  installFetch(dom.window, [entry()]);
  const originalFetch = dom.window.fetch;
  dom.window.fetch = async (url, options) => url === '/minifiguras' ? new Promise(() => {}) : originalFetch(url, options);
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 10));
  dom.window.document.querySelector('#open-global-ranking').click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(dom.window.document.querySelectorAll('.ranking-card-static').length, 2);
  assert.equal(dom.window.document.querySelector('.ranking-add-wanted'), null);
  dom.window.close();
});

test('alta rapida precarga metadatos, fija BUSCADA y deja nombre, descripcion y seguimiento editables', async () => {
  const dom = createDom();
  const figure = { id: 'HIGH', nombre: 'Nombre ajeno', descripcion: 'Privado', categoria: 'Space', anio: 2020, precio: 50, observada: true };
  const calls = installFetch(dom.window, [entry({ top5Precio: [figure] })]);
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const document = dom.window.document;
  document.querySelector('#open-global-ranking').click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  document.querySelector('.ranking-expand').click();
  document.querySelector('.ranking-add-wanted').click();
  assert.equal(document.querySelector('#form-dialog').open, true);
  assert.equal(document.querySelector('#form-dialog-title').textContent, 'Editar minifigura');
  assert.equal(document.querySelector('#form-id').disabled, true);
  assert.equal(document.querySelector('#form-id').value, 'HIGH');
  assert.equal(document.querySelector('#form-nombre').value, '');
  assert.equal(document.querySelector('#form-descripcion').value, '');
  assert.equal(document.querySelector('#form-nombre').disabled, false);
  assert.equal(document.querySelector('#form-estadoColeccion').value, 'BUSCADA');
  assert.equal(document.querySelector('#form-estadoColeccion').disabled, true);
  assert.ok([...document.querySelectorAll('[data-form-state]')].every((button) => button.disabled));
  assert.equal(document.querySelector('#form-observada').disabled, false);
  assert.equal(document.querySelector('#form-observada').getAttribute('aria-pressed'), 'false');
  document.querySelector('#form-observada').click();
  assert.equal(document.querySelector('#form-observada').getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelector('#form-precioCompra').disabled, true);
  assert.equal(document.querySelector('#form-fechaCompra').value, '');
  assert.equal(document.querySelector('#form-categoria').value, 'Space');
  assert.equal(document.querySelector('#form-anio').value, '2020');
  assert.equal(document.querySelector('#form-precio').value, '50');
  document.querySelector('#form-preview-image').dispatchEvent(new dom.window.Event('load'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls.filter(({ url }) => url.startsWith('/minifiguras/') && url.endsWith('/brickset')).length, 0);
  assert.equal(document.querySelector('#form-submit').disabled, true);
  document.querySelector('#form-nombre').value = 'Mi figura';
  document.querySelector('#form-nombre').dispatchEvent(new dom.window.Event('input'));
  assert.equal(document.querySelector('#form-submit').disabled, false);
  dom.window.close();
});

test('alta rapida completa metadatos ausentes con Brickset y bloquea guardar si falla', async () => {
  for (const success of [true, false]) {
    const dom = createDom();
    installFetch(dom.window, [entry()]);
    const originalFetch = dom.window.fetch;
    let resolveLookup;
    dom.window.fetch = async (url, options) => url.startsWith('/minifiguras/') && url.endsWith('/brickset') ? new Promise((resolve) => { resolveLookup = resolve; }) : originalFetch(url, options);
    dom.window.eval(script);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const document = dom.window.document;
    document.querySelector('#open-global-ranking').click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    document.querySelector('.ranking-add-wanted').click();
    document.querySelector('#form-nombre').value = 'Mi figura';
    document.querySelector('#form-nombre').dispatchEvent(new dom.window.Event('input'));
    assert.equal(document.querySelector('#form-submit').disabled, true);
    resolveLookup({ ok: success, json: async () => ({ categoria: 'Space', anio: 0, precio: 15 }) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(document.querySelector('#form-submit').disabled, !success);
    if (success) assert.equal(document.querySelector('#form-anio').value, String(new Date().getFullYear()));
    else assert.match(document.querySelector('#toast-region').textContent, /No se encontraron datos/);
    dom.window.close();
  }
});

test('alta rapida usa POST una vez, conserva filtros y oculta todas las acciones del ID tras confirmacion', async () => {
  const dom = createDom();
  const figure = { id: 'HIGH', nombre: 'Ajeno', categoria: 'Space', anio: 2020, precio: 50 };
  const calls = installFetch(dom.window, [entry({ top5Precio: [figure], top5Antiguedad: [figure] })]);
  const originalFetch = dom.window.fetch;
  const catalog = [];
  let resolvePost;
  dom.window.fetch = async (url, options = {}) => {
    if (url === '/minifiguras' && options.method === 'POST') {
      calls.push({ url, options });
      return new Promise((resolve) => { resolvePost = resolve; });
    }
    if (url === '/minifiguras') return { ok: true, json: async () => catalog };
    return originalFetch(url, options);
  };
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const document = dom.window.document;
  document.querySelector('#nombre').value = 'sin coincidencias';
  document.querySelector('#filters-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  document.querySelector('#open-global-ranking').click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  document.querySelector('.ranking-expand').click();
  document.querySelector('.ranking-add-wanted').click();
  const form = document.querySelector('#minifigura-form');
  form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  assert.equal(resolvePost, undefined);
  document.querySelector('#form-nombre').value = 'Mi figura';
  document.querySelector('#form-observada').click();
  document.querySelector('#form-estadoColeccion').value = 'COLECCIÓN';
  document.querySelector('#form-precioCompra').value = '99';
  form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  const posts = calls.filter(({ options }) => options?.method === 'POST');
  assert.equal(posts.length, 1);
  const payload = JSON.parse(posts[0].options.body);
  assert.equal(posts[0].url, '/minifiguras');
  assert.equal(payload.id, 'HIGH');
  assert.equal(payload.nombre, 'Mi figura');
  assert.equal(payload.descripcion, '');
  assert.equal(payload.estadoColeccion, 'BUSCADA');
  assert.equal(payload.observada, true);
  assert.equal('precioCompra' in payload, false);
  assert.equal('user_id' in payload, false);
  assert.equal(document.querySelectorAll('.ranking-add-wanted').length, 2);
  catalog.push({ ...payload, FechaRegistro: '2026-10-02T00:00:00Z' });
  resolvePost({ ok: true, json: async () => catalog[0] });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(document.querySelector('#form-dialog').open, false);
  assert.equal(document.querySelector('.ranking-add-wanted'), null);
  assert.equal(document.querySelector('.ranking-user-details').hidden, false);
  assert.equal(document.querySelector('#nombre').value, 'sin coincidencias');
  assert.equal(document.activeElement.className.startsWith('ranking-expand'), true);
  assert.equal(figure.nombre, 'Ajeno');
  dom.window.close();
});

test('alta rapida mantiene errores de duplicado, seguimiento y servidor sin mutar cache', async () => {
  for (const [status, error] of [[409, 'ID_DUPLICADO'], [400, 'LIMITE_OBSERVADAS'], [500, 'CATALOGO_NO_DISPONIBLE']]) {
    const dom = createDom();
    const figure = { id: 'HIGH', nombre: 'Ajeno', categoria: 'Space', anio: 2020, precio: 50 };
    installFetch(dom.window, [entry({ top5Precio: [figure], top5Antiguedad: [] })]);
    const originalFetch = dom.window.fetch;
    let duplicateConfirmed = false;
    dom.window.fetch = async (url, options = {}) => {
      if (url === '/minifiguras' && options.method === 'POST') {
        duplicateConfirmed = status === 409;
        return { ok: false, status, json: async () => ({ error }) };
      }
      if (url === '/minifiguras' && duplicateConfirmed) return { ok: true, json: async () => [{ ...figure, estadoColeccion: 'BUSCADA' }] };
      return originalFetch(url, options);
    };
    dom.window.eval(script);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const document = dom.window.document;
    document.querySelector('#open-global-ranking').click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    document.querySelector('.ranking-add-wanted').click();
    document.querySelector('#form-nombre').value = 'Mi figura';
    document.querySelector('#minifigura-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(document.querySelector('#form-dialog').open, true);
    assert.notEqual(document.querySelector('#form-error').textContent, '');
    if (status === 409) assert.equal(document.querySelector('.ranking-add-wanted'), null);
    else assert.ok(document.querySelector('.ranking-add-wanted'));
    if (error === 'LIMITE_OBSERVADAS') assert.match(document.querySelector('.toast-warning').textContent, /Máximo 10/);
    dom.window.close();
  }
});

test('cancelar alta rapida restaura foco y permisos ordinarios e ignora fallback tardio', async () => {
  const dom = createDom();
  const calls = installFetch(dom.window, [entry()]);
  const originalFetch = dom.window.fetch;
  let resolveLookup;
  dom.window.fetch = async (url, options) => url.startsWith('/minifiguras/') && url.endsWith('/brickset')
    ? new Promise((resolve) => { resolveLookup = resolve; }) : originalFetch(url, options);
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const document = dom.window.document;
  document.querySelector('#open-global-ranking').click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  const trigger = document.querySelector('.ranking-add-wanted');
  trigger.click();
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(document.activeElement, trigger);
  document.querySelector('#ranking-close').click();
  document.querySelector('#new-minifigura').click();
  resolveLookup({ ok: true, json: async () => ({ categoria: 'Space', anio: 2020, precio: 20 }) });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(document.querySelector('#form-id').disabled, false);
  assert.equal(document.querySelector('#form-id').value, '');
  assert.equal(document.querySelector('#form-estadoColeccion').value, 'COLECCIÓN');
  assert.equal(document.querySelector('#form-categoria').value, '');
  assert.equal(calls.filter(({ options }) => options.method === 'POST').length, 0);
  dom.window.__supabaseStub.setSession('SIGNED_OUT', null);
  assert.equal(document.querySelector('#form-dialog').open, false);
  dom.window.close();
});

test('el globo abre el ranking, muestra medallas o posición y actualiza su presencia', async () => {
  const dom = createDom();
  const ranking = [entry({ userId: 'user-a' })];
  installFetch(dom.window, ranking);
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const document = dom.window.document;
  const globe = document.querySelector('#ranking-main-globe');
  assert.equal(globe.tagName, 'BUTTON');
  assert.equal(globe.closest('#user-menu-toggle'), null);
  assert.equal(globe.title, 'En Top Global');
  assert.equal(globe.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(globe.getAttribute('aria-controls'), 'ranking-dialog');

  for (const [index, marker] of ['🥇', '🥈', '🥉', '#4'].entries()) {
    if (index > 0) ranking.unshift(entry({ userId: `other-${index}` }));
    globe.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(document.querySelector('#ranking-dialog').open, true);
    assert.equal(document.activeElement.id, 'ranking-close');
    assert.equal(document.querySelector('#user-profile').hidden, true);
    assert.equal(document.querySelector('#user-menu-toggle').getAttribute('aria-expanded'), 'false');
    assert.equal(document.querySelector('#ranking-main-position').textContent, marker);
    assert.ok(globe.getAttribute('aria-label').includes(`posición ${index + 1}`));
    document.querySelector('#ranking-close').click();
    assert.equal(document.activeElement, globe);
  }

  ranking.pop();
  globe.click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(globe.hidden, true);
  assert.equal(document.querySelector('#ranking-main-position').textContent, '');
  document.querySelector('#ranking-close').click();
  assert.equal(document.activeElement.id, 'open-global-ranking');
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
  assert.equal(dom.window.document.querySelector('[data-gift-user="user-b"]').textContent, '+50');
  assert.equal(dom.window.document.querySelector('[data-gift-user="user-b"] img').getAttribute('src'), '/toast_images/hero_2026-01-05_16-38-47-871.webp');

  dom.window.__supabaseStub.setSession('SIGNED_OUT', null);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(dom.window.document.querySelector('#ranking-main-globe').hidden, true);
  assert.equal(dom.window.document.querySelector('#ranking-main-position').textContent, '');
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
  assert.equal(dom.window.document.querySelector('[data-gift-user="user-b"]').textContent, '+50');
  const failingGift = dom.window.document.querySelector('[data-gift-user="user-c"]');
  assert.equal(failingGift.closest('.global-ranking-row').querySelector('.ranking-avatar-fallback').hidden, false);
  failingGift.click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(failingGift.disabled, false);
  assert.ok([...dom.window.document.querySelectorAll('.toast-error')].some((toast) => toast.textContent.includes('No se pudo enviar el regalo')));
  dom.window.close();
});