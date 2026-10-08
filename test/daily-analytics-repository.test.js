import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDailyAnalyticsRepository,
  DailyAnalyticsRepositoryError,
} from '../src/daily-analytics-repository.js';
import { createSupabaseMock } from '../test-support/supabase-mock.js';

test('repositorio administrativo expone RPC allowlisted sin consultas globales ni credenciales', async () => {
  const serviceRoleKey = 'server-secret-test-only';
  const mock = createSupabaseMock({ users: { token: { id: '00000000-0000-4000-8000-00000000000a' } } });
  let clientOptions;
  const repository = createDailyAnalyticsRepository({
    adminConfig: { url: 'https://supabase.invalid', serviceRoleKey },
    createSupabaseClient(url, key, options) {
      clientOptions = { url, key, options };
      return mock.createAdminClient();
    },
  });

  assert.equal(await repository.recover(), null);
  const started = await repository.start();
  const status = await repository.status(started.jobId);
  await repository.claim(started.jobId, 'worker-owner');
  await repository.usersPage(started.jobId, 'worker-owner');
  await repository.pricesPage(started.jobId, 'worker-owner');
  await repository.sources(started.jobId, 'worker-owner', '00000000-0000-4000-8000-00000000000a');
  await repository.captureUser(started.jobId, 'worker-owner', '00000000-0000-4000-8000-00000000000a', 'revision', {});

  assert.equal(clientOptions.url, 'https://supabase.invalid');
  assert.equal(clientOptions.key, serviceRoleKey);
  assert.deepEqual(clientOptions.options.auth, {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  });
  assert.equal(status.jobId, started.jobId);
  assert.equal(JSON.stringify(status).includes(serviceRoleKey), false);
  assert.ok(mock.adminCalls().every(({ name }) => name !== 'from'));
  assert.throws(() => mock.createAdminClient().from('minifiguras'), /solo puede ejecutar RPC allowlisted/);
});

test('repositorio oculta errores y no imprime claves administrativas', async () => {
  const serviceRoleKey = 'another-private-key';
  const repository = createDailyAnalyticsRepository({
    adminConfig: { url: 'https://supabase.invalid', serviceRoleKey },
    createSupabaseClient: () => ({
      async rpc() {
        return { data: null, error: { message: `request failed using ${serviceRoleKey}` } };
      },
    }),
  });

  await assert.rejects(repository.start(), (error) => {
    assert.ok(error instanceof DailyAnalyticsRepositoryError);
    assert.equal(error.message.includes(serviceRoleKey), false);
    assert.equal(error.code, 'ANALITICA_NO_DISPONIBLE');
    return true;
  });
});