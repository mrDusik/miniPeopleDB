const INSTALLATION_KEY = 'miniPeopleDB.push.installationId';
const PENDING_REVOCATION_KEY = 'miniPeopleDB.push.pendingRevocation';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES = new Set([
  'gift_received', 'gift_thanks', 'ranking_entered', 'ranking_exited', 'daily_summary',
  'friend_request', 'friend_request_accepted', 'weekly_ranking_available',
]);

function randomUuid(cryptoImpl = globalThis.crypto) {
  if (typeof cryptoImpl?.randomUUID === 'function') return cryptoImpl.randomUUID();
  if (typeof cryptoImpl?.getRandomValues !== 'function') throw new Error('ANDROID_PUSH_UUID_UNAVAILABLE');
  const bytes = cryptoImpl.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export function ensurePushInstallationId(storage, cryptoImpl = globalThis.crypto) {
  const current = storage.getItem(INSTALLATION_KEY);
  if (typeof current === 'string' && UUID_PATTERN.test(current)) return current;
  const installationId = randomUuid(cryptoImpl);
  storage.setItem(INSTALLATION_KEY, installationId);
  return installationId;
}

export function validatePushAction(notificationData) {
  if (!notificationData || typeof notificationData !== 'object' || Array.isArray(notificationData)) return null;
  const notificationId = notificationData.notification_id;
  const category = notificationData.category;
  if (typeof notificationId !== 'string' || !UUID_PATTERN.test(notificationId) || !CATEGORIES.has(category)) return null;
  return Object.freeze({ notificationId: notificationId.toLowerCase(), category });
}

export function createPushRegistrationLifecycle({
  storage = globalThis.localStorage,
  fetchImpl = globalThis.fetch,
  apiUrl = (path) => path,
  cryptoImpl = globalThis.crypto,
} = {}) {
  const installationId = ensurePushInstallationId(storage, cryptoImpl);

  function readPendingRevocation() {
    const raw = storage.getItem(PENDING_REVOCATION_KEY);
    if (!raw) return null;
    try {
      const marker = JSON.parse(raw);
      if (typeof marker?.userId === 'string' && UUID_PATTERN.test(marker.userId)
        && marker.installationId === installationId) return marker;
    } catch {
      // An unreadable marker blocks registration rather than risking token reassignment.
    }
    return { invalid: true };
  }

  async function revoke(session) {
    const userId = session?.user?.id;
    const accessToken = session?.access_token;
    if (typeof userId !== 'string' || !UUID_PATTERN.test(userId) || typeof accessToken !== 'string' || !accessToken) return false;
    storage.setItem(PENDING_REVOCATION_KEY, JSON.stringify({ userId, installationId }));
    try {
      const response = await fetchImpl(apiUrl(`/api/push/registrations/${installationId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
        ...(globalThis.AbortSignal?.timeout ? { signal: globalThis.AbortSignal.timeout(3000) } : {}),
      });
      if (!response.ok) return false;
      storage.removeItem(PENDING_REVOCATION_KEY);
      return true;
    } catch {
      return false;
    }
  }

  async function register(session, { token = null, permissionState = 'unknown' } = {}) {
    const userId = session?.user?.id;
    const accessToken = session?.access_token;
    if (typeof userId !== 'string' || !UUID_PATTERN.test(userId) || typeof accessToken !== 'string' || !accessToken) return false;
    const pending = readPendingRevocation();
    if (pending) {
      if (pending.invalid || pending.userId !== userId || !await revoke(session)) return false;
    }
    if (!['unknown', 'granted', 'denied'].includes(permissionState)) return false;
    if (permissionState === 'granted' && (typeof token !== 'string' || token.length < 20 || token.length > 4096)) return false;
    try {
      const response = await fetchImpl(apiUrl('/api/push/registrations'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          installationId,
          token: permissionState === 'granted' ? token : null,
          permissionState,
        }),
        cache: 'no-store',
        ...(globalThis.AbortSignal?.timeout ? { signal: globalThis.AbortSignal.timeout(3000) } : {}),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  return Object.freeze({
    installationId,
    register,
    revoke,
    hasPendingRevocation: () => Boolean(readPendingRevocation()),
    accountDeleted(userId) {
      const pending = readPendingRevocation();
      if (pending && !pending.invalid && pending.userId === userId) storage.removeItem(PENDING_REVOCATION_KEY);
    },
  });
}
