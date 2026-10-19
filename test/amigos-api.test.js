import assert from 'node:assert/strict';
import test from 'node:test';
import { AmigosRepository } from '../src/amigos-repository.js';
import { createSupabaseMock } from '../test-support/supabase-mock.js';
import { authFetch, startTestServer } from '../test-support/server.js';

const TOKEN_A = 'friends-token-a';
const TOKEN_B = 'friends-token-b';
const TOKEN_C = 'friends-token-c';
const USER_A = '00000000-0000-4000-8000-00000000000a';
const USER_B = '00000000-0000-4000-8000-00000000000b';
const USER_C = '00000000-0000-4000-8000-00000000000c';

function friendsMock() {
  const mock = createSupabaseMock({ users: {
    [TOKEN_A]: { id: USER_A },
    [TOKEN_B]: { id: USER_B },
    [TOKEN_C]: { id: USER_C },
  } });
  mock.seed('user_profiles', USER_A, [{ username: 'SpaceFan', currency: 'EUR', language: 'es' }]);
  mock.seed('user_profiles', USER_B, [{ username: 'BrickFan', currency: 'EUR', language: 'es', avatar_url: 'https://avatar.example/b.png' }]);
  mock.seed('user_profiles', USER_C, [{ username: 'CastleFan', currency: 'EUR', language: 'es' }]);
  mock.seed('perfiles_publicos', USER_B, [{ display_name: 'Private OAuth name', avatar_url: 'https://avatar.example/public.png' }]);
  mock.seed('gamificacion', USER_B, [{ bricks: 100, nivel: { id: 3, nombre: 'Level', private: 'hidden' }, logros: [
    { id: 'first', type: 'normal', nombre: 'First', total: 10 },
    { id: 'gift', type: 'regalo', nombre: 'Gift', total: 100 },
    { id: 'second', type: 'normal', nombre: 'Second', total: 50 },
  ] }]);
  mock.seed('minifiguras', USER_B, [
    { id: 'A-1', nombre: 'Old', categoria: 'Space', estado_coleccion: 'COLECCIÓN', anio: 1980, precio: 20, precio_compra: 5, fecha_compra: '2020-01-01', fecha_registro: '2024-01-01T00:00:00.000Z' },
    { id: 'A-2', nombre: 'Newest', categoria: 'Castle', estado_coleccion: 'COLECCIÓN', anio: 2000, precio: 50, precio_compra: 10, fecha_compra: '2021-01-01', fecha_registro: '2026-01-01T00:00:00.000Z' },
    { id: 'B-1', nombre: 'Wanted', categoria: 'City', estado_coleccion: 'BUSCADA', anio: 2022, precio: 15, fecha_registro: '2026-02-01T00:00:00.000Z' },
  ]);
  return mock;
}

test('amigos exige sesión y búsqueda parcial con mínimo de tres caracteres', async () => {
  const mock = friendsMock();
  const context = await startTestServer({ supabase: mock });
  const own = authFetch(TOKEN_A);
  try {
    assert.equal((await fetch(`${context.baseUrl}/api/amigos?tipo=friends`)).status, 401);
    const short = await own(`${context.baseUrl}/api/amigos/buscar?q=%20ab%20`);
    assert.equal(short.status, 400);
    assert.deepEqual(await short.json(), { error: 'CONSULTA_DEMASIADO_CORTA' });

    const response = await own(`${context.baseUrl}/api/amigos/buscar?q=fAn`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = await response.json();
    assert.deepEqual(result.users.map(({ username }) => username), ['BrickFan', 'CastleFan']);
    assert.equal(result.users.some(({ userId }) => userId === USER_A), false);
    assert.deepEqual(Object.keys(result.users[0]).sort(), [
      'avatarUrl', 'bricks', 'dnaPrincipal', 'dnaTraits', 'globalPosition', 'level', 'relationshipStatus', 'totalCollection', 'userId', 'username',
    ]);
    assert.equal(result.users[0].totalCollection, 2);
    assert.equal(result.users[0].dnaTraits.length <= 2, true);
    assert.equal('email' in result.users[0], false);
    assert.equal((await own(`${context.baseUrl}/api/amigos?tipo=invalid`)).status, 400);
    assert.equal((await own(`${context.baseUrl}/api/amigos/buscar?q=fan&userId=${USER_B}`)).status, 400);
  } finally {
    await context.close();
  }
});

test('solicitudes se envían una vez, se pueden rechazar y aceptar después con listas recíprocas', async () => {
  const mock = friendsMock();
  const context = await startTestServer({ supabase: mock });
  const sender = authFetch(TOKEN_A);
  const receiver = authFetch(TOKEN_B);
  const strangers = authFetch(TOKEN_C);
  const sendUrl = `${context.baseUrl}/api/amigos/solicitudes`;
  try {
    const self = await sender(sendUrl, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ receptorId: USER_A }),
    });
    assert.equal(self.status, 400);
    assert.deepEqual(await self.json(), { error: 'AUTORRELACION_NO_PERMITIDA' });

    const sent = await sender(sendUrl, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ receptorId: USER_B }),
    });
    assert.equal(sent.status, 201);
    const request = await sent.json();
    assert.equal(request.status, 'pending');
    assert.equal(mock.rows('notificaciones', USER_B)[0].payload.user, 'SpaceFan');

    const duplicate = await sender(sendUrl, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ receptorId: USER_B }),
    });
    assert.equal(duplicate.status, 409);
    assert.deepEqual(await duplicate.json(), { error: 'SOLICITUD_EXISTENTE' });
    assert.equal((await strangers(`${context.baseUrl}/api/amigos?tipo=received`).then((response) => response.json())).users.length, 0);

    const received = await receiver(`${context.baseUrl}/api/amigos?tipo=received`);
    assert.equal((await received.json()).users[0].status, 'pending');
    const sentBeforeRejection = await (await sender(`${context.baseUrl}/api/amigos?tipo=sent`)).json();
    const searchBeforeRejection = await (await sender(`${context.baseUrl}/api/amigos/buscar?q=Brick`)).json();
    const countsBeforeRejection = await (await sender(`${context.baseUrl}/api/amigos/contadores`)).json();
    const rejected = await receiver(`${context.baseUrl}/api/amigos/solicitudes/${request.requestId}/rechazar`, { method: 'POST' });
    assert.deepEqual(await rejected.json(), { ok: true, status: 'rejected', alreadyAccepted: false });
    assert.deepEqual((await (await receiver(`${context.baseUrl}/api/amigos?tipo=received`)).json()).users.map(({ status }) => status), ['rejected']);
    assert.equal(mock.rows('notificaciones', USER_A).length, 0);
    assert.deepEqual(await (await sender(`${context.baseUrl}/api/amigos?tipo=sent`)).json(), sentBeforeRejection);
    assert.deepEqual(await (await sender(`${context.baseUrl}/api/amigos/buscar?q=Brick`)).json(), searchBeforeRejection);
    assert.deepEqual(await (await sender(`${context.baseUrl}/api/amigos/contadores`)).json(), countsBeforeRejection);

    const accepted = await receiver(`${context.baseUrl}/api/amigos/solicitudes/${request.requestId}/aceptar`, { method: 'POST' });
    assert.deepEqual(await accepted.json(), { ok: true, status: 'accepted', alreadyAccepted: false });
    const repeated = await receiver(`${context.baseUrl}/api/amigos/solicitudes/${request.requestId}/aceptar`, { method: 'POST' });
    assert.deepEqual(await repeated.json(), { ok: true, status: 'accepted', alreadyAccepted: true });
    assert.equal(mock.rows('friendships').length, 1);
    assert.equal(mock.rows('notificaciones', USER_A).filter(({ type }) => type === 'friend_request_accepted').length, 1);
    assert.equal((await (await sender(`${context.baseUrl}/api/amigos?tipo=friends`)).json()).users[0].username, 'BrickFan');
    assert.equal((await (await receiver(`${context.baseUrl}/api/amigos?tipo=friends`)).json()).users[0].username, 'SpaceFan');
    assert.equal((await (await receiver(`${context.baseUrl}/api/amigos?tipo=received`)).json()).users.length, 0);
    assert.deepEqual(mock.adminCalls(), []);
  } finally {
    await context.close();
  }
});

test('perfil ajeno devuelve solo el resumen permitido y errores controlados', async () => {
  const mock = friendsMock();
  const context = await startTestServer({ supabase: mock });
  const own = authFetch(TOKEN_A);
  const profileUrl = `${context.baseUrl}/api/amigos/${USER_B}/perfil`;
  try {
    assert.equal((await fetch(profileUrl)).status, 401);
    const response = await own(profileUrl);
    assert.equal(response.status, 200);
    const profile = await response.json();
    assert.equal(profile.username, 'BrickFan');
    assert.equal(profile.bricks, 100);
    assert.equal(profile.collection.total, 2);
    assert.deepEqual(profile.collection.latest.map(({ id }) => id), ['A-2', 'A-1']);
    assert.deepEqual(profile.wanted.latest.map(({ id }) => id), ['B-1']);
    assert.equal(profile.top5Price[0].id, 'A-2');
    assert.equal(profile.top5Age[0].id, 'A-1');
    assert.deepEqual(profile.achievements.map(({ id }) => id), ['second', 'first', 'gift']);
    const serialized = JSON.stringify(profile);
    for (const forbidden of ['private@example.invalid', 'currency', 'language', 'precio_compra', 'fecha_compra', 'Private OAuth name', 'private']) {
      assert.equal(serialized.includes(forbidden), false, forbidden);
    }
    assert.equal((await own(`${context.baseUrl}/api/amigos/${USER_A}/perfil`)).status, 400);
    assert.equal((await own(`${context.baseUrl}/api/amigos/not-a-uuid/perfil`)).status, 400);
    assert.equal((await own(`${context.baseUrl}/api/amigos/00000000-0000-4000-8000-00000000000d/perfil`)).status, 404);
    mock.failNext('amigos_perfil', { code: 'XX000', message: 'private SQL detail' }, 'rpc');
    const failed = await own(profileUrl);
    assert.equal(failed.status, 500);
    assert.deepEqual(await failed.json(), { error: 'AMIGOS_NO_DISPONIBLES' });
  } finally {
    await context.close();
  }
});

test('contadores propios y eliminación recíproca permiten una solicitud nueva', async () => {
  const mock = friendsMock();
  const context = await startTestServer({ supabase: mock });
  const own = authFetch(TOKEN_A);
  const other = authFetch(TOKEN_B);
  const outsider = authFetch(TOKEN_C);
  const base = `${context.baseUrl}/api/amigos`;
  try {
    assert.equal((await fetch(`${base}/contadores`)).status, 401);
    assert.equal((await fetch(`${base}/${USER_B}`, { method: 'DELETE' })).status, 401);
    assert.equal((await own(`${base}/contadores?userId=${USER_B}`)).status, 400);
    const sent = await (await own(`${base}/solicitudes`, {
      method: 'POST', body: JSON.stringify({ receptorId: USER_B }),
    })).json();
    assert.deepEqual(await (await own(`${base}/contadores`)).json(), { friends: 0, sent: 1, received: 0 });
    assert.deepEqual(await (await other(`${base}/contadores`)).json(), { friends: 0, sent: 0, received: 1 });
    await other(`${base}/solicitudes/${sent.requestId}/aceptar`, { method: 'POST' });
    assert.deepEqual(await (await own(`${base}/contadores`)).json(), { friends: 1, sent: 0, received: 0 });
    await outsider(`${base}/${USER_B}`, { method: 'DELETE' });
    assert.equal(mock.rows('friendships').length, 1);
    mock.failNext('friend_requests', { code: 'XX000', message: 'private failure' }, 'delete');
    assert.equal((await own(`${base}/${USER_B}`, { method: 'DELETE' })).status, 500);
    assert.equal(mock.rows('friendships').length, 1);
    assert.deepEqual(await (await other(`${base}/${USER_A}`, { method: 'DELETE' })).json(), { ok: true, removed: true });
    assert.equal(mock.rows('friendships').length, 0);
    assert.equal(mock.rows('friend_requests').length, 0);
    assert.equal(mock.rows('notificaciones').length, 0);
    assert.deepEqual(await (await own(`${base}/${USER_B}`, { method: 'DELETE' })).json(), { ok: true, removed: false });
    assert.deepEqual(await (await own(`${base}/contadores`)).json(), { friends: 0, sent: 0, received: 0 });
    assert.equal((await other(`${base}/solicitudes/${sent.requestId}/aceptar`, { method: 'POST' })).status, 404);
    assert.equal((await own(`${base}/solicitudes`, { method: 'POST', body: JSON.stringify({ receptorId: USER_B }) })).status, 201);
  } finally {
    await context.close();
  }
});

test('el repositorio elimina campos inesperados de la proyección de perfil', async () => {
  const repository = new AmigosRepository({
    userId: USER_A,
    client: {
      rpc: async () => ({
        error: null,
        data: {
          userId: USER_B, username: 'BrickFan', email: 'private@example.invalid', avatarUrl: null,
          bricks: 20, level: { id: 2, name: 'Level', private: 'hidden' },
          dna: { rarityHunter: 0, explorer: 25, collector: 50, fan: 25, weights: 'secret' },
          top5Price: [{ id: 'A-1', name: 'High', price: 20, precio_compra: 3, ownerEmail: 'secret' }],
          top5Age: [],
          collection: { total: 1, latest: [{ id: 'A-1', name: 'High', private: 'secret' }] },
          wanted: { total: 0, latest: [] },
          achievements: [{ id: 'collector', name: 'Collector', total: 5, email: 'secret', dnaWeights: [1, 2, 3, 4] }],
        },
      }),
    },
  });
  const profile = await repository.profile(USER_B);
  assert.deepEqual(profile.top5Price, [{ id: 'A-1', name: 'High', price: 20 }]);
  assert.deepEqual(profile.collection.latest, [{ id: 'A-1', name: 'High' }]);
  assert.deepEqual(profile.achievements, [{ id: 'collector', name: 'Collector', total: 5 }]);
  assert.equal(JSON.stringify(profile).includes('secret'), false);
  assert.equal(JSON.stringify(profile).includes('private@example.invalid'), false);
});