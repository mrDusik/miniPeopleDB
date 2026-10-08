import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OTHER_USER,
  TEST_USER,
  createTestSupabase,
  startTestServer,
} from '../test-support/server.js';

const snapshot = (userId, date, figures, value) => ({
  user_id: userId,
  snapshot_date: date,
  total_figures: String(figures),
  total_value: String(value),
  bricks: '59',
  level: '1',
  pct_collector: '60.00',
  pct_explorer: '10.00',
  pct_rarity_hunter: '10.00',
  pct_fan: '20.00',
});

test('history API devuelve orden ascendente, numeros y baseline propios bajo JWT/RLS', async () => {
  const supabase = createTestSupabase();
  supabase.seed('user_daily_snapshots', TEST_USER.id, [
    snapshot(TEST_USER.id, '2026-09-30', 4, 40),
    snapshot(TEST_USER.id, '2026-10-01', 5, 50),
    snapshot(TEST_USER.id, '2026-10-03', 3, 30),
  ]);
  supabase.seed('user_daily_snapshots', OTHER_USER.id, [
    snapshot(OTHER_USER.id, '2026-09-30', 900, 9000),
    snapshot(OTHER_USER.id, '2026-10-02', 901, 9001),
  ]);
  const server = await startTestServer({ supabase });
  try {
    const response = await fetch(`${server.baseUrl}/api/analytics/history?from=2026-10-01&to=2026-10-03`, {
      headers: { authorization: 'Bearer token-usuario-a' },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.snapshots.map(({ snapshotDate, totalFigures, totalValue }) => ({ snapshotDate, totalFigures, totalValue })), [
      { snapshotDate: '2026-10-01', totalFigures: 5, totalValue: 50 },
      { snapshotDate: '2026-10-03', totalFigures: 3, totalValue: 30 },
    ]);
    assert.deepEqual(body.baseline, { snapshotDate: '2026-09-30', totalFigures: 4 });
    assert.deepEqual(body.snapshots[0].dna, { collector: 60, explorer: 10, rarityHunter: 10, fan: 20 });
    assert.equal(JSON.stringify(body).includes(OTHER_USER.id), false);
    assert.equal(JSON.stringify(body).includes('9001'), false);
  } finally {
    await server.close();
  }
});

test('history API devuelve historico vacio, exige sesion y oculta fallos de persistencia', async () => {
  const supabase = createTestSupabase();
  const server = await startTestServer({ supabase });
  try {
    const anonymous = await fetch(`${server.baseUrl}/api/analytics/history?from=2026-10-01&to=2026-10-03`);
    assert.equal(anonymous.status, 401);

    const empty = await fetch(`${server.baseUrl}/api/analytics/history?from=2026-10-01&to=2026-10-03`, {
      headers: { authorization: 'Bearer token-usuario-a' },
    });
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), { snapshots: [], baseline: null });

    supabase.failNext('user_daily_snapshots');
    const unavailable = await fetch(`${server.baseUrl}/api/analytics/history?from=2026-10-01&to=2026-10-03`, {
      headers: { authorization: 'Bearer token-usuario-a' },
    });
    assert.equal(unavailable.status, 500);
    assert.deepEqual(await unavailable.json(), { error: 'HISTORICO_NO_DISPONIBLE' });
  } finally {
    await server.close();
  }
});

test('history valida calendario, rangos inclusivos, query estricta y defaults de Madrid', async () => {
  const supabase = createTestSupabase();
  supabase.seed('user_daily_snapshots', TEST_USER.id, [
    snapshot(TEST_USER.id, '2026-07-09', 1, 10),
    snapshot(TEST_USER.id, '2026-07-10', 2, 20),
    snapshot(TEST_USER.id, '2026-10-07', 3, 30),
  ]);
  const server = await startTestServer({
    supabase,
    options: { now: () => new Date('2026-10-06T22:30:00.000Z') },
  });
  const headers = { authorization: 'Bearer token-usuario-a' };
  try {
    const defaults = await fetch(`${server.baseUrl}/api/analytics/history`, { headers });
    assert.equal(defaults.status, 200);
    const defaultBody = await defaults.json();
    assert.deepEqual(defaultBody.snapshots.map(({ snapshotDate }) => snapshotDate), ['2026-07-10', '2026-10-07']);
    assert.deepEqual(defaultBody.baseline, { snapshotDate: '2026-07-09', totalFigures: 1 });

    for (const query of [
      'from=2026-02-30&to=2026-03-01',
      'from=2026-10-03&to=2026-10-01',
      'from=2025-12-31&to=2027-01-01',
      'from=2026-10-01&from=2026-10-02&to=2026-10-03',
      'from=2026-10-01&to=2026-10-03&userId=00000000-0000-0000-0000-00000000000a',
      'from=&to=2026-10-03',
    ]) {
      const invalid = await fetch(`${server.baseUrl}/api/analytics/history?${query}`, { headers });
      assert.equal(invalid.status, 400, query);
      assert.deepEqual(await invalid.json(), { error: 'PARAMETRO_INVALIDO' });
    }

    for (const range of [
      'from=2028-02-29&to=2028-02-29',
      'from=2026-03-29&to=2026-03-30',
      'from=2026-01-01&to=2027-01-01',
    ]) {
      const valid = await fetch(`${server.baseUrl}/api/analytics/history?${range}`, { headers });
      assert.equal(valid.status, 200, range);
    }

    const method = await fetch(`${server.baseUrl}/api/analytics/history?from=2026-10-01&to=2026-10-03`, {
      method: 'POST', headers,
    });
    assert.equal(method.status, 405);
    assert.equal(method.headers.get('allow'), 'GET');
  } finally {
    await server.close();
  }
});