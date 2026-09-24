import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { GamificacionInvalidaError, GamificacionRepository } from '../src/gamificacion-repository.js';
import { MinifigurasRepository } from '../src/minifiguras-repository.js';

const categorias = JSON.parse(await readFile(new URL('../data/categorias-brickset.json', import.meta.url), 'utf8'));
const catalogo = [{ id: 'one', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN', precio: 20 }];

function categoryRepository() {
  return { read: async () => categorias };
}

test('inicializa una sola vez aunque se solicite concurrentemente', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gamificacion-repository-'));
  const filePath = join(directory, 'gamificacion.json');
  let reads = 0;
  const repository = new GamificacionRepository(filePath, { categoriasRepository: categoryRepository() });
  try {
    const reader = async () => { reads += 1; return catalogo; };
    const [first, second] = await Promise.all([repository.ensure(reader), repository.ensure(reader)]);
    assert.deepEqual(first, second);
    assert.equal(reads, 1);
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), first);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rechaza un estado persistido con formato invalido', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gamificacion-invalid-'));
  const filePath = join(directory, 'gamificacion.json');
  await writeFile(filePath, JSON.stringify({ bricks: -1 }));
  const repository = new GamificacionRepository(filePath);
  try {
    await assert.rejects(repository.read(), GamificacionInvalidaError);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('no cambia gamificacion cuando falla la persistencia del catalogo', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gamificacion-catalog-failure-'));
  const catalogPath = join(directory, 'minifiguras.json');
  const gamificationPath = join(directory, 'gamificacion.json');
  const initial = [];
  await writeFile(catalogPath, JSON.stringify(initial));
  const gamification = new GamificacionRepository(gamificationPath, { categoriasRepository: categoryRepository() });
  await gamification.recalculate(initial);
  const repository = new MinifigurasRepository(catalogPath, {
    categoriasRepository: { read: async () => categorias },
    onCatalogPersisted: async (catalogo) => gamification.recalculate(catalogo),
  });
  repository.persist = async () => { throw new Error('fallo de escritura'); };
  try {
    await assert.rejects(repository.create({ id: 'fail', nombre: 'Fallo', descripcion: 'Fallo', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN' }));
    assert.equal((await gamification.read()).bricks, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
