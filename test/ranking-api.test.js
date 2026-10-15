import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseMock } from '../test-support/supabase-mock.js';
import { TEST_TOKEN, OTHER_TOKEN, authFetch, startTestServer } from '../test-support/server.js';

const RANKING_USER = { id: '00000000-0000-4000-8000-00000000000a', email: 'a@example.com' };
const OTHER_RANKING_USER = { id: '00000000-0000-4000-8000-00000000000b', email: 'b@example.com' };

function rankingSupabase({ now } = {}) {
  const supabase = createSupabaseMock({ users: {
    [TEST_TOKEN]: { ...RANKING_USER, user_metadata: { full_name: 'Ada Google', avatar_url: 'https://example.com/ada.png' } },
    [OTHER_TOKEN]: { ...OTHER_RANKING_USER, user_metadata: { name: 'Grace Google', avatar_url: 'https://example.com/grace.png' } },
  }, ...(now ? { now } : {}) });
  supabase.seed('gamificacion', RANKING_USER.id, [{ bricks: 100, nivel: { id: 3, nombre: 'Three-Seven-Five' }, logros: [] }]);
  supabase.seed('gamificacion', OTHER_RANKING_USER.id, [{ bricks: 200, nivel: { id: 4, nombre: 'Citizen' }, logros: [{ id: 'woah', cantidad: 1 }] }]);
  supabase.seed('perfiles_publicos', OTHER_RANKING_USER.id, [{ display_name: 'Grace', avatar_url: 'https://example.com/grace.png' }]);
  supabase.seed('user_profiles', OTHER_RANKING_USER.id, [{ username: 'Grace' }]);
  supabase.seed('user_profiles', RANKING_USER.id, [{ username: 'AdaCollector' }]);
  supabase.seed('minifiguras', OTHER_RANKING_USER.id, [
    { id: 'HIGH', nombre: 'High', estado_coleccion: 'COLECCIÓN', precio: 50, anio: 2020 },
    { id: 'OLD', nombre: 'Old', estado_coleccion: 'COLECCIÓN', precio: 5, anio: 1980 },
    { id: 'WANTED', nombre: 'Wanted', estado_coleccion: 'BUSCADA', precio: 500, anio: 1970 },
  ]);
  return supabase;
}

test('el regalo semanal concede 5, notifica, admite gracias y se renueva independientemente del global', async () => {
  let instant = '2026-10-12T12:00:00Z';
  const supabase = createSupabaseMock({ now: () => instant, users: {
    [TEST_TOKEN]: RANKING_USER, [OTHER_TOKEN]: OTHER_RANKING_USER,
  } });
  for (const user of [RANKING_USER, OTHER_RANKING_USER]) supabase.seed('gamificacion', user.id, [{ bricks: 0, nivel: { id: 0 }, logros: [] }]);
  supabase.seed('user_daily_snapshots', OTHER_RANKING_USER.id,
    ['2026-10-11', '2026-10-12', '2026-10-18', '2026-10-19'].map((snapshot_date) => ({ snapshot_date, bricks: 10 })));
  const context = await startTestServer({ supabase });
  const donor = authFetch(TEST_TOKEN);
  const receiver = authFetch(OTHER_TOKEN);
  const url = `${context.baseUrl}/api/ranking/semanal/regalar`;
  const send = (payload = { receptorId: OTHER_RANKING_USER.id }) => donor(url, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  try {
    assert.equal((await fetch(url, { method: 'POST' })).status, 401);
    assert.equal((await donor(url)).status, 405);
    assert.equal((await send({ receptorId: OTHER_RANKING_USER.id, semana: '2026-10-19' })).status, 400);
    assert.equal((await send({ receptorId: RANKING_USER.id })).status, 400);
    assert.equal((await send({ receptorId: '00000000-0000-4000-8000-000000000099' })).status, 404);
    assert.equal((await send()).status, 200);
    assert.equal((await send()).status, 409);
    assert.equal(supabase.rows('gamificacion', OTHER_RANKING_USER.id)[0].bricks, 5);
    const notification = supabase.rows('notificaciones', OTHER_RANKING_USER.id).find(({ type }) => type === 'gift_received');
    assert.equal(notification.payload.amount, 5);
    assert.match(notification.payload.message, /Ranking Semanal/);
    const thanksUrl = `${context.baseUrl}/api/notificaciones/${notification.id}/agradecer`;
    assert.equal((await receiver(thanksUrl, { method: 'POST' })).status, 200);
    assert.equal((await receiver(thanksUrl, { method: 'POST' })).status, 409);
    const recalculated = await (await receiver(`${context.baseUrl}/gamificacion`)).json();
    assert.equal(recalculated.logros.find(({ id }) => id === 'youre-on-fire-this-week').total, 5);
    for (let index = 100; index < 110; index += 1) supabase.seed('gamificacion', `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, [{ bricks: 1000, nivel: { id: 9 }, logros: [] }]);
    const achievements = await (await donor(`${context.baseUrl}/api/ranking/${OTHER_RANKING_USER.id}/logros`)).json();
    assert.equal(achievements.logros.find(({ id }) => id === 'youre-on-fire-this-week').nombre, "You're on fire this week!");
    const globalGift = await donor(`${context.baseUrl}/api/ranking/regalar`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ receptorId: OTHER_RANKING_USER.id }),
    });
    assert.equal(globalGift.status, 200);
    instant = '2026-10-18T22:00:00Z';
    const ranking = await (await donor(`${context.baseUrl}/api/ranking/semanal`)).json();
    assert.equal(ranking.weekStart, '2026-10-19');
    assert.equal(ranking.entries[0].regaloEnviado, false);
    assert.equal((await send()).status, 200);
    assert.equal(supabase.rows('gamificacion', OTHER_RANKING_USER.id)[0].logros.find(({ id }) => id === 'youre-on-fire-this-week').total, 10);
  } finally {
    await context.close();
  }
});

test('el ranking valida los seis criterios y selecciona el Top 10 antes de proyectar datos publicos', async () => {
  const supabase = rankingSupabase();
  const ids = Array.from({ length: 12 }, (_, index) => `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`);
  const candidateAchievements = { 9: 'weirdo', 8: 'hooked', 7: 'land-ho', 6: 'nerd' };
  for (const [index, userId] of ids.entries()) {
    supabase.seed('gamificacion', userId, [{ bricks: index < 10 ? 1000 - index : 10,
      nivel: { id: index < 10 ? 5 : index === 10 ? 2 : 1 },
      logros: index < 10
        ? (candidateAchievements[index] ? [{ id: candidateAchievements[index], cantidad: 1 }] : [])
        : ['weirdo', 'hooked', 'land-ho', 'nerd'].map((id) => ({ id, cantidad: 1 })),
    }]);
    if (index === 9 || index >= 10) supabase.seed('minifiguras', userId, [
      { id: 'ONE', nombre: 'One', estado_coleccion: 'COLECCIÓN' },
      ...(index >= 10 ? [
        { id: 'TWO', nombre: 'Two', estado_coleccion: 'COLECCIÓN' },
        { id: 'THREE', nombre: 'Three', estado_coleccion: 'COLECCIÓN' },
      ] : []),
    ]);
  }
  const context = await startTestServer({ supabase });
  const get = authFetch(TEST_TOKEN);
  try {
    for (const criterio of ['nivel', 'coleccion', 'rarityHunter', 'collector', 'explorer', 'fan']) {
      const response = await get(`${context.baseUrl}/api/ranking?criterio=${criterio}`);
      assert.equal(response.status, 200);
      const ranking = await response.json();
      assert.equal(ranking.length, 10);
      assert.ok(ranking.every(({ userId }) => ids.slice(0, 10).includes(userId)));
      assert.equal(ranking.some(({ userId }) => ids.slice(10).includes(userId)), false);
      if (criterio === 'nivel') assert.deepEqual(ranking.map(({ userId }) => userId), ids.slice(0, 10));
      if (criterio === 'coleccion') assert.equal(ranking[0].userId, ids[9]);
      if (['rarityHunter', 'collector', 'explorer', 'fan'].includes(criterio)) {
        const winner = { rarityHunter: 9, collector: 8, explorer: 7, fan: 6 }[criterio];
        assert.equal(ranking[0].userId, ids[winner]);
        assert.equal(ranking[0].dnaRasgos[0].porcentaje, 100);
      }
      assert.ok(ranking.every((row) => !('porcentajes' in row) && row.dnaRasgos.length <= 2));
    }
    for (const query of ['criterio=invalid', 'criterio=', 'criterio=nivel&criterio=fan']) {
      const response = await get(`${context.baseUrl}/api/ranking?${query}`);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: 'PARAMETRO_INVALIDO', parametro: 'criterio' });
    }
  } finally {
    await context.close();
  }
});

test('GET /api/ranking exige autenticación y devuelve solo el contrato público', async () => {
  const context = await startTestServer({ supabase: rankingSupabase() });
  try {
    assert.equal((await fetch(`${context.baseUrl}/api/ranking`)).status, 401);
    const response = await authFetch(TEST_TOKEN)(`${context.baseUrl}/api/ranking`);
    assert.equal(response.status, 200);
    const ranking = await response.json();
    assert.equal(ranking[0].userId, OTHER_RANKING_USER.id);
    assert.equal(ranking[0].dnaPrincipal, 'Rarity Hunter');
    assert.equal(ranking[1].dnaPrincipal, 'Newbie');
    assert.deepEqual(ranking[0].dnaRasgos, [{ nombre: 'Rarity Hunter', porcentaje: 50 }, { nombre: 'Collector', porcentaje: 20 }]);
    assert.deepEqual(ranking[1].dnaRasgos, []);
    assert.equal('porcentajes' in ranking[0], false);
    assert.equal('dnaPonderaciones' in ranking[0], false);
    assert.equal(ranking[0].totalColeccion, 2);
    assert.deepEqual(ranking[0].top5Precio.map(({ id }) => id), ['HIGH', 'OLD']);
    assert.equal('email' in ranking[0], false);
    assert.deepEqual(context.supabase.rows('perfiles_publicos', RANKING_USER.id).map(({ display_name, avatar_url }) => ({ display_name, avatar_url })), [
      { display_name: 'AdaCollector', avatar_url: 'https://example.com/ada.png' },
    ]);
  } finally {
    await context.close();
  }
});

test('GET /api/ranking/semanal protege la lectura, fija el calendario y distingue disponibilidad de errores', async () => {
  let currentTime = '2026-10-08T12:00:00Z';
  const supabase = rankingSupabase({ now: () => new Date(currentTime) });
  const context = await startTestServer({ supabase });
  const get = authFetch(TEST_TOKEN);
  const path = `${context.baseUrl}/api/ranking/semanal`;
  try {
    assert.equal((await fetch(path)).status, 401);
    const wrongMethod = await get(path, { method: 'POST' });
    assert.equal(wrongMethod.status, 405);
    assert.equal(wrongMethod.headers.get('allow'), 'GET');
    for (const query of ['userId=any', 'date=2026-10-12', 'week=2026-10-12', 'criterio=nivel']) {
      const invalid = await get(`${path}?${query}`);
      assert.equal(invalid.status, 400);
      assert.deepEqual(await invalid.json(), { error: 'PARAMETRO_INVALIDO' });
    }

    const beforeLaunch = await get(path);
    assert.equal(beforeLaunch.status, 200);
    assert.deepEqual(await beforeLaunch.json(), {
      available: false, availableFrom: '2026-10-12', weekStart: '2026-10-05', weekEnd: '2026-10-11', entries: [],
    });

    currentTime = '2026-10-12T08:00:00Z';
    const mondayWithoutCapture = await get(path);
    assert.equal((await mondayWithoutCapture.json()).available, false);
    supabase.seed('user_daily_snapshots', OTHER_RANKING_USER.id, [
      { snapshot_date: '2026-10-11', bricks: 100 },
      { snapshot_date: '2026-10-12', bricks: 250 },
    ]);
    const available = await get(path);
    assert.equal(available.status, 200);
    const weekly = await available.json();
    assert.equal(weekly.available, true);
    assert.equal(weekly.entries[0].userId, OTHER_RANKING_USER.id);
    assert.equal(weekly.entries[0].bricksSemanales, 150);
    assert.equal(weekly.entries[0].bricks, 200);
    assert.equal(weekly.entries[0].snapshotDate, '2026-10-12');

    supabase.failNext('ranking_semanal', { message: 'secret storage details' });
    const failed = await get(path);
    assert.equal(failed.status, 500);
    assert.deepEqual(await failed.json(), { error: 'RANKING_SEMANAL_NO_DISPONIBLE' });
    assert.deepEqual(supabase.adminCalls(), []);
    const unchangedGlobal = await get(`${context.baseUrl}/api/ranking`);
    assert.equal(unchangedGlobal.status, 200);
  } finally {
    await context.close();
  }
});

test('GET logros exige sesion, valida UUID y proyecta datos sin modificar gamificacion', async () => {
  const context = await startTestServer({ supabase: rankingSupabase() });
  const path = `${context.baseUrl}/api/ranking/${OTHER_RANKING_USER.id}/logros`;
  const get = authFetch(TEST_TOKEN);
  try {
    const before = context.supabase.rows('gamificacion');
    assert.equal((await fetch(path)).status, 401);
    const response = await get(path);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { userId: OTHER_RANKING_USER.id, displayName: 'Grace', bricks: 200,
      nivel: { id: 4, nombre: 'Citizen' }, logros: [{ id: 'woah', cantidad: 1 }] });
    assert.deepEqual(context.supabase.rows('gamificacion'), before);
    const invalid = await get(`${context.baseUrl}/api/ranking/invalido/logros`);
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { error: 'USUARIO_INVALIDO' });
    const missing = await get(`${context.baseUrl}/api/ranking/00000000-0000-4000-8000-000000000099/logros`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'USUARIO_NO_ENCONTRADO' });
    context.supabase.failNext('ranking_logros', { message: 'secret details' });
    const failure = await get(path);
    assert.equal(failure.status, 500);
    assert.deepEqual(await failure.json(), { error: 'LOGROS_NO_DISPONIBLES' });
    for (let index = 0; index < 10; index += 1) {
      context.supabase.seed('gamificacion', `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`, [{ bricks: 1000 }]);
    }
    assert.equal((await get(path)).status, 404);
    assert.equal((await get(path, { method: 'POST' })).status, 405);
  } finally {
    await context.close();
  }
});

test('POST /api/ranking/regalar aplica validación y errores de dominio sin suplantación', async () => {
  const context = await startTestServer({ supabase: rankingSupabase() });
  const post = (body) => authFetch(TEST_TOKEN)(`${context.baseUrl}/api/ranking/regalar`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  try {
    assert.deepEqual(await (await post({ receptorId: OTHER_RANKING_USER.id })).json(), { ok: true });
    assert.equal(context.supabase.rows('gamificacion', OTHER_RANKING_USER.id)[0].bricks, 250);
    assert.equal(context.supabase.rows('gamificacion', RANKING_USER.id)[0].bricks, 100);

    const duplicate = await post({ receptorId: OTHER_RANKING_USER.id });
    assert.equal(duplicate.status, 409);
    assert.deepEqual(await duplicate.json(), { error: 'REGALO_YA_ENVIADO' });

    const self = await post({ receptorId: RANKING_USER.id });
    assert.equal(self.status, 400);
    assert.deepEqual(await self.json(), { error: 'AUTORREGALO_NO_PERMITIDO' });

    const missing = await post({ receptorId: '00000000-0000-4000-8000-000000000099' });
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'RECEPTOR_NO_ENCONTRADO' });

    const spoof = await post({ receptorId: OTHER_RANKING_USER.id, donanteId: OTHER_RANKING_USER.id });
    assert.equal(spoof.status, 400);
    assert.deepEqual(await spoof.json(), { error: 'PARAMETRO_INVALIDO', parametro: 'receptorId' });
    assert.equal(context.supabase.rows('regalos_enviados').length, 1);
  } finally {
    await context.close();
  }
});