import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { categoriasMockRaw } from '../test-support/fixtures.js';
import { withSupabaseSession } from '../test-support/browser-auth.js';
import { validatePushAction } from '../src/android-push-client.js';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');

function createNotification(id, user, isRead = false, options = {}) {
  const ordinal = id === 'a-new' ? 59 : Number(/\d+$/.exec(id)?.[0] ?? 1);
  return {
    id,
    type: options.type ?? 'gift_thanks',
    createdAt: `2026-10-09T10:${String(ordinal).padStart(2, '0')}:00.000Z`,
    isRead,
    data: options.data ?? { message: `${user} thanks` },
    ...(options.canThank === undefined ? {} : { canThank: options.canThank }),
    ...(options.accepted === undefined ? {} : { accepted: options.accepted }),
    ...(options.canAccept === undefined ? {} : { canAccept: options.canAccept }),
  };
}

function startApp({ initialPage = null, nativePush = null } = {}) {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  const requests = [];
  let realtimeInserted = false;
  let thankHeld = false;
  let resolveThank = null;
  let friendAcceptFails = false;
  let customPage = initialPage;
  let gamificationState = { bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, logros: [] };
  const thankRequests = [];
  const friendAcceptRequests = [];
  if (nativePush) window.NativePush = nativePush;
  window.fetch = async (url, init = {}) => {
    requests.push({ url, init });
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(categoriasMockRaw) };
    if (url === '/minifiguras' || url.startsWith('/minifiguras?')) return { ok: true, json: async () => [] };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 0, enColeccion: 0, buscadas: 0, top5: [], top5Antiguas: [] }) };
    if (url === '/gamificacion') return { ok: true, json: async () => gamificationState };
    if (url === '/gamificacion/dna') return { ok: true, json: async () => ({ principal: 'Newbie', porcentajes: { rarityHunter: 0, collector: 0, explorer: 0, fan: 0 } }) };
    if (url === '/sincronizacion/brickset') return { ok: true, json: async () => ({ estado: 'idle' }) };
    if (url === '/api/ranking/semanal') return { ok: true, json: async () => ({ available: true, entries: [] }) };
    if (url.startsWith('/api/notificaciones')) {
      const user = init.headers.Authorization.endsWith('token-b') ? 'B' : 'A';
      if (url === '/api/notificaciones/leer-todas') return { ok: true, json: async () => ({ unreadCount: 0 }) };
      if (url.endsWith('/leer') && init.method === 'POST') return { ok: true, json: async () => ({ unreadCount: 1 }) };
      if (url.endsWith('/agradecer') && init.method === 'POST') {
        thankRequests.push(url);
        if (thankHeld) return new Promise((resolve) => {
          resolveThank = () => resolve({ ok: true, json: async () => ({ ok: true }) });
        });
        return { ok: true, json: async () => ({ ok: true }) };
      }
      if (url.endsWith('/aceptar') && init.method === 'POST') {
        friendAcceptRequests.push(url);
        return friendAcceptFails
          ? { ok: false, status: 500, json: async () => ({ error: 'NOTIFICACIONES_NO_DISPONIBLES' }) }
          : { ok: true, json: async () => ({ ok: true, accepted: true, alreadyAccepted: false }) };
      }
      if (user === 'A' && customPage) return { ok: true, json: async () => customPage };
      const cursor = new URL(url, 'http://localhost').searchParams.get('cursor');
      if (user === 'B') return { ok: true, json: async () => ({ notifications: [createNotification('b1', 'User B', false, { type: 'gift_thanks', data: { user: 'User B', amount: 5 } })], unreadCount: 1, nextCursor: null }) };
      if (cursor === 'page-2') return { ok: true, json: async () => ({ notifications: [createNotification('a16', 'User A')], unreadCount: 2, nextCursor: null }) };
      const page = Array.from({ length: 15 }, (_, index) => createNotification(`a${index + 1}`, 'User A'));
      if (realtimeInserted) page.unshift(createNotification('a-new', 'New User'));
      return { ok: true, json: async () => ({ notifications: page.slice(0, 15), unreadCount: realtimeInserted ? 3 : 2, nextCursor: 'page-2' }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  window.eval(withSupabaseSession(script, { session: {
    access_token: 'token-a', user: { id: 'user-a', email: 'a@example.invalid', user_metadata: { full_name: 'User A' } },
  } }));
  return {
    dom, window, requests,
    setRealtimeInserted(value) { realtimeInserted = value; },
    setNotificationPage(value) { customPage = value; },
    setGamificationState(value) { gamificationState = value; },
    thankRequests,
    friendAcceptRequests,
    holdThank() { thankHeld = true; },
    releaseThank() { resolveThank?.(); thankHeld = false; },
    setFriendAcceptFails(value) { friendAcceptFails = value; },
  };
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test('el toque push ignora payload externo y abre la fila autenticada sin marcarla leída', async () => {
  const notificationId = '20000000-0000-4000-8000-0000000000a1';
  const listeners = new Map();
  const nativePush = {
    isNative: () => true,
    createRegistrationLifecycle: () => ({
      register: async () => true,
      revoke: async () => true,
    }),
    validateAction: validatePushAction,
    addListener: async (event, listener) => { listeners.set(event, listener); },
    checkPermissions: async () => ({ receive: 'prompt' }),
  };
  const { dom, window, requests, setNotificationPage } = startApp({ nativePush });
  try {
    await tick();
    await tick();
    setNotificationPage({
      notifications: [createNotification(notificationId, 'Ada', false, {
        type: 'friend_request', data: { user: 'Ada', message: 'Contenido recuperado desde la API.' },
      })],
      unreadCount: 1,
      nextCursor: null,
    });
    listeners.get('pushNotificationActionPerformed')({
      notification: { data: {
        notification_id: notificationId,
        category: 'friend_request',
        message: 'NO_MOSTRAR_PAYLOAD_EXTERNO',
        route: 'javascript:alert(1)',
      } },
    });
    await tick();
    await tick();
    assert.equal(window.document.querySelector('#notifications-dialog').open, true);
    assert.equal(window.document.querySelector(`[data-notification-id="${notificationId}"]`)?.textContent.includes('Ada quiere ser tu amigo.'), true);
    assert.equal(window.document.querySelector('#notifications-list').textContent.includes('NO_MOSTRAR_PAYLOAD_EXTERNO'), false);
    assert.equal(requests.some(({ url }) => url.endsWith(`/${notificationId}/leer`)), false);

    const inboxRequestsBefore = requests.filter(({ url }) => url.startsWith('/api/notificaciones')).length;
    const foregroundPush = { data: { notification_id: notificationId, category: 'friend_request' } };
    listeners.get('pushNotificationReceived')(foregroundPush);
    listeners.get('pushNotificationReceived')(foregroundPush);
    await tick();
    assert.equal(requests.filter(({ url }) => url.startsWith('/api/notificaciones')).length, inboxRequestsBefore + 1);
  } finally {
    dom.window.close();
  }
});

test('comparte el indicador animado del ranking y oculta la limpieza durante carga, vacío y error', async () => {
  const { dom, window } = startApp();
  try {
    await tick();
    await tick();
    const status = window.document.querySelector('#notifications-status');
    const toolbar = window.document.querySelector('.notifications-toolbar');
    const button = window.document.querySelector('#notifications-mark-all');
    const originalFetch = window.fetch;
    let finishRequest;
    window.fetch = (url, init) => url === '/api/notificaciones'
      ? new Promise((resolve) => { finishRequest = resolve; })
      : originalFetch(url, init);

    const open = () => window.document.querySelector('#open-notifications').click();
    const finish = async (notifications) => {
      finishRequest({ ok: true, json: async () => ({ notifications, unreadCount: notifications.filter((item) => !item.isRead).length, nextCursor: null }) });
      await tick();
    };
    open();
    assert.equal(status.textContent, 'Cargando notificaciones...');
    assert.equal(status.className, 'status loading-message');
    assert.equal(toolbar.hidden, true);
    assert.match(styles, /\.loading-message::before \{[^}]*animation: brickset-spinner/);
    assert.match(styles, /\.notifications-toolbar\[hidden\] \{ display: none; \}/);
    await finish([createNotification('a1', 'Ada')]);
    assert.equal(status.className, 'status');
    assert.equal(status.textContent, '');
    assert.equal(toolbar.hidden, false);
    assert.equal(button.disabled, false);

    window.__supabaseStub.channels[0].emit({ new: { id: 'loading-refresh' } });
    assert.equal(window.document.querySelectorAll('.notification-item').length, 1);
    assert.equal(toolbar.hidden, true);
    await finish([createNotification('a1', 'Ada', true)]);
    assert.equal(toolbar.hidden, false);
    assert.equal(button.disabled, true);

    open();
    await finish([]);
    assert.equal(status.textContent, 'No tienes notificaciones.');
    assert.equal(status.className, 'status');
    assert.equal(toolbar.hidden, true);

    open();
    finishRequest({ ok: false, json: async () => ({}) });
    await tick();
    assert.equal(status.textContent, 'No se pudieron cargar las notificaciones.');
    assert.equal(status.className, 'status');
    assert.equal(toolbar.hidden, true);
  } finally {
    dom.window.close();
  }
});

test('carga quince, pagina sin duplicados, recupera Realtime y solo limpiar globalmente reduce el badge', async () => {
  const { dom, window, requests, setRealtimeInserted } = startApp();
  try {
    await tick();
    await tick();
    let list = window.document.querySelector('#notifications-list');
    assert.equal(list.classList.contains('notifications-list'), true);
    const badge = window.document.querySelector('#notifications-unread-badge');
    assert.equal(list.querySelectorAll('.notification-item').length, 15);
    assert.equal(badge.hidden, false);
    assert.equal(window.document.querySelector('#open-notifications').getAttribute('aria-label'), 'Notificaciones, 2 sin leer');
    assert.equal(requests.some(({ url, init }) => url.endsWith('/leer-todas') || init.method === 'POST'), false);

    const firstNotification = list.querySelector('.notification-item');
    const firstNotificationId = firstNotification.dataset.notificationId;
    assert.equal(firstNotification.classList.contains('achievement-item'), false);
    assert.equal(firstNotification.querySelector('.notification-mark-read').textContent, '✅');
    firstNotification.querySelector('.notification-mark-read').click();
    await tick();
    const readNotificationRow = window.document.querySelector(`[data-notification-id="${firstNotificationId}"]`);
    const readButton = readNotificationRow.querySelector('.notification-mark-read');
    assert.ok(readButton);
    assert.equal(readButton.disabled, true);
    assert.equal(readButton.parentElement.className, 'notification-controls');
    assert.equal(readButton.parentElement, readNotificationRow.lastElementChild);
    assert.equal(readButton.textContent, '✅');
    assert.match(styles, /\.notifications-list \.notification-item \{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 1fr\) 48px;[^}]*padding: 0;[^}]*border: 0;[^}]*background: transparent/);
    assert.match(styles, /\.notification-content \{[^}]*border: 1px solid var\(--line\);[^}]*border-left: 4px solid var\(--accent\)/);
    assert.match(styles, /\.notification-mark-read \{[^}]*display: flex;[^}]*align-items: center;[^}]*justify-content: center;[^}]*width: 36px;[^}]*height: 36px/);
    assert.match(styles, /\.notification-controls \{[^}]*align-items: center;[^}]*justify-content: center/);
    assert.equal(window.document.querySelector('#open-notifications').getAttribute('aria-label'), 'Notificaciones, 1 sin leer');
    assert.equal(requests.filter(({ url, init }) => url.endsWith('/leer') && init.method === 'POST').length, 1);

    list.dispatchEvent(new window.Event('scroll'));
    await tick();
    list = window.document.querySelector('#notifications-list');
    assert.equal(list.querySelectorAll('.notification-item').length, 16);
    assert.equal(new Set([...list.querySelectorAll('.notification-item')].map(({ dataset }) => dataset.notificationId)).size, 16);
    assert.equal(window.document.querySelector('#open-notifications').getAttribute('aria-label'), 'Notificaciones, 2 sin leer');

    const firstChannel = window.__supabaseStub.channels[0];
    assert.equal(firstChannel.handlers[0].filter.filter, 'user_id=eq.user-a');
    setRealtimeInserted(true);
    firstChannel.emit({ new: { id: 'event-hint', type: 'gift_received', payload: { user: 'Grace', amount: 50 } } });
    await tick();
    assert.equal(window.document.querySelector('#notifications-list .notification-item').dataset.notificationId, 'a-new');
    assert.equal(window.document.querySelector('#open-notifications').getAttribute('aria-label'), 'Notificaciones, 3 sin leer');
    const newToast = window.document.querySelector('#toast-region .toast-task');
    assert.equal(newToast.textContent.trim(), '¡Has recibido un regalo de Grace: +50 Bricks!');
    assert.ok(newToast.classList.contains('toast-gift'));
    assert.equal(newToast.querySelector('strong'), null);
    assert.equal(newToast.querySelector('.toast-icon').getAttribute('src'), '/toast_images/regalo.png');

    firstChannel.emit({ eventType: 'INSERT', new: { id: 'thanks-hint', type: 'gift_thanks', payload: { user: 'Alex', amount: 5 } } });
    await tick();
    const thanksToast = window.document.querySelector('#toast-region').lastElementChild;
    assert.equal(thanksToast.textContent.trim(), '¡Alex te ha dado las gracias por tu regalo: +5 Bricks!');
    assert.ok(thanksToast.classList.contains('toast-gift'));
    assert.equal(thanksToast.querySelector('strong'), null);
    assert.equal(thanksToast.querySelector('.toast-icon').getAttribute('src'), '/toast_images/regalo.png');

    window.document.querySelector('#open-notifications').click();
    assert.equal(window.document.querySelector('#notifications-dialog').open, true);
    assert.equal(window.document.querySelector('#notifications-close'), window.document.activeElement);
    assert.equal(window.document.querySelector('#open-notifications').getAttribute('aria-label'), 'Notificaciones, 3 sin leer');
    window.document.querySelector('#notifications-mark-all').click();
    await tick();
    assert.equal(badge.hidden, true);
    assert.equal([...window.document.querySelectorAll('.notification-item')].every((item) => item.classList.contains('is-read')), true);
    assert.equal(requests.filter(({ url, init }) => url.endsWith('/leer-todas') && init.method === 'POST').length, 1);
  } finally {
    dom.window.close();
  }
});

test('muestra al volver a la pestaña el toast de regalo recibido mientras estaba oculta', async () => {
  const { dom, window } = startApp();
  try {
    await tick();
    await tick();
    Object.defineProperty(window.document, 'visibilityState', { configurable: true, value: 'hidden' });
    window.__supabaseStub.channels[0].emit({ eventType: 'INSERT', new: { id: 'background-gift', type: 'gift_received', payload: { user: 'Grace', amount: 5 } } });
    await tick();
    assert.equal(window.document.querySelectorAll('#toast-region .toast').length, 0);

    Object.defineProperty(window.document, 'visibilityState', { configurable: true, value: 'visible' });
    window.document.dispatchEvent(new window.Event('visibilitychange'));
    const toast = window.document.querySelector('#toast-region .toast-task');
    assert.equal(toast?.textContent.trim(), '¡Has recibido un regalo de Grace: +5 Bricks!');
    assert.ok(toast?.classList.contains('toast-gift'));
    assert.equal(toast?.querySelector('strong'), null);
    assert.equal(toast?.querySelector('.toast-icon').getAttribute('src'), '/toast_images/regalo.png');
  } finally {
    dom.window.close();
  }
});

test('cambia y elimina el canal al cambiar de sesión e ignora eventos del usuario anterior', async () => {
  const { dom, window, requests } = startApp();
  try {
    await tick();
    await tick();
    const previousChannel = window.__supabaseStub.channels[0];
    const sessionB = { access_token: 'token-b', user: { id: 'user-b', email: 'b@example.invalid' } };
    window.__supabaseStub.setSession('SIGNED_IN', sessionB);
    await tick();
    await tick();
    const beforeOldEvent = requests.filter(({ url }) => url.startsWith('/api/notificaciones')).length;
    assert.deepEqual(Array.from(window.__supabaseStub.calls.removeChannel), ['notificaciones-user-a']);
    assert.equal(window.document.querySelectorAll('#notifications-list .notification-item').length, 1);
    assert.equal(window.document.querySelector('#notifications-list').textContent.includes('User B'), true);
    assert.equal(window.document.querySelector('#open-notifications').getAttribute('aria-label'), 'Notificaciones, 1 sin leer');
    previousChannel.emit({ new: { id: 'stale' } });
    await tick();
    assert.equal(requests.filter(({ url }) => url.startsWith('/api/notificaciones')).length, beforeOldEvent);

    window.__supabaseStub.channels[1].setStatus('SUBSCRIBED');
    await tick();
    assert.ok(requests.filter(({ url }) => url.startsWith('/api/notificaciones')).length > beforeOldEvent);
  } finally {
    dom.window.close();
  }
});

test('renderiza las tarjetas sociales y DNA diario, firma deltas y bloquea el doble agradecimiento', async () => {
  const daily = createNotification('daily-1', 'Ada', false, {
    type: 'daily_summary',
    data: {
      snapshotDate: '2026-10-08',
      hasPrevious: true,
      deltas: {
        figures: -2, valueEur: -3.5, bricks: 5, level: -1, globalPosition: 1, weeklyPosition: -2,
        dna: { collector: -1.25, explorer: 2, rarityHunter: -0.5, fan: 0.25 },
      },
    },
  });
  const gift = createNotification('gift-1', 'Grace', false, {
    type: 'gift_received', canThank: true, data: { user: 'Grace', amount: 50, message: 'Grace te regaló 50 Bricks.' },
  });
  const page = {
    notifications: [
      gift,
      createNotification('weekly-gift-1', 'Grace', false, {
        type: 'gift_received', canThank: true, data: { user: 'Grace', amount: 5 },
      }),
      createNotification('thanks-1', 'Ada', false, { type: 'gift_thanks', data: { user: 'Ada', amount: 5 } }),
      createNotification('entered-1', 'Ada', false, {
        type: 'ranking_entered', data: { ranking: 'global', position: 8, message: 'Has entrado en el Top 10 del Ranking Global en el puesto 8.' },
      }),
      createNotification('weekly-entry-1', 'Ada', false, { type: 'ranking_entered', data: { ranking: 'weekly', position: 3 } }),
      createNotification('exited-1', 'Ada', false, { type: 'ranking_exited', data: { ranking: 'weekly' } }),
      daily,
      createNotification('weekly-available-1', 'Ada', false, {
        type: 'weekly_ranking_available',
        data: { weekStart: '2026-10-05', message: 'El Ranking Semanal de esta semana ya está disponible.' },
      }),
    ],
    unreadCount: 8,
    nextCursor: null,
  };
  const { dom, window, requests, holdThank, releaseThank, thankRequests } = startApp({ initialPage: page });
  try {
    await tick();
    await tick();
    const list = window.document.querySelector('#notifications-list');
    assert.equal(list.querySelectorAll('.notification-item').length, 8);
    const giftMessage = list.querySelector('[data-notification-id="gift-1"] .notification-message');
    assert.equal(giftMessage.querySelector('strong').textContent, 'Grace');
    assert.equal(giftMessage.textContent.includes('El usuario'), false);
    assert.equal(giftMessage.textContent.includes('Bricks'), false);
    assert.equal(giftMessage.textContent, 'Grace vio tus tops en el Ranking Global y te regaló 50.');
    assert.equal(giftMessage.querySelector('img').getAttribute('src'), '/toast_images/hero_2026-01-05_16-38-47-871.webp');
    const weeklyGiftMessage = list.querySelector('[data-notification-id="weekly-gift-1"] .notification-message');
    assert.equal(weeklyGiftMessage.textContent, 'Grace vio tus tops en el Ranking Semanal y te regaló 5.');
    const thankMessage = list.querySelector('[data-notification-id="thanks-1"] .notification-message');
    assert.equal(thankMessage.querySelector('strong').textContent, 'Ada');
    assert.equal(thankMessage.textContent, 'Ada agradeció tu regalo con 5.');
    assert.equal(thankMessage.querySelector('img').getAttribute('src'), '/toast_images/hero_2026-01-05_16-38-47-871.webp');
    assert.equal(thankMessage.querySelector('img').nextSibling.textContent, '.');
    const giftThankButton = list.querySelector('.notification-thank');
    assert.ok(giftThankButton.classList.contains('ranking-gift'));
    assert.equal(giftThankButton.parentElement.className, 'notification-actions');
    assert.equal(giftThankButton.parentElement.parentElement.className, 'notification-content');
    assert.match(styles, /\.notification-actions \{[^}]*display: flex;[^}]*justify-content: flex-start/);
    assert.match(styles, /\.notification-actions \.notification-thank \{[^}]*width: auto/);
    assert.equal(giftThankButton.childNodes[0].textContent.trim(), '¡Gracias! +5');
    assert.equal(giftThankButton.querySelector('img').getAttribute('src'), '/toast_images/hero_2026-01-05_16-38-47-871.webp');
    assert.equal(list.querySelector('[data-notification-id="entered-1"] .notification-leading-emoji').textContent, '🌐');
    assert.equal(list.querySelector('[data-notification-id="entered-1"] .notification-message').textContent.includes('puesto 8'), true);
    assert.equal(list.querySelector('[data-notification-id="weekly-entry-1"] .notification-leading-emoji').textContent, '🗓️');
    assert.equal(list.querySelector('[data-notification-id="exited-1"] .notification-leading-emoji').textContent, '❌');
    const availabilityItem = list.querySelector('[data-notification-id="weekly-available-1"]');
    assert.equal(availabilityItem.querySelector('.notification-message').textContent,
      '🗓️ El Ranking Semanal de esta semana ya está disponible.');
    const openWeeklyRankingButton = availabilityItem.querySelector('.notification-open-weekly-ranking');
    assert.equal(openWeeklyRankingButton.getAttribute('aria-label'), 'Ver Ranking Semanal');
    openWeeklyRankingButton.click();
    await tick();
    await tick();
    assert.equal(window.document.querySelector('#weekly-ranking-dialog').open, true);
    assert.equal(requests.filter(({ url }) => url === '/api/ranking/semanal').length, 1);
    assert.equal(availabilityItem.classList.contains('is-read'), false);
    assert.equal(requests.some(({ url }) => url === '/api/notificaciones/weekly-available-1/leer'), false);

    const details = list.querySelector('[data-notification-id="daily-1"] details');
    assert.ok(details);
    assert.equal(details.open, false);
    details.querySelector('summary').click();
    assert.equal(details.open, true);
    assert.equal(list.querySelector('[data-notification-id="daily-1"] time').title, '09/10/2026 12:01');
    assert.ok([...details.querySelectorAll('.daily-summary-label')].some((label) => label.textContent === 'Nivel'));
    assert.ok(details.querySelector('.daily-ranking-deltas'));
    const dailyText = details.textContent;
    for (const value of ['Colección-2', 'Valor-3,50 €', 'Bricks+5', 'Nivel-1', 'Ranking Global+1 puestos', 'Ranking Semanal-2 puestos',
      'Collector-1.25%', 'Explorer+2%', 'Rarity Hunter-0.5%', 'Fan+0.25%']) {
      assert.ok(dailyText.includes(value), `missing ${value}: ${dailyText}`);
    }
    assert.deepEqual([...details.querySelectorAll('.daily-summary-icon')].map((image) => image.getAttribute('src')), [
      '/status_images/caja.png', '/toast_images/billete.png', '/toast_images/hero_2026-01-05_16-38-47-871.webp', '/toast_images/75206.png',
    ]);
    assert.match(styles, /\.daily-summary-icon \{[^}]*width: 22px; height: 22px;/);
    assert.match(styles, /\.daily-summary-metrics \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    assert.doesNotMatch(styles, /\.daily-summary-metrics \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
    assert.deepEqual([...details.querySelectorAll('.daily-dna-trait .dna-swatch')].map((swatch) => swatch.className), [
      'dna-swatch dna-swatch-collector', 'dna-swatch dna-swatch-explorer',
      'dna-swatch dna-swatch-rarity', 'dna-swatch dna-swatch-fan',
    ]);
    assert.match(styles, /\.daily-dna-grid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);

    holdThank();
    let thankButton = list.querySelector('.notification-thank');
    assert.equal(thankButton.childNodes[0].textContent.trim(), '¡Gracias! +5');
    assert.ok(thankButton.classList.contains('ranking-gift'));
    assert.equal(thankButton.querySelector('img').getAttribute('src'), '/toast_images/hero_2026-01-05_16-38-47-871.webp');
    thankButton.click();
    thankButton = window.document.querySelector('.notification-thank');
    assert.equal(thankButton.disabled, true);
    thankButton.click();
    assert.equal(thankRequests.length, 1);
    releaseThank();
    await tick();
    await tick();
    thankButton = window.document.querySelector('.notification-thank');
    assert.equal(thankButton.disabled, true);
    assert.equal(window.document.querySelector('#notifications-unread-badge').hidden, false);
    assert.equal(window.document.querySelector('[data-notification-id="daily-1"]').classList.contains('is-read'), false);
  } finally {
    dom.window.close();
  }
});

test('acepta solicitudes desde la bandeja sin leerlas, duplica eventos ni permitir un segundo clic', async () => {
  const friendRequest = createNotification('friend-1', 'Grace', false, {
    type: 'friend_request',
    data: { user: 'Grace', message: 'Grace quiere ser tu amigo.' },
    accepted: false,
    canAccept: true,
  });
  const { dom, window, requests, friendAcceptRequests, setGamificationState } = startApp({
    initialPage: { notifications: [friendRequest], unreadCount: 1, nextCursor: null },
  });
  try {
    await tick();
    await tick();
    const document = window.document;
    const row = document.querySelector('[data-notification-id="friend-1"]');
    const message = row.querySelector('.notification-message');
    assert.equal(message.textContent, 'Grace quiere ser tu amigo.');
    assert.equal(message.querySelector('strong').textContent, 'Grace');
    const accept = row.querySelector('.notification-accept-friend');
    assert.equal(accept.getAttribute('aria-label'), 'Aceptar solicitud de amistad de Grace');
    assert.equal(accept.querySelector('.notification-friend-plus').textContent, '+');
    assert.equal(accept.querySelector('.notification-friend-icon').getAttribute('src'), '/status_images/friends.png');
    assert.equal(accept.querySelector('.notification-friend-heart'), null);
    assert.equal(row.classList.contains('is-read'), false);

    setGamificationState({
      bricks: 3,
      nivel: { id: 0, nombre: 'Duplo' },
      progreso: { porcentaje: 15 },
      logros: [{ id: 'handshake', type: 'amistad', nombre: 'Handshake', descripcion: 'Has aceptado la primera solicitud de amistad', bricks: 3, cantidad: 1, total: 3 }],
    });
    accept.click();
    accept.click();
    await tick();
    const accepted = document.querySelector('[data-notification-id="friend-1"] .notification-accept-friend');
    assert.equal(friendAcceptRequests.length, 1);
    assert.equal(accepted.disabled, true);
    assert.equal(accepted.querySelector('.notification-friend-plus').textContent, 'Aceptada');
    assert.equal(document.querySelector('#gamification-bricks').textContent, '3');
    assert.equal(document.querySelector('[data-notification-id="friend-1"]').classList.contains('is-read'), false);
    assert.equal(document.querySelector('#open-notifications').getAttribute('aria-label'), 'Notificaciones, 1 sin leer');
    assert.equal(requests.some(({ url, init }) => url.endsWith('/leer') && init.method === 'POST'), false);
    accepted.click();
    await tick();
    assert.equal(friendAcceptRequests.length, 1);
  } finally {
    dom.window.close();
  }
});

test('la aceptación de amistad destaca el username como texto seguro en negrita', async () => {
  const username = '<b>Collector</b>';
  const accepted = createNotification('accepted-1', username, false, {
    type: 'friend_request_accepted', data: { user: username },
  });
  const { dom, window } = startApp({ initialPage: { notifications: [accepted], unreadCount: 1, nextCursor: null } });
  try {
    await tick();
    await tick();
    const message = window.document.querySelector('.notification-message');
    assert.equal(message.querySelector('strong').textContent, username);
    assert.equal(message.querySelector('b'), null);
    assert.equal(message.textContent, `${username} ha aceptado tu solicitud de amistad.`);
  } finally {
    dom.window.close();
  }
});

test('un fallo al aceptar conserva lectura y deja reintentar', async () => {
  const friendRequest = createNotification('friend-retry', 'Grace', false, {
    type: 'friend_request', data: { user: 'Grace', message: 'Grace quiere ser tu amigo.' }, canAccept: true,
  });
  const { dom, window, friendAcceptRequests, setFriendAcceptFails } = startApp({
    initialPage: { notifications: [friendRequest], unreadCount: 1, nextCursor: null },
  });
  try {
    await tick();
    await tick();
    setFriendAcceptFails(true);
    window.document.querySelector('.notification-accept-friend').click();
    await tick();
    assert.equal(window.document.querySelector('.notification-error[role="alert"]').textContent, 'No se pudo aceptar la solicitud. Inténtalo de nuevo.');
    assert.equal(window.document.querySelector('.notification-accept-friend').disabled, false);
    assert.equal(window.document.querySelector('[data-notification-id="friend-retry"]').classList.contains('is-read'), false);
    setFriendAcceptFails(false);
    window.document.querySelector('.notification-accept-friend').click();
    await tick();
    assert.equal(friendAcceptRequests.length, 2);
    assert.equal(window.document.querySelector('.notification-accept-friend').disabled, true);
    assert.equal(window.document.querySelector('.notification-error'), null);
    assert.equal(window.document.querySelector('[data-notification-id="friend-retry"]').classList.contains('is-read'), false);
  } finally {
    dom.window.close();
  }
});

test('agrupa fechas con calendario de Madrid y fija title exacto incluso en el límite de un minuto', async () => {
  const { dom, window } = startApp();
  try {
    await tick();
    await tick();
    const groups = window.eval(`[
      notificationDateGroup('2026-10-09T10:59:01.000Z', new Date('2026-10-09T11:00:00.000Z')),
      notificationDateGroup('2026-10-09T10:59:00.000Z', new Date('2026-10-09T11:00:00.000Z')),
      notificationDateGroup('2026-10-09T08:00:00.000Z', new Date('2026-10-09T11:00:00.000Z')),
      notificationDateGroup('2026-10-08T08:00:00.000Z', new Date('2026-10-09T11:00:00.000Z')),
      notificationDateGroup('2026-10-06T08:00:00.000Z', new Date('2026-10-09T11:00:00.000Z')),
      notificationDateGroup('2026-10-04T08:00:00.000Z', new Date('2026-10-09T11:00:00.000Z')),
      notificationDateGroup('2026-09-20T08:00:00.000Z', new Date('2026-10-09T11:00:00.000Z')),
    ]`);
    assert.deepEqual(Array.from(groups), [
      'Hace un instante', 'Hoy', 'Ayer', 'Esta semana', 'La semana pasada', 'Hace más de dos semanas',
    ].flatMap((label, index) => index === 1 ? [label, label] : [label]));
    assert.equal(window.eval("exactNotificationTimestamp('2026-10-09T10:01:00.000Z')"), '09/10/2026 12:01');
  } finally {
    dom.window.close();
  }
});

test('refresca logros V2 al agradecer y el pago directo al donante por Realtime', async () => {
  const gift = createNotification('gift-live', 'Ada', false, {
    type: 'gift_received', canThank: true,
    data: { user: 'Ada', amount: 50, message: 'Ada te regaló 50 Bricks.' },
  });
  const { dom, window, requests, setGamificationState } = startApp({
    initialPage: { notifications: [gift], unreadCount: 1, nextCursor: null },
  });
  try {
    await tick();
    await tick();
    assert.equal(window.document.querySelector('#gamification-bricks').textContent, '0');
    window.document.querySelector('#gamification-level').click();
    const giftedState = {
      bricks: 70,
      nivel: { id: 2, nombre: 'Plate' },
      siguienteNivel: { id: 3, nombre: 'Three-Seven-Five' },
      progreso: { porcentaje: 0 },
      logros: [{ id: 'oh-you-shouldnt-have', type: 'regalo', nombre: "Oh! you shouldn't have!", descripcion: 'Has recibido tu primer regalo', bricks: 20, cantidad: 1, total: 20 }],
    };
    setGamificationState(giftedState);
    window.__supabaseStub.channels[0].emit({ new: { id: gift.id, type: 'gift_received' } });
    await tick();
    await tick();
    assert.equal(window.document.querySelector('#gamification-bricks').textContent, '70');
    assert.equal(window.document.querySelector('#gamification-dialog-bricks').textContent, '70');
    assert.ok([...window.document.querySelectorAll('#gamification-achievements .achievement-name')]
      .some(({ textContent }) => textContent === "Oh! you shouldn't have!"));
    window.document.querySelector('#gamification-close').click();

    window.document.querySelector('#open-notifications').click();
    await tick();
    await tick();
    const thankedState = {
      ...giftedState,
      bricks: 75,
      logros: [
        giftedState.logros[0],
        { id: 'gratitude-is-the-sign-of-noble-souls', type: 'regalo', nombre: 'Gratitude is the sign of noble souls', descripcion: 'Has dado las gracias por primera vez', bricks: 5, cantidad: 1, total: 5 },
      ],
    };
    setGamificationState(thankedState);
    window.document.querySelector('.notification-thank').click();
    await tick();
    await tick();
    assert.equal(window.document.querySelector('#gamification-bricks').textContent, '75');
    assert.ok([...window.document.querySelectorAll('#gamification-achievements .achievement-name')]
      .some(({ textContent }) => textContent === 'Gratitude is the sign of noble souls'));

    const sessionB = { access_token: 'token-b', user: { id: 'user-b', email: 'b@example.invalid' } };
    setGamificationState({ bricks: 100, nivel: { id: 3, nombre: 'Three-Seven-Five' }, progreso: { porcentaje: 0 }, logros: [] });
    window.__supabaseStub.setSession('SIGNED_IN', sessionB);
    await tick();
    await tick();
    setGamificationState({
      bricks: 105,
      nivel: { id: 3, nombre: 'Three-Seven-Five' },
      progreso: { porcentaje: 0 },
      logros: [],
    });
    window.__supabaseStub.channels[1].emit({ new: { id: 'thanks-live', type: 'gift_thanks' } });
    await tick();
    await tick();
    assert.equal(window.document.querySelector('#gamification-bricks').textContent, '105');
    assert.ok(requests.filter(({ url }) => url === '/gamificacion').length >= 4);
    window.document.querySelector('#gamification-level').click();
    assert.equal(window.document.querySelectorAll('#gamification-achievements .achievement-item').length, 0);
    assert.equal(window.location.pathname, '/');
  } finally {
    dom.window.close();
  }
});

test('el cambio de version vacia la bandeja y los toasts V1 y conserva la sesion', async () => {
  const staleNotification = createNotification('v1-notification', 'Grace', false, {
    type: 'gift_received', canThank: true,
    data: { user: 'Grace', amount: 50, message: 'Grace te regaló 50 Bricks.' },
  });
  const { dom, window, requests, setNotificationPage } = startApp({
    initialPage: { notifications: [staleNotification], unreadCount: 1, nextCursor: null },
  });
  try {
    await tick();
    await tick();
    const document = window.document;
    document.querySelector('#open-notifications').click();
    await tick();
    assert.ok(document.querySelector('[data-notification-id="v1-notification"]'));
    assert.equal(document.querySelector('#notifications-unread-badge').hidden, false);

    window.eval("showGamificationToasts({ logrosNuevos: [{ nombre: 'V1 visible', bricksNuevos: 50 }, { nombre: 'V1 pendiente', bricksNuevos: 20 }] })");
    assert.ok(document.querySelector('#toast-region .toast-task'));
    window.localStorage.setItem('minipeople.gamificationVersion', 'v1');
    setNotificationPage({ notifications: [], unreadCount: 0, nextCursor: null });
    const versionRefresh = window.eval('loadGamification()');
    await versionRefresh;
    await tick();
    assert.equal(document.querySelector('#notifications-dialog').open, false);
    assert.equal(document.querySelector('#notifications-unread-badge').hidden, true);
    assert.equal(window.localStorage.getItem('minipeople.gamificationVersion'), 'v2');
    assert.equal(document.querySelectorAll('#toast-region .toast').length, 0);
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.equal(document.querySelectorAll('#toast-region .toast').length, 0);
    assert.ok(requests.some(({ url, init }) => url === '/gamificacion' && init.headers.Authorization === 'Bearer token-a'));

    window.__supabaseStub.channels[0].emit({ new: { id: 'late-v1-event', type: 'gift_received' } });
    await tick();
    assert.equal(document.querySelectorAll('#toast-region .toast-notification').length, 0);
    document.querySelector('#open-notifications').click();
    await tick();
    await tick();
    assert.equal(document.querySelector('#notifications-status').textContent, 'No tienes notificaciones.');
    assert.equal(document.querySelectorAll('[data-notification-id]').length, 0);
  } finally {
    dom.window.close();
  }
});