import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from '../src/server.js';

const officialCategoriasRaw = await readFile(
  new URL('../data/categorias-brickset.json', import.meta.url),
  'utf8',
);
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
      id: 'mf-web',
      nombre: 'Figura web',
      descripcion: 'Figura para probar la interfaz',
      categoria: 'Space',
      anio: 2023,
      estadoColeccion: 'COLECCIÓN',
    }]);
  });
});

test('la pagina referencia controles y estados necesarios para la consulta', async () => {
  await withServer(async (baseUrl) => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    const script = await (await fetch(`${baseUrl}/app.js`)).text();

    for (const expected of ['name="id"', 'name="categoria"', '<option value="" selected>Todas</option>', 'name="subcategoria"', 'name="anio"', 'min="1978"', 'name="estadoColeccion"', '<option value="BUSCADA">BUSCADA</option>', 'Buscar', 'Mostrar todo', 'id="catalog-body"']) {
      assert.match(html, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.match(script, /URLSearchParams/);
    assert.match(script, /replaceChildren/);
    assert.match(script, /No se pudo cargar el catálogo/);
  });
});

test('la tabla no muestra la columna Descripción y muestra Categoría y Subcategoría', async () => {
  await withServer(async (baseUrl) => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    assert.doesNotMatch(html, /<th scope="col">Descripción<\/th>/);
    assert.match(html, /<th scope="col">Categoría<\/th>/);
    assert.match(html, /<th scope="col">Subcategoría<\/th>/);
  });
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
      '<select id="form-estadoColeccion" name="estadoColeccion">',
      'name="precioCompra"',
      'name="fechaCompra"',
      'name="precio"',
      'id="lookup-brickset"',
      'id="sync-prices"',
      'id="collection-total"',
      'id="collection-count"',
      'id="wanted-count"',
      'id="top-five-list"',
      'Top 5 minifiguras en colección por precio',
      'id="oldest-five-list"',
      'Top 5 minifiguras más antiguas',
      'Diferencia',
      'data-sort="anio"',
      'data-sort="precio"',
      'Valor Total de la Colección',
      'id="delete-dialog"',
      'id="delete-confirm"',
      'id="delete-cancel"',
      'id="toast-region"',
    ]) {
      assert.match(html, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });
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
    officialCategoriaNames,
  );
  assert.equal(rows()[0].children[8].textContent, '5,00 €');
  assert.equal(rows()[1].children[8].textContent, 'N/A');
  assert.equal(rows()[2].children[8].textContent, '?');
  assert.ok(rows()[0].children[8].querySelector('.difference-positive'));  assert.equal(rows()[0].children[3].textContent, 'Space');
  assert.equal(rows()[0].children[4].textContent, '');
  assert.equal(rows()[1].children[3].textContent, 'Collectible Minifigures');
  assert.equal(rows()[1].children[4].textContent, 'Team GB');
  window.document.querySelector('[data-sort="anio"]').click();
  assert.deepEqual(rows().map((row) => row.children[1].textContent), ['b', 'c', 'a']);
  window.document.querySelector('[data-sort="precio"]').click();
  assert.deepEqual(rows().map((row) => row.children[1].textContent), ['a', 'b', 'c']);
  window.document.querySelector('[data-sort="precio"]').click();
  assert.deepEqual(rows().map((row) => row.children[1].textContent), ['b', 'a', 'c']);

  const editButton = rows().find((row) => row.children[1].textContent === 'c').querySelector('[data-action="edit"]');
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
  assert.ok(officialCategoriaSet.has('Stranger Things'));
  const catalog = [{
    id: 'ST008', nombre: 'Demogorgon', descripcion: 'Figura', categoria: 'Stranger Things',
    anio: 2019, estadoColeccion: 'COLECCIÓN', precio: 109.56,
  }];
  window.fetch = async (url) => {
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(officialCategoriasRaw) };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 109.56, enColeccion: 1, buscadas: 0, top5: catalog, top5Antiguas: catalog }) };
    return { ok: true, json: async () => catalog };
  };

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const thumbnail = window.document.querySelector('.table-thumb');
  assert.equal(thumbnail.src, 'https://img.bricklink.com/ItemImage/MN/0/st008.png');
  assert.equal(thumbnail.dataset.action, 'preview');
  assert.equal(window.document.querySelectorAll('.ranking-card').length, 2);
  assert.equal(window.document.querySelector('#image-modal').hidden, true);
  dom.window.close();
});

test('los filtros muestran todos los estados, limitan el año y listan los temas', async () => {
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

  assert.equal(window.document.querySelector('#estadoColeccion').value, '');
  assert.deepEqual(
    [...window.document.querySelectorAll('#categoria option')].map((option) => option.textContent),
    ['Todas', ...officialCategoriaNames],
  );
  assert.equal(window.document.querySelector('#anio').min, '1978');
  assert.equal(window.document.querySelector('#anio').max, String(new Date().getFullYear()));
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
    return { ok: true, json: async () => [] };
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
  window.document.querySelector('#form-nombre').value = 'Nueva';
  window.document.querySelector('#form-categoria').value = 'Space';
  window.document.querySelector('#form-anio').value = '2024';
  window.document.querySelector('#form-estadoColeccion').value = '';
  window.document.querySelector('#minifigura-form').dispatchEvent(
    new window.Event('submit', { bubbles: true, cancelable: true }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(submittedPayload.estadoColeccion, 'COLECCIÓN');
  dom.window.close();
});