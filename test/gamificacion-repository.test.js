import assert from 'node:assert/strict';
import test from 'node:test';
import { GamificacionDnaNoDisponibleError, GamificacionInvalidaError, GamificacionNoDisponibleError, GamificacionRepository } from '../src/gamificacion-repository.js';
import { MinifigurasRepository } from '../src/minifiguras-repository.js';
import { categoriasMock } from '../test-support/fixtures.js';
import { OTHER_USER, TEST_USER, createTestClient, createTestSupabase } from '../test-support/server.js';

const catalogo = [{ id: 'ONE', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN', precio: 20 }];

function categoryRepository() {
  return { read: async () => categoriasMock };
}

function gamificationWith(supabase) {
  return new GamificacionRepository({ client: createTestClient(supabase), userId: TEST_USER.id, categoriasRepository: categoryRepository() });
}

test('destacados usa RPC propia y no persiste preferencias en logros derivados', async () => {
  const supabase = createTestSupabase();
  const repository = gamificationWith(supabase);
  const { state } = await repository.recalculate(catalogo);
  const id = state.logros[0].id;
  assert.deepEqual(await repository.setFeatured(id, true), { logrosDestacados: [id] });
  const decorated = await repository.featured();
  assert.deepEqual(decorated.logrosDestacados, [id]);
  assert.deepEqual(decorated.logros, state.logros);
  await repository.recalculate(catalogo);
  assert.deepEqual((await repository.featured()).logrosDestacados, [id]);
  await repository.recalculate([]);
  assert.deepEqual((await repository.featured()).logrosDestacados, []);
  await repository.recalculate(catalogo);
  assert.deepEqual((await repository.featured()).logrosDestacados, []);
});

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

test('conserva los regalos recibidos al recalcular tras cambios del catálogo', async () => {
  const supabase = createTestSupabase();
  supabase.seed('regalos_enviados', undefined, [{ donante_id: OTHER_USER.id, receptor_id: TEST_USER.id }]);
  const gamification = gamificationWith(supabase);
  const first = await gamification.recalculate(catalogo);
  const second = await gamification.recalculate([]);
  assert.equal(first.state.logros.find(({ type }) => type === 'regalo').total, 20);
  assert.equal(second.state.bricks, 70);
  assert.equal(second.state.logros.find(({ type }) => type === 'regalo').cantidad, 1);
});

test('deriva fuentes sociales del JWT, conserva dirección y excluye solicitudes rechazadas', async () => {
  const supabase = createTestSupabase();
  const otherFriend = '00000000-0000-0000-0000-00000000000c';
  const outgoingFriend = '00000000-0000-0000-0000-00000000000d';
  const incomingFriend = '00000000-0000-0000-0000-00000000000e';
  const friendshipRow = (left, right) => {
    const [user_low_id, user_high_id] = [left, right].sort();
    return { user_low_id, user_high_id };
  };
  supabase.seed('friend_requests', undefined, [
    { id: 'pending', sender_id: TEST_USER.id, recipient_id: OTHER_USER.id, status: 'pending' },
    { id: 'rejected', sender_id: TEST_USER.id, recipient_id: otherFriend, status: 'rejected' },
    { id: 'accepted-out', sender_id: TEST_USER.id, recipient_id: outgoingFriend, status: 'accepted' },
    { id: 'accepted-in', sender_id: incomingFriend, recipient_id: TEST_USER.id, status: 'accepted' },
  ]);
  supabase.seed('friendships', undefined, [
    friendshipRow(TEST_USER.id, outgoingFriend), friendshipRow(TEST_USER.id, incomingFriend),
  ]);
  supabase.seed('regalos_enviados', undefined, [
    { donante_id: OTHER_USER.id, receptor_id: TEST_USER.id, semana: '0001-01-01' },
    { donante_id: otherFriend, receptor_id: TEST_USER.id, semana: '2026-10-26' },
  ]);
  supabase.seed('agradecimientos_regalo', undefined, [
    { gift_notification_id: 'thanks-sent', thanker_id: TEST_USER.id, donor_id: OTHER_USER.id },
    { gift_notification_id: 'thanks-received', thanker_id: otherFriend, donor_id: TEST_USER.id },
  ]);

  const client = createTestClient(supabase);
  const sourceResult = await client.rpc('gamificacion_social_fuentes');
  assert.match(sourceResult.data.source_revision, /^[\da-f]{32}$/);
  const { source_revision, ...sourceCounts } = sourceResult.data;
  assert.deepEqual(sourceCounts, {
    friends: 2, sent_pending: 1, accepted_sent: 1, accepted_received: 1,
    global_gifts_received: 1, weekly_gifts_received: 1, thanks_sent: 1, thanks_received: 1,
  });
  assert.equal((await client.rpc('gamificacion_social_fuentes', { p_user_id: OTHER_USER.id })).error.code, 'PGRST202');

  const repository = gamificationWith(supabase);
  const state = await repository.calculate([]);
  assert.equal(state.logros.find(({ id }) => id === 'first-contact')?.cantidad, 1);
  assert.equal(state.logros.find(({ id }) => id === 'handshake')?.cantidad, 1);
  assert.equal(state.logros.find(({ id }) => id === 'oh-you-shouldnt-have')?.cantidad, 1);
  assert.equal(state.logros.find(({ id }) => id === 'gratitude-is-the-sign-of-noble-souls')?.cantidad, 1);

  const rejectedOnly = createTestSupabase();
  rejectedOnly.seed('friend_requests', undefined, [
    { id: 'rejected-only', sender_id: TEST_USER.id, recipient_id: OTHER_USER.id, status: 'rejected' },
  ]);
  const rejectedState = await gamificationWith(rejectedOnly).calculate([]);
  assert.equal(rejectedState.logros.some(({ id }) => id === 'first-contact'), false);
});

test('reintenta el cálculo si las fuentes sociales cambian antes de persistir', async () => {
  const supabase = createTestSupabase();
  supabase.seed('friend_requests', undefined, [{
    id: 'pending-before-recalc', sender_id: TEST_USER.id, recipient_id: OTHER_USER.id, status: 'pending',
  }]);
  const client = createTestClient(supabase);
  const recipientClient = createTestClient(supabase, 'token-usuario-b');
  const originalRpc = client.rpc.bind(client);
  let sourceReads = 0;
  client.rpc = async (name, parameters) => {
    if (name === 'gamificacion_social_fuentes') {
      sourceReads += 1;
      if (sourceReads === 2) {
        const rejection = await recipientClient.rpc('amigos_rechazar', { p_solicitud_id: 'pending-before-recalc' });
        assert.equal(rejection.error, null);
      }
    }
    return originalRpc(name, parameters);
  };
  const repository = new GamificacionRepository({
    client, userId: TEST_USER.id, categoriasRepository: categoryRepository(),
  });

  const result = await repository.recalculate([]);
  assert.equal(sourceReads, 4);
  assert.equal(result.state.logros.some(({ id }) => id === 'first-contact'), false);
  assert.equal(supabase.rows('gamificacion', TEST_USER.id)[0].logros.some(({ id }) => id === 'first-contact'), false);
});

test('recalcula el estado persistido sin conservar logros V1 retirados', async () => {
  const supabase = createTestSupabase();
  supabase.seed('gamificacion', TEST_USER.id, [{
    bricks: 20,
    nivel: { id: 1, nombre: 'Stud' },
    siguiente_nivel: { id: 2, nombre: 'Plate' },
    progreso: { actual: 20, desde: 20, hasta: 50, porcentaje: 0 },
    logros: [
      { id: 'new-mini-person', nombre: 'New mini person', bricks: 1, repetible: true, cantidad: 10, total: 10 },
      { id: 'someone-liked-your-collection', type: 'regalo', nombre: 'Your collection is top!', bricks: 50, repetible: true, cantidad: 1, total: 50 },
    ],
  }]);
  const result = await gamificationWith(supabase).recalculate([]);

  assert.equal(result.state.bricks, 0);
  assert.deepEqual(result.state.logros, []);
  assert.equal(supabase.rows('gamificacion', TEST_USER.id)[0].logros.length, 0);
});

test('dna consulta una RPC fresca por JWT y valida solo su proyeccion agregada', async () => {
  const supabase = createTestSupabase();
  supabase.seed('gamificacion', TEST_USER.id, [{ logros: [{ id: 'solid-investment', cantidad: 1 }] }]);
  supabase.seed('gamificacion', OTHER_USER.id, [{ logros: [{ id: 'sweet-find', cantidad: 1 }] }]);
  const ownRepository = new GamificacionRepository({ client: createTestClient(supabase), userId: TEST_USER.id });
  const otherRepository = new GamificacionRepository({ client: createTestClient(supabase, 'token-usuario-b'), userId: OTHER_USER.id });
  const ownBefore = supabase.rows('gamificacion', TEST_USER.id);
  assert.deepEqual(await ownRepository.dna(), {
    principal: 'Collector', porcentajes: { rarityHunter: 5, explorer: 5, collector: 80, fan: 10 },
  });
  assert.deepEqual(await otherRepository.dna(), {
    principal: 'Collector', porcentajes: { rarityHunter: 5, explorer: 5, collector: 80, fan: 10 },
  });
  await createTestClient(supabase).from('gamificacion').update({ logros: [{ id: 'treasure-hoard', cantidad: 2 }] }).eq('user_id', TEST_USER.id);
  assert.equal((await ownRepository.dna()).porcentajes.rarityHunter, 50);
  assert.deepEqual(supabase.rows('gamificacion', TEST_USER.id), [{ ...ownBefore[0], logros: [{ id: 'treasure-hoard', cantidad: 2 }] }]);
  assert.equal(ownRepository.initialization, null);

  supabase.failNext('gamificacion_dna');
  await assert.rejects(ownRepository.dna(), GamificacionDnaNoDisponibleError);
  const malformed = new GamificacionRepository({ client: { rpc: async () => ({ data: {
    principal: 'Newbie', porcentajes: { rarityHunter: 1, explorer: 0, collector: 0, fan: 0 }, private: 'secret',
  }, error: null }) } });
  await assert.rejects(malformed.dna(), GamificacionDnaNoDisponibleError);
});
