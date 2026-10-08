import assert from 'node:assert/strict';
import test from 'node:test';
import { startApplication } from '../src/server.js';
import { createDailyAnalyticsJobs } from '../src/daily-analytics-jobs.js';
import { DailyAnalyticsRepository } from '../src/daily-analytics-repository.js';
import { createSupabaseMock } from '../test-support/supabase-mock.js';
import { startTestServer, TEST_USER, TEST_SUPABASE_CONFIG } from '../test-support/server.js';

const CRON_SECRET = 'cron-test-secret';
const JOB_ID = '90000000-0000-4000-8000-000000000001';
const SNAPSHOT_DATE = '2026-10-07';

function createJobs() {
  const calls = [];
  return {
    calls,
    async start() {
      calls.push('start');
      return { jobId: JOB_ID, status: 'pending', snapshotDate: SNAPSHOT_DATE };
    },
    async status(jobId) {
      calls.push(`status:${jobId}`);
      return jobId === JOB_ID ? {
        jobId,
        status: 'completed',
        snapshotDate: SNAPSHOT_DATE,
        processedUsers: 1,
        totalUsers: 1,
        failedPrices: 0,
        result: { success: true, processedUsers: 1, timestamp: '2026-10-07T03:10:00.000Z' },
      } : null;
    },
  };
}

test('cron protege inicio/estado sin ejecutar RPC para credenciales incorrectas ni JWT', async () => {
  const dailyAnalyticsJobs = createJobs();
  const server = await startTestServer({ options: { cronSecret: CRON_SECRET, dailyAnalyticsJobs } });
  try {
    for (const authorization of [undefined, 'Bearer wrong-secret', 'Bearer token-navegador']) {
      const response = await fetch(`${server.baseUrl}/api/cron/daily-sync`, {
        method: 'POST',
        headers: authorization ? { authorization } : {},
      });
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: 'CRON_NO_AUTORIZADO' });
    }
    const status = await fetch(`${server.baseUrl}/api/cron/daily-sync/${JOB_ID}`, {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    assert.equal(status.status, 401);
    assert.deepEqual(dailyAnalyticsJobs.calls, []);
  } finally {
    await server.close();
  }
});

test('cron responde 202 durable, rechaza identidad/fecha de cliente y expone estado agregado', async () => {
  const dailyAnalyticsJobs = createJobs();
  const server = await startTestServer({ options: {
    cronSecret: CRON_SECRET,
    adminConfig: { url: 'https://supabase.invalid', serviceRoleKey: 'must-not-leak' },
    dailyAnalyticsJobs,
  } });
  const headers = { authorization: `Bearer ${CRON_SECRET}` };
  try {
    const started = await fetch(`${server.baseUrl}/api/cron/daily-sync`, { method: 'POST', headers });
    assert.equal(started.status, 202);
    assert.deepEqual(await started.json(), { jobId: JOB_ID, status: 'pending', snapshotDate: SNAPSHOT_DATE });

    for (const [url, body] of [
      [`${server.baseUrl}/api/cron/daily-sync?date=2026-10-06`, undefined],
      [`${server.baseUrl}/api/cron/daily-sync`, JSON.stringify({ userId: TEST_USER.id })],
      [`${server.baseUrl}/api/cron/daily-sync`, JSON.stringify({ snapshotDate: '2026-10-06' })],
    ]) {
      const rejected = await fetch(url, {
        method: 'POST', headers: { ...headers, ...(body ? { 'content-type': 'application/json' } : {}) }, body,
      });
      assert.equal(rejected.status, 400);
      assert.deepEqual(await rejected.json(), { error: 'PARAMETRO_INVALIDO' });
    }

    const state = await fetch(`${server.baseUrl}/api/cron/daily-sync/${JOB_ID}`, { headers });
    assert.equal(state.status, 200);
    const stateBody = await state.json();
    assert.equal(stateBody.status, 'completed');
    assert.deepEqual(Object.keys(stateBody).sort(), [
      'failedPrices', 'jobId', 'processedUsers', 'result', 'snapshotDate', 'status', 'totalUsers',
    ]);
    assert.equal(JSON.stringify(stateBody).includes('must-not-leak'), false);
    assert.equal(dailyAnalyticsJobs.calls.filter((call) => call === 'start').length, 1);
    assert.equal(dailyAnalyticsJobs.calls.filter((call) => call.startsWith('status:')).length, 1);

    const unknown = await fetch(`${server.baseUrl}/api/cron/daily-sync/90000000-0000-4000-8000-000000000099`, { headers });
    assert.equal(unknown.status, 404);
    assert.deepEqual(await unknown.json(), { error: 'CRON_TRABAJO_NO_ENCONTRADO' });
  } finally {
    await server.close();
  }
});

test('cron informa secreto ausente y limita metodos', async () => {
  const disabled = await startTestServer({ options: { cronSecret: null, dailyAnalyticsJobs: createJobs() } });
  try {
    const response = await fetch(`${disabled.baseUrl}/api/cron/daily-sync`, { method: 'POST' });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'CRON_NO_CONFIGURADO' });
  } finally {
    await disabled.close();
  }

  const jobs = createJobs();
  const server = await startTestServer({ options: { cronSecret: CRON_SECRET, dailyAnalyticsJobs: jobs } });
  const headers = { authorization: `Bearer ${CRON_SECRET}` };
  try {
    const startGet = await fetch(`${server.baseUrl}/api/cron/daily-sync`, { headers });
    assert.equal(startGet.status, 405);
    assert.equal(startGet.headers.get('allow'), 'POST');
    const statusPost = await fetch(`${server.baseUrl}/api/cron/daily-sync/${JOB_ID}`, { method: 'POST', headers });
    assert.equal(statusPost.status, 405);
    assert.equal(statusPost.headers.get('allow'), 'GET');
    const malformed = await fetch(`${server.baseUrl}/api/cron/daily-sync/not-a-uuid`, { headers });
    assert.equal(malformed.status, 404);
    assert.deepEqual(jobs.calls, []);
  } finally {
    await server.close();
  }
});

test('startup recupera antes de escuchar y 202 llega antes del scraping con resultado final unico', async () => {
  const mock = createSupabaseMock({ users: { 'token-user': TEST_USER } });
  mock.seed('minifiguras', TEST_USER.id, [{
    id: 'FIG-SLOW', nombre: 'Slow figure', categoria: 'Space', estado_coleccion: 'COLECCIÓN', precio: 8,
  }]);
  const repository = new DailyAnalyticsRepository({ client: mock.createAdminClient() });
  let releaseScrape;
  let scrapeStarted;
  const scrapeGate = new Promise((resolve) => { releaseScrape = resolve; });
  const scrapeStartedPromise = new Promise((resolve) => { scrapeStarted = resolve; });
  const scraper = {
    async getPrice() {
      scrapeStarted();
      await scrapeGate;
      return 12;
    },
  };
  const dailyAnalyticsJobs = createDailyAnalyticsJobs({
    repository,
    brickset: scraper,
    categoriasRepository: { async read() { return []; } },
  });
  const lifecycle = [];
  const server = await startApplication({
    adminConfig: { url: 'https://supabase.invalid', serviceRoleKey: 'startup-only-test-key' },
    supabaseConfig: TEST_SUPABASE_CONFIG,
    cronSecret: CRON_SECRET,
    createSupabaseClient: () => mock.createAdminClient(),
    categoriesRepository: { async read() { return []; } },
    recalculator: { async start() { lifecycle.push('recalculator-start'); }, close() { lifecycle.push('recalculator-close'); } },
    analyticsRepository: repository,
    analyticsJobs: {
      async recover() { lifecycle.push('worker-recover'); return dailyAnalyticsJobs.recover(); },
      start: (...args) => dailyAnalyticsJobs.start(...args),
      status: (...args) => dailyAnalyticsJobs.status(...args),
      close() { lifecycle.push('worker-close'); dailyAnalyticsJobs.close(); },
    },
    scraper,
    port: 0,
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const headers = { authorization: `Bearer ${CRON_SECRET}` };
  try {
    assert.deepEqual(lifecycle.slice(0, 2), ['recalculator-start', 'worker-recover']);
    const firstStart = await fetch(`${baseUrl}/api/cron/daily-sync`, { method: 'POST', headers });
    assert.equal(firstStart.status, 202);
    const firstRun = await firstStart.json();
    await scrapeStartedPromise;

    const duplicateStart = await fetch(`${baseUrl}/api/cron/daily-sync`, { method: 'POST', headers });
    assert.equal(duplicateStart.status, 202);
    assert.equal((await duplicateStart.json()).jobId, firstRun.jobId);
    assert.equal(mock.analyticsRows('runs').length, 1);

    releaseScrape();
    await dailyAnalyticsJobs.waitForIdle();
    const finalResponse = await fetch(`${baseUrl}/api/cron/daily-sync/${firstRun.jobId}`, { headers });
    assert.equal(finalResponse.status, 200);
    const result = await finalResponse.json();
    assert.equal(result.status, 'completed');
    assert.equal(result.processedUsers, 1);
    assert.equal(result.result.success, true);
    assert.equal(result.result.processedUsers, 1);
    assert.match(result.result.timestamp, /^\d{4}-\d{2}-\d{2}T.*Z$/);
    assert.equal(mock.analyticsRows('snapshots').length, 1);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  assert.deepEqual(lifecycle.slice(-2), ['recalculator-close', 'worker-close']);
});