import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseMock } from '../test-support/supabase-mock.js';
import {
  AutorregaloNoPermitidoError,
  LogrosNoDisponiblesError,
  RankingRepository,
  RankingSemanalNoDisponibleError,
  RegaloYaEnviadoError,
  ReceptorNoEncontradoError,
  UsuarioNoEncontradoError,
} from '../src/ranking-repository.js';
import { OTHER_TOKEN, OTHER_USER, TEST_TOKEN, TEST_USER, createTestClient, createTestSupabase } from '../test-support/server.js';

test('sincroniza perfil validado y mapea el contrato público del ranking', async () => {
  const supabase = createTestSupabase();
  const repository = new RankingRepository({ client: createTestClient(supabase), userId: TEST_USER.id });
  await repository.syncProfile({ user_metadata: { full_name: ' Ada ', avatar_url: ' https://example.com/a.png ' } });
  supabase.seed('gamificacion', TEST_USER.id, [{ bricks: 100, nivel: { id: 3, nombre: 'Three-Seven-Five' } }]);
  const [entry] = await repository.list();
  assert.deepEqual(entry, {
    userId: TEST_USER.id, avatarUrl: 'https://example.com/a.png', displayName: 'Ada', bricks: 100,
    nivel: 3, nombreNivel: 'Three-Seven-Five', imagenNivel: '/level_images/3_threesevenfive.png', totalColeccion: 0,
    top5Precio: [], top5Antiguedad: [], regaloEnviado: false, dnaPrincipal: 'Newbie', dnaRasgos: [],
  });
});

test('proyecta solo los dos rasgos DNA publicos del ranking sin ponderaciones', async () => {
  const repository = new RankingRepository({ client: { async rpc(name) {
    assert.equal(name, 'ranking_global');
    return { data: [{
      user_id: 'target', avatar_url: null, display_name: 'Ada', bricks: 10, nivel: 0, nombre_nivel: 'Duplo',
      imagen_nivel: '/level_images/9_forestman.png', total_coleccion: 0, top5_precio: [], top5_antiguedad: [],
      regalo_enviado: false, dna_principal: 'Explorer', dna_porcentajes: { explorer: 100 }, dna_ponderaciones: [{ private: true }],
      dna_rasgos: [{ nombre: 'Explorer', porcentaje: 60, privado: true }, { nombre: 'Collector', porcentaje: 30 }, { nombre: 'Fan', porcentaje: 10 }],
    }], error: null };
  } } });
  assert.deepEqual(await repository.list(), [{
    userId: 'target', avatarUrl: null, displayName: 'Ada', bricks: 10, nivel: 0, nombreNivel: 'Duplo',
    imagenNivel: '/level_images/9_forestman.png', totalColeccion: 0, top5Precio: [], top5Antiguedad: [],
    regaloEnviado: false, dnaPrincipal: 'Explorer', dnaRasgos: [{ nombre: 'Explorer', porcentaje: 60 }, { nombre: 'Collector', porcentaje: 30 }],
  }]);
});

test('el mock del ranking semanal usa reloj inyectado, base dominical exacta y no disponibilidad sin candidatos', async () => {
  let currentTime = '2026-10-08T12:00:00Z';
  const supabase = createSupabaseMock({
    users: { [TEST_TOKEN]: TEST_USER, [OTHER_TOKEN]: OTHER_USER },
    now: () => new Date(currentTime),
  });
  const client = createTestClient(supabase);
  supabase.seed('gamificacion', TEST_USER.id, [{ bricks: 120, nivel: { id: 3, nombre: 'Three-Seven-Five' } }]);
  supabase.seed('user_daily_snapshots', TEST_USER.id, [{ snapshot_date: '2026-10-11', bricks: 100 }]);
  supabase.seed('gamificacion', OTHER_USER.id, [{ bricks: 50, nivel: { id: 1, nombre: 'Stud' } }]);
  supabase.seed('user_daily_snapshots', OTHER_USER.id, [{ snapshot_date: '2026-10-12', bricks: 100 }]);

  const beforeLaunch = await client.rpc('ranking_semanal');
  assert.equal(beforeLaunch.error, null);
  assert.equal(beforeLaunch.data.available, false);
  assert.deepEqual(beforeLaunch.data.entries, []);

  currentTime = '2026-10-12T08:00:00Z';
  const withoutCurrentCapture = await client.rpc('ranking_semanal');
  assert.equal(withoutCurrentCapture.data.available, false);
  assert.deepEqual(withoutCurrentCapture.data.entries, []);

  supabase.seed('user_daily_snapshots', TEST_USER.id, [{ snapshot_date: '2026-10-12', bricks: 90 }]);
  const available = await client.rpc('ranking_semanal');
  assert.equal(available.error, null);
  assert.deepEqual({
    available: available.data.available,
    availableFrom: available.data.availableFrom,
    weekStart: available.data.weekStart,
    weekEnd: available.data.weekEnd,
  }, { available: true, availableFrom: '2026-10-12', weekStart: '2026-10-12', weekEnd: '2026-10-18' });
  assert.deepEqual(available.data.entries.map(({ userId, bricksSemanales }) => ({ userId, bricksSemanales })), [
    { userId: TEST_USER.id, bricksSemanales: -10 },
  ]);
  assert.deepEqual(supabase.adminCalls(), []);
});

test('el repositorio normaliza el semanal y convierte resultados o fallos invalidos en error controlado', async () => {
  const entry = {
    userId: OTHER_USER.id, avatarUrl: null, displayName: 'Grace', bricks: '200', nivel: '4',
    nombreNivel: 'Citizen', imagenNivel: '/level_images/4_citizen.png', totalColeccion: '2',
    top5Precio: [], top5Antiguedad: [], regaloEnviado: false, dnaPrincipal: 'Explorer',
    dnaRasgos: [{ nombre: 'Explorer', porcentaje: '75' }], bricksSemanales: '-10', snapshotDate: '2026-10-13',
  };
  const data = {
    available: true, availableFrom: '2026-10-12', weekStart: '2026-10-12', weekEnd: '2026-10-18', entries: [entry],
  };
  const repositoryFor = (result) => new RankingRepository({ client: { rpc(name, parameters) {
    assert.equal(name, 'ranking_semanal');
    assert.equal(parameters, undefined);
    return Promise.resolve(result);
  } } });
  const normalized = await repositoryFor({ data, error: null }).weekly();
  assert.equal(normalized.entries[0].bricks, 200);
  assert.equal(normalized.entries[0].nivel, 4);
  assert.equal(normalized.entries[0].totalColeccion, 2);
  assert.equal(normalized.entries[0].bricksSemanales, -10);
  assert.deepEqual(normalized.entries[0].dnaRasgos, [{ nombre: 'Explorer', porcentaje: 75 }]);

  for (const invalidEntry of [{ ...entry, bricksSemanales: 'NaN' }, { ...entry, bricks: '-1' }, { ...entry, nivel: 'nivel' }]) {
    await assert.rejects(repositoryFor({ data: { ...data, entries: [invalidEntry] }, error: null }).weekly(), RankingSemanalNoDisponibleError);
  }
  await assert.rejects(repositoryFor({ data: null, error: new Error('private storage detail') }).weekly(), (error) => {
    assert.ok(error instanceof RankingSemanalNoDisponibleError);
    assert.equal(error.code, 'RANKING_SEMANAL_NO_DISPONIBLE');
    assert.equal(error.message.includes('private storage detail'), false);
    return true;
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