import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { categoriasMockRaw } from '../test-support/fixtures.js';
import { supabaseStubScript, withSupabaseSession } from '../test-support/browser-auth.js';
import { authFetch, startTestServer } from '../test-support/server.js';

const officialCategoriasRaw = categoriasMockRaw;
const officialCategoriaNames = JSON.parse(officialCategoriasRaw).map(({ categoria }) => categoria);
const officialCategoriaSet = new Set(officialCategoriaNames);
const fetch = authFetch();

async function readSessionScript(options) {
  return withSupabaseSession(await readFile(new URL('../public/app.js', import.meta.url), 'utf8'), options);
}

async function withServer(callback) {
  const server = await startTestServer({ catalog: [
    {
      id: 'MF-WEB',
      nombre: 'Figura web',
      descripcion: 'Figura para probar la interfaz',
      categoria: 'Space',
      anio: 2023,
      estadoColeccion: 'COLECCIÓN',
      FechaRegistro: '2026-01-01T00:00:00.000Z',
      observada: false,
    },
  ] });

  try {
    await callback(server.baseUrl);
  } finally {
    await server.close();
  }
}

test('sirve la interfaz estatica y conserva la API del catalogo', async () => {
  await withServer(async (baseUrl) => {
    const page = await fetch(`${baseUrl}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /^text\/html/);
    const html = await page.text();
    assert.match(html, /id="filters-form"/);
    const levelTitle = new JSDOM(html).window.document.querySelector('#gamification-title');
    assert.equal(levelTitle.firstElementChild.getAttribute('src'), '/level_images/0_duplo.png');
    assert.equal(levelTitle.firstElementChild.getAttribute('alt'), '');
    assert.equal(levelTitle.children[1].id, 'gamification-level-number');

    const logo = new JSDOM(html).window.document.querySelector('.brand-logo');
    assert.equal(logo.alt, 'MiniPeopleDB');
    const logoImage = await fetch(`${baseUrl}${logo.getAttribute('src')}`);
    assert.equal(logoImage.status, 200);
    assert.match(logoImage.headers.get('content-type'), /^image\/png/);

    const levelImage = await fetch(`${baseUrl}/level_images/9_forestman.png`);
    assert.equal(levelImage.status, 200);
    assert.match(levelImage.headers.get('content-type'), /^image\/png/);
    const spacebabyImage = await fetch(`${baseUrl}/level_images/15_spacebaby.jpg`);
    assert.equal(spacebabyImage.status, 200);
    assert.match(spacebabyImage.headers.get('content-type'), /^image\/jpeg/);

    const styles = await fetch(`${baseUrl}/styles.css`);
    assert.equal(styles.status, 200);
    assert.match(styles.headers.get('content-type'), /^text\/css/);

    const script = await fetch(`${baseUrl}/app.js`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get('content-type'), /^text\/javascript/);
    const scriptText = await script.text();
    assert.match(scriptText, /iconSrc = '\/toast_images\/87X2Rz8y2ZY\.png'/);
    const clientAssets = `${html}\n${await styles.text()}\n${scriptText}`;
    assert.doesNotMatch(clientAssets, /dna_ponderaciones|rarity_hunter|new-mini-person/);

    const toastImage = await fetch(`${baseUrl}/toast_images/87X2Rz8y2ZY.png`);
    assert.equal(toastImage.status, 200);
    assert.match(toastImage.headers.get('content-type'), /^image\/png/);

    const catalog = await fetch(`${baseUrl}/minifiguras`);
    assert.equal(catalog.status, 200);
    assert.deepEqual(await catalog.json(), [{
      id: 'MF-WEB',
      nombre: 'Figura web',
      descripcion: 'Figura para probar la interfaz',
      categoria: 'Space',
      anio: 2023,
      estadoColeccion: 'COLECCIÓN',
      FechaRegistro: '2026-01-01T00:00:00.000Z',
      observada: false,
    }]);
  });
});

test('la pagina referencia controles y estados necesarios para la consulta', async () => {
  await withServer(async (baseUrl) => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    const script = await (await fetch(`${baseUrl}/app.js`)).text();

    for (const expected of ['name="id"', 'name="categoria"', '<option value="" selected>Todas</option>', 'name="subcategoria"', 'name="anio"', 'name="estadoColeccion"', '<option value="BUSCADA">Búsqueda</option>', 'Buscar', 'Reestablecer', 'id="catalog-body"']) {
      assert.match(html, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.match(html, /id="filter-coleccion"/);
      assert.match(html, /id="filter-buscada"/);
    }
    assert.ok(html.indexOf('name="nombre"') < html.indexOf('name="id"'));
    assert.match(html, /id="show-all"[^>]*>Reestablecer<\/button>\s*<div class="form-actions">\s*<button type="submit" id="filter-submit"/);
    assert.match(html, /aria-label="Filtrar observadas"[^>]*title="Filtrar observadas"/);
    assert.match(html, /<img class="filter-symbol status-icon-image" src="\/status_images\/caja\.png" title="Colección" alt="">/);
    assert.match(html, /<img class="filter-symbol status-icon-image" src="\/status_images\/lupa\.png" title="Búsqueda" alt="">/);
    assert.match(html, /<span class="eye-symbol" title="Seguimiento" aria-hidden="true">👁️<\/span>/);
    assert.match(script, /matchesClientFilters/);
    assert.match(script, /replaceChildren/);
    assert.match(script, /No se pudo cargar el catálogo/);
  });
});

test('la tabla no muestra la columna Descripción y muestra Categoría y Subcategoría', async () => {
  await withServer(async (baseUrl) => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    const dom = new JSDOM(html);
    const headers = [...dom.window.document.querySelectorAll('table thead th')];
    assert.doesNotMatch(html, /<th scope="col">Descripción<\/th>/);
    assert.match(html, /<th scope="col">Categoría<\/th>/);
    assert.match(html, /<th scope="col">Subcategoría<\/th>/);
    for (const [index, label] of [[0, 'Imagen'], [1, 'Observar'], [10, 'Acciones']]) {
      assert.equal(headers[index].textContent.trim(), '');
      assert.equal(headers[index].getAttribute('aria-label'), label);
    }
  });
});

test('las acciones de editar y eliminar permanecen en una sola fila', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /\.actions-cell\s*\{[^}]*display:\s*flex/s);
    assert.match(css, /\.filters-form\s*\{[^}]*84px 38px auto auto/s);
  assert.match(css, /\.filters-form \.form-actions\s*\{\s*grid-column:\s*9/);
    assert.match(css, /\.filter-toggle \.filter-symbol, \.filter-toggle \.eye-symbol\s*\{[^}]*opacity:\s*0\.4/);
  assert.match(css, /\.eye-icon\s*\{[^}]*font-size:\s*1\.5rem/s);
  assert.match(css, /\.badge\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*font-size:\s*1\.5rem/s);
  assert.match(css, /\.actions-buttons\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*nowrap/s);
  assert.match(script, /actions\.className = 'actions-buttons'/);
});

test('los modales usan bordes neutros como los paneles principales', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.modal\s*\{[^}]*border:\s*1px solid var\(--line\)/s);
  assert.match(css, /\.modal-content\s*\{[^}]*border:\s*1px solid var\(--line\)/s);
});

test('los ajustes responsive quedan aislados de escritorio y ordenan los controles', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const dom = new JSDOM('<style></style>');
  dom.window.document.querySelector('style').textContent = css;
  assert.match(css, /\.filter-state-row\s*\{\s*display:\s*contents;\s*\}/);
  const rules = [...dom.window.document.styleSheets[0].cssRules];
  const responsive = rules.find((rule) => rule.conditionText === '(max-width: 1024px), (max-width: 1366px) and (hover: none) and (pointer: coarse)');
  assert.ok(responsive, 'Los ajustes deben limitarse a pantallas pequenas o tablets tactiles');
  const declarations = new Map([...responsive.cssRules].map((rule) => [rule.selectorText, rule.style]));
  assert.equal(declarations.get('body').getPropertyValue('min-width'), '0');
  assert.equal(declarations.get('.filters-form').getPropertyValue('grid-auto-flow'), 'row');
  assert.equal(declarations.get('.brand-heading').getPropertyValue('margin'), '0 auto');
  assert.equal(declarations.get('.filters-form .form-actions').getPropertyValue('grid-row'), 'auto');
  assert.equal(declarations.get('.filters-form > #show-all').getPropertyValue('grid-column'), '2');
  assert.equal(declarations.get('.gamification-level-stack .gamification-level').getPropertyValue('grid-row'), '1 / 3');
  assert.equal(declarations.get('.gamification-meter').getPropertyValue('min-width'), '0');
  assert.equal(declarations.get('#form-dialog').getPropertyValue('overflow'), 'hidden');
  dom.window.close();
});

test('smartphone limita las tarjetas a cinco columnas y compacta modales e inventario sin cambiar tablet', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const dom = new JSDOM('<style></style>');
  dom.window.document.querySelector('style').textContent = css;
  const rules = [...dom.window.document.styleSheets[0].cssRules];
  const smartphone = rules.filter((rule) => rule.conditionText === '(max-width: 600px)').at(-1);
  const declarations = new Map([...smartphone.cssRules].map((rule) => [rule.selectorText, rule.style]));
  assert.equal(declarations.get(':root')?.getPropertyValue('font-size'), '14px');
  assert.equal(declarations.get('.watchlist-row, .top-five .ranking-row')?.getPropertyValue('grid-template-columns'), 'repeat(5, minmax(0, 1fr))');
  assert.equal(declarations.get('.watchlist-card, .top-five .ranking-card')?.getPropertyValue('height'), '90px');
  assert.equal(declarations.get('.dna-dialog-body')?.getPropertyValue('grid-template-columns'), '80px minmax(0, 1fr)');
  assert.equal(declarations.get('.ranking-summary .ranking-expand')?.getPropertyValue('grid-template-rows'), 'auto auto auto');
  assert.equal(declarations.get('#form-dialog .modal-preview')?.getPropertyValue('display'), 'contents');
  assert.equal(declarations.get('#form-dialog .modal-form-column')?.getPropertyValue('grid-row'), '1');
  assert.equal(declarations.get('#form-dialog .modal-preview img')?.getPropertyValue('grid-row'), '2');
  const hiddenColumns = declarations.get('.results-panel th:nth-child(2), .results-panel td:nth-child(2), .results-panel th:nth-child(4), .results-panel td:nth-child(4), .results-panel th:nth-child(5), .results-panel td:nth-child(5), .results-panel th:nth-child(6), .results-panel td:nth-child(6), .results-panel th:nth-child(7), .results-panel td:nth-child(7), .results-panel th:nth-child(10), .results-panel td:nth-child(10)');
  assert.equal(hiddenColumns?.getPropertyValue('display'), 'none');
  assert.equal(declarations.get('.table-wrap')?.getPropertyValue('overflow'), 'hidden');
  assert.equal(declarations.get('.results-panel th:nth-child(1), .results-panel td:nth-child(1)'), undefined);
  assert.equal(declarations.get('.results-panel .table-thumb')?.getPropertyValue('width'), '36px');
  assert.equal(declarations.get('.results-panel .actions-buttons')?.getPropertyValue('width'), '100%');
  assert.equal(declarations.get('.results-panel .button-icon.button-small')?.getPropertyValue('flex'), '1 1 0');
  assert.deepEqual([1, 3, 8, 9, 11].map((column) => Number.parseInt(declarations.get(`.results-panel th:nth-child(${column})`)?.getPropertyValue('width'), 10)).reduce((total, width) => total + width, 0), 100);
  const watchlistScroller = [...smartphone.cssRules].find((rule) => rule.selectorText?.includes('.watchlist-row:has(> .watchlist-card:nth-child(6))'));
  assert.equal(watchlistScroller?.style.getPropertyValue('overflow-x'), 'auto');
  assert.equal(declarations.get('#filters-form')?.getPropertyValue('grid-template-columns'), 'repeat(2, minmax(0, 1fr))');
  assert.equal(declarations.get('#filters-form > label:nth-of-type(1)')?.getPropertyValue('grid-column'), '1');
  assert.equal(declarations.get('#filters-form > label:nth-of-type(2)')?.getPropertyValue('grid-column'), '2');
  assert.equal(declarations.get('#filters-form > label:nth-of-type(5)')?.getPropertyValue('grid-row'), '3');
  assert.equal(declarations.get('#filters-form > .filter-state-row')?.getPropertyValue('grid-column'), '2');
  assert.equal(declarations.get('#filters-form > #show-all')?.getPropertyValue('grid-column'), '1');
  assert.equal(declarations.get('#filters-form .form-actions')?.getPropertyValue('grid-column'), '2');
  assert.equal(declarations.get('#filters-form > #show-all')?.getPropertyValue('margin-top'), '8px');
  assert.equal(declarations.get('#filters-form .form-actions')?.getPropertyValue('margin-top'), '8px');
  assert.equal(declarations.get('#filters-form > label:not(.filter-toggle)')?.getPropertyValue('width'), '100%');
  assert.equal(declarations.get('#filters-form input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), #filters-form select')?.getPropertyValue('width'), '100%');
  assert.equal(declarations.get('#filters-form input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), #filters-form select')?.getPropertyValue('height'), '34px');
  assert.equal(declarations.get('#filters-form > .filter-state-row')?.getPropertyValue('transform'), 'translateY(10px)');
  assert.equal(declarations.get('#filters-form .filter-toggle')?.getPropertyValue('width'), '38.4px');
  assert.equal(declarations.get('#filters-form .filter-toggle')?.getPropertyValue('min-height'), '48.4px');
  assert.equal(declarations.get('#filters-form .filter-toggle')?.getPropertyValue('align-self'), 'center');
  assert.equal(declarations.get('#filters-form .filter-toggle .filter-symbol, #filters-form .filter-toggle .eye-symbol')?.getPropertyValue('width'), '1.656rem');
  assert.equal(declarations.get('.brand-heading')?.getPropertyValue('width'), 'min(204px, 68%)');
  assert.equal(declarations.get('.table-wrap')?.getPropertyValue('overflow'), 'hidden');
  assert.equal(declarations.get('.results-panel .table-thumb')?.getPropertyValue('width'), '36px');
  assert.doesNotMatch(smartphone.cssRules.map((rule) => rule.cssText).join('\n'), /\.results-panel th:nth-child\(1\), \.results-panel td:nth-child\(1\)[^{]*\{ display: none; \}/);
  dom.window.close();
});

test('las cabeceras de modales en smartphone comparten altura y cierre sin separar los bricks', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const dom = new JSDOM('<style></style>');
  dom.window.document.querySelector('style').textContent = css;
  const rules = [...dom.window.document.styleSheets[0].cssRules];
  const smartphoneRules = rules.filter((rule) => rule.conditionText === '(max-width: 600px)').flatMap((rule) => [...rule.cssRules]);
  const headings = smartphoneRules.find((rule) => rule.selectorText === '.ranking-dialog-heading, .achievements-heading, .dna-dialog-heading, .form-dialog-heading');
  assert.equal(headings.style.getPropertyValue('height'), '66px');
  assert.equal(headings.style.getPropertyValue('align-items'), 'center');
  assert.equal(headings.style.getPropertyValue('margin-bottom'), '20px');
  const emptyStatuses = smartphoneRules.find((rule) => rule.selectorText === '#ranking-status:empty, #achievements-status:empty');
  assert.equal(emptyStatuses.style.getPropertyValue('display'), 'none');
  const buttons = smartphoneRules.find((rule) => rule.selectorText === '.ranking-dialog-heading .button, .achievements-heading .button, .dna-dialog-heading .button, .form-dialog-heading .button');
  assert.equal(buttons.style.getPropertyValue('flex'), '0 0 auto');
  assert.equal(buttons.style.getPropertyValue('height'), '36px');
  assert.equal(buttons.style.getPropertyValue('min-height'), '36px');
  const achievements = smartphoneRules.find((rule) => rule.selectorText === '.achievement-item');
  assert.equal(achievements.style.getPropertyValue('grid-template-columns'), '32px minmax(0, 1fr) auto auto');
  assert.doesNotMatch(css, /\.achievements-heading-bricks\s*\{[^}]*grid-row:\s*2/s);
  assert.doesNotMatch(css, /\.achievement-item \.achievement-bricks\s*\{[^}]*grid-column:\s*2 \/ -1/s);
  dom.window.close();
});

test('seguimiento en smartphone se oculta tambien cuando supera cinco figuras', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const dom = new JSDOM('<style></style><div class="watchlist-row"></div>');
  const { document } = dom.window;
  const style = document.querySelector('style');
  style.textContent = css;
  const rules = [...document.styleSheets[0].cssRules];
  const smartphone = rules.filter((rule) => rule.conditionText === '(max-width: 600px)').at(-1);
  const scroller = [...smartphone.cssRules].find((rule) => rule.style?.getPropertyValue('display') === 'flex' && rule.selectorText?.includes('.watchlist-row:has('));
  const hiddenRule = rules.find((rule) => rule.selectorText === '.rankings[hidden], .watchlist-row[hidden]');
  const watchlist = document.querySelector('.watchlist-row');
  try {
    assert.equal(hiddenRule.style.getPropertyValue('display'), 'none');
    for (const count of [5, 6, 15]) {
      watchlist.replaceChildren(...Array.from({ length: count }, () => {
        const card = document.createElement('button');
        card.className = 'watchlist-card';
        return card;
      }));
      watchlist.hidden = true;
      assert.equal(watchlist.matches(hiddenRule.selectorText), true);
      assert.equal(watchlist.matches(scroller.selectorText), false, `${count} figuras ocultas no deben activar el carrusel`);
      watchlist.hidden = false;
      assert.equal(watchlist.matches(scroller.selectorText), count > 5);
    }
  } finally {
    dom.window.close();
  }
});

test('la interfaz centra el contenido, iguala la tipografia del resumen y elimina la linea de rankings', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /body\s*\{[^}]*text-align:\s*center/s);
  assert.match(css, /\.rankings\s*\{[^}]*text-align:\s*center/s);
  assert.match(css, /\.watchlist-panel\s*\{[^}]*text-align:\s*center/s);
  assert.match(css, /\.search-panel\s*\{[^}]*text-align:\s*center/s);
  assert.match(css, /table\s*\{[^}]*text-align:\s*center/s);
  assert.match(css, /td\s*\{[^}]*vertical-align:\s*middle/s);
  assert.match(css, /\.eyebrow\s*\{[^}]*text-align:\s*left/s);
  assert.match(css, /\.section-heading\s*\{[^}]*justify-content:\s*flex-start/s);
  assert.match(css, /\.modal label\s*\{[^}]*text-align:\s*left/s);
  assert.match(css, /\.results-heading\s*\{[^}]*justify-content:\s*space-between/s);
  assert.match(css, /\.header-top\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.header-top\s*\{[^}]*flex-wrap:\s*nowrap/s);
  assert.match(css, /\.brand-heading\s*\{[^}]*flex:\s*0 0 320px/s);
  assert.match(css, /\.brand-logo\s*\{[^}]*width:\s*100%[^}]*object-fit:\s*contain/s);
  assert.match(css, /\.gamification-main\s*\{[^}]*grid-template-columns:\s*auto auto minmax\(0, 1fr\) auto auto/s);
  assert.match(css, /\.gamification-main \.gamification-bricks-value strong, \.gamification-main \.collection-counts-panel strong \{[^}]*font: 700 var\(--summary-count-size\) Arial, sans-serif/);
  assert.match(css, /\.gamification-summary \.count-icon \{ width: 2\.15rem; height: 2\.15rem; transform: none; \}/);
  assert.match(css, /\.gamification-summary\s*\{[^}]*flex:\s*0 0 840px[^}]*margin-left:\s*auto/s);
  assert.match(css, /\.gamification-level-stack \{[^}]*display: grid;[^}]*grid-template-columns: var\(--level-image-size\) minmax\(0, 1fr\);[^}]*min-height: var\(--level-image-size\);/);
  assert.match(css, /\.gamification-level-stack \{[^}]*row-gap: 4px;/);
  assert.match(css, /\.gamification-level-stack \.gamification-level \{[^}]*grid-row: 1 \/ 3; grid-template-rows: subgrid;/);
  assert.match(css, /\.gamification-level-title > \.gamification-level-image \{[^}]*grid-row: 1 \/ 3;[^}]*height: 100%;/);
  assert.match(css, /\.gamification-level-title > \.gamification-level-image \{[^}]*min-height: 0; aspect-ratio: 1;/);
  assert.match(css, /\.gamification-dna-row \{[^}]*grid-column: 2; grid-row: 2;/);
  assert.match(css, /\.gamification-dna-row \{ position: relative; z-index: 1;/);
  assert.match(css, /\.gamification-summary\s*\{ flex: 1 1 800px; min-width: 0; \}/);
  assert.match(css, /@media \(min-width: 761px\) and \(max-width: 1024px\) \{\s*\.header-top \{ flex-wrap: wrap; \}\s*\.gamification-summary \{ flex: 1 1 100%; width: 100%; min-width: 0; \}/);
  assert.match(css, /\.gamification-details\s*\{[^}]*right:\s*-1px[^}]*width:\s*min\(381px, 100%\)/s);
  assert.match(css, /\.user-profile\s*\{[^}]*left:\s*50%[^}]*justify-items:\s*center[^}]*text-align:\s*center[^}]*transform:\s*translateX\(-50%\)/s);
  assert.match(css, /\.user-menu-chevron\s*\{[^}]*color:\s*var\(--ink\)/s);
  assert.match(css, /\.gamification-details\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /\.gamification-details\[hidden\]\s*\{[^}]*display:\s*none/s);
  assert.match(css, /\.collection-counts-panel\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.filter-state-toggles\s*\{[^}]*align-self:\s*end[^}]*min-height:\s*36px/s);
  assert.match(css, /button\s*\{\s*min-height:\s*36px;\s*\}/);
  assert.match(css, /\.button\s*\{[^}]*min-height:\s*36px;[^}]*padding:\s*0 12px;/s);
  assert.match(css, /input, select\s*\{[^}]*padding:\s*8px 12px/s);
  assert.match(css, /input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="hidden"\]\), select\s*\{\s*min-height:\s*36px;/);
  assert.match(css, /\.modal\s*\{[^}]*width:\s*min\(860px, calc\(100% - 32px\)\)[^}]*padding:\s*22px/s);
  assert.match(css, /\.filters-form > \.filter-toggle, \.filters-form > \.filter-state-row > \.filter-toggle\s*\{[^}]*align-self:\s*end/);
  assert.match(css, /\.filters-form > #show-all\s*\{[^}]*align-self:\s*end/);
  assert.match(css, /\.filters-form \.form-actions\s*\{[^}]*grid-row:\s*1;[^}]*align-self:\s*end/);
  assert.match(css, /\.modal-preview img\s*\{[^}]*object-fit:\s*contain;\s*\}/);
  assert.match(css, /\.collection-value strong\s*\{[^}]*font:\s*700 1\.2rem Arial, sans-serif/s);
  assert.match(css, /\.gamification-bricks-value strong\s*\{[^}]*line-height:\s*1/s);
  assert.match(css, /\.gamification-level-title\s*\{[^}]*font:\s*700 1\.35rem\/1 'Arial Rounded MT Bold', 'Trebuchet MS', Arial, sans-serif/s);
  assert.match(css, /\.gamification-level-title\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(css, /#gamification-level-number\s*\{[^}]*font-size:\s*1\.75rem/s);
  assert.match(css, /\.gamification-meter > span\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /\.toast-task\s*\{[^}]*color:\s*white;\s*background:\s*#00449e;\s*border-color:\s*#00449e/s);
  assert.match(css, /\.toast-level\s*\{[^}]*color:\s*white;\s*background:\s*var\(--accent-dark\);\s*border-color:\s*var\(--accent-dark\)/s);
  assert.match(css, /\.toast-success\s*\{[^}]*background:\s*var\(--surface\)/s);
  assert.match(css, /\.toast\s*\{[^}]*width:\s*min\(360px, calc\(100vw - 24px\)\)/s);
  assert.match(css, /#form-dialog\.view-mode \.state-toggle\.active:disabled[^}]*opacity:\s*1/s);
  assert.match(css, /#form-dialog\.view-mode \.state-toggle:disabled, #form-dialog\.view-mode \.eye-icon:disabled\s*\{[^}]*color:\s*inherit/s);
  assert.match(css, /\.button-danger\s*\{[^}]*background:\s*var\(--accent\)/s);
  assert.match(css, /\.watchlist-panel\s*\{[^}]*border-top:\s*4px solid var\(--accent\)/s);
  assert.match(css, /\.gamification-summary\s*\{[^}]*border-bottom:\s*4px solid var\(--blue\)/s);
  assert.doesNotMatch(css, /\.collection-summary\s*\{[^}]*border-left:\s*6px solid var\(--accent\)/s);
  assert.match(css, /\.gamification-meter > span\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /\.button-danger\s*\{[^}]*background:\s*var\(--accent\)/s);
  assert.match(css, /\.watchlist-panel\s*\{[^}]*border-top:\s*4px solid var\(--accent\)/s);
  assert.doesNotMatch(css, /\.page-header\s*\{[^}]*border-bottom:\s*6px solid var\(--yellow\)/s);
  assert.doesNotMatch(css, /\.top-five\s*\{[^}]*border-top:\s*4px solid var\(--yellow\)/s);
});

test('la pagina referencia los modales, las acciones por fila y el contenedor de toasts', async () => {
  await withServer(async (baseUrl) => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');

    for (const expected of [
      'id="new-minifigura"',
      'id="form-dialog"',
      'id="minifigura-form"',
      'name="id"',
      'name="nombre"',
      'name="descripcion"',
      'name="categoria"',
      'name="subcategoria"',
      'name="anio"',
      'name="estadoColeccion"',
      'id="form-estadoColeccion" name="estadoColeccion" class="visually-hidden"',
      'id="form-state-toggles"',
      'data-form-state="COLECCIÓN"',
      'name="precioCompra"',
      'name="fechaCompra"',
      'name="precio"',
      'id="sync-prices"',
      'id="collection-total"',
      'id="collection-count"',
      'id="wanted-count"',
      'id="top-five-list"',
      'Top 5 por precio',
      'id="oldest-five-list"',
      'Top 5 por antiguedad',
      'Diferencia',
      'data-sort="anio"',
      'data-sort="precio"',
      'id="delete-dialog"',
      'id="delete-confirm"',
      'id="delete-cancel"',
      'id="toast-region"',
    ]) {
      assert.match(html, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    const document = new JSDOM(html).window.document;
    const headerTop = document.querySelector('.header-top');
    assert.equal(headerTop.children[0].className, 'brand-heading');
    assert.equal(headerTop.children[1].className, 'gamification-summary');
    const main = document.querySelector('.gamification-main');
    assert.deepEqual([...main.children].map((element) => element.className), ['user-session', 'gamification-bricks-value', 'gamification-level-stack', 'collection-counts-panel', 'gamification-toggle']);
    assert.deepEqual([...main.querySelector('.gamification-level-stack').children].map((element) => element.className), ['gamification-level', 'gamification-dna-row']);
    assert.equal(main.querySelector('#user-avatar').parentElement.id, 'user-menu-toggle');
    assert.equal(main.querySelector('#open-dna-inline').className, 'gamification-dna-name');
    assert.equal(main.querySelector('#open-dna-inline').tagName, 'BUTTON');
    assert.equal(main.querySelector('#gamification-dna-principal').textContent, 'Newbie');
    assert.equal(main.querySelector('#open-dna-inline img, #open-dna-inline svg'), null);
    assert.match(css, /\.gamification-level-title > #gamification-level-number \{ grid-column: 2; grid-row: 1; \}/);
    assert.match(css, /\.gamification-dna-name \{[^}]*min-height: 0; padding: 0;/);
    assert.match(css, /\.gamification-dna-name \{[^}]*color: var\(--ink\)[^}]*font: italic 700 0\.75rem/);
    assert.match(css, /\.gamification-dna-name:hover \{ color: var\(--accent\); background: transparent; \}/);
    assert.doesNotMatch(css, /\.modal-dna \{[^}]*border-top:/);
    assert.match(css, /\.dna-chart \{ width: min\(180px, 30vw\);/);
    assert.match(css, /\.dna-chart \{ width: min\(150px, 48vw\); \}/);
    assert.equal(main.querySelector('#logout').parentElement.id, 'user-profile');
    const details = document.querySelector('#gamification-details');
    assert.ok(details.hidden);
    assert.equal(details.querySelector('#gamification-achievements-button'), null);
    assert.equal(details.children[0].className, 'gamification-progress');
    assert.equal(details.children[1].className, 'summary-achievements-row');
    assert.equal(details.querySelector('#open-dna').parentElement, details.querySelector('#open-achievements').parentElement);
    assert.equal(details.querySelector('#open-dna').getAttribute('aria-label'), null);
    assert.equal(details.querySelector('#open-dna').textContent.trim(), '🧬 DNA');
    assert.equal(details.querySelector('#open-dna').parentElement, details.querySelector('#open-achievements').parentElement);
    assert.notEqual(details.querySelector('#open-global-ranking').parentElement, details.querySelector('#open-achievements').parentElement);
    assert.equal(details.children[2].className, 'summary-ranking-row');
    assert.equal(details.children[3].className, 'summary-sync-row');
    assert.equal(details.children[3].querySelector('.collection-value img').getAttribute('src'), '/toast_images/billete.png');
    assert.equal(details.children[3].querySelector('.collection-value img').title, 'Valor total de tu colección');
    assert.equal(details.children[3].querySelector('#collection-total').textContent, '€0,00');
    assert.equal(details.children[3].children[0].id, 'sync-prices');
    assert.equal(details.children[3].children[1].className, 'collection-value');
    assert.equal(details.querySelector('#open-global-ranking').textContent.trim(), '🌐 Ranking Global');
    assert.equal(details.querySelector('#sync-prices').textContent.trim(), '🔄 Sincronizar Precios');
    const countsPanel = main.querySelector('.collection-counts-panel');
    assert.equal(countsPanel.querySelectorAll(':scope > span').length, 2);
    for (const count of countsPanel.children) assert.deepEqual([...count.children].map((element) => element.tagName), ['IMG', 'STRONG']);
    assert.equal(document.querySelector('#sync-prices').textContent.trim(), '🔄 Sincronizar Precios');
    assert.ok(document.querySelector('#sync-prices').classList.contains('button-secondary'));
    assert.match(css, /\.summary-sync-row, \.summary-achievements-row, \.summary-ranking-row \{ display: flex; flex-wrap: nowrap; justify-content: center; align-items: center; gap: 12px; \}/);
    assert.equal(document.querySelector('#lookup-brickset'), null);
    assert.equal(document.querySelector('.brand-heading img').alt, 'MiniPeopleDB');
    assert.equal(document.querySelector('.brand-heading').textContent.trim(), '');
    assert.doesNotMatch(document.querySelector('#form-dialog').textContent, /Preview/i);
  });
});

test('el modal distribuye los campos en filas y mantiene preview y acciones en dos columnas', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const dom = new JSDOM(html);
  const form = dom.window.document.querySelector('#minifigura-form');

  for (const [rowSelector, fieldIds] of [
    ['.modal-row-identity', ['form-id', 'form-nombre']],
    ['.modal-row-status', ['form-estadoColeccion', 'form-observada']],
    ['.modal-row-purchase', ['form-fechaCompra', 'form-precioCompra']],
    ['.modal-row-category', ['form-categoria', 'form-subcategoria']],
    ['.modal-row-brickset', ['form-anio', 'form-precio']],
  ]) {
    const row = form.querySelector(rowSelector);
    assert.ok(row, `Debe existir la fila ${rowSelector}`);
    for (const fieldId of fieldIds) assert.ok(row.querySelector(`#${fieldId}`), `${fieldId} debe estar en ${rowSelector}`);
  }

  const identityRow = form.querySelector('.modal-row-identity');
  assert.deepEqual([...identityRow.children].map((element) => element.className), [
    'modal-identity-fields', 'description-field',
  ]);
  assert.deepEqual([...identityRow.querySelector('.modal-identity-fields').children].map((element) => element.id), [
    'form-id-label', 'form-nombre-label',
  ]);
  assert.equal(form.querySelector('#form-id').parentElement.id, 'form-id-label');
  assert.equal(form.querySelector('#form-nombre').parentElement.id, 'form-nombre-label');
  assert.equal(identityRow.querySelector('.description-field #form-descripcion').tagName, 'TEXTAREA');
  assert.equal(identityRow.parentElement.className, 'modal-form-column');
  assert.equal(identityRow.getAttribute('style'), null);
  const heading = dom.window.document.querySelector('.form-dialog-heading');
  assert.equal(heading.parentElement, form.parentElement);
  assert.equal(heading.nextElementSibling, form);
  assert.equal(heading.querySelector('#form-dialog-title').textContent, 'Nueva minifigura');
  assert.equal(heading.querySelector('#form-cancel').textContent, 'Cerrar');
  assert.equal(heading.querySelector('#form-cancel').type, 'button');
  assert.equal(form.querySelector('#form-cancel'), null);
  assert.equal(form.parentElement.getAttribute('aria-labelledby'), 'form-dialog-title');
  assert.equal(form.querySelector('.modal-preview img').id, 'form-preview-image');
  assert.equal(form.querySelector('.form-actions').parentElement, form);
  assert.match(css, /#delete-dialog\s*\{\s*width:\s*min\(400px, calc\(100% - 32px\)\)/);
  assert.match(css, /#delete-message\s*\{\s*white-space:\s*pre-line;/);
  assert.match(css, /#delete-dialog h2\s*\{\s*margin-bottom:\s*2rem;/);
  assert.match(css, /\.modal form\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 250px;[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto/s);
  assert.match(css, /\.modal-row\.modal-row-identity\s*\{[^}]*grid-column:\s*1;[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.modal-identity-fields\s*\{[^}]*grid-template-rows:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(css, /#form-dialog \.modal-row-identity input:disabled, #form-dialog \.modal-row-identity textarea:disabled, #form-dialog \.modal-row-purchase input:disabled\s*\{[^}]*background:\s*#ecebe6/s);
  assert.match(css, /\.form-dialog-heading\s*\{[^}]*align-items:\s*center[^}]*justify-content:\s*space-between[^}]*border-bottom:\s*4px solid var\(--blue\)/s);
  assert.match(css, /#form-dialog-title\s*\{[^}]*margin:\s*0/s);
  assert.match(css, /#form-dialog\.view-mode input:disabled[^}]*background:\s*#ecebe6/s);
  assert.doesNotMatch(css, /#form-dialog\.view-mode #form-dialog-title\s*\{\s*display:\s*none/);
  assert.match(css, /#form-dialog\.view-mode \.form-actions\s*\{\s*display:\s*none;/);
  assert.match(css, /#form-dialog\.view-mode input:disabled[^}]*background:\s*#ecebe6/s);
  assert.match(css, /#form-dialog\.view-mode \.required-label > span::after[^}]*content:\s*''/s);
  assert.match(css, /#form-dialog\s*\{[^}]*height:\s*fit-content/);
  assert.doesNotMatch(css, /#form-dialog #minifigura-form\s*\{[^}]*height:/);
  assert.match(css, /\.modal-form-column\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1 \/ 3;[^}]*grid-template-rows:\s*auto auto auto/s);
  assert.match(css, /\.modal-preview\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*2;[^}]*grid-template-rows:\s*minmax\(0, 1fr\);[^}]*align-content:\s*stretch/s);
  assert.match(css, /\.modal \.form-actions\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*padding-top:\s*17px;[^}]*border-top:\s*1px solid var\(--line\)/s);
  assert.doesNotMatch(css, /\.modal \.form-actions\s*\{[^}]*margin(?:-inline)?:\s*-/s);
  assert.match(css, /#form-dialog\s*\{[^}]*padding-bottom:\s*16px/);
  assert.match(css, /\.modal \.form-actions\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*3;/s);
  assert.match(css, /#form-dialog\s*\{[^}]*overflow:\s*hidden/s);
  assert.doesNotMatch(css, /\.modal-form-column\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /#form-dialog\s*\{[^}]*height:\s*fit-content/s);
  assert.doesNotMatch(css, /#form-dialog #minifigura-form\s*\{[^}]*height:/s);
  assert.match(css, /\.modal label\s*\{\s*gap:\s*4px;\s*font-size:\s*0\.68rem/);
  assert.match(css, /\.modal-preview img\s*\{\s*width:\s*56px;\s*height:\s*56px/);
  assert.match(css, /\.modal form\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);[^}]*gap:\s*10px/s);
  assert.match(css, /@media \(max-width:\s*360px\)\s*\{[^}]*#form-dialog #minifigura-form\s*\{[^}]*gap:\s*10px/s);
  assert.match(css, /\.modal label\s*\{\s*font-size:\s*0\.6rem;\s*line-height:\s*1;\s*\}/);
  dom.window.close();
});

test('app.js gestiona alta, edicion y eliminacion mediante POST, PUT y DELETE', async () => {
  await withServer(async (baseUrl) => {
    const script = await (await fetch(`${baseUrl}/app.js`)).text();

    assert.match(script, /method:\s*isEdit \? 'PUT' : 'POST'/);
    assert.match(script, /method:\s*'DELETE'/);
    assert.match(script, /\/minifiguras\/\$\{encodeURIComponent\(/);
    assert.match(script, /showToast/);
    assert.match(script, /badgeClassFor/);
    assert.match(script, /openDeleteDialog/);
    assert.match(script, /\/sincronizacion\/brickset/);
    assert.match(script, /\/minifiguras\/\$\{encodeURIComponent\(id\)\}\/brickset/);
    assert.match(script, /collectionTotal/);
    assert.match(script, /differenceCell/);
    assert.match(script, /difference-positive/);
    assert.match(script, /difference-negative/);
    assert.match(script, /N\/A/);
    assert.match(script, /data-sort/);
    assert.match(script, /sortCatalog/);
    assert.match(script, /querySelectorAll\('input, select, button'\)/);
    assert.match(script, /startSync/);
    assert.doesNotMatch(script, /normalized === 'deseada'|normalized === 'vendida'/);
  });
});

test('El servidor expone correctamente los elementos del formulario y la integracion de la API web', async () => {
  await withServer(async (baseUrl) => {
    const htmlResponse = await fetch(`${baseUrl}/`);
    assert.equal(htmlResponse.status, 200);
    const html = await htmlResponse.text();

    assert.match(html, /id="minifigura-form"/, 'El HTML servido debe incluir el formulario minifigura-form');
    assert.match(html, /id="form-dialog"/, 'El HTML servido debe incluir el modal form-dialog');
    assert.match(html, /id="toast-region"/, 'El HTML servido debe incluir el contenedor de toasts');

    const appJsResponse = await fetch(`${baseUrl}/app.js`);
    assert.equal(appJsResponse.status, 200);
    const script = await appJsResponse.text();

    assert.match(script, /apiFetch\((['"`])\/minifiguras/, 'El script del cliente debe invocar el endpoint de la API');  });
});

test('la interfaz renderiza diferencias, ordena columnas y conserva el estado por defecto en edición', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const catalog = [
    { id: 'a', nombre: 'A', descripcion: 'A', categoria: 'Space', subcategoria: undefined, anio: 2024, estadoColeccion: 'COLECCIÓN', precioCompra: 10, precio: 15, FechaRegistro: '2026-01-04T00:00:00.000Z' },
    { id: 'b', nombre: 'B', descripcion: 'B', categoria: 'Collectible Minifigures', subcategoria: 'Team GB', anio: 2022, estadoColeccion: 'BUSCADA', precioCompra: 5, precio: 50, FechaRegistro: '2026-01-03T00:00:00.000Z' },
    { id: 'c', nombre: 'C', descripcion: 'C', categoria: 'Space', anio: 2023, precioCompra: 20, FechaRegistro: '2026-01-02T00:00:00.000Z' },
    { id: 'd', nombre: 'D', descripcion: 'D', categoria: 'Space', anio: 2021, estadoColeccion: 'COLECCIÓN', precioCompra: 10, precio: 40, FechaRegistro: '2026-01-01T00:00:00.000Z' },
  ];
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  const valuation = { total: 15, enColeccion: 2, buscadas: 1, top5: [], top5Antiguas: [] };
  window.fetch = async (url) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/minifiguras' || url.startsWith('/minifiguras?')) return { ok: true, json: async () => catalog };
    if (url === '/valoracion') return { ok: true, json: async () => valuation };
    return { ok: false, json: async () => ({}) };
  };

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const rows = () => [...window.document.querySelectorAll('#catalog-body tr')];
  assert.deepEqual(
    [...window.document.querySelectorAll('#categoria option')].slice(1).map((option) => option.textContent),
    ['Collectible Minifigures: 1 de 845 (0,1%)', 'Space: 3 de 230 (1,3%)'],
  );
  assert.equal(rows()[0].children[9].textContent, '5,00 €');
  assert.equal(rows()[1].children[9].textContent, 'N/A');
  assert.equal(rows()[2].children[9].textContent, '?');
  assert.equal(rows()[0].children[7].querySelector('.badge img').getAttribute('src'), '/status_images/caja.png');
  assert.equal(rows()[0].children[7].querySelector('.badge').getAttribute('aria-label'), 'Colección');
  assert.equal(rows()[0].children[7].querySelector('.badge').title, 'Colección');
  assert.equal(rows()[1].children[7].querySelector('.badge img').getAttribute('src'), '/status_images/lupa.png');
  assert.equal(rows()[1].children[7].querySelector('.badge').getAttribute('aria-label'), 'Búsqueda');
  assert.equal(rows()[1].children[7].querySelector('.badge').title, 'Búsqueda');
  assert.ok(rows()[0].children[9].querySelector('.difference-positive'));  assert.equal(rows()[0].children[4].textContent, 'Space');
  assert.equal(rows()[0].children[5].textContent, '');
  assert.equal(rows()[1].children[4].textContent, 'Collectible Minifigures');
  assert.equal(rows()[1].children[5].textContent, 'Team GB');
  window.document.querySelector('[data-sort="anio"]').click();
  assert.deepEqual(rows().map((row) => row.children[2].textContent), ['d', 'b', 'c', 'a']);
  window.document.querySelector('[data-sort="precio"]').click();
  assert.deepEqual(rows().map((row) => row.children[2].textContent), ['a', 'd', 'b', 'c']);
  window.document.querySelector('[data-sort="precio"]').click();
  assert.deepEqual(rows().map((row) => row.children[2].textContent), ['b', 'd', 'a', 'c']);
  window.document.querySelector('[data-sort="diferencia"]').click();
  assert.deepEqual(rows().map((row) => row.children[2].textContent), ['a', 'd', 'b', 'c']);
  window.document.querySelector('[data-sort="diferencia"]').click();
  assert.deepEqual(rows().map((row) => row.children[2].textContent), ['d', 'a', 'b', 'c']);
  window.document.querySelector('#show-all').click();
  assert.deepEqual(rows().map((row) => row.children[2].textContent), ['a', 'b', 'c', 'd']);
  assert.equal(window.document.querySelectorAll('.table-sort[data-direction=""]').length, 3);

  const editButton = rows().find((row) => row.children[2].textContent === 'c').querySelector('[data-action="edit"]');
  editButton.click();
  assert.equal(window.document.querySelector('#form-estadoColeccion').value, '');
  assert.equal(window.document.querySelector('#form-id').disabled, true);
  assert.equal(window.document.querySelector('#form-nombre').disabled, false);
  assert.equal(window.document.querySelector('#form-descripcion').disabled, false);
  assert.equal(window.document.querySelector('#form-observada').disabled, false);
  assert.equal(window.document.querySelector('#form-precioCompra').disabled, false);
  assert.equal(window.eval('buildPayloadFromForm().id'), 'c');
  assert.equal(catalog[2].FechaRegistro, '2026-01-02T00:00:00.000Z');
  window.document.querySelector('#form-cancel').click();
  window.document.querySelector('#new-minifigura').click();
  assert.equal(window.document.querySelector('#form-id').disabled, false);
  dom.window.close();
});

test('los indicadores requeridos son rojos sin colorear etiquetas ni campos opcionales', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const dom = new JSDOM(html);
  assert.match(css, /\.required-label > span::after, span\.required-label::after \{ content: ' \*'; color: var\(--accent\); \}/);
  assert.match(css, /#form-dialog\.view-mode .*required-label.*content: ''/);
  for (const input of dom.window.document.querySelectorAll('input[required]')) {
    assert.ok(input.closest('.required-label') || input.closest('label').querySelector('.required-label'));
  }
  assert.equal(dom.window.document.querySelector('#form-descripcion').closest('.required-label'), null);
  assert.equal(dom.window.document.querySelector('#form-subcategoria').closest('label').querySelector('.required-label'), null);
  dom.window.close();
});

test('Nueva minifigura, Editar y Eliminar se muestran como iconos sin texto visible y con aria-label', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const catalog = [
    { id: 'a', nombre: 'A', descripcion: 'A', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN' },
  ];
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.fetch = async (url) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 0, enColeccion: 1, buscadas: 0, top5: [], top5Antiguas: [] }) };
    return { ok: true, json: async () => catalog };
  };

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const newButton = window.document.querySelector('#new-minifigura');
  const editButton = window.document.querySelector('[data-action="edit"]');
  const deleteButton = window.document.querySelector('[data-action="delete"]');

  for (const [button, expectedLabel] of [
    [newButton, 'Nueva minifigura'],
    [editButton, 'Editar'],
    [deleteButton, 'Eliminar'],
  ]) {
    assert.equal(button.textContent.trim(), '', `${expectedLabel} no debe mostrar texto visible`);
    assert.equal(button.getAttribute('aria-label'), expectedLabel);
    assert.ok(button.querySelector('svg'), `${expectedLabel} debe mostrar un icono`);
  }
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  deleteButton.click();
  assert.match(window.document.querySelector('#delete-message').textContent, /\n\nEsta acción no se puede deshacer\.$/);
  dom.window.close();
});

test('la interfaz muestra imágenes en la tabla y tarjetas de ranking', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  const smartphoneViewport = { matches: true };
  window.matchMedia = () => smartphoneViewport;
  window.Image = class ImageStub {
    set src(url) { this.onload(); }
  };
  assert.ok(officialCategoriaSet.has('Stranger Things'));
  const catalog = [{
    id: 'ST008', nombre: 'Demogorgon', descripcion: 'Figura', categoria: 'Stranger Things',
    anio: 2019, estadoColeccion: 'COLECCIÓN', precio: 109.56, observada: true,
  }];
  const rankingOnly = {
    id: 'RANK1', nombre: 'Figura ranking', descripcion: 'Datos completos', categoria: 'Space',
    anio: 2020, estadoColeccion: 'COLECCIÓN', precio: 25, observada: false,
  };
  window.fetch = async (url) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/minifiguras?id=RANK1') return { ok: true, json: async () => [rankingOnly] };
    if (url === '/valoracion') return {
      ok: true,
      json: async () => ({
        total: 109.56,
        enColeccion: 1,
        buscadas: 0,
        top5: [rankingOnly],
        top5Antiguas: catalog,
        observadas: [{ id: 'ST008', nombre: 'Demogorgon', estadoColeccion: 'COLECCIÓN', precioBrickset: 109.56 }],
      }),
    };
    return { ok: true, json: async () => catalog };
  };

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const thumbnail = window.document.querySelector('.table-thumb');
  assert.equal(thumbnail.src, 'https://img.bricklink.com/ItemImage/MN/0/st008.png');
  assert.equal(thumbnail.dataset.action, 'preview');
  assert.equal(window.document.querySelectorAll('.ranking-card').length, 2);
  for (const [selector, expectedId, expectedDescription] of [
    ['.ranking-card', 'RANK1', 'Datos completos'],
    ['.watchlist-card', 'ST008', 'Figura'],
  ]) {
    window.document.querySelector(selector).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(window.document.querySelector('#form-dialog').open, true);
    assert.equal(window.document.querySelector('#form-dialog-title').textContent, 'Ver minifigura');
    assert.equal(window.document.querySelector('#form-id').value, expectedId);
    assert.equal(window.document.querySelector('#form-descripcion').value, expectedDescription);
    assert.equal(window.document.querySelector('#form-id').disabled, true);
    if (expectedId === 'RANK1') {
      window.document.querySelector('#form-preview-image').click();
      assert.equal(window.document.querySelector('#image-modal').open, true);
      assert.equal(window.document.querySelector('#image-modal-title').textContent, 'RANK1');
      assert.equal(window.document.querySelector('#image-modal-name').textContent, 'Figura ranking');
      window.document.querySelector('#image-modal-close').click();
    }
    assert.equal(window.document.querySelector('#image-modal').open, false);
    window.document.querySelector('#form-cancel').click();
  }
  smartphoneViewport.matches = false;
  window.document.querySelector('.watchlist-card').click();
  window.document.querySelector('#form-preview-image').click();
  assert.equal(window.document.querySelector('#image-modal').open, false);
  window.document.querySelector('#form-cancel').click();
  thumbnail.click();
  assert.equal(window.document.querySelector('#image-modal').open, true);
  assert.equal(window.document.querySelector('#image-modal-title').textContent, 'ST008');
  assert.equal(window.document.querySelector('#image-modal-name').textContent, 'Demogorgon');
  assert.doesNotMatch(window.document.querySelector('#image-modal-title').textContent, /Minifigura:/);
  window.document.querySelector('#image-modal-close').click();
  assert.equal(window.document.querySelector('#image-modal-name').textContent, '');
  assert.equal(window.document.querySelector('#image-modal').open, false);
  dom.window.close();
});

test('los filtros muestran parcial, total conocido de Brickset y porcentaje sin inventar totales', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  const categories = [{ categoria: 'Space', total: 500, subcategorias: [{ subcategoria: 'Classic', total: 100 }, { subcategoria: 'Unknown' }] }, { categoria: 'Zero', total: 0, subcategorias: [] }];
  const catalog = [
    ...Array.from({ length: 53 }, (_, index) => ({ id: `OWNED-${index}`, categoria: 'Space', subcategoria: 'Classic', anio: 2024, estadoColeccion: 'COLECCIÓN' })),
    { id: 'WANTED', categoria: 'Space', subcategoria: 'Unknown', anio: 2020, estadoColeccion: 'BUSCADA' },
    { id: 'ZERO', categoria: 'Zero', anio: 2024, estadoColeccion: 'BUSCADA' },
  ];
  const requests = [];
  window.fetch = async (url) => {
    requests.push(url);
    if (url === '/categorias') return { ok: true, json: async () => categories };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 0, enColeccion: 53, buscadas: 2 }) };
    return { ok: true, json: async () => catalog };
  };
  const options = (id) => [...window.document.querySelector(`#${id}`).options].map((option) => option.textContent);
  try {
    window.eval(script);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(options('categoria'), ['Todas (55)', 'Space: 54 de 500 (10,8%)', 'Zero (1)']);
    window.document.querySelector('#filter-coleccion').click();
    assert.deepEqual(options('categoria'), ['Todas (53)', 'Space: 53 de 500 (10,6%)']);
    const category = window.document.querySelector('#categoria');
    category.value = 'Space';
    category.dispatchEvent(new window.Event('change'));
    assert.deepEqual(options('subcategoria'), ['Todas (53)', 'Classic: 53 de 100 (53%)']);
    assert.deepEqual(options('anio'), ['Todos (53)', '2024 (53)']);
    window.document.querySelector('#filter-buscada').click();
    assert.deepEqual(options('subcategoria'), ['Todas (54)', 'Classic: 53 de 100 (53%)', 'Unknown (1)']);
    assert.equal(category.value, 'Space');
    assert.deepEqual(requests.filter((url) => url.startsWith('/minifiguras')), ['/minifiguras']);
  } finally {
    dom.window.close();
  }
});

test('los filtros muestran los toggles de estado y listan los temas y años registrados', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  assert.ok(officialCategoriaSet.has('Space'));
  assert.ok(officialCategoriaSet.has('Castle'));
  const catalog = [
    { id: 'a', nombre: 'A', descripcion: 'A', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN' },
    { id: 'b', nombre: 'B', descripcion: 'B', categoria: 'Castle', anio: 1980, estadoColeccion: 'BUSCADA' },
  ];
  window.fetch = async (url) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 0, enColeccion: 1, buscadas: 1 }) };
    return { ok: true, json: async () => catalog };
  };

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(window.document.querySelector('#filter-coleccion').checked, false);
  assert.equal(window.document.querySelector('#filter-buscada').checked, false);
  assert.deepEqual(
    [...window.document.querySelectorAll('#categoria option')].map((option) => option.textContent),
    ['Todas (2)', 'Castle: 1 de 100 (1%)', 'Space: 1 de 230 (0,4%)'],
  );
  assert.equal(window.document.querySelector('#anio').tagName, 'SELECT');
  assert.deepEqual(
    [...window.document.querySelectorAll('#anio option')].map((option) => option.textContent),
    ['Todos (2)', '2024 (1)', '1980 (1)'],
  );
  dom.window.close();
});

test('los iconos recalculan categorias, subcategorias y años sin opciones de total cero', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  const catalog = [
    { id: 'OWNED-A', categoria: 'Space', subcategoria: 'A', anio: 2024, estadoColeccion: 'COLECCIÓN', observada: true },
    { id: 'OWNED-B', categoria: 'Space', subcategoria: 'B', anio: 2020, estadoColeccion: 'COLECCIÓN', observada: false },
    { id: 'WANTED-B', categoria: 'Space', subcategoria: 'B', anio: 2024, estadoColeccion: 'BUSCADA', observada: true },
    { id: 'WANTED-C', categoria: 'Castle', subcategoria: 'C', anio: 1980, estadoColeccion: 'BUSCADA', observada: false },
  ];
  const catalogRequests = [];
  window.fetch = async (url) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 0, enColeccion: 2, buscadas: 2 }) };
    if (url.startsWith('/minifiguras')) catalogRequests.push(url);
    return { ok: true, json: async () => catalog };
  };
  const options = (id) => [...window.document.querySelector(`#${id}`).options].map((option) => option.textContent);
  const countedOptions = (figures, field, placeholder) => {
    const values = [...new Set(figures.map((figure) => figure[field]))];
    values.sort(field === 'anio' ? (left, right) => right - left : undefined);
    return [`${placeholder} (${figures.length})`, ...values.map((value) => {
      const count = figures.filter((figure) => figure[field] === value).length;
      const total = field === 'categoria' ? JSON.parse(officialCategoriasRaw).find(({ categoria }) => categoria === value)?.total : undefined;
      return total > 0 ? `${value}: ${count} de ${total} (${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(count * 100 / total)}%)` : `${value} (${count})`;
    })];
  };

  try {
    window.eval(script);
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (const collection of [false, true]) {
      for (const wanted of [false, true]) {
        for (const observed of [false, true]) {
          window.document.querySelector('#categoria').value = '';
          for (const [id, checked] of [['filter-coleccion', collection], ['filter-buscada', wanted], ['observada', observed]]) {
            const input = window.document.querySelector(`#${id}`);
            input.checked = checked;
            input.dispatchEvent(new window.Event('change', { bubbles: true }));
          }
          const matching = catalog.filter((figure) => (collection === wanted || figure.estadoColeccion === (collection ? 'COLECCIÓN' : 'BUSCADA')) && (!observed || figure.observada));
          assert.deepEqual(options('categoria'), countedOptions(matching, 'categoria', 'Todas'));
          assert.deepEqual(options('anio'), countedOptions(matching, 'anio', 'Todos'));
          const category = window.document.querySelector('#categoria');
          category.value = 'Space';
          category.dispatchEvent(new window.Event('change', { bubbles: true }));
          const space = matching.filter((figure) => figure.categoria === 'Space');
          assert.deepEqual(options('subcategoria'), countedOptions(space, 'subcategoria', 'Todas'));
          assert.deepEqual(options('anio'), countedOptions(space, 'anio', 'Todos'));
        }
      }
    }

    window.document.querySelector('#show-all').click();
    const category = window.document.querySelector('#categoria');
    const subcategory = window.document.querySelector('#subcategoria');
    const year = window.document.querySelector('#anio');
    category.value = 'Space';
    category.dispatchEvent(new window.Event('change'));
    subcategory.value = 'B';
    subcategory.dispatchEvent(new window.Event('change'));
    assert.deepEqual(options('anio'), ['Todos (2)', '2024 (1)', '2020 (1)']);
    year.value = '2020';
    window.document.querySelector('#observada').click();
    assert.equal(subcategory.value, 'B');
    assert.equal(year.value, '');
    assert.deepEqual(options('anio'), ['Todos (1)', '2024 (1)']);
    window.document.querySelector('#filter-coleccion').click();
    assert.equal(subcategory.value, '');
    assert.deepEqual(options('subcategoria'), ['Todas (1)', 'A (1)']);

    window.document.querySelector('#show-all').click();
    category.value = 'Castle';
    category.dispatchEvent(new window.Event('change'));
    year.value = '1980';
    window.document.querySelector('#filter-coleccion').click();
    assert.equal(category.value, '');
    assert.equal(year.value, '');
    window.document.querySelector('#show-all').click();
    assert.deepEqual(options('categoria'), ['Todas (4)', 'Castle: 1 de 100 (1%)', 'Space: 3 de 230 (1,3%)']);
    assert.deepEqual(options('anio'), ['Todos (4)', '2024 (2)', '2020 (1)', '1980 (1)']);
    year.value = '2024';
    window.document.querySelector('#filters-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    assert.equal(window.document.querySelector('#result-count').textContent, '2 figuras');
    assert.deepEqual(catalogRequests, ['/minifiguras']);
  } finally {
    dom.window.close();
  }
});

test('los desplegables no ofrecen elementos cuando los iconos no coinciden con ninguna figura', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.fetch = async (url) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 0, enColeccion: 1, buscadas: 0 }) };
    return { ok: true, json: async () => [{ id: 'ONLY-OWNED', categoria: 'Space', subcategoria: 'Classic', anio: 1980, estadoColeccion: 'COLECCIÓN', observada: false }] };
  };
  try {
    window.eval(script);
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (const id of ['filter-buscada', 'observada']) {
      window.document.querySelector('#show-all').click();
      window.document.querySelector(`#${id}`).click();
      for (const selectId of ['categoria', 'subcategoria', 'anio']) {
        const select = window.document.querySelector(`#${selectId}`);
        assert.equal(select.options.length, 1);
        assert.equal(select.value, '');
        assert.match(select.options[0].textContent, /\(0\)$/);
      }
      assert.equal(window.document.querySelector('#subcategoria').disabled, true);
    }
  } finally {
    dom.window.close();
  }
});

test('los toggles 📦 y 🔍 filtran por estado individualmente o muestran ambos', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  const catalogRequests = [];
  const catalog = [
    { id: 'OWNED', nombre: 'Propia', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN' },
    { id: 'WANTED', nombre: 'Buscada', categoria: 'Space', anio: 2024, estadoColeccion: 'BUSCADA' },
  ];
  window.fetch = async (url) => {
    if (url.startsWith('/minifiguras')) catalogRequests.push(url);
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 0, enColeccion: 0, buscadas: 0 }) };
    return { ok: true, json: async () => catalog };
  };

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const collectionToggle = window.document.querySelector('#filter-coleccion');
  const wantedToggle = window.document.querySelector('#filter-buscada');
  const submitFilters = async () => {
    window.document.querySelector('#filters-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    return [...window.document.querySelectorAll('#catalog-body tr')].map((row) => row.children[2].textContent).sort();
  };

  collectionToggle.checked = true;
  assert.deepEqual(await submitFilters(), ['OWNED']);
  wantedToggle.checked = true;
  assert.deepEqual(await submitFilters(), ['OWNED', 'WANTED']);
  collectionToggle.checked = false;
  assert.deepEqual(await submitFilters(), ['WANTED']);
  assert.deepEqual(catalogRequests, ['/minifiguras']);
  dom.window.close();
});

test('el select de subcategoria depende de la categoria seleccionada en el filtro', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.fetch = async (url) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 0, enColeccion: 0, buscadas: 0 }) };
    return { ok: true, json: async () => [{ id: 'COL-1', nombre: 'Team', categoria: 'Collectible Minifigures', subcategoria: 'Team GB', estadoColeccion: 'COLECCIÓN' }] };
  };

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const categoriaFilter = window.document.querySelector('#categoria');
  const subcategoriaFilter = window.document.querySelector('#subcategoria');
  assert.equal(subcategoriaFilter.disabled, true);

  categoriaFilter.value = 'Collectible Minifigures';
  categoriaFilter.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(subcategoriaFilter.disabled, false);
  assert.ok([...subcategoriaFilter.options].some((option) => option.value === 'Team GB'));

  categoriaFilter.value = 'Space';
  categoriaFilter.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(subcategoriaFilter.disabled, true);
  assert.equal(subcategoriaFilter.value, '');
  dom.window.close();
});

test('el formulario de alta/edición mantiene Categoría, Subcategoría y Año como campos de solo lectura', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  window.fetch = async (url) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 0, enColeccion: 0, buscadas: 0 }) };
    return { ok: true, json: async () => [] };
  };

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  window.document.querySelector('#new-minifigura').click();
  assert.equal(window.document.querySelector('#form-categoria').readOnly, true);
  assert.equal(window.document.querySelector('#form-subcategoria').readOnly, true);
  assert.equal(window.document.querySelector('#form-anio').readOnly, true);
  assert.equal(window.document.querySelector('#form-precio').readOnly, true);
  dom.window.close();
});

test('la interfaz bloquea controles dependientes cuando no puede cargar temas', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.fetch = async () => ({ ok: false, json: async () => ({ error: 'CATEGORIAS_NO_DISPONIBLES' }) });

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(window.document.querySelector('#categoria').disabled, true);
  assert.equal(window.document.querySelector('#new-minifigura').disabled, true);
  assert.equal(window.document.querySelector('#sync-prices').disabled, true);
  assert.match(window.document.querySelector('#status').textContent, /categorías no está disponible/);
  dom.window.close();
});

test('la interfaz bloquea controles dependientes si falla el catalogo de minifiguras', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.fetch = async (url) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    return { ok: false, json: async () => ({ error: 'CATALOGO_NO_DISPONIBLE' }) };
  };

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(window.document.querySelector('#categoria').disabled, true);
  assert.equal(window.document.querySelector('#new-minifigura').disabled, true);
  assert.equal(window.document.querySelector('#sync-prices').disabled, true);
  dom.window.close();
});

test('la interfaz mantiene bloqueados los controles de temas tras sincronizar sin catálogo', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.fetch = async (url) => {
    if (url === '/categorias') return { ok: true, json: async () => [] };
    if (url === '/sincronizacion/brickset') return { ok: true, json: async () => ({ estado: 'completada', procesados: 0, total: 0, actualizados: [], fallidos: [] }) };
    if (url === '/minifiguras' || url === '/valoracion') return { ok: true, json: async () => url === '/valoracion' ? { total: 0, enColeccion: 0, buscadas: 0 } : [] };
    return { ok: false, json: async () => ({}) };
  };

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));
  window.document.querySelector('#sync-prices').click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(window.document.querySelector('#categoria').disabled, true);
  assert.equal(window.document.querySelector('#new-minifigura').disabled, true);
  dom.window.close();
});

test('la interfaz rechaza entradas de temas con propiedades adicionales o nombres no canónicos', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.fetch = async () => ({
    ok: true,
    json: async () => [{ categoria: ' Space ', total: 1, subcategorias: [], extra: true }],
  });

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(window.document.querySelector('#categoria').disabled, true);
  assert.match(window.document.querySelector('#status').textContent, /categorías no tiene un formato válido/);
  dom.window.close();
});

test('la sincronización deshabilita solo su botón mientras está en curso', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  const catalog = [{
    id: 'sync-test',
    nombre: 'Figura de sincronización',
    descripcion: 'Figura para probar la restauración de botones',
    categoria: 'Space',
    anio: 2024,
    estadoColeccion: 'COLECCIÓN',
  }];
  let releaseSync;
  let syncStatus = 'en_curso';
  window.fetch = async (url) => {
    if (url === '/sincronizacion/brickset' && syncStatus === 'en_curso') {
      return { ok: true, json: async () => ({ estado: 'en_curso', procesados: 0, total: 1, actualizados: [], fallidos: [] }) };
    }
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/minifiguras' || url === '/valoracion') return {
      ok: true,
      json: async () => url === '/valoracion'
        ? { total: 0, enColeccion: 1, buscadas: 0 }
        : catalog,
    };
    return { ok: true, json: async () => ({}) };
  };
  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const syncPromise = window.document.querySelector('#sync-prices').click();
  void syncPromise;
  assert.equal(window.document.querySelector('#sync-prices').disabled, true);
  assert.equal(window.document.querySelector('#show-all').disabled, false);
  assert.equal(window.document.querySelector('#new-minifigura').disabled, false);
  assert.equal(window.document.querySelector('#sync-progress').hidden, false);
  syncStatus = 'completada';
  dom.window.close();
});

test('la sincronización mantiene utilizables las acciones creadas al refrescar el catálogo', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  const catalog = [{
    id: 'sync-row',
    nombre: 'Figura sincronizada',
    descripcion: 'Figura para probar acciones nuevas',
    categoria: 'Space',
    anio: 2024,
    estadoColeccion: 'COLECCIÓN',
  }];
  let valuationCalls = 0;
  let releaseSummary;
  const summaryPending = new Promise((resolve) => { releaseSummary = resolve; });
  window.fetch = async (url) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/sincronizacion/brickset') return { ok: true, json: async () => ({ estado: 'en_curso', procesados: 0, total: 1, actualizados: [], fallidos: [] }) };
    if (url === '/minifiguras') return { ok: true, json: async () => catalog };
    if (url === '/valoracion') {
      valuationCalls += 1;
      return valuationCalls === 1
        ? { ok: true, json: async () => ({ total: 0, enColeccion: 1, buscadas: 0, top5: [], top5Antiguas: [] }) }
        : summaryPending;
    }
    return { ok: false, json: async () => ({}) };
  };

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));
  window.document.querySelector('#sync-prices').click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(window.document.querySelector('[data-action="edit"]').disabled, false);
  assert.equal(window.document.querySelector('[data-action="delete"]').disabled, false);
  assert.equal(window.document.querySelector('#categoria').disabled, false);
  assert.equal(window.document.querySelector('#new-minifigura').disabled, false);
  assert.equal(window.document.querySelector('#sync-prices').disabled, true);
  dom.window.close();
});

test('la creación desde el formulario normaliza el estado vacío a COLECCIÓN', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  assert.ok(officialCategoriaSet.has('Space'));
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  let submittedPayload;
  let lookups = 0;
  window.fetch = async (url, options = {}) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/minifiguras' && options.method === 'POST') {
      submittedPayload = JSON.parse(options.body);
      return { ok: true, status: 201, json: async () => submittedPayload };
    }
    if (url === '/minifiguras/new-figure/brickset') {
      lookups += 1;
      return { ok: true, json: async () => ({ id: 'NEW-FIGURE', categoria: 'Space', anio: 2024, precio: 12 }) };
    }
    if (url === '/minifiguras' || url.startsWith('/minifiguras?')) {
      return { ok: true, json: async () => [] };
    }
    if (url === '/valoracion') {
      return { ok: true, json: async () => ({ total: 0, enColeccion: 0, buscadas: 0 }) };
    }
    return { ok: false, json: async () => ({}) };
  };

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));
  window.document.querySelector('#new-minifigura').click();
  window.document.querySelector('#form-id').value = 'new-figure';
  window.document.querySelector('#form-id').dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(lookups, 0);
  assert.equal(window.document.querySelector('#form-nombre').disabled, true);
  assert.equal(window.document.querySelector('#form-descripcion').disabled, true);
  assert.equal(window.document.querySelector('#form-fechaCompra').disabled, true);
  assert.equal(window.document.querySelector('#form-precioCompra').disabled, true);
  window.document.querySelector('#form-preview-image').dispatchEvent(new window.Event('load'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(lookups, 1);
  assert.equal(window.document.querySelector('#form-nombre').disabled, false);
  assert.equal(window.document.querySelector('#form-descripcion').disabled, false);
  assert.equal(window.document.querySelector('#form-fechaCompra').disabled, false);
  assert.equal(window.document.querySelector('#form-precioCompra').disabled, false);
  window.document.querySelector('#form-nombre').value = 'Nueva';
  window.document.querySelector('#form-estadoColeccion').value = '';
  window.document.querySelector('#minifigura-form').dispatchEvent(
    new window.Event('submit', { bubbles: true, cancelable: true }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(submittedPayload.estadoColeccion, 'COLECCIÓN');
  dom.window.close();
});

test('el alta ignora consultas de imágenes anteriores y bloquea los campos si falla Brickset', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  let resolveOldLookup;
  window.fetch = async (url) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 0, enColeccion: 0, buscadas: 0 }) };
    if (url === '/minifiguras/old/brickset') return new Promise((resolve) => { resolveOldLookup = resolve; });
    if (url === '/minifiguras/new/brickset') return { ok: false, json: async () => ({ error: 'BRICKSET_NO_DISPONIBLE' }) };
    return { ok: true, json: async () => [] };
  };

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));
  window.document.querySelector('#new-minifigura').click();
  const idInput = window.document.querySelector('#form-id');
  const preview = window.document.querySelector('#form-preview-image');
  idInput.value = 'old';
  idInput.dispatchEvent(new window.Event('input'));
  preview.dispatchEvent(new window.Event('load'));
  idInput.value = 'new';
  idInput.dispatchEvent(new window.Event('input'));
  resolveOldLookup({ ok: true, json: async () => ({ categoria: 'Space', anio: 2024, precio: 12 }) });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(window.document.querySelector('#form-categoria').value, '');
  assert.equal(window.document.querySelector('#form-nombre').disabled, true);

  preview.dispatchEvent(new window.Event('load'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(window.document.querySelector('#form-submit').disabled, true);
  const errorToast = window.document.querySelector('#toast-region .toast-error');
  assert.equal(errorToast.textContent, 'No se encontraron datos para el ID especificado.');
  assert.doesNotMatch(errorToast.textContent, /Brickset/i);
  dom.window.close();
});

test('la interfaz muestra y alterna la watchlist con el orden del resumen', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  const catalog = [
    { id: 'HIGH', nombre: 'Alta', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN', precio: 30, observada: true },
    { id: 'LOW', nombre: 'Baja', categoria: 'Space', anio: 2023, estadoColeccion: 'BUSCADA', precio: 10, observada: false },
  ];
  const valuation = { total: 30, enColeccion: 1, buscadas: 1, top5: [catalog[0]], top5Antiguas: [], observadas: [{ id: 'HIGH', nombre: 'Alta', estadoColeccion: 'COLECCIÓN', precioBrickset: 30 }] };
  window.fetch = async (url, options = {}) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/valoracion') return { ok: true, json: async () => valuation };
    if (url.includes('/observada') && options.method === 'PUT') {
      catalog[1] = { ...catalog[1], observada: true };
      return { ok: true, json: async () => catalog[1] };
    }
    return { ok: true, json: async () => catalog };
  };

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(window.document.querySelector('.eye-icon.active').dataset.id, 'HIGH');
  assert.equal(window.document.querySelectorAll('.watchlist-card').length, 1);
  assert.equal(window.document.querySelector('#watchlist-title').textContent, 'Seguimiento (1 / 10)');
  const watchlistCard = window.document.querySelector('.watchlist-card');
  assert.equal(watchlistCard.title, window.document.querySelector('.ranking-card').title);
  assert.equal(watchlistCard.querySelector('.watchlist-state-icon').title, 'Colección');
  assert.equal(watchlistCard.querySelector('.watchlist-state-icon img').getAttribute('src'), '/status_images/caja.png');
  assert.match(css, /\.watchlist-card \.status-icon-image\s*\{\s*width:\s*1\.5rem;\s*height:\s*1\.5rem;/);
  assert.match(css, /\.status-icon-image\[src\$="caja\.png"\]\s*\{\s*transform:\s*scale\(1\.2\);/);
  assert.match(css, /\.watchlist-card \.watchlist-state-icon img\[src\$="caja\.png"\]\s*\{\s*margin-right:\s*2px;/);
  assert.match(watchlistCard.textContent, /^ HIGH 30,00/);
  assert.equal(window.document.querySelector('.eye-icon.active').title, 'Seguimiento');
  assert.equal(window.document.querySelector('.filter-symbol').title, 'Colección');
  assert.equal(window.document.querySelectorAll('.filter-symbol')[1].title, 'Búsqueda');
  assert.equal(window.document.querySelector('.eye-symbol').title, 'Seguimiento');
  assert.equal(window.document.querySelectorAll('.count-icon')[0].title, 'Colección');
  assert.equal(window.document.querySelectorAll('.count-icon')[1].title, 'Búsqueda');
  assert.match(css, /\.watchlist-row\s*\{[^}]*justify-content:\s*flex-start;[^}]*overflow-x:\s*auto;[^}]*scroll-snap-type:\s*x mandatory;/);
  assert.match(css, /\.watchlist-card\s*\{\s*scroll-snap-align:\s*start;/);
  assert.match(css, /\.watchlist-card:hover\s*\{[^}]*border-color:\s*var\(--accent\)/s);
  assert.equal(window.document.querySelector('#collection-count').textContent, '1');
  assert.equal(window.document.querySelector('#wanted-count').textContent, '1');

  window.document.querySelector('.eye-icon.inactive').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(window.document.querySelectorAll('.eye-icon.active').length, 2);
  dom.window.close();
});

test('el modal de seguimiento permite alternar el ojo y conserva el estado ante errores', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  let minifigura = { id: 'WATCH-1', nombre: 'Seguida', categoria: 'Space', anio: 2024, estadoColeccion: 'BUSCADA', precio: 20, observada: true };
  let resolveUpdate;
  const updates = [];
  window.fetch = async (url, options = {}) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 0, enColeccion: 0, buscadas: 1, top5: [], top5Antiguas: [], observadas: minifigura.observada ? [{ ...minifigura, precioBrickset: 20 }] : [] }) };
    if (url === '/minifiguras/WATCH-1/observada' && options.method === 'PUT') {
      updates.push(JSON.parse(options.body));
      return new Promise((resolve) => { resolveUpdate = resolve; });
    }
    return { ok: true, json: async () => [minifigura] };
  };

  try {
    window.eval(script);
    await new Promise((resolve) => setTimeout(resolve, 0));
    window.document.querySelector('.watchlist-card').click();
    const eye = window.document.querySelector('#form-observada');
    assert.equal(eye.disabled, false);
    assert.equal(eye.getAttribute('aria-pressed'), 'true');
    assert.equal(window.document.querySelector('#form-nombre').disabled, true);
    assert.equal(window.document.querySelector('#form-submit').hidden, true);

    for (const observada of [false, true]) {
      eye.click();
      assert.equal(eye.disabled, true);
      eye.click();
      assert.deepEqual(updates.at(-1), { observada });
      assert.equal(updates.length, observada ? 2 : 1);
      minifigura = { ...minifigura, observada };
      resolveUpdate({ ok: true, json: async () => minifigura });
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal(eye.disabled, false);
      assert.equal(eye.getAttribute('aria-pressed'), String(observada));
      assert.equal(eye.classList.contains('active'), observada);
      assert.equal(eye.getAttribute('aria-label'), observada ? 'Dejar de seguir' : 'Seguir');
      assert.equal(window.document.querySelector('.eye-icon').getAttribute('aria-pressed'), String(observada));
      assert.equal(window.document.querySelectorAll('.watchlist-card').length, Number(observada));
      assert.equal(window.document.querySelector('#watchlist-title').textContent, `Seguimiento (${Number(observada)} / 10)`);
      assert.equal(window.document.querySelector('#form-dialog').open, true);
    }

    eye.click();
    resolveUpdate({ ok: false, json: async () => ({ error: 'ERROR_INTERNO' }) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(eye.disabled, false);
    assert.equal(eye.getAttribute('aria-pressed'), 'true');
    assert.equal(window.document.querySelectorAll('.watchlist-card').length, 1);
    assert.notEqual(window.document.querySelector('#toast-region').textContent, '');
  } finally {
    dom.window.close();
  }
});

test('el modal aplica los modos de alta y visualizacion', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readSessionScript();
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  const catalog = [{ id: 'VIEW-1', nombre: 'Vista', categoria: 'Space', anio: 2024, estadoColeccion: 'BUSCADA', precio: 20, observada: true }];
  let lookups = 0;
  const submittedPayloads = [];
  window.fetch = async (url, options = {}) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 20, enColeccion: 1, buscadas: 0, top5: [], top5Antiguas: [], observadas: [] }) };
    if (url === '/sincronizacion/brickset') return { ok: true, json: async () => ({ estado: 'inactiva' }) };
    if (options.method === 'PUT' || options.method === 'POST') {
      const payload = JSON.parse(options.body);
      submittedPayloads.push(payload);
      return { ok: true, json: async () => payload };
    }
    if (url.endsWith('/brickset')) {
      lookups += 1;
      return { ok: true, json: async () => ({ id: 'NEW-1', categoria: 'Space', anio: 2024, precio: 18 }) };
    }
    return { ok: true, json: async () => catalog };
  };

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  window.document.querySelector('.id-link').click();
  window.document.querySelector('#form-preview-image').dispatchEvent(new window.Event('load'));
  assert.equal(lookups, 0);
  assert.ok(window.document.querySelector('#form-dialog').classList.contains('view-mode'));
  assert.ok(window.document.querySelector('.modal-row-identity').classList.contains('view-mode'));
  assert.equal(window.document.querySelector('#form-dialog-title').hidden, false);
  assert.equal(window.document.querySelector('#form-submit').hidden, true);
  assert.equal(window.document.querySelector('#lookup-brickset'), null);
  assert.equal(window.document.querySelector('#form-id').disabled, true);
  assert.equal(window.document.querySelector('#form-cancel').textContent, 'Cerrar');
  const collectionToggle = window.document.querySelector('[data-form-state="COLECCIÓN"]');
  const wantedToggle = window.document.querySelector('[data-form-state="BUSCADA"]');
  const followToggle = window.document.querySelector('#form-observada');
  assert.equal(collectionToggle.getAttribute('aria-pressed'), 'false');
  assert.equal(wantedToggle.getAttribute('aria-pressed'), 'true');
  assert.ok(wantedToggle.classList.contains('active'));
  assert.ok(collectionToggle.classList.contains('inactive'));
  assert.equal(collectionToggle.disabled, true);
  assert.equal(wantedToggle.disabled, true);
  assert.equal(followToggle.disabled, false);
  assert.equal(followToggle.getAttribute('aria-pressed'), 'true');
  assert.ok(followToggle.classList.contains('active'));
  collectionToggle.click();
  assert.equal(wantedToggle.getAttribute('aria-pressed'), 'true');
  assert.equal(followToggle.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(
    [...window.document.querySelectorAll('#minifigura-form input, #minifigura-form select, #minifigura-form textarea, #minifigura-form button')]
      .filter((control) => !['form-cancel', 'form-observada'].includes(control.id) && !control.disabled),
    [],
  );
  window.document.querySelector('#form-cancel').click();

  window.document.querySelector('[data-action="edit"]').click();
  window.document.querySelector('#form-preview-image').dispatchEvent(new window.Event('load'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(lookups, 1);
  assert.equal(window.document.querySelector('#form-precio').value, '18');
  assert.equal(window.document.querySelector('#form-dialog').classList.contains('view-mode'), false);
  assert.equal(window.document.querySelector('#form-cancel').textContent, 'Cerrar');
  assert.equal(window.document.querySelector('#lookup-brickset'), null);
  assert.equal(collectionToggle.disabled, false);
  wantedToggle.click();
  assert.equal(window.document.querySelector('#form-estadoColeccion').value, 'BUSCADA');
  assert.equal(wantedToggle.getAttribute('aria-pressed'), 'true');
  assert.equal(collectionToggle.getAttribute('aria-pressed'), 'false');
  followToggle.click();
  assert.equal(followToggle.getAttribute('aria-pressed'), 'false');
  assert.ok(followToggle.classList.contains('inactive'));
  followToggle.click();
  assert.equal(followToggle.getAttribute('aria-pressed'), 'true');
  assert.ok(followToggle.classList.contains('active'));
  collectionToggle.click();
  assert.equal(window.document.querySelector('#form-estadoColeccion').value, 'COLECCIÓN');
  assert.equal(wantedToggle.getAttribute('aria-pressed'), 'false');
  const purchaseDate = window.document.querySelector('#form-fechaCompra');
  const purchasePrice = window.document.querySelector('#form-precioCompra');
  purchaseDate.value = '2024-01-15';
  purchasePrice.value = '12.50';
  wantedToggle.click();
  assert.equal(purchaseDate.value, '');
  assert.equal(purchasePrice.value, '');
  assert.equal(purchaseDate.disabled, true);
  assert.equal(purchasePrice.disabled, true);
  collectionToggle.click();
  assert.equal(purchaseDate.disabled, false);
  assert.equal(purchasePrice.disabled, false);
  wantedToggle.click();
  window.document.querySelector('#minifigura-form').dispatchEvent(
    new window.Event('submit', { bubbles: true, cancelable: true }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(submittedPayloads[0].estadoColeccion, 'BUSCADA');
  assert.equal('fechaCompra' in submittedPayloads[0], false);
  assert.equal('precioCompra' in submittedPayloads[0], false);
  window.document.querySelector('#form-cancel').click();

  window.document.querySelector('#new-minifigura').click();
  assert.equal(window.document.querySelector('#form-dialog').classList.contains('view-mode'), false);
  assert.equal(window.document.querySelector('#form-id').disabled, false);
  assert.equal(window.document.querySelector('#form-nombre').disabled, true);
  assert.equal(window.document.querySelector('#lookup-brickset'), null);
  assert.equal(window.document.querySelector('#form-submit').disabled, true);
  assert.equal(collectionToggle.getAttribute('aria-pressed'), 'true');
  assert.equal(followToggle.getAttribute('aria-pressed'), 'false');
  window.document.querySelector('#form-id').value = 'new-1';
  window.document.querySelector('#form-id').dispatchEvent(new window.Event('input'));
  window.document.querySelector('#form-preview-image').dispatchEvent(new window.Event('load'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  purchaseDate.value = '2024-02-20';
  purchasePrice.value = '25';
  wantedToggle.click();
  assert.equal(purchaseDate.value, '');
  assert.equal(purchasePrice.value, '');
  assert.equal(purchaseDate.disabled, true);
  assert.equal(purchasePrice.disabled, true);
  window.document.querySelector('#form-nombre').value = 'Nueva';
  window.document.querySelector('#minifigura-form').dispatchEvent(
    new window.Event('submit', { bubbles: true, cancelable: true }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(submittedPayloads[1].estadoColeccion, 'BUSCADA');
  assert.equal('fechaCompra' in submittedPayloads[1], false);
  assert.equal('precioCompra' in submittedPayloads[1], false);
  dom.window.close();
});