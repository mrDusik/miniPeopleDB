import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { BricksetCategoriasError, BricksetCategoriasScraper, parseBricksetCategorias } from '../src/brickset-categorias-scraper.js';
import { syncCategorias } from '../scripts/sync-brickset-categorias.js';
import { CategoriasInvalidosError, CategoriasNoDisponiblesError, CategoriasPersistenciaError, CategoriasRepository, validateCategorias } from '../src/categorias-repository.js';
import { createServer } from '../src/server.js';

const validHtml = `
  <a href="/minifigs/category-Jurassic-World">Jurassic World</a> (154)
  <a href="/minifigs/category-Collectible-Minifigures">Collectible Minifigures</a> (845)
  <a href="/minifigs/category-Pokemon">Pok&eacute;mon</a> (1)
`;

test('el catálogo oficial de categorías tiene una estructura íntegra', async () => {
  const content = await readFile(new URL('../data/categorias-brickset.json', import.meta.url), 'utf8');
  const categorias = JSON.parse(content);

  assert.doesNotThrow(() => validateCategorias(categorias));
  assert.ok(categorias.length > 0);
  assert.equal(new Set(categorias.map(({ categoria }) => categoria)).size, categorias.length);
  assert.ok(categorias.every(({ categoria, total, subcategorias }) => (
    typeof categoria === 'string'
    && categoria.trim() !== ''
    && Number.isInteger(total)
    && total >= 0
    && Array.isArray(subcategorias)
  )));
});

test('Collectible Minifigures incluye subcategorias representativas y el resto de categorias no tiene subcategorias', async () => {
  const content = await readFile(new URL('../data/categorias-brickset.json', import.meta.url), 'utf8');
  const categorias = JSON.parse(content);
  const collectible = categorias.find(({ categoria }) => categoria === 'Collectible Minifigures');

  assert.ok(collectible, 'Collectible Minifigures debe existir en el catálogo');
  assert.ok(collectible.subcategorias.length >= 50, 'Collectible Minifigures debe tener su conjunto íntegro de subcategorias');
  const nombres = collectible.subcategorias.map(({ subcategoria }) => subcategoria);
  for (const esperada of ['Series 17 Minifigures', 'Team GB', 'The LEGO Movie', 'Disney / Disney Series 1']) {
    assert.ok(nombres.includes(esperada), `falta la subcategoria "${esperada}"`);
  }
  assert.equal(new Set(nombres).size, nombres.length);
  assert.ok(collectible.subcategorias.every(({ total }) => total === undefined || (Number.isInteger(total) && total >= 0)));

  const otras = categorias.filter(({ categoria }) => categoria !== 'Collectible Minifigures');
  assert.ok(otras.length > 0);
  assert.ok(otras.every(({ subcategorias }) => subcategorias.length === 0));
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
  const server = createServer({ themesPath });
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
