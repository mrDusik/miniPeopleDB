import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from '../src/server.js';
import { categoriasMockRaw } from '../test-support/fixtures.js';

const officialCategoriasRaw = categoriasMockRaw;
const officialCategoriaNames = JSON.parse(officialCategoriasRaw).map(({ categoria }) => categoria);
const officialCategoriaSet = new Set(officialCategoriaNames);

async function withServer(callback) {
  const directory = await mkdtemp(join(tmpdir(), 'minifiguras-web-'));
  const catalogPath = join(directory, 'minifiguras.json');
  const themesPath = join(directory, 'temas.json');
  await writeFile(catalogPath, JSON.stringify([
    {
      id: 'mf-web',
      nombre: 'Figura web',
      descripcion: 'Figura para probar la interfaz',
      categoria: 'Space',
      anio: 2023,
      estadoColeccion: 'COLECCIÓN',
      FechaRegistro: '2026-01-01T00:00:00.000Z',
      observada: false,
    },
  ]));
  await writeFile(themesPath, officialCategoriasRaw);

  const server = createServer({ catalogPath, themesPath });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
}

test('sirve la interfaz estatica y conserva la API del catalogo', async () => {
  await withServer(async (baseUrl) => {
    const page = await fetch(`${baseUrl}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /^text\/html/);
    assert.match(await page.text(), /id="filters-form"/);

    const styles = await fetch(`${baseUrl}/styles.css`);
    assert.equal(styles.status, 200);
    assert.match(styles.headers.get('content-type'), /^text\/css/);

    const script = await fetch(`${baseUrl}/app.js`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get('content-type'), /^text\/javascript/);

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

    for (const expected of ['name="id"', 'name="categoria"', '<option value="" selected>Todas</option>', 'name="subcategoria"', 'name="anio"', 'min="1978"', 'name="estadoColeccion"', '<option value="BUSCADA">🔍</option>', 'Buscar', 'Mostrar todo', 'id="catalog-body"']) {
      assert.match(html, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.match(html, /id="filter-coleccion"/);
      assert.match(html, /id="filter-buscada"/);
    }
    assert.ok(html.indexOf('name="nombre"') < html.indexOf('name="id"'));
    assert.match(html, /id="show-all"[^>]*>Mostrar todo<\/button>\s*<div class="form-actions">\s*<button type="submit" id="filter-submit"/);
    assert.match(html, /aria-label="Filtrar observadas"[^>]*title="Filtrar observadas"/);
    assert.match(html, /<span class="filter-symbol" aria-hidden="true">📦<\/span>/);
    assert.match(html, /<span class="filter-symbol" aria-hidden="true">🔍<\/span>/);
    assert.match(html, /<span class="eye-symbol" aria-hidden="true">👁️<\/span>/);
    assert.match(script, /URLSearchParams/);
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
    assert.match(css, /\.filter-toggle \.filter-symbol, \.filter-toggle \.eye-symbol\s*\{\s*font-size:\s*1\.25rem;\s*opacity:\s*0\.4/);
  assert.match(css, /\.eye-icon\s*\{[^}]*font-size:\s*1\.5rem/s);
  assert.match(css, /\.badge\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*font-size:\s*1\.5rem/s);
  assert.match(css, /\.actions-buttons\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*nowrap/s);
  assert.match(script, /actions\.className = 'actions-buttons'/);
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
  assert.match(css, /\.summary-row\s*\{[^}]*grid-template-columns:\s*minmax\(0, calc\(\(100% - 24px\) \/ 2\)\) auto minmax\(0, 1fr\)/s);
  assert.match(css, /\.collection-counts-panel\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /\.filter-state-toggles\s*\{[^}]*align-self:\s*end[^}]*min-height:\s*46px/s);
  assert.match(css, /\.filters-form > \.filter-toggle\s*\{[^}]*align-self:\s*end/);
  assert.match(css, /\.filters-form > #show-all\s*\{[^}]*align-self:\s*end/);
  assert.match(css, /\.filters-form \.form-actions\s*\{[^}]*grid-row:\s*1;[^}]*align-self:\s*end/);
  assert.match(css, /\.modal-preview img\s*\{[^}]*object-fit:\s*contain;\s*\}/);
  assert.match(css, /\.collection-summary-content strong\s*\{[^}]*font:\s*700 1\.2rem Arial, sans-serif/s);
  assert.match(css, /\.gamification-level strong\s*\{[^}]*font-size:\s*1\.2rem/s);
  assert.match(css, /\.gamification-meter > span\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /\.toast-task\s*\{[^}]*background:\s*var\(--blue\)/s);
  assert.match(css, /\.toast-level\s*\{[^}]*background:\s*var\(--accent\)/s);
  assert.match(css, /\.toast-success\s*\{[^}]*background:\s*var\(--surface\)/s);
  assert.match(css, /#form-dialog\.view-mode \.state-toggle\.active:disabled[^}]*opacity:\s*1/s);
  assert.match(css, /#form-dialog\.view-mode \.state-toggle:disabled, #form-dialog\.view-mode \.eye-icon:disabled\s*\{[^}]*color:\s*inherit/s);
  assert.match(css, /\.button-danger\s*\{[^}]*background:\s*var\(--accent\)/s);
  assert.match(css, /\.watchlist-panel\s*\{[^}]*border-top:\s*4px solid var\(--accent\)/s);
  assert.match(css, /\.gamification-summary\s*\{[^}]*border-bottom:\s*4px solid var\(--blue\)/s);
  assert.match(css, /\.collection-counts-panel\s*\{[^}]*border-bottom:\s*4px solid var\(--blue\)/s);
  assert.match(css, /\.collection-summary\s*\{[^}]*border-bottom:\s*4px solid var\(--blue\)/s);
  assert.doesNotMatch(css, /\.collection-summary\s*\{[^}]*border-left:\s*6px solid var\(--accent\)/s);
  assert.match(css, /\.gamification-meter > span\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /\.button-danger\s*\{[^}]*background:\s*var\(--accent\)/s);
  assert.match(css, /\.watchlist-panel\s*\{[^}]*border-top:\s*4px solid var\(--accent\)/s);
  assert.match(css, /\.gamification-summary\s*\{[^}]*border-bottom:\s*4px solid var\(--blue\)/s);
  assert.match(css, /\.collection-counts-panel\s*\{[^}]*border-bottom:\s*4px solid var\(--blue\)/s);
  assert.match(css, /\.collection-summary\s*\{[^}]*border-bottom:\s*4px solid var\(--blue\)/s);
  assert.doesNotMatch(css, /\.collection-summary\s*\{[^}]*border-left:\s*6px solid var\(--accent\)/s);
  assert.doesNotMatch(css, /\.page-header\s*\{[^}]*border-bottom:\s*6px solid var\(--yellow\)/s);
  assert.doesNotMatch(css, /\.top-five\s*\{[^}]*border-top:\s*4px solid var\(--yellow\)/s);
});

test('la pagina referencia los modales, las acciones por fila y el contenedor de toasts', async () => {
  await withServer(async (baseUrl) => {
    const html = await (await fetch(`${baseUrl}/`)).text();

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
      'id="lookup-brickset"',
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
      'BY MRDUSIK',
      'id="delete-dialog"',
      'id="delete-confirm"',
      'id="delete-cancel"',
      'id="toast-region"',
    ]) {
      assert.match(html, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    const document = new JSDOM(html).window.document;
    const summaryRow = document.querySelector('.summary-row');
    assert.equal(summaryRow.children[0].className, 'gamification-summary');
    assert.equal(summaryRow.children[1].className, 'collection-counts-panel');
    assert.equal(summaryRow.children[2].className, 'collection-summary');
    const countsPanel = summaryRow.children[1];
    assert.equal(countsPanel.querySelectorAll(':scope > span').length, 2);
    for (const count of countsPanel.children) assert.deepEqual([...count.children].map((element) => element.tagName), ['SPAN', 'STRONG']);
    const collectionSummary = summaryRow.children[2];
    assert.equal(collectionSummary.children[0].className, 'collection-summary-content');
    assert.equal(collectionSummary.children[1].id, 'sync-prices');
    assert.equal(document.querySelector('#sync-prices').textContent, '🔄');
    assert.ok(document.querySelector('#sync-prices').classList.contains('button-secondary'));
    assert.equal(document.querySelector('#lookup-brickset').textContent, '🔄');
    assert.ok(document.querySelector('#lookup-brickset').classList.contains('button-secondary'));
    assert.equal(document.querySelector('.brand-heading').lastElementChild.textContent, 'BY MRDUSIK');
    assert.equal(document.querySelector('.modal-preview span').textContent, 'Preview');
  });
});

test('el modal distribuye los campos en filas y mantiene preview y acciones en dos columnas', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const dom = new JSDOM(html);
  const form = dom.window.document.querySelector('#minifigura-form');

  for (const [rowSelector, fieldIds] of [
    ['.modal-row-identity', ['form-id', 'lookup-brickset', 'form-nombre']],
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
  assert.deepEqual([...identityRow.children].map((element) => element.id), [
    'form-id-label', 'form-id', 'lookup-brickset', 'form-nombre-label', 'form-nombre',
  ]);
  assert.equal(identityRow.parentElement.className, 'modal-form-column');
  assert.equal(identityRow.getAttribute('style'), null);
  assert.equal(form.querySelector('#form-dialog-title').parentElement, form.querySelector('.modal-preview-heading'));
  assert.equal(form.querySelector('#form-dialog-title').textContent, 'Nueva minifigura');
  assert.equal(form.querySelector('.modal-preview img').id, 'form-preview-image');
  assert.equal(form.querySelector('.form-actions').parentElement, form);
  assert.match(css, /\.modal form\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 250px;[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto/s);
  assert.match(css, /\.modal-row\.modal-row-identity\s*\{[^}]*grid-column:\s*1;[^}]*grid-template-columns:\s*max-content minmax\(0, 1fr\) 40px max-content minmax\(0, 1fr\)/s);
  assert.match(css, /\.modal-preview-heading\s*\{[^}]*justify-items:\s*center[^}]*text-align:\s*center/s);
  assert.match(css, /\.modal-preview-heading\s*\{[^}]*align-self:\s*start/s);
  assert.match(css, /#form-dialog-title\s*\{[^}]*text-align:\s*center/s);
  assert.match(css, /\.modal-preview-heading > span\s*\{[^}]*text-align:\s*center/s);
  assert.match(css, /#form-dialog\.view-mode input:disabled[^}]*background:\s*#ecebe6/s);
  assert.match(css, /#form-dialog\.view-mode \.modal-row-identity\s*\{[^}]*grid-template-columns:\s*max-content minmax\(0, 1fr\) max-content minmax\(0, 1fr\)/s);
  assert.match(css, /#form-dialog\.view-mode #lookup-brickset\s*\{\s*display:\s*none/);
  assert.match(css, /#form-dialog\.view-mode #form-dialog-title\s*\{\s*display:\s*none/);
  assert.match(css, /#form-dialog\.view-mode input:disabled[^}]*background:\s*#ecebe6/s);
  assert.match(css, /#form-dialog\.view-mode \.required-label > span::after[^}]*content:\s*''/s);
  assert.match(css, /#form-dialog\s*\{[^}]*height:\s*fit-content/);
  assert.doesNotMatch(css, /#form-dialog #minifigura-form\s*\{[^}]*height:/);
  assert.match(css, /\.modal-form-column\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1 \/ 3;[^}]*grid-template-rows:\s*auto auto auto/s);
  assert.match(css, /\.modal-preview\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*2;[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\);[^}]*align-content:\s*stretch/s);
  assert.match(css, /\.form-actions\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*3;/s);
  assert.match(css, /#form-dialog\s*\{[^}]*overflow:\s*hidden/s);
  assert.doesNotMatch(css, /\.modal-form-column\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /#form-dialog\s*\{[^}]*height:\s*fit-content/s);
  assert.doesNotMatch(css, /#form-dialog #minifigura-form\s*\{[^}]*height:/s);
  assert.match(css, /\.modal label\s*\{\s*gap:\s*4px;\s*font-size:\s*0\.68rem/);
  assert.match(css, /\.modal-preview img\s*\{\s*width:\s*100px;\s*height:\s*100px/);
  assert.match(css, /@media \(max-width:\s*360px\)\s*\{[^}]*#form-dialog #minifigura-form\s*\{[^}]*gap:\s*4px/s);
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
    assert.match(script, /setSyncLoading/);
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

    assert.match(script, /fetch\((['"`])\/minifiguras/, 'El script del cliente debe invocar el endpoint de la API');  });
});

test('la interfaz renderiza diferencias, ordena columnas y conserva el estado por defecto en edición', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const catalog = [
    { id: 'a', nombre: 'A', descripcion: 'A', categoria: 'Space', subcategoria: undefined, anio: 2024, estadoColeccion: 'COLECCIÓN', precioCompra: 10, precio: 15 },
    { id: 'b', nombre: 'B', descripcion: 'B', categoria: 'Collectible Minifigures', subcategoria: 'Team GB', anio: 2022, estadoColeccion: 'BUSCADA', precioCompra: 5, precio: 50 },
    { id: 'c', nombre: 'C', descripcion: 'C', categoria: 'Space', anio: 2023, precioCompra: 20 },
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
    ['Collectible Minifigures (1)', 'Space (2)'],
  );
  assert.equal(rows()[0].children[9].textContent, '5,00 €');
  assert.equal(rows()[1].children[9].textContent, 'N/A');
  assert.equal(rows()[2].children[9].textContent, '?');
  assert.equal(rows()[0].children[7].querySelector('.badge').textContent, '📦');
  assert.equal(rows()[0].children[7].querySelector('.badge').getAttribute('aria-label'), '📦');
  assert.equal(rows()[1].children[7].querySelector('.badge').textContent, '🔍');
  assert.equal(rows()[1].children[7].querySelector('.badge').getAttribute('aria-label'), '🔍');
  assert.ok(rows()[0].children[9].querySelector('.difference-positive'));  assert.equal(rows()[0].children[4].textContent, 'Space');
  assert.equal(rows()[0].children[5].textContent, '');
  assert.equal(rows()[1].children[4].textContent, 'Collectible Minifigures');
  assert.equal(rows()[1].children[5].textContent, 'Team GB');
  window.document.querySelector('[data-sort="anio"]').click();
  assert.deepEqual(rows().map((row) => row.children[2].textContent), ['b', 'c', 'a']);
  window.document.querySelector('[data-sort="precio"]').click();
  assert.deepEqual(rows().map((row) => row.children[2].textContent), ['a', 'b', 'c']);
  window.document.querySelector('[data-sort="precio"]').click();
  assert.deepEqual(rows().map((row) => row.children[2].textContent), ['b', 'a', 'c']);

  const editButton = rows().find((row) => row.children[2].textContent === 'c').querySelector('[data-action="edit"]');
  editButton.click();
  assert.equal(window.document.querySelector('#form-estadoColeccion').value, '');
  dom.window.close();
});

test('Nueva minifigura, Editar y Eliminar se muestran como iconos sin texto visible y con aria-label', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
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
  dom.window.close();
});

test('la interfaz muestra imágenes en la tabla y tarjetas de ranking', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
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
    assert.equal(window.document.querySelector('#image-modal').hidden, true);
    window.document.querySelector('#form-cancel').click();
  }
  thumbnail.click();
  assert.equal(window.document.querySelector('#image-modal').hidden, false);
  assert.equal(window.document.querySelector('#image-modal-title').textContent, 'ST008');
  assert.equal(window.document.querySelector('#image-modal-name').textContent, 'Demogorgon');
  assert.doesNotMatch(window.document.querySelector('#image-modal-title').textContent, /Minifigura:/);
  window.document.querySelector('#image-modal-close').click();
  assert.equal(window.document.querySelector('#image-modal-name').textContent, '');
  assert.equal(window.document.querySelector('#image-modal').hidden, true);
  dom.window.close();
});

test('los filtros muestran los toggles de estado, limitan el año y listan los temas', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
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
    ['Todas (2)', 'Castle (1)', 'Space (1)'],
  );
  assert.equal(window.document.querySelector('#anio').min, '1978');
  assert.equal(window.document.querySelector('#anio').max, String(new Date().getFullYear()));
  dom.window.close();
});

test('los toggles 📦 y 🔍 filtran por estado individualmente o muestran ambos', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  const catalogRequests = [];
  window.fetch = async (url) => {
    if (url.startsWith('/minifiguras')) catalogRequests.push(url);
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 0, enColeccion: 0, buscadas: 0 }) };
    return { ok: true, json: async () => [] };
  };

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const collectionToggle = window.document.querySelector('#filter-coleccion');
  const wantedToggle = window.document.querySelector('#filter-buscada');
  const submitFilters = async () => {
    window.document.querySelector('#filters-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    return new URL(catalogRequests.at(-1), 'http://localhost').searchParams.get('estadoColeccion');
  };

  collectionToggle.checked = true;
  assert.equal(await submitFilters(), 'COLECCIÓN');
  wantedToggle.checked = true;
  assert.equal(await submitFilters(), null);
  collectionToggle.checked = false;
  assert.equal(await submitFilters(), 'BUSCADA');
  dom.window.close();
});

test('el select de subcategoria depende de la categoria seleccionada en el filtro', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
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
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
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
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
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
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
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
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.fetch = async (url) => {
    if (url === '/categorias') return { ok: true, json: async () => [] };
    if (url === '/sincronizacion/brickset') return { ok: true, json: async () => ({ actualizados: [], fallidos: [], total: 0 }) };
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
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
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

test('la sincronización deshabilita los botones mientras está en curso', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
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
  const syncPending = new Promise((resolve) => { releaseSync = resolve; });
  window.fetch = async (url) => {
    if (url === '/sincronizacion/brickset') return syncPending;
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
  assert.ok([...window.document.querySelectorAll('button')].every((button) => button.disabled));
  releaseSync({ ok: true, json: async () => ({ actualizados: [], fallidos: [], total: 0 }) });
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (const selector of [
    '#show-all',
    '#new-minifigura',
    '#sync-prices',
    '.table-sort',
    '#lookup-brickset',
    '#form-cancel',
    '#delete-cancel',
    '[data-action="edit"]',
    '[data-action="delete"]',
  ]) {
    assert.equal(window.document.querySelector(selector).disabled, false, `${selector} debe reactivarse`);
  }
  dom.window.close();
});

test('la sincronización mantiene bloqueadas las acciones creadas al refrescar el catálogo', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
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
    if (url === '/sincronizacion/brickset') return { ok: true, json: async () => ({ actualizados: [], fallidos: [], total: 1 }) };
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

  assert.equal(window.document.querySelector('[data-action="edit"]').disabled, true);
  assert.equal(window.document.querySelector('[data-action="delete"]').disabled, true);
  assert.equal(window.document.querySelector('#categoria').disabled, true);
  assert.equal(window.document.querySelector('#new-minifigura').disabled, true);
  assert.equal(window.document.querySelector('#sync-prices').disabled, true);

  releaseSummary({
    ok: true,
    json: async () => ({ total: 0, enColeccion: 1, buscadas: 0, top5: [], top5Antiguas: [] }),
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(window.document.querySelector('[data-action="edit"]').disabled, false);
  assert.equal(window.document.querySelector('[data-action="delete"]').disabled, false);
  assert.equal(window.document.querySelector('#categoria').disabled, false);
  assert.equal(window.document.querySelector('#new-minifigura').disabled, false);
  assert.equal(window.document.querySelector('#sync-prices').disabled, false);
  dom.window.close();
});

test('la creación desde el formulario normaliza el estado vacío a COLECCIÓN', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  assert.ok(officialCategoriaSet.has('Space'));
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  let submittedPayload;
  window.fetch = async (url, options = {}) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/minifiguras' && options.method === 'POST') {
      submittedPayload = JSON.parse(options.body);
      return { ok: true, status: 201, json: async () => submittedPayload };
    }
    if (url === '/minifiguras/new-figure/brickset') {
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
  window.document.querySelector('#lookup-brickset').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  window.document.querySelector('#form-nombre').value = 'Nueva';
  window.document.querySelector('#form-estadoColeccion').value = '';
  window.document.querySelector('#minifigura-form').dispatchEvent(
    new window.Event('submit', { bubbles: true, cancelable: true }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(submittedPayload.estadoColeccion, 'COLECCIÓN');
  dom.window.close();
});

test('la interfaz muestra y alterna la watchlist con el orden del resumen', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  const catalog = [
    { id: 'HIGH', nombre: 'Alta', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN', precio: 30, observada: true },
    { id: 'LOW', nombre: 'Baja', categoria: 'Space', anio: 2023, estadoColeccion: 'BUSCADA', precio: 10, observada: false },
  ];
  const valuation = { total: 30, enColeccion: 1, buscadas: 1, top5: [], top5Antiguas: [], observadas: [{ id: 'HIGH', nombre: 'Alta', estadoColeccion: 'COLECCIÓN', precioBrickset: 30 }] };
  window.fetch = async (url, options = {}) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/valoracion') return { ok: true, json: async () => valuation };
    if (url.includes('/observada') && options.method === 'PUT') {
      return { ok: true, json: async () => ({ ...catalog[1], observada: true }) };
    }
    return { ok: true, json: async () => catalog };
  };

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(window.document.querySelector('.eye-icon.active').dataset.id, 'HIGH');
  assert.equal(window.document.querySelectorAll('.watchlist-card').length, 1);
  assert.match(window.document.querySelector('.watchlist-card span').textContent, /^📦 HIGH 30,00/);
  assert.equal(window.document.querySelector('#collection-count').textContent, '1');
  assert.equal(window.document.querySelector('#wanted-count').textContent, '1');

  window.document.querySelector('.eye-icon.inactive').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(window.document.querySelectorAll('.eye-icon.active').length, 2);
  dom.window.close();
});

test('el modal aplica los modos de alta y visualizacion', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  const catalog = [{ id: 'VIEW-1', nombre: 'Vista', categoria: 'Space', anio: 2024, estadoColeccion: 'BUSCADA', precio: 20, observada: true }];
  window.fetch = async (url) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 20, enColeccion: 1, buscadas: 0, top5: [], top5Antiguas: [], observadas: [] }) };
    if (url.endsWith('/brickset')) return { ok: true, json: async () => ({ id: 'NEW-1', categoria: 'Space', anio: 2024, precio: 18 }) };
    return { ok: true, json: async () => catalog };
  };

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  window.document.querySelector('.id-link').click();
  assert.ok(window.document.querySelector('#form-dialog').classList.contains('view-mode'));
  assert.ok(window.document.querySelector('.modal-row-identity').classList.contains('view-mode'));
  assert.equal(window.document.querySelector('#form-dialog-title').hidden, true);
  assert.equal(window.document.querySelector('#form-submit').hidden, true);
  assert.equal(window.document.querySelector('#lookup-brickset').hidden, true);
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
  assert.equal(followToggle.disabled, true);
  assert.equal(followToggle.getAttribute('aria-pressed'), 'true');
  assert.ok(followToggle.classList.contains('active'));
  collectionToggle.click();
  followToggle.click();
  assert.equal(wantedToggle.getAttribute('aria-pressed'), 'true');
  assert.equal(followToggle.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(
    [...window.document.querySelectorAll('#minifigura-form input, #minifigura-form select, #minifigura-form textarea, #minifigura-form button')]
      .filter((control) => control.id !== 'form-cancel' && !control.disabled),
    [],
  );
  window.document.querySelector('#form-cancel').click();

  window.document.querySelector('[data-action="edit"]').click();
  assert.equal(window.document.querySelector('#form-dialog').classList.contains('view-mode'), false);
  assert.equal(window.document.querySelector('#lookup-brickset').hidden, false);
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
  window.document.querySelector('#form-cancel').click();

  window.document.querySelector('#new-minifigura').click();
  assert.equal(window.document.querySelector('#form-dialog').classList.contains('view-mode'), false);
  assert.equal(window.document.querySelector('#form-id').disabled, false);
  assert.equal(window.document.querySelector('#form-nombre').disabled, true);
  assert.equal(window.document.querySelector('#lookup-brickset').disabled, true);
  assert.equal(window.document.querySelector('#form-submit').disabled, true);
  assert.equal(collectionToggle.getAttribute('aria-pressed'), 'true');
  assert.equal(followToggle.getAttribute('aria-pressed'), 'false');
  dom.window.close();
});