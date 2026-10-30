import { createPrivateKey } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

const MAX_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DELIVERY_ATTEMPTS = 5;
const CLAIM_RPC = 'android_push_claim_events';
const RESOLVE_RPC = 'android_push_resolve_event_tokens';
const RECORD_RPC = 'android_push_record_attempt';

const COPY = Object.freeze({
  gift_received: ['MiniPeopleDB', 'Tienes una nueva notificación.'],
  gift_thanks: ['MiniPeopleDB', 'Tienes una nueva notificación.'],
  ranking_entered: ['MiniPeopleDB', 'Tienes una nueva notificación.'],
  ranking_exited: ['MiniPeopleDB', 'Tienes una nueva notificación.'],
  daily_summary: ['MiniPeopleDB', 'Tienes una nueva notificación.'],
  friend_request: ['MiniPeopleDB', 'Tienes una nueva notificación.'],
  friend_request_accepted: ['MiniPeopleDB', 'Tienes una nueva notificación.'],
  weekly_ranking_available: ['MiniPeopleDB', 'Tienes una nueva notificación.'],
});
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);
const PERMANENT_CODES = new Set([
  'messaging/invalid-argument',
  'messaging/invalid-payload',
  'messaging/mismatched-credential',
  'messaging/invalid-recipient',
  'messaging/invalid-options',
]);
const TRANSIENT_CODES = new Set([
  'messaging/server-unavailable',
  'messaging/internal-error',
  'messaging/message-rate-exceeded',
  'messaging/device-message-rate-exceeded',
  'messaging/topics-message-rate-exceeded',
  'messaging/unknown-error',
]);
const CONFIGURATION_CODES = new Set([
  'app/invalid-credential',
  'app/invalid-app-credential',
  'messaging/invalid-credential',
  'messaging/mismatched-credential',
]);

function providerCode(error) {
  return typeof error?.code === 'string' ? error.code : 'unknown';
}

export function classifyFcmError(error) {
  const code = providerCode(error);
  if (INVALID_TOKEN_CODES.has(code)) return { outcome: 'invalid', errorCode: 'UNREGISTERED' };
  if (PERMANENT_CODES.has(code)) return { outcome: 'permanent', errorCode: code.endsWith('invalid-argument') ? 'INVALID_ARGUMENT' : 'FAILED_PRECONDITION' };
  if (TRANSIENT_CODES.has(code) || error?.name === 'AbortError' || error?.name === 'TypeError') {
    return { outcome: 'retry', errorCode: code.endsWith('server-unavailable') ? 'UNAVAILABLE' : code.endsWith('internal-error') ? 'INTERNAL' : 'QUOTA_EXCEEDED' };
  }
  return { outcome: 'retry', errorCode: 'UNKNOWN' };
}

function assertRpc(result) {
  if (!result || result.error || !Array.isArray(result.data)) throw new Error('ANDROID_PUSH_DATABASE_UNAVAILABLE');
  return result.data;
}

function retryDelaySeconds(attempts) {
  return Math.min(3600, 30 * (2 ** Math.min(Math.max(0, attempts), 7)));
}

export function createAndroidPushJobs({
  client,
  sender,
  now = () => new Date(),
  logger = console,
  pollIntervalMs = 10000,
  setIntervalImpl = setInterval,
  clearIntervalImpl = clearInterval,
} = {}) {
  let timer = null;
  let running = false;

  async function runOnce() {
    if (!sender || sender.enabled === false || typeof sender.send !== 'function') return { status: 'disabled', processed: 0 };
    if (running) return { status: 'busy', processed: 0 };
    running = true;
    let processed = 0;
    try {
      const events = assertRpc(await client.rpc(CLAIM_RPC, { p_limit: 10, p_lease_seconds: 60 }));
      for (const event of events) {
        const parameters = { p_event_id: event.event_id, p_lease_token: event.lease_token };
        const targets = assertRpc(await client.rpc(RESOLVE_RPC, parameters));
        for (const target of targets) {
          let outcome;
          let errorCode = null;
          let retryDelay = 0;
          if (target.expires_at && new Date(target.expires_at).getTime() <= now().getTime()) {
            outcome = 'permanent';
            errorCode = 'MAX_ATTEMPTS';
          } else if (target.attempts >= MAX_DELIVERY_ATTEMPTS) {
            outcome = 'permanent';
            errorCode = 'MAX_ATTEMPTS';
          } else {
            const ttlMs = Math.max(0, Math.min(MAX_TTL_MS, new Date(target.expires_at).getTime() - now().getTime()));
            const [title, body] = COPY[target.category] ?? COPY.friend_request;
            try {
              await sender.send({
                token: target.fcm_token,
                notification: { title, body },
                data: {
                  notification_id: event.notification_id,
                  category: target.category,
                  schema_version: '1',
                },
                android: {
                  ttl: ttlMs,
                  priority: 'high',
                  notification: { tag: event.notification_id, channelId: 'mini-people-notifications' },
                },
              });
              outcome = 'sent';
            } catch (error) {
              if (error?.code === 'fcm/configuration-disabled') {
                logger.warn?.('android_push_configuration_disabled');
                return { status: 'disabled', processed };
              }
              ({ outcome, errorCode } = classifyFcmError(error));
              if (outcome === 'retry') {
                if (target.attempts + 1 >= MAX_DELIVERY_ATTEMPTS) {
                  outcome = 'permanent';
                  errorCode = 'MAX_ATTEMPTS';
                } else {
                  retryDelay = retryDelaySeconds(target.attempts);
                }
              }
            }
          }
          try {
            const result = await client.rpc(RECORD_RPC, {
              p_event_id: event.event_id,
              p_lease_token: event.lease_token,
              p_installation_id: target.installation_id,
              p_outcome: outcome,
              p_error_code: errorCode,
              p_retry_delay_seconds: retryDelay,
            });
            if (result?.error) throw new Error('ANDROID_PUSH_DATABASE_UNAVAILABLE');
          } catch {
            throw new Error('ANDROID_PUSH_DATABASE_UNAVAILABLE');
          }
          processed += 1;
          logger.info?.('android_push_attempt', { eventId: event.event_id, outcome, errorCode });
        }
      }
      return { status: 'ok', processed };
    } finally {
      running = false;
    }
  }

  function start() {
    if (timer || !sender || sender.enabled === false) return;
    const poll = () => {
      void runOnce().catch(() => logger.warn?.('android_push_worker_error'));
    };
    poll();
    timer = setIntervalImpl(poll, pollIntervalMs);
    timer.unref?.();
  }

  function close() {
    if (!timer) return;
    clearIntervalImpl(timer);
    timer = null;
  }

  return Object.freeze({
    runOnce,
    start,
    close,
    get enabled() { return Boolean(sender && sender.enabled !== false); },
  });
}

export function createFcmSender({ serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON } = {}) {
  if (typeof serviceAccountJson !== 'string' || !serviceAccountJson.trim()) {
    return { enabled: false, send: null };
  }
  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (typeof serviceAccount.project_id !== 'string' || typeof serviceAccount.client_email !== 'string'
      || typeof serviceAccount.private_key !== 'string') return { enabled: false, send: null };
    createPrivateKey(serviceAccount.private_key);
    const appName = `mini-people-fcm-${serviceAccount.project_id}`;
    const app = getApps().find((candidate) => candidate.name === appName)
      ?? initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id }, appName);
    const messaging = getMessaging(app);
    let enabled = true;
    return {
      get enabled() { return enabled; },
      send: async (message) => {
        try {
          return await messaging.send(message);
        } catch (error) {
          if (CONFIGURATION_CODES.has(error?.code)) {
            enabled = false;
            throw Object.assign(new Error('FCM_CONFIGURATION_DISABLED'), { code: 'fcm/configuration-disabled' });
          }
          throw error;
        }
      },
    };
  } catch {
    return { enabled: false, send: null };
  }
}
