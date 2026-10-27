import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { BricksetCategoriasError, BricksetCategoriasScraper, parseBricksetCategorias, parseBricksetCollectibleMinifiguresPage, summarizeBricksetCollectibleMinifiguresYears } from '../src/brickset-categorias-scraper.js';
import { syncCategorias } from '../scripts/sync-brickset-categorias.js';
import { CategoriasInvalidosError, CategoriasNoDisponiblesError, CategoriasPersistenciaError, CategoriasRepository, validateCategorias } from '../src/categorias-repository.js';
import { createServer, startApplication } from '../src/server.js';
import { categoriasMock } from '../test-support/fixtures.js';

const validHtml = `
  <a href="/minifigs/category-Jurassic-World">Jurassic World</a> (154)
  <a href="/minifigs/category-Collectible-Minifigures">Collectible Minifigures</a> (845)
  <a href="/minifigs/category-Pokemon">Pok&eacute;mon</a> (1)
`;

function listingRecord(id, subcategoria, anio) {
  return `<h1><a href='/minifigs/${id}/figure'>${id}</a></h1><div class='tags floatleft'>
    <a href='/minifigs/category-Collectible-Minifigures'>Collectible Minifigures</a>
    <a href='/minifigs/category-Collectible-Minifigures/subcategory-series'>${subcategoria}</a>
    ${anio === null ? '' : `<a href='/minifigs/category-Collectible-Minifigures/year-${anio}'>${anio}</a>`}
  </div>`;
}

function listingPage({ page, start, end, total, totalPages, records }) {
  const lastPage = page === 1 ? `<a href='/minifigs/category-Collectible-Minifigures/page-${totalPages}'>${totalPages}</a>` : '';
  return `<div>${start} to ${end} of ${total} matches</div>${records.join('')}${lastPage}`;
}

test('el fixture de categorías representa categorías y subcategorías válidas', () => {
  assert.doesNotThrow(() => validateCategorias(categoriasMock));
  const collectible = categoriasMock.find(({ categoria }) => categoria === 'Collectible Minifigures');
  assert.deepEqual(collectible.subcategorias.map(({ subcategoria }) => subcategoria), [
    'Team GB',
    'The LEGO Movie',
    'Series 3 Minifigures',
    'Series 17 Minifigures',
  ]);
});

test('validateCategorias acepta subcategorias sin total o con total 0 y rechaza totales invalidos', () => {
  assert.doesNotThrow(() => validateCategorias([
    { categoria: 'A', total: 10, subcategorias: [{ subcategoria: 'A1' }, { subcategoria: 'A2', total: 0 }, { subcategoria: 'A3', total: 5 }] },
  ]));
  assert.throws(() => validateCategorias([
    { categoria: 'A', total: 10, subcategorias: [{ subcategoria: 'A1', total: -1 }] },
  ]), (error) => error instanceof CategoriasInvalidosError);
  assert.throws(() => validateCategorias([
    { categoria: 'A', total: 10, subcategorias: [{ subcategoria: 'A1', total: '5' }] },
  ]), (error) => error instanceof CategoriasInvalidosError);
  assert.throws(() => validateCategorias([
    { categoria: 'A', total: 10, subcategorias: ['A1'] },
  ]), (error) => error instanceof CategoriasInvalidosError);
});

test('CategoriasRepository lee anioInicio opcional y rechaza años invalidos o fuera de Collectible Minifigures', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'categorias-anio-inicio-'));
  const filePath = join(directory, 'categorias.json');
  const repository = new CategoriasRepository(filePath);
  const categorias = [
    { categoria: 'Collectible Minifigures', total: 845, subcategorias: [
      { subcategoria: 'Series 1', total: 16, anioInicio: 2010 },
      { subcategoria: 'Series 19', anioInicio: 2019, anioInicioEstimado: true },
      { subcategoria: 'Legacy Series', total: 8 },
    ] },
  ];
  try {
    await writeFile(filePath, JSON.stringify(categorias));
    assert.deepEqual(await repository.read(), categorias);
    for (const anioInicio of [0, -1, 2010.5, '2010']) {
      assert.throws(() => validateCategorias([{
        categoria: 'Collectible Minifigures', total: 10,
        subcategorias: [{ subcategoria: 'Series', anioInicio }],
      }]), (error) => error instanceof CategoriasInvalidosError);
    }
      assert.throws(() => validateCategorias([{
        categoria: 'Collectible Minifigures', total: 10,
        subcategorias: [{ subcategoria: 'Estimated without year', anioInicioEstimado: true }],
      }]), (error) => error instanceof CategoriasInvalidosError);
      assert.throws(() => validateCategorias([{
        categoria: 'Collectible Minifigures', total: 10,
        subcategorias: [{ subcategoria: 'Invalid estimate flag', anioInicio: 2010, anioInicioEstimado: 'true' }],
      }]), (error) => error instanceof CategoriasInvalidosError);
    assert.throws(() => validateCategorias([{
      categoria: 'Space', total: 10, subcategorias: [{ subcategoria: 'Series', anioInicio: 2010 }],
    }]), (error) => error instanceof CategoriasInvalidosError);
    assert.doesNotThrow(() => validateCategorias([{
      categoria: 'Collectible Minifigures', total: 10,
      subcategorias: [{ subcategoria: 'Series', total: 10, anioInicio: 2010 }],
    }]));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Brickset calcula el año minimo de series y Other solo con todas las paginas', async () => {
  const pageOne = parseBricksetCollectibleMinifiguresPage(listingPage({
    page: 1, start: 1, end: 2, total: 3, totalPages: 2,
    records: [listingRecord('COL001', 'Series A', 2020), listingRecord('OTHER001', 'Collectible Minifigures Other', 2013)],
  }));
  const pageTwo = parseBricksetCollectibleMinifiguresPage(listingPage({
    page: 2, start: 3, end: 3, total: 3, totalPages: 2,
    records: [listingRecord('COL002', 'Series A', 2018)],
  }), 2, pageOne.pageSize);
  const expectedSubcategories = ['Series A', 'Collectible Minifigures Other'];
  const complete = summarizeBricksetCollectibleMinifiguresYears([pageOne, pageTwo], expectedSubcategories);

  assert.equal(complete.estado, 'complete');
  assert.deepEqual(complete.series.map(({ subcategoria, anioInicio }) => [subcategoria, anioInicio]), [
    ['Series A', 2018], ['Collectible Minifigures Other', 2013],
  ]);

  const partial = summarizeBricksetCollectibleMinifiguresYears([pageOne], expectedSubcategories);
  assert.equal(partial.estado, 'incomplete');
  assert.deepEqual(partial.series.map(({ anioInicio }) => anioInicio), [null, null]);
  assert.throws(() => parseBricksetCollectibleMinifiguresPage(listingPage({
    page: 1, start: 1, end: 2, total: 3, totalPages: 2,
    records: [listingRecord('COL001', 'Series A', 2020)],
  })), (error) => error.code === 'BRICKSET_SERIES_COBERTURA_INCOMPLETA');
});

test('Brickset estima con el mínimo observado de la misma serie y enumera registros sin año', () => {
  const firstPage = parseBricksetCollectibleMinifiguresPage(listingPage({
    page: 1, start: 1, end: 2, total: 4, totalPages: 2,
    records: [listingRecord('COL001', 'Series A', 2020), listingRecord('COL002', 'Series A', 2018)],
  }));
  const lastPage = parseBricksetCollectibleMinifiguresPage(listingPage({
    page: 2, start: 3, end: 4, total: 4, totalPages: 2,
    records: [listingRecord('COL003', 'Series B', 2021), listingRecord('COL004', 'Series B', null)],
  }), 2, firstPage.pageSize);
  const report = summarizeBricksetCollectibleMinifiguresYears([firstPage, lastPage], ['Series A', 'Series B']);

  assert.equal(report.estado, 'incomplete');
  assert.deepEqual(report.series.map(({ subcategoria, anioInicio, anioInicioEstimado, idsSinAnio, coberturaCompleta }) => [
    subcategoria, anioInicio, anioInicioEstimado, idsSinAnio, coberturaCompleta,
  ]), [
    ['Series A', 2018, false, [], true],
    ['Series B', 2021, true, ['COL004'], false],
  ]);
  assert.deepEqual(report.fuentes.map(({ pagina }) => pagina), [1, 2]);
});

test('Brickset espacia las peticiones paginadas según el intervalo configurado', async () => {
  let now = 0;
  const waits = [];
  const firstPage = listingPage({
    page: 1, start: 1, end: 1, total: 2, totalPages: 2,
    records: [listingRecord('COL001', 'Series A', 2020)],
  });
  const secondPage = listingPage({
    page: 2, start: 2, end: 2, total: 2, totalPages: 2,
    records: [listingRecord('COL002', 'Series A', 2018)],
  });
  const scraper = new BricksetCategoriasScraper({
    minIntervalMs: 9000,
    now: () => now,
    sleep: async (duration) => { waits.push(duration); now += duration; },
    fetchImpl: async (url) => new Response(url.endsWith('/page-2') ? secondPage : firstPage),
  });

  const report = await scraper.fetchCollectibleMinifigureSeriesYears(['Series A']);
  assert.equal(report.estado, 'complete');
  assert.deepEqual(waits, [9000]);
});

test('completa un año ausente en el listado solo si la ficha Brickset lo publica', async () => {
  const page = listingPage({
    page: 1, start: 1, end: 2, total: 2, totalPages: 1,
    records: [listingRecord('COL001', 'Series A', 2020), listingRecord('COL002', 'Series A', null)],
  });
  const scraper = new BricksetCategoriasScraper({
    minIntervalMs: 0,
    fetchImpl: async (url) => url.endsWith('/COL002')
      ? new Response('<dl><dt>Year released</dt><dd>2017</dd></dl>')
      : new Response(page),
  });
  const report = await scraper.fetchCollectibleMinifigureSeriesYears(['Series A']);

  assert.equal(report.estado, 'complete');
  assert.equal(report.series[0].anioInicio, 2017);
  assert.equal(report.series[0].registrosSinAnio, 0);
  assert.deepEqual(report.detallesConsultados, [{
    id: 'COL002', url: 'https://brickset.com/minifigs/COL002', year: 2017,
  }]);
  assert.deepEqual(report.detallesSinAnio, []);
});

test('una ficha sin Year released deja incompleta la serie sin inventar un año', async () => {
  const page = listingPage({
    page: 1, start: 1, end: 1, total: 1, totalPages: 1,
    records: [listingRecord('COL001', 'Series A', null)],
  });
  const scraper = new BricksetCategoriasScraper({
    minIntervalMs: 0,
    fetchImpl: async (url) => url.endsWith('/COL001')
      ? new Response('<dl><dt>Name</dt><dd>Unknown</dd></dl>')
      : new Response(page),
  });
  const report = await scraper.fetchCollectibleMinifigureSeriesYears(['Series A']);

  assert.equal(report.estado, 'incomplete');
  assert.equal(report.series[0].anioInicio, null);
  assert.equal(report.detallesSinAnio[0].error, 'BRICKSET_SERIES_DETAIL_YEAR_MISSING');
});

test('Brickset informa una página bloqueada sin publicar mínimos parciales', async () => {
  const firstPage = listingPage({
    page: 1, start: 1, end: 2, total: 3, totalPages: 2,
    records: [listingRecord('COL001', 'Series A', 2020), listingRecord('OTHER001', 'Collectible Minifigures Other', 2013)],
  });
  const scraper = new BricksetCategoriasScraper({
    minIntervalMs: 0,
    fetchImpl: async (url) => url.endsWith('/page-2')
      ? new Response('blocked', { status: 503 })
      : new Response(firstPage),
  });
  const report = await scraper.fetchCollectibleMinifigureSeriesYears(['Series A', 'Collectible Minifigures Other']);

  assert.equal(report.estado, 'incomplete');
  assert.deepEqual(report.paginaFallida, { page: 2, code: 'BRICKSET_SERIES_HTTP' });
  assert.deepEqual(report.series.map(({ anioInicio }) => anioInicio), [null, null]);
});

test('parseBricksetCategorias extrae nombres y totales en el orden de Brickset', () => {
  assert.deepEqual(parseBricksetCategorias(validHtml), [
    { categoria: 'Jurassic World', total: 154, subcategorias: [] },
    { categoria: 'Collectible Minifigures', total: 845, subcategorias: [] },
    { categoria: 'Pokémon', total: 1, subcategorias: [] },
  ]);
});

test('parseBricksetCategorias rechaza HTML incompleto o duplicado', () => {
  assert.throws(() => parseBricksetCategorias('<html>sin categorias</html>'), (error) => error instanceof BricksetCategoriasError);
  assert.throws(() => parseBricksetCategorias(`${validHtml}<a href="/minifigs/category-X">Jurassic World</a> (2)`), (error) => error instanceof BricksetCategoriasError);
});

test('BricksetCategoriasScraper informa errores HTTP y de red', async () => {
  const httpScraper = new BricksetCategoriasScraper({ fetchImpl: async () => new Response('no', { status: 503 }) });
  await assert.rejects(() => httpScraper.fetchCategorias(), (error) => error.code === 'BRICKSET_CATEGORIAS_HTTP');

  const networkScraper = new BricksetCategoriasScraper({ fetchImpl: async () => { throw new Error('offline'); } });
  await assert.rejects(() => networkScraper.fetchCategorias(), (error) => error.code === 'BRICKSET_CATEGORIAS_NO_DISPONIBLES');
});

test('CategoriasRepository valida ausencia, JSON invalido y reemplazo atomico', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'categorias-'));
  const filePath = join(directory, 'categorias.json');
  const repository = new CategoriasRepository(filePath);
  try {
    await assert.rejects(() => repository.read(), (error) => error instanceof CategoriasNoDisponiblesError);
    await writeFile(filePath, '{');
    await assert.rejects(() => repository.read(), (error) => error instanceof CategoriasInvalidosError);
    await repository.replace([{ categoria: 'Space', total: 230, subcategorias: [] }]);
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), [{ categoria: 'Space', total: 230, subcategorias: [] }]);
    await assert.rejects(() => repository.replace([{ categoria: 'Space', total: -1, subcategorias: [] }]), (error) => error instanceof CategoriasInvalidosError);
    await assert.rejects(() => repository.replace([]), (error) => error instanceof CategoriasInvalidosError);
    await assert.rejects(() => repository.replace([
      { categoria: 'Space', total: 230, subcategorias: [] },
      { categoria: ' space ', total: 231, subcategorias: [] },
    ]), (error) => error instanceof CategoriasInvalidosError);
    await assert.rejects(() => repository.replace([{ categoria: ' Space', total: 230, subcategorias: [] }]), (error) => error instanceof CategoriasInvalidosError);
    await assert.rejects(() => repository.replace([{ categoria: 'Space ', total: 230, subcategorias: [] }]), (error) => error instanceof CategoriasInvalidosError);
    await assert.rejects(() => repository.replace([
      { categoria: 'Collectible Minifigures', total: 845, subcategorias: ['Team GB', ' team gb '] },
    ]), (error) => error instanceof CategoriasInvalidosError);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('syncCategorias reemplaza el archivo solo cuando Brickset devuelve un conjunto valido', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sync-categorias-'));
  const filePath = join(directory, 'categorias.json');
  try {
    await writeFile(filePath, JSON.stringify([{ categoria: 'Anterior', total: 1, subcategorias: [] }]));
    await syncCategorias({ filePath, scraper: { fetchCategorias: async () => [{ categoria: 'Nuevo', total: 2, subcategorias: [] }] } });
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), [{ categoria: 'Nuevo', total: 2, subcategorias: [] }]);
    await assert.rejects(() => syncCategorias({ filePath, scraper: { fetchCategorias: async () => { throw new BricksetCategoriasError('FAIL'); } } }));
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), [{ categoria: 'Nuevo', total: 2, subcategorias: [] }]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('CategoriasRepository informa un fallo de sustitucion y conserva el archivo anterior', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'categorias-persistencia-'));
  const filePath = join(directory, 'categorias.json');
  const previousCategorias = [{ categoria: 'Anterior', total: 1, subcategorias: [] }];
  try {
    await writeFile(filePath, JSON.stringify(previousCategorias));
    const repository = new CategoriasRepository(filePath, {
      renameImpl: async () => {
        throw new Error('rename failed');
      },
    });

    await assert.rejects(
      () => repository.replace([{ categoria: 'Nuevo', total: 2, subcategorias: [] }]),
      (error) => error instanceof CategoriasPersistenciaError && error.code === 'CATEGORIAS_PERSISTENCIA_ERROR',
    );
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), previousCategorias);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('syncCategorias propaga un codigo controlado si falla la persistencia', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sync-categorias-persistencia-'));
  const filePath = join(directory, 'categorias.json');
  const previousCategorias = [{ categoria: 'Anterior', total: 1, subcategorias: [] }];
  try {
    await writeFile(filePath, JSON.stringify(previousCategorias));
    const repository = new CategoriasRepository(filePath, {
      renameImpl: async () => {
        throw new Error('rename failed');
      },
    });

    await assert.rejects(
      () => syncCategorias({
        filePath,
        repository,
        scraper: { fetchCategorias: async () => [{ categoria: 'Nuevo', total: 2, subcategorias: [] }] },
      }),
      (error) => error.code === 'CATEGORIAS_PERSISTENCIA_ERROR',
    );
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), previousCategorias);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('GET /categorias devuelve un error controlado si el JSON esta corrupto', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'categorias-api-'));
  const themesPath = join(directory, 'categorias.json');
  await writeFile(themesPath, '{');
  const server = createServer({ themesPath, supabaseConfig: null });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/categorias`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'CATEGORIAS_INVALIDOS' });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test('el modo mantenimiento bloquea la aplicacion y conserva health', async () => {
  const server = createServer({ supabaseConfig: null, maintenanceMode: true });
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.equal(await health.text(), 'OK');

    for (const [path, method] of [['/', 'GET'], ['/api/cron/daily-sync', 'POST'], ['/vendor/supabase.js', 'GET']]) {
      const response = await fetch(`${baseUrl}${path}`, { method });
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('retry-after'), '300');
      assert.deepEqual(await response.json(), { error: 'MANTENIMIENTO' });
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('el modo mantenimiento no inicia ni recupera workers al arrancar', async () => {
  const workerCalls = [];
  const server = await startApplication({
    adminConfig: { url: 'https://example.supabase.co', serviceRoleKey: 'unused' },
    supabaseConfig: null,
    createSupabaseClient: () => ({}),
    categoriesRepository: {},
    recalculator: {
      start: async () => workerCalls.push('recalculator'),
      close() {},
    },
    analyticsRepository: {},
    analyticsJobs: {
      recover: async () => workerCalls.push('analytics'),
      close() {},
    },
    scraper: {},
    port: 0,
    maintenanceMode: true,
  });

  try {
    assert.deepEqual(workerCalls, []);
    const response = await fetch(`http://127.0.0.1:${server.address().port}/health`);
    assert.equal(response.status, 200);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
