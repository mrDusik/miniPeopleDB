import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyFcmError, createAndroidPushJobs, createFcmSender } from '../src/android-push-jobs.js';

const EVENT_ID = '20000000-0000-4000-8000-0000000000a1';
const NOTIFICATION_ID = '30000000-0000-4000-8000-0000000000a1';
const INSTALLATION_ID = '10000000-0000-4000-8000-0000000000a1';
const TOKEN = 'opaque-private-token-never-log-this';
const EXPIRES_AT = '2026-10-30T10:00:00.000Z';

function fakePushClient({ attempts = 0 } = {}) {
  const calls = [];
  return {
    calls,
    async rpc(name, parameters) {
      calls.push({ name, parameters });
      if (name === 'android_push_claim_events') {
        return { data: [{ event_id: EVENT_ID, notification_id: NOTIFICATION_ID, category: 'gift_received', expires_at: EXPIRES_AT, lease_token: 'lease-private' }] };
      }
      if (name === 'android_push_resolve_event_tokens') {
        return { data: [{ installation_id: INSTALLATION_ID, fcm_token: TOKEN, category: 'gift_received', expires_at: EXPIRES_AT, attempts }] };
      }
      if (name === 'android_push_record_attempt') return { data: 'completed', error: null };
      return { data: null, error: { message: 'unexpected rpc' } };
    },
  };
}

test('el worker usa exclusivamente las tres RPC allowlisted y envía payload genérico sin registrar el token', async () => {
  const client = fakePushClient();
  const sentMessages = [];
  const logs = [];
  const worker = createAndroidPushJobs({
    client,
    sender: { async send(message) { sentMessages.push(message); return 'message-id'; } },
    now: () => new Date('2026-10-30T09:00:00.000Z'),
    logger: { info(...values) { logs.push(values); }, warn(...values) { logs.push(values); } },
  });
  assert.deepEqual(await worker.runOnce(), { status: 'ok', processed: 1 });
  assert.deepEqual(client.calls.map(({ name }) => name), [
    'android_push_claim_events',
    'android_push_resolve_event_tokens',
    'android_push_record_attempt',
  ]);
  assert.equal(sentMessages.length, 1);
  assert.deepEqual(sentMessages[0].data, {
    notification_id: NOTIFICATION_ID,
    category: 'gift_received',
    schema_version: '1',
  });
  assert.deepEqual(sentMessages[0].notification, { title: 'MiniPeopleDB', body: 'Tienes una nueva notificación.' });
  assert.equal(sentMessages[0].android.notification.tag, NOTIFICATION_ID);
  assert.equal(sentMessages[0].android.ttl, '3600000ms');
  assert.equal(JSON.stringify(sentMessages).includes('secret'), false);
  assert.equal(JSON.stringify(logs).includes(TOKEN), false);
  assert.deepEqual(client.calls.at(-1).parameters, {
    p_event_id: EVENT_ID,
    p_lease_token: 'lease-private',
    p_installation_id: INSTALLATION_ID,
    p_outcome: 'sent',
    p_error_code: null,
    p_retry_delay_seconds: 0,
  });
});

test('los errores transitorios aplican backoff acotado y errores de token se desactivan sin reintento', async () => {
  const transientClient = fakePushClient();
  const transientWorker = createAndroidPushJobs({
    client: transientClient,
    sender: { async send() { throw Object.assign(new Error('private provider details'), { code: 'messaging/server-unavailable' }); } },
    now: () => new Date('2026-10-30T09:00:00.000Z'),
    logger: { info() {}, warn() {} },
  });
  await transientWorker.runOnce();
  assert.equal(transientClient.calls.at(-1).parameters.p_outcome, 'retry');
  assert.equal(transientClient.calls.at(-1).parameters.p_retry_delay_seconds, 30);
  assert.equal(transientClient.calls.at(-1).parameters.p_error_code, 'UNAVAILABLE');

  const invalidClient = fakePushClient();
  const invalidWorker = createAndroidPushJobs({
    client: invalidClient,
    sender: { async send() { throw Object.assign(new Error(TOKEN), { code: 'messaging/registration-token-not-registered' }); } },
    logger: { info() {}, warn() {} },
  });
  await invalidWorker.runOnce();
  assert.equal(invalidClient.calls.at(-1).parameters.p_outcome, 'invalid');
  assert.equal(invalidClient.calls.at(-1).parameters.p_error_code, 'UNREGISTERED');
  assert.equal(JSON.stringify(invalidClient.calls).includes(TOKEN), false);
});

test('el worker no envía tras el límite, respeta expiración y falla cerrado sin configuración', async () => {
  const atLimit = fakePushClient({ attempts: 5 });
  let sendCount = 0;
  const capped = createAndroidPushJobs({
    client: atLimit, sender: { async send() { sendCount += 1; } },
    logger: { info() {}, warn() {} },
  });
  await capped.runOnce();
  assert.equal(sendCount, 0);
  assert.equal(atLimit.calls.at(-1).parameters.p_outcome, 'permanent');
  assert.equal(atLimit.calls.at(-1).parameters.p_error_code, 'MAX_ATTEMPTS');

  const expired = fakePushClient();
  const expiredWorker = createAndroidPushJobs({
    client: expired, sender: { async send() { sendCount += 1; } },
    now: () => new Date('2026-10-30T10:00:00.000Z'),
    logger: { info() {}, warn() {} },
  });
  await expiredWorker.runOnce();
  assert.equal(sendCount, 0);
  assert.equal(expired.calls.at(-1).parameters.p_outcome, 'permanent');

  const disabledClient = fakePushClient();
  const disabled = createAndroidPushJobs({ client: disabledClient, sender: null });
  assert.deepEqual(await disabled.runOnce(), { status: 'disabled', processed: 0 });
  assert.deepEqual(disabledClient.calls, []);
  assert.equal(createFcmSender({ serviceAccountJson: 'not-json' }).enabled, false);
  assert.equal(createFcmSender({ serviceAccountJson: JSON.stringify({
    project_id: 'test-project',
    client_email: 'push@test-project.iam.gserviceaccount.com',
    private_key: 'not-a-private-key',
  }) }).enabled, false);
});

test('una credencial FCM rechazada deshabilita el worker sin registrar detalles ni consumir el evento', async () => {
  const client = fakePushClient();
  let senderEnabled = true;
  const logs = [];
  const worker = createAndroidPushJobs({
    client,
    sender: {
      get enabled() { return senderEnabled; },
      async send() {
        senderEnabled = false;
        throw Object.assign(new Error('private credential response'), { code: 'fcm/configuration-disabled' });
      },
    },
    logger: { info(...values) { logs.push(values); }, warn(...values) { logs.push(values); } },
  });
  assert.deepEqual(await worker.runOnce(), { status: 'disabled', processed: 0 });
  assert.equal(worker.enabled, false);
  assert.deepEqual(client.calls.map(({ name }) => name), ['android_push_claim_events', 'android_push_resolve_event_tokens']);
  assert.equal(JSON.stringify(logs).includes('private credential response'), false);
  assert.deepEqual(await worker.runOnce(), { status: 'disabled', processed: 0 });
  assert.equal(client.calls.length, 2);
});

test('clasificación de FCM expone solo clases de error allowlisted', () => {
  assert.deepEqual(classifyFcmError(Object.assign(new Error('token'), { code: 'messaging/invalid-registration-token' })), {
    outcome: 'invalid', errorCode: 'UNREGISTERED',
  });
  assert.deepEqual(classifyFcmError(Object.assign(new Error('credential'), { code: 'messaging/mismatched-credential' })), {
    outcome: 'permanent', errorCode: 'FAILED_PRECONDITION',
  });
  assert.deepEqual(classifyFcmError(new Error('private provider response')), {
    outcome: 'retry', errorCode: 'UNKNOWN',
  });
});
