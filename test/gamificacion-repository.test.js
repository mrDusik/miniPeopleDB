import assert from 'node:assert/strict';
import test from 'node:test';
import { GamificacionInvalidaError, GamificacionNoDisponibleError, GamificacionRepository } from '../src/gamificacion-repository.js';
import { MinifigurasRepository } from '../src/minifiguras-repository.js';
import { categoriasMock } from '../test-support/fixtures.js';
import { TEST_USER, createTestClient, createTestSupabase } from '../test-support/server.js';

const catalogo = [{ id: 'ONE', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN', precio: 20 }];

function categoryRepository() {
  return { read: async () => categoriasMock };
}

function gamificationWith(supabase) {
  return new GamificacionRepository({ client: createTestClient(supabase), userId: TEST_USER.id, categoriasRepository: categoryRepository() });
}

test('inicializa una sola vez aunque se solicite concurrentemente', async () => {
  const supabase = createTestSupabase();
  const repository = gamificationWith(supabase);
  let reads = 0;
  const reader = async () => { reads += 1; return catalogo; };
  const [first, second] = await Promise.all([repository.ensure(reader), repository.ensure(reader)]);
  assert.deepEqual(first, second);
  assert.equal(reads, 1);
  const [row] = supabase.rows('gamificacion');
  assert.equal(row.user_id, TEST_USER.id);
  assert.deepEqual(
    { bricks: row.bricks, nivel: row.nivel, siguienteNivel: row.siguiente_nivel, progreso: row.progreso, logros: row.logros },
    first,
  );
  assert.deepEqual(await gamificationWith(supabase).read(), first);
});

test('read devuelve null si el usuario no tiene estado y error si Supabase falla', async () => {
  const supabase = createTestSupabase();
  const repository = gamificationWith(supabase);
  assert.equal(await repository.read(), null);
  supabase.failNext('gamificacion');
  await assert.rejects(repository.read(), GamificacionNoDisponibleError);
});

test('rechaza un estado persistido con formato invalido', async () => {
  const supabase = createTestSupabase();
  supabase.seed('gamificacion', TEST_USER.id, [{ bricks: -1 }]);
  await assert.rejects(gamificationWith(supabase).read(), GamificacionInvalidaError);
});

test('no cambia gamificacion cuando falla la persistencia del catalogo', async () => {
  const supabase = createTestSupabase();
  const gamification = gamificationWith(supabase);
  await gamification.recalculate([]);
  const repository = new MinifigurasRepository({
    client: createTestClient(supabase),
    userId: TEST_USER.id,
    categoriasRepository: categoryRepository(),
    onCatalogPersisted: async (catalogo) => gamification.recalculate(catalogo),
  });
  supabase.failNext('minifiguras', undefined, 'insert');
  await assert.rejects(repository.create({ id: 'fail', nombre: 'Fallo', descripcion: 'Fallo', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN' }));
  assert.equal((await gamification.read()).bricks, 0);
});

test('recalcula y persiste gamificacion tras una mutacion del catalogo', async () => {
  const supabase = createTestSupabase();
  const gamification = gamificationWith(supabase);
  const repository = new MinifigurasRepository({
    client: createTestClient(supabase),
    userId: TEST_USER.id,
    categoriasRepository: categoryRepository(),
    onCatalogPersisted: async (catalogo) => gamification.recalculate(catalogo),
  });
  await repository.create({ id: 'nueva', nombre: 'Nueva', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN', precio: 20 });
  assert.ok(repository.lastGamification.state.bricks > 0);
  assert.equal(supabase.rows('gamificacion')[0].bricks, repository.lastGamification.state.bricks);
});
