import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { BricksetThemesError, BricksetThemesScraper, parseBricksetThemes } from '../src/brickset-themes-scraper.js';
import { syncThemes } from '../scripts/sync-brickset-themes.js';
import { TemasInvalidosError, TemasNoDisponiblesError, TemasPersistenciaError, TemasRepository, validateTemas } from '../src/temas-repository.js';
import { createServer } from '../src/server.js';

const validHtml = `
  <a href="/minifigs/category-Jurassic-World">Jurassic World</a> (154)
  <a href="/minifigs/category-Collectible-Minifigures">Collectible Minifigures</a> (845)
  <a href="/minifigs/category-Pokemon">Pok&eacute;mon</a> (1)
`;

test('el catálogo oficial de temas tiene una estructura íntegra', async () => {
  const content = await readFile(new URL('../data/temas-brickset.json', import.meta.url), 'utf8');
  const temas = JSON.parse(content);

  assert.doesNotThrow(() => validateTemas(temas));
  assert.ok(temas.length > 0);
  assert.equal(new Set(temas.map(({ tema }) => tema)).size, temas.length);
  assert.ok(temas.every(({ tema, total }) => (
    typeof tema === 'string'
    && tema.trim() !== ''
    && Number.isInteger(total)
    && total >= 0
  )));
});

test('parseBricksetThemes extrae nombres y totales en el orden de Brickset', () => {
  assert.deepEqual(parseBricksetThemes(validHtml), [
    { tema: 'Jurassic World', total: 154 },
    { tema: 'Collectible Minifigures', total: 845 },
    { tema: 'Pokémon', total: 1 },
  ]);
});

test('parseBricksetThemes rechaza HTML incompleto o duplicado', () => {
  assert.throws(() => parseBricksetThemes('<html>sin categorias</html>'), (error) => error instanceof BricksetThemesError);
  assert.throws(() => parseBricksetThemes(`${validHtml}<a href="/minifigs/category-X">Jurassic World</a> (2)`), (error) => error instanceof BricksetThemesError);
});

test('BricksetThemesScraper informa errores HTTP y de red', async () => {
  const httpScraper = new BricksetThemesScraper({ fetchImpl: async () => new Response('no', { status: 503 }) });
  await assert.rejects(() => httpScraper.fetchThemes(), (error) => error.code === 'BRICKSET_TEMAS_HTTP');

  const networkScraper = new BricksetThemesScraper({ fetchImpl: async () => { throw new Error('offline'); } });
  await assert.rejects(() => networkScraper.fetchThemes(), (error) => error.code === 'BRICKSET_TEMAS_NO_DISPONIBLES');
});

test('TemasRepository valida ausencia, JSON invalido y reemplazo atomico', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'temas-'));
  const filePath = join(directory, 'temas.json');
  const repository = new TemasRepository(filePath);
  try {
    await assert.rejects(() => repository.read(), (error) => error instanceof TemasNoDisponiblesError);
    await writeFile(filePath, '{');
    await assert.rejects(() => repository.read(), (error) => error instanceof TemasInvalidosError);
    await repository.replace([{ tema: 'Space', total: 230 }]);
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), [{ tema: 'Space', total: 230 }]);
    await assert.rejects(() => repository.replace([{ tema: 'Space', total: -1 }]), (error) => error instanceof TemasInvalidosError);
    await assert.rejects(() => repository.replace([]), (error) => error instanceof TemasInvalidosError);
    await assert.rejects(() => repository.replace([
      { tema: 'Space', total: 230 },
      { tema: ' space ', total: 231 },
    ]), (error) => error instanceof TemasInvalidosError);
    await assert.rejects(() => repository.replace([{ tema: ' Space', total: 230 }]), (error) => error instanceof TemasInvalidosError);
    await assert.rejects(() => repository.replace([{ tema: 'Space ', total: 230 }]), (error) => error instanceof TemasInvalidosError);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('syncThemes reemplaza el archivo solo cuando Brickset devuelve un conjunto valido', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sync-temas-'));
  const filePath = join(directory, 'temas.json');
  try {
    await writeFile(filePath, JSON.stringify([{ tema: 'Anterior', total: 1 }]));
    await syncThemes({ filePath, scraper: { fetchThemes: async () => [{ tema: 'Nuevo', total: 2 }] } });
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), [{ tema: 'Nuevo', total: 2 }]);
    await assert.rejects(() => syncThemes({ filePath, scraper: { fetchThemes: async () => { throw new BricksetThemesError('FAIL'); } } }));
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), [{ tema: 'Nuevo', total: 2 }]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('TemasRepository informa un fallo de sustitucion y conserva el archivo anterior', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'temas-persistencia-'));
  const filePath = join(directory, 'temas.json');
  const previousThemes = [{ tema: 'Anterior', total: 1 }];
  try {
    await writeFile(filePath, JSON.stringify(previousThemes));
    const repository = new TemasRepository(filePath, {
      renameImpl: async () => {
        throw new Error('rename failed');
      },
    });

    await assert.rejects(
      () => repository.replace([{ tema: 'Nuevo', total: 2 }]),
      (error) => error instanceof TemasPersistenciaError && error.code === 'TEMAS_PERSISTENCIA_ERROR',
    );
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), previousThemes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('syncThemes propaga un codigo controlado si falla la persistencia', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sync-temas-persistencia-'));
  const filePath = join(directory, 'temas.json');
  const previousThemes = [{ tema: 'Anterior', total: 1 }];
  try {
    await writeFile(filePath, JSON.stringify(previousThemes));
    const repository = new TemasRepository(filePath, {
      renameImpl: async () => {
        throw new Error('rename failed');
      },
    });

    await assert.rejects(
      () => syncThemes({
        filePath,
        repository,
        scraper: { fetchThemes: async () => [{ tema: 'Nuevo', total: 2 }] },
      }),
      (error) => error.code === 'TEMAS_PERSISTENCIA_ERROR',
    );
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), previousThemes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('GET /temas devuelve un error controlado si el JSON esta corrupto', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'temas-api-'));
  const themesPath = join(directory, 'temas.json');
  await writeFile(themesPath, '{');
  const server = createServer({ themesPath });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/temas`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'TEMAS_INVALIDOS' });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});