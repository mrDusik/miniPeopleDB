import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AutorregaloNoPermitidoError,
  RankingRepository,
  RegaloYaEnviadoError,
  ReceptorNoEncontradoError,
} from '../src/ranking-repository.js';
import { OTHER_USER, TEST_USER, createTestClient, createTestSupabase } from '../test-support/server.js';

test('sincroniza perfil validado y mapea el contrato público del ranking', async () => {
  const supabase = createTestSupabase();
  const repository = new RankingRepository({ client: createTestClient(supabase), userId: TEST_USER.id });
  await repository.syncProfile({ user_metadata: { full_name: ' Ada ', avatar_url: ' https://example.com/a.png ' } });
  supabase.seed('gamificacion', TEST_USER.id, [{ bricks: 20, nivel: { id: 1, nombre: 'Stud' } }]);
  const [entry] = await repository.list();
  assert.deepEqual(entry, {
    userId: TEST_USER.id, avatarUrl: 'https://example.com/a.png', displayName: 'Ada', bricks: 20,
    nivel: 1, nombreNivel: 'Stud', imagenNivel: '/level_images/9_forestman.png', totalColeccion: 0,
    top5Precio: [], top5Antiguedad: [], regaloEnviado: false,
  });
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