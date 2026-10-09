import assert from 'node:assert/strict';
import test from 'node:test';
import { createDailyAnalyticsJobs } from '../src/daily-analytics-jobs.js';
import { DailyAnalyticsRepository } from '../src/daily-analytics-repository.js';
import { BricksetScraper } from '../src/brickset-scraper.js';
import { createBricksetSyncJobs } from '../src/brickset-sync-jobs.js';
import { categoriasMock } from '../test-support/fixtures.js';
import { createSupabaseMock } from '../test-support/supabase-mock.js';

const USER_A = '00000000-0000-4000-8000-00000000000a';
const USER_B = '00000000-0000-4000-8000-00000000000b';

function analyticsHarness({ users = [USER_A], figures = [], brickset, categories = [], coordinatorOptions = {} } = {}) {
  const authUsers = Object.fromEntries(users.map((id, index) => [`token-${index}`, { id }]));
  const mock = createSupabaseMock({ users: authUsers });
  for (const figure of figures) mock.seed('minifiguras', figure.user_id, [figure]);
  const repository = new DailyAnalyticsRepository({ client: mock.createAdminClient() });
  const jobs = createDailyAnalyticsJobs({
    repository,
    brickset: brickset ?? { async getPrice() { return 10; } },
    categoriasRepository: { async read() { return categories; } },
    heartbeatMs: 1000,
    ...coordinatorOptions,
  });
  return { jobs, mock, repository };
}

test('procesa usuarios vacios y captura una vez; IDs repetidos se refrescan una vez', async () => {
  const requested = [];
  const { jobs, mock } = analyticsHarness({
    users: [USER_A, USER_B],
    figures: [
      { user_id: USER_A, id: 'FIG-SHARED', nombre: 'Shared', categoria: 'Test', estado_coleccion: 'COLECCIÓN', precio: 8 },
      { user_id: USER_B, id: 'FIG-SHARED', nombre: 'Shared', categoria: 'Test', estado_coleccion: 'BUSCADA', precio: 9 },
    ],
    brickset: { async getPrice(id) { requested.push(id); return 12; } },
  });
  const started = await jobs.start();
  const repeated = await jobs.start();
  assert.equal(repeated.jobId, started.jobId);
  await jobs.waitForIdle();

  const status = await jobs.status(started.jobId);
  const snapshots = mock.analyticsRows('snapshots');
  assert.equal(status.status, 'completed');
  assert.equal(status.processedUsers, 2);
  assert.deepEqual(requested, ['FIG-SHARED']);
  assert.equal(snapshots.length, 2);
  assert.ok(snapshots.some(({ user_id, total_figures, total_value, level }) => user_id === USER_A && total_figures === 1 && total_value === 12 && level === 0));
  assert.ok(snapshots.some(({ user_id, total_figures, total_value, level }) => user_id === USER_B && total_figures === 0 && total_value === 0 && level === 0));
});

test('daily-sync conserva logros y Bricks derivados del ledger de agradecimientos', async () => {
  const { jobs, mock } = analyticsHarness({ users: [USER_A, USER_B] });
  mock.seed('agradecimientos_regalo', USER_A, [{
    gift_notification_id: 'gift-notification-a', thanker_id: USER_A, donor_id: USER_B,
  }]);

  await jobs.start();
  await jobs.waitForIdle();

  const thanker = mock.rows('gamificacion', USER_A)[0];
  const donor = mock.rows('gamificacion', USER_B)[0];
  assert.equal(thanker.logros.some(({ id }) => id === 'thanks-for-the-gift'), false);
  assert.equal(thanker.bricks, 0);
  assert.equal(donor.logros.find(({ id }) => id === 'thanks-for-the-gift')?.cantidad, 1);
  assert.equal(donor.bricks, 10);
});

test('usa el scraper compartido, deduplica el ID y preserva precios ante fallo', async () => {
  const requested = [];
  const { jobs, mock } = analyticsHarness({
    users: [USER_A, USER_B],
    figures: [
      { user_id: USER_A, id: 'FIG-SHARED', nombre: 'Shared', categoria: 'Test', estado_coleccion: 'COLECCIÓN', precio: 8 },
      { user_id: USER_B, id: 'FIG-SHARED', nombre: 'Shared', categoria: 'Test', estado_coleccion: 'COLECCIÓN', precio: 9 },
      { user_id: USER_B, id: 'FIG-FAIL', nombre: 'Failure', categoria: 'Test', estado_coleccion: 'COLECCIÓN', precio: 4 },
    ],
    brickset: {
      async getPrice(id) {
        requested.push(id);
        if (id === 'FIG-FAIL') throw Object.assign(new Error(), { code: 'BRICKSET_TIMEOUT' });
        return 12;
      },
    },
  });
  await jobs.start();
  await jobs.waitForIdle();
  const prices = mock.analyticsRows('prices');
  assert.deepEqual(requested.sort(), ['FIG-FAIL', 'FIG-SHARED']);
  assert.equal(prices.find(({ figure_id }) => figure_id === 'FIG-FAIL').failure_code, 'TIMEOUT');
  assert.equal(mock.rows('minifiguras').find(({ id }) => id === 'FIG-FAIL').precio, 4);
  assert.equal((await jobs.status(mock.analyticsRows('runs')[0].id)).status, 'completed');
});

test('relee fuentes cuando una captura detecta una revision obsoleta', async () => {
  let sourceReads = 0;
  const captures = [];
  const run = { jobId: 'run-1', status: 'pending', snapshotDate: '2026-10-07' };
  const calls = [];
  const repository = {
    async start() { return run; },
    async recover() { return run; },
    async status() { return { status: 'completed', processedUsers: 1 }; },
    async claim() { return true; },
    async renew() { return true; },
    async pricesPage() { return []; },
    async usersPage(_runId, _owner, after) { return after ? [] : [{ user_id: USER_A }]; },
    async sources() {
      sourceReads += 1;
      return { revision: `revision-${sourceReads}`, figures: [], giftsReceived: 0 };
    },
    async captureUser(_runId, _owner, userId, revision, state) {
      captures.push({ userId, revision, state });
      return captures.length > 1;
    },
    async finalize() { calls.push('finalize'); },
    async failUser() { calls.push('failUser'); },
    async fail() { calls.push('fail'); },
  };
  const jobs = createDailyAnalyticsJobs({
    repository,
    brickset: { async getPrice() { return 1; } },
    categoriasRepository: { async read() { return []; } },
  });
  await jobs.start();
  await jobs.waitForIdle();
  assert.equal(sourceReads, 2);
  assert.deepEqual(captures.map(({ revision }) => revision), ['revision-1', 'revision-2']);
  assert.deepEqual(calls, ['finalize']);
});

test('recupera el run persistido y mantiene heartbeat durante una consulta larga', async () => {
  let heartbeat;
  let releasePrice;
  let renewals = 0;
  const priceGate = new Promise((resolve) => { releasePrice = resolve; });
  const user = { user_id: USER_A };
  const run = { jobId: 'run-recovery', status: 'running', snapshotDate: '2026-10-07' };
  const repositoryCalls = [];
  const repository = {
    async start() { return run; },
    async recover() { repositoryCalls.push('recover'); return run; },
    async status() { return null; },
    async claim() { repositoryCalls.push('claim'); return true; },
    async renew() { renewals += 1; return true; },
    async pricesPage(_runId, _owner, after) { return after ? [] : [{ figure_id: 'FIG-1' }]; },
    async usersPage(_runId, _owner, after) { return after ? [] : [user]; },
    async applyPrice() { repositoryCalls.push('price'); },
    async sources() { return { revision: 'r1', figures: [], giftsReceived: 0 }; },
    async captureUser() { return true; },
    async finalize() { repositoryCalls.push('finalize'); },
    async fail() { repositoryCalls.push('fail'); },
  };
  const jobs = createDailyAnalyticsJobs({
    repository,
    brickset: { async getPrice() { await priceGate; return 1; } },
    categoriasRepository: { async read() { return []; } },
    setIntervalImpl(callback) { heartbeat = callback; return { unref() {} }; },
    clearIntervalImpl() {},
  });
  assert.equal((await jobs.recover()).jobId, run.jobId);
  while (!heartbeat) await new Promise((resolve) => setTimeout(resolve, 0));
  await heartbeat();
  assert.equal(renewals, 1);
  releasePrice();
  await jobs.waitForIdle();
  assert.deepEqual(repositoryCalls, ['recover', 'claim', 'price', 'finalize']);
});

test('reintenta errores transitorios de almacenamiento con backoff acotado e inyectable', async () => {
  const run = { jobId: 'run-backoff', status: 'pending', snapshotDate: '2026-10-07' };
  const sleeps = [];
  let pageCalls = 0;
  const repository = {
    async start() { return run; },
    async recover() { return null; },
    async status() { return null; },
    async claim() { return true; },
    async renew() { return true; },
    async pricesPage() { return []; },
    async usersPage() {
      pageCalls += 1;
      if (pageCalls === 1) throw new Error('temporary storage error');
      return [];
    },
    async finalize() { return { status: 'completed' }; },
    async fail() { assert.fail('transient storage error should recover'); },
  };
  const jobs = createDailyAnalyticsJobs({
    repository,
    brickset: { async getPrice() { return 1; } },
    categoriasRepository: { async read() { return []; } },
    sleepImpl: async (duration) => sleeps.push(duration),
    storageRetryDelaysMs: [5, 10],
  });
  await jobs.start();
  await jobs.waitForIdle();
  assert.deepEqual(sleeps, [5]);
  assert.equal(pageCalls, 2);
});

test('el cierre aborta fetch activo, limpia heartbeat y deja el trabajo recuperable', async () => {
  const run = { jobId: 'run-close', status: 'pending', snapshotDate: '2026-10-07' };
  let requestSignal;
  let heartbeatCallback;
  let heartbeatCleared = false;
  let applied = false;
  const repository = {
    async start() { return run; },
    async recover() { return run; },
    async status() { return null; },
    async claim() { return true; },
    async renew() { return true; },
    async pricesPage(_runId, _owner, after) { return after ? [] : [{ figure_id: 'FIG-1' }]; },
    async applyPrice() { applied = true; },
    async usersPage() { return []; },
    async finalize() {},
    async fail() { assert.fail('shutdown must leave the lease for recovery'); },
  };
  const jobs = createDailyAnalyticsJobs({
    repository,
    brickset: {
      getPrice(_figureId, { signal }) {
        requestSignal = signal;
        return new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error(), { code: 'BRICKSET_CANCELADO' })), { once: true }));
      },
    },
    categoriasRepository: { async read() { return []; } },
    setIntervalImpl(callback) { heartbeatCallback = callback; return { unref() {} }; },
    clearIntervalImpl() { heartbeatCleared = true; },
  });

  await jobs.start();
  while (!requestSignal) await new Promise((resolve) => setTimeout(resolve, 0));
  jobs.close();
  await jobs.waitForIdle();
  assert.equal(requestSignal.aborted, true);
  assert.equal(heartbeatCleared, true);
  assert.equal(typeof heartbeatCallback, 'function');
  assert.equal(applied, false);
  assert.equal((await jobs.recover()).jobId, run.jobId);
});

test('reanuda tras la fase de precios y una captura, rechaza al worker viejo y conserva fecha Madrid', async () => {
  const authUsers = {
    'token-a': { id: USER_A },
    'token-b': { id: USER_B },
  };
  const mock = createSupabaseMock({ users: authUsers });
  mock.seed('minifiguras', USER_A, [{ id: 'FIG-A', nombre: 'A', categoria: 'Test', estado_coleccion: 'COLECCIÓN', precio: 8 }]);
  mock.seed('minifiguras', USER_B, [{ id: 'FIG-B', nombre: 'B', categoria: 'Test', estado_coleccion: 'COLECCIÓN', precio: 9 }]);
  const repository = new DailyAnalyticsRepository({ client: mock.createAdminClient() });
  const started = await repository.start();
  const oldOwner = 'old-worker-owner';
  await repository.claim(started.jobId, oldOwner);
  const pricePage = await repository.pricesPage(started.jobId, oldOwner);
  for (const { figure_id } of pricePage) {
    await repository.applyPrice(started.jobId, oldOwner, figure_id, { success: true, price: 15 });
  }
  const firstSources = await repository.sources(started.jobId, oldOwner, USER_A);
  const state = {
    bricks: 0,
    nivel: { id: 0, nombre: 'Duplo' },
    siguiente_nivel: { id: 1, nombre: 'Stud' },
    progreso: { actual: 0 },
    logros: [],
  };
  await repository.captureUser(started.jobId, oldOwner, USER_A, firstSources.revision, state);
  mock.expireDailySyncLease(started.jobId);
  await assert.rejects(repository.applyPrice(started.jobId, oldOwner, 'FIG-B', { success: true, price: 999 }));

  const requestDate = started.snapshotDate;
  let clock = new Date(`${requestDate}T23:59:59.000Z`).getTime();
  const refreshedPrices = [];
  const resumed = createDailyAnalyticsJobs({
    repository,
    brickset: { async getPrice(id) { refreshedPrices.push(id); return 25; } },
    categoriasRepository: { async read() { return []; } },
    now: () => clock,
  });
  clock += 2 * 60 * 60 * 1000;
  const recovered = await resumed.recover();
  assert.equal(recovered.snapshotDate, requestDate);
  await resumed.waitForIdle();

  const finalStatus = await repository.status(started.jobId);
  assert.equal(finalStatus.status, 'completed');
  assert.equal(finalStatus.snapshotDate, requestDate);
  assert.equal(finalStatus.processedUsers, 2);
  assert.deepEqual(refreshedPrices, []);
  assert.equal(mock.analyticsRows('snapshots').length, 2);
  assert.equal(mock.analyticsRows('prices').every(({ status }) => status === 'completed'), true);
});

test('usa el queue compartido del scraper y reintenta 429 antes del checkpoint', async () => {
  let activeRequests = 0;
  let maximumConcurrent = 0;
  const requested = [];
  const attempts = new Map();
  const scraper = new BricksetScraper({
    minIntervalMs: 0,
    timeoutMs: 100,
    maxRateLimitRetries: 2,
    fetchImpl: async (url) => {
      const id = decodeURIComponent(url.split('/').at(-1));
      requested.push(id);
      activeRequests += 1;
      maximumConcurrent = Math.max(maximumConcurrent, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, 0));
      activeRequests -= 1;
      const count = (attempts.get(id) ?? 0) + 1;
      attempts.set(id, count);
      if (id === 'FIG-ANALYTICS' && count === 1) {
        return { status: 429, headers: { get: () => '0' }, ok: false };
      }
      return {
        status: 200,
        ok: true,
        async text() { return '<div>Current Value - New €12.50</div>'; },
      };
    },
  });
  const { jobs, mock } = analyticsHarness({
    users: [USER_A],
    figures: [{ user_id: USER_A, id: 'FIG-ANALYTICS', nombre: 'Figure', categoria: 'Test', estado_coleccion: 'COLECCIÓN', precio: 8 }],
    brickset: scraper,
  });
  const syncJobs = createBricksetSyncJobs({ brickset: scraper });
  const ordinaryRepository = {
    async readCatalog() { return [{ id: 'ORDINARY' }]; },
    async updatePrice(id, price) { return { id, price }; },
  };
  const analyticsRun = await jobs.start();
  await syncJobs.start(USER_B, ordinaryRepository);
  await jobs.waitForIdle();

  assert.equal((await jobs.status(analyticsRun.jobId)).status, 'completed');
  assert.equal(maximumConcurrent, 1);
  assert.equal(attempts.get('FIG-ANALYTICS'), 2);
  assert.ok(requested.includes('ORDINARY'));
  assert.equal(mock.analyticsRows('prices', analyticsRun.jobId).find(({ figure_id }) => figure_id === 'FIG-ANALYTICS').status, 'completed');
  assert.equal(mock.rows('minifiguras', USER_A)[0].precio, 12.5);
});

test('impone timeout finito de scraping y persiste el fallo sin sustituir el precio anterior', async () => {
  let requestSignal;
  const { jobs, mock } = analyticsHarness({
    users: [USER_A],
    figures: [{ user_id: USER_A, id: 'FIG-HANG', nombre: 'Slow', categoria: 'Test', estado_coleccion: 'COLECCIÓN', precio: 7 }],
    brickset: {
      getPrice(_id, { signal }) {
        requestSignal = signal;
        return new Promise(() => {});
      },
    },
    coordinatorOptions: { scraperTimeoutMs: 10 },
  });
  const started = await jobs.start();
  await jobs.waitForIdle();
  const price = mock.analyticsRows('prices', started.jobId)[0];
  assert.equal(price.status, 'failed');
  assert.equal(price.failure_code, 'TIMEOUT');
  assert.equal(mock.rows('minifiguras', USER_A)[0].precio, 7);
  assert.equal(requestSignal.aborted, true);
  assert.equal((await jobs.status(started.jobId)).status, 'completed');
});

test('un precio actualizado cambia logro y DNA, y la recalculacion conserva regalos recibidos', async () => {
  const mock = createSupabaseMock({ users: {
    'token-a': { id: USER_A },
    'token-b': { id: USER_B },
  } });
  mock.seed('minifiguras', USER_A, [{
    id: 'FIG-HARRY', nombre: 'Harry Potter', categoria: 'Harry Potter',
    estado_coleccion: 'COLECCIÓN', precio: 5, precio_compra: 3,
  }]);
  mock.seed('regalos_enviados', null, [{ donante_id: USER_B, receptor_id: USER_A }]);
  const repository = new DailyAnalyticsRepository({ client: mock.createAdminClient() });
  const jobs = createDailyAnalyticsJobs({
    repository,
    brickset: { async getPrice() { return 20; } },
    categoriasRepository: { async read() { return categoriasMock; } },
  });
  const started = await jobs.start();
  await jobs.waitForIdle();

  const gamification = mock.rows('gamificacion', USER_A)[0];
  const snapshot = mock.analyticsRows('snapshots').find(({ user_id }) => user_id === USER_A);
  const woah = gamification.logros.find(({ id }) => id === 'woah');
  const gift = gamification.logros.find(({ id }) => id === 'someone-liked-your-collection');
  const dna = mock.calculateDna(gamification.logros);
  assert.equal(woah.cantidad, 1);
  assert.equal(gift.cantidad, 1);
  assert.ok(gamification.logros.some(({ id }) => id === 'bricky-potter'));
  assert.equal(Number(snapshot.total_value), 20);
  assert.deepEqual([
    snapshot.pct_rarity_hunter,
    snapshot.pct_collector,
    snapshot.pct_explorer,
    snapshot.pct_fan,
  ], [
    Math.round(dna.porcentajes.rarityHunter * 100) / 100,
    Math.round(dna.porcentajes.collector * 100) / 100,
    Math.round(dna.porcentajes.explorer * 100) / 100,
    Math.round(dna.porcentajes.fan * 100) / 100,
  ]);
  assert.equal((await jobs.status(started.jobId)).status, 'completed');
});

test('agota reintentos de fuentes y marca el trabajo fallido sin resultado exitoso', async () => {
  const run = { jobId: 'run-terminal', status: 'pending', snapshotDate: '2026-10-07' };
  let sourceReads = 0;
  const repository = {
    async start() { return run; },
    async recover() { return null; },
    async status() { return this.result; },
    async claim() { return true; },
    async renew() { return true; },
    async pricesPage() { return []; },
    async usersPage(_runId, _owner, after) { return after ? [] : [{ user_id: USER_A }]; },
    async sources() { sourceReads += 1; return { revision: `revision-${sourceReads}`, figures: [], giftsReceived: 0 }; },
    async captureUser() { return false; },
    async failUser() { this.failedUser = true; },
    async finalize() {
      this.result = { status: 'failed', result: null, errorCode: this.failedUser ? 'USERS_FAILED' : null };
      return this.result;
    },
    async fail() { this.result = { status: 'failed', result: null, errorCode: 'WORKER_ERROR' }; },
  };
  const jobs = createDailyAnalyticsJobs({
    repository,
    brickset: { async getPrice() { return 1; } },
    categoriasRepository: { async read() { return []; } },
    sourceRetries: 3,
  });
  await jobs.start();
  await jobs.waitForIdle();
  const status = await jobs.status(run.jobId);
  assert.equal(sourceReads, 3);
  assert.equal(repository.failedUser, true);
  assert.equal(status.status, 'failed');
  assert.equal(status.result, null);
  assert.equal(status.errorCode, 'USERS_FAILED');
});

test('329 IDs no generan fetch en el segundo job y solo se refrescan al caducar 24 horas', async () => {
  const requestedIds = [];
  const { jobs, mock } = analyticsHarness({
    users: [USER_A],
    figures: [
      { user_id: USER_A, id: 'FIG-CACHED', nombre: 'Cached', categoria: 'Test', estado_coleccion: 'COLECCIÓN', precio: 5 },
      ...Array.from({ length: 328 }, (_, index) => ({
        user_id: USER_A,
        id: `FIG-${String(index).padStart(3, '0')}`,
        nombre: `Figure ${index}`,
        categoria: 'Test',
        estado_coleccion: 'COLECCIÓN',
        precio: 5,
      })),
    ],
    brickset: {
      async getPrice(id) {
        requestedIds.push(id);
        return id === 'FIG-CACHED' ? 12 + requestedIds.filter((requestedId) => requestedId === id).length - 1 : 10;
      },
    },
  });

  const firstRun = await jobs.start();
  await jobs.waitForIdle();
  assert.equal(requestedIds.length, 329);
  assert.equal(mock.analyticsRows('prices', firstRun.jobId).length, 329);
  assert.ok(mock.analyticsRows('prices', firstRun.jobId).every(({ status }) => status === 'completed'));
  assert.equal(Number(mock.analyticsRows('cache').find(({ figure_id }) => figure_id === 'FIG-CACHED').price), 12);

  const secondRun = await jobs.start();
  await jobs.waitForIdle();
  assert.equal(requestedIds.length, 329);
  assert.equal(mock.analyticsRows('prices', secondRun.jobId).length, 329);
  assert.ok(mock.analyticsRows('prices', secondRun.jobId).every(({ status, attempts }) => status === 'completed' && attempts === 0));
  assert.equal(mock.rows('minifiguras', USER_A)[0].precio, 12);

  mock.setPriceCacheFetchedAt('FIG-CACHED', Date.now() - 25 * 60 * 60 * 1000);
  const thirdRun = await jobs.start();
  await jobs.waitForIdle();
  assert.equal(requestedIds.length, 330);
  assert.equal(requestedIds.filter((id) => id === 'FIG-CACHED').length, 2);
  const thirdRunPrices = mock.analyticsRows('prices', thirdRun.jobId);
  assert.equal(thirdRunPrices.filter(({ attempts }) => attempts > 0).length, 1);
  assert.equal(thirdRunPrices.filter(({ status }) => status === 'completed').length, 329);
  assert.equal(Number(mock.analyticsRows('cache').find(({ figure_id }) => figure_id === 'FIG-CACHED').price), 13);
  assert.equal(mock.rows('minifiguras', USER_A).find(({ id }) => id === 'FIG-CACHED').precio, 13);
  assert.equal(mock.analyticsRows('snapshots').length, 1);
});