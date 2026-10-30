import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseMock } from '../test-support/supabase-mock.js';
import { OTHER_TOKEN, TEST_TOKEN, authFetch, startTestServer } from '../test-support/server.js';

const INSTALLATION_ID = '10000000-0000-4000-8000-0000000000a1';
const OTHER_INSTALLATION_ID = '10000000-0000-4000-8000-0000000000b1';
const TOKEN = 'opaque-fcm-registration-token-123456789';

function pushMock() {
  return createSupabaseMock({
    users: {
      [TEST_TOKEN]: { id: '00000000-0000-0000-0000-00000000000a' },
      [OTHER_TOKEN]: { id: '00000000-0000-0000-0000-00000000000b' },
    },
  });
}

test('el registro requiere JWT, deriva el propietario y nunca devuelve el token', async () => {
  const mock = pushMock();
  const context = await startTestServer({ supabase: mock });
  const registrations = `${context.baseUrl}/api/push/registrations`;
  try {
    assert.equal((await fetch(registrations, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ installationId: INSTALLATION_ID, token: TOKEN, permissionState: 'granted' }),
    })).status, 401);

    const owner = authFetch(TEST_TOKEN);
    const forged = await owner(registrations, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ installationId: INSTALLATION_ID, token: TOKEN, permissionState: 'granted', user_id: '00000000-0000-0000-0000-00000000000b' }),
    });
    assert.equal(forged.status, 400);
    const registered = await owner(registrations, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ installationId: INSTALLATION_ID, token: TOKEN, permissionState: 'granted' }),
    });
    assert.equal(registered.status, 200);
    assert.deepEqual(await registered.json(), { ok: true });
    assert.equal(registered.headers.get('cache-control'), 'no-store');
    assert.deepEqual(mock.rows('android_push_installations').map(({ user_id, installation_id, permission_state, active }) => ({
      user_id, installation_id, permission_state, active,
    })), [{
      user_id: '00000000-0000-0000-0000-00000000000a',
      installation_id: INSTALLATION_ID,
      permission_state: 'granted',
      active: true,
    }]);

    const leakedRead = await context.supabase.createClient('url', 'key', {
      global: { headers: { Authorization: `Bearer ${TEST_TOKEN}` } },
    }).from('android_push_installations').select('*');
    assert.ok(leakedRead.error);
  } finally {
    await context.close();
  }
});

test('la salud pública solo comunica si push está habilitado, sin detalles de proveedor', async () => {
  const context = await startTestServer({ supabase: pushMock() });
  try {
    const response = await fetch(`${context.baseUrl}/health/push`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { enabled: false, status: 'disabled' });
  } finally {
    await context.close();
  }
});

test('la rotación y el permiso actualizan solo el registro propio; la revocación de otra cuenta no lo elimina', async () => {
  const mock = pushMock();
  const context = await startTestServer({ supabase: mock });
  const registrations = `${context.baseUrl}/api/push/registrations`;
  const owner = authFetch(TEST_TOKEN);
  const other = authFetch(OTHER_TOKEN);
  try {
    await owner(registrations, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ installationId: INSTALLATION_ID, token: TOKEN, permissionState: 'granted' }),
    });
    const rotatedToken = `${TOKEN}-rotated`;
    const rotated = await owner(registrations, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ installationId: INSTALLATION_ID, token: rotatedToken, permissionState: 'granted' }),
    });
    assert.equal(rotated.status, 200);
    assert.equal(mock.rows('android_push_installations')[0].fcm_token, rotatedToken);

    const denied = await owner(registrations, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ installationId: INSTALLATION_ID, token: null, permissionState: 'denied' }),
    });
    assert.equal(denied.status, 200);
    assert.equal(mock.rows('android_push_installations')[0].active, false);
    assert.equal(mock.rows('android_push_installations')[0].fcm_token, null);

    await owner(registrations, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ installationId: INSTALLATION_ID, token: TOKEN, permissionState: 'granted' }),
    });
    const otherOwnerDelete = await other(`${registrations}/${INSTALLATION_ID}`, { method: 'DELETE' });
    assert.equal(otherOwnerDelete.status, 200);
    assert.equal(mock.rows('android_push_installations')[0].user_id, '00000000-0000-0000-0000-00000000000a');
    const ownerDelete = await owner(`${registrations}/${INSTALLATION_ID}`, { method: 'DELETE' });
    assert.equal(ownerDelete.status, 200);
    assert.deepEqual(mock.rows('android_push_installations'), []);
  } finally {
    await context.close();
  }
});

test('el registro rechaza tokens o instalaciones inválidos y no permite reutilizar un token de otra cuenta', async () => {
  const mock = pushMock();
  const context = await startTestServer({ supabase: mock });
  const registrations = `${context.baseUrl}/api/push/registrations`;
  try {
    const owner = authFetch(TEST_TOKEN);
    for (const body of [
      { installationId: 'not-a-uuid', token: TOKEN, permissionState: 'granted' },
      { installationId: INSTALLATION_ID, token: 'short', permissionState: 'granted' },
      { installationId: INSTALLATION_ID, token: TOKEN, permissionState: 'prompt' },
    ]) {
      const response = await owner(registrations, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      assert.equal(response.status, 400, JSON.stringify(await response.json()));
    }

    assert.equal((await owner(registrations, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ installationId: INSTALLATION_ID, token: TOKEN, permissionState: 'granted' }),
    })).status, 200);
    const competingOwner = await authFetch(OTHER_TOKEN)(registrations, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ installationId: OTHER_INSTALLATION_ID, token: TOKEN, permissionState: 'granted' }),
    });
    assert.equal(competingOwner.status, 500);
    assert.deepEqual(await competingOwner.json(), { error: 'ANDROID_PUSH_REGISTRATION_UNAVAILABLE' });
    assert.equal(mock.rows('android_push_installations').length, 1);
  } finally {
    await context.close();
  }
});
