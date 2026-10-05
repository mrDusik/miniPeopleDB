import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AutorregaloNoPermitidoError,
  LogrosNoDisponiblesError,
  RankingRepository,
  RegaloYaEnviadoError,
  ReceptorNoEncontradoError,
  UsuarioNoEncontradoError,
} from '../src/ranking-repository.js';
import { OTHER_USER, TEST_USER, createTestClient, createTestSupabase } from '../test-support/server.js';

test('sincroniza perfil validado y mapea el contrato público del ranking', async () => {
  const supabase = createTestSupabase();
  const repository = new RankingRepository({ client: createTestClient(supabase), userId: TEST_USER.id });
  await repository.syncProfile({ user_metadata: { full_name: ' Ada ', avatar_url: ' https://example.com/a.png ' } });
  supabase.seed('gamificacion', TEST_USER.id, [{ bricks: 100, nivel: { id: 3, nombre: 'Three-Seven-Five' } }]);
  const [entry] = await repository.list();
  assert.deepEqual(entry, {
    userId: TEST_USER.id, avatarUrl: 'https://example.com/a.png', displayName: 'Ada', bricks: 100,
    nivel: 3, nombreNivel: 'Three-Seven-Five', imagenNivel: '/level_images/3_threesevenfive.png', totalColeccion: 0,
    top5Precio: [], top5Antiguedad: [], regaloEnviado: false, dnaPrincipal: 'Newbie',
  });
});

test('proyecta solo el caracter DNA publico del ranking', async () => {
  const repository = new RankingRepository({ client: { async rpc(name) {
    assert.equal(name, 'ranking_global');
    return { data: [{
      user_id: 'target', avatar_url: null, display_name: 'Ada', bricks: 10, nivel: 0, nombre_nivel: 'Duplo',
      imagen_nivel: '/level_images/9_forestman.png', total_coleccion: 0, top5_precio: [], top5_antiguedad: [],
      regalo_enviado: false, dna_principal: 'Explorer', dna_porcentajes: { explorer: 100 }, dna_ponderaciones: [{ private: true }],
    }], error: null };
  } } });
  assert.deepEqual(await repository.list(), [{
    userId: 'target', avatarUrl: null, displayName: 'Ada', bricks: 10, nivel: 0, nombreNivel: 'Duplo',
    imagenNivel: '/level_images/9_forestman.png', totalColeccion: 0, top5Precio: [], top5Antiguedad: [],
    regaloEnviado: false, dnaPrincipal: 'Explorer',
  }]);
});

test('usa fallback de perfil y traduce errores de regalo', async () => {
  const supabase = createTestSupabase();
  const repository = new RankingRepository({ client: createTestClient(supabase), userId: TEST_USER.id });
  await repository.syncProfile({ user_metadata: {} });
  assert.equal(supabase.rows('perfiles_publicos', TEST_USER.id)[0].display_name, 'Coleccionista');
  await assert.rejects(repository.gift(TEST_USER.id), AutorregaloNoPermitidoError);
  await assert.rejects(repository.gift('00000000-0000-0000-0000-000000000099'), ReceptorNoEncontradoError);
  supabase.seed('gamificacion', OTHER_USER.id, [{ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, logros: [] }]);
  assert.deepEqual(await repository.gift(OTHER_USER.id), { ok: true });
  await assert.rejects(repository.gift(OTHER_USER.id), RegaloYaEnviadoError);
});

test('consulta logros publicos y traduce ausencia y fallos', async () => {
  const supabase = createTestSupabase();
  const repository = new RankingRepository({ client: createTestClient(supabase), userId: TEST_USER.id });
  supabase.seed('gamificacion', OTHER_USER.id, [{ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, logros: [] }]);
  assert.deepEqual(await repository.achievements(OTHER_USER.id), {
    userId: OTHER_USER.id, displayName: 'Coleccionista', bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, logros: [],
  });
  await assert.rejects(repository.achievements('missing'), UsuarioNoEncontradoError);
  supabase.failNext('ranking_logros');
  await assert.rejects(repository.achievements(OTHER_USER.id), LogrosNoDisponiblesError);
});

test('el repositorio elimina propiedades privadas incluso si la RPC las incluye', async () => {
  const repository = new RankingRepository({ client: { rpc(name, parameters) {
    assert.equal(name, 'ranking_logros');
    assert.deepEqual(parameters, { p_usuario_id: 'target' });
    return { data: { userId: 'target', displayName: 'Ada', bricks: 10, email: 'secret',
      nivel: { id: 0, nombre: 'Duplo', privado: true },
      logros: [{ id: 'first', nombre: 'First', bricks: 10, cantidad: 1, total: 10, repetible: false, donantes: ['secret'] }],
    }, error: null };
  } } });
  assert.deepEqual(await repository.achievements('target'), {
    userId: 'target', displayName: 'Ada', bricks: 10, nivel: { id: 0, nombre: 'Duplo' },
    logros: [{ id: 'first', nombre: 'First', bricks: 10, cantidad: 1, total: 10, repetible: false }],
  });
});