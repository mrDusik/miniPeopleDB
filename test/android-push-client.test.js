import assert from 'node:assert/strict';
import test from 'node:test';
import { createPushRegistrationLifecycle, ensurePushInstallationId, validatePushAction } from '../src/android-push-client.js';

const USER_A = '00000000-0000-4000-8000-0000000000a1';
const USER_B = '00000000-0000-4000-8000-0000000000b1';
const SESSION_A = { user: { id: USER_A }, access_token: 'jwt-a' };
const SESSION_B = { user: { id: USER_B }, access_token: 'jwt-b' };
const INSTALLATION_ID = '10000000-0000-4000-8000-0000000000a1';
const NOTIFICATION_ID = '20000000-0000-4000-8000-0000000000a1';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
}

test('la instalación conserva UUID opaco sin persistir tokens FCM', async () => {
  const storage = memoryStorage();
  const cryptoImpl = { randomUUID: () => INSTALLATION_ID };
  assert.equal(ensurePushInstallationId(storage, cryptoImpl), INSTALLATION_ID);
  assert.equal(ensurePushInstallationId(storage, { randomUUID() { assert.fail('Debe reutilizar el UUID'); } }), INSTALLATION_ID);
  const requests = [];
  const lifecycle = createPushRegistrationLifecycle({
    storage,
    cryptoImpl,
    apiUrl: (path) => `https://api.example.test${path}`,
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(null, { status: 200 });
    },
  });
  const fcmToken = 'private-fcm-token-do-not-store-12345';
  assert.equal(await lifecycle.register(SESSION_A, { token: fcmToken, permissionState: 'granted' }), true);
  assert.equal(requests[0].url, 'https://api.example.test/api/push/registrations');
  assert.equal(requests[0].init.headers.Authorization, 'Bearer jwt-a');
  const registration = JSON.parse(requests[0].init.body);
  assert.deepEqual(registration, {
    installationId: INSTALLATION_ID,
    token: fcmToken,
    permissionState: 'granted',
  });
  assert.equal('user_id' in registration, false);
  assert.equal([...storage.values.values()].some((value) => value.includes(fcmToken)), false);
});

test('la revocación offline queda pendiente y bloquea otra cuenta hasta revocar con el propietario JWT anterior', async () => {
  const storage = memoryStorage();
  let online = false;
  const requests = [];
  const lifecycle = createPushRegistrationLifecycle({
    storage,
    cryptoImpl: { randomUUID: () => INSTALLATION_ID },
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      if (!online) throw new TypeError('offline');
      return new Response(null, { status: 200 });
    },
  });
  assert.equal(await lifecycle.revoke(SESSION_A), false);
  assert.equal(lifecycle.hasPendingRevocation(), true);
  assert.equal(await lifecycle.register(SESSION_B, { token: 'new-fcm-token-123456789012345', permissionState: 'granted' }), false);
  assert.equal(requests.length, 1);
  online = true;
  assert.equal(await lifecycle.register(SESSION_A, { token: 'new-fcm-token-123456789012345', permissionState: 'granted' }), true);
  assert.deepEqual(requests.map(({ init }) => init.method), ['DELETE', 'DELETE', 'POST']);
  assert.equal(lifecycle.hasPendingRevocation(), false);
  assert.equal(requests[1].init.headers.Authorization, 'Bearer jwt-a');
});

test('el toque acepta solo identificadores y categorías allowlist; ignora rutas arbitrarias', () => {
  assert.deepEqual(validatePushAction({
    notification_id: NOTIFICATION_ID,
    category: 'friend_request',
    route: 'javascript:alert(1)',
    message: 'private business data',
  }), { notificationId: NOTIFICATION_ID, category: 'friend_request' });
  assert.equal(validatePushAction({ notification_id: NOTIFICATION_ID, category: 'friend_request', url: 'https://evil.example' })?.notificationId, NOTIFICATION_ID);
  assert.equal(validatePushAction({ notification_id: NOTIFICATION_ID, category: 'arbitrary', route: '/admin' }), null);
  assert.equal(validatePushAction({ notification_id: 'not-a-uuid', category: 'friend_request' }), null);
  assert.equal(validatePushAction({ notification_id: NOTIFICATION_ID, category: 'friend_request', action: 'mark_read' })?.notificationId, NOTIFICATION_ID);
});
