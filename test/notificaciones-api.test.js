import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseMock } from '../test-support/supabase-mock.js';
import { TEST_TOKEN, OTHER_TOKEN, authFetch, startTestServer } from '../test-support/server.js';

const DONOR_ID = '00000000-0000-4000-8000-00000000000a';
const RECEIVER_ID = '00000000-0000-4000-8000-00000000000b';
const DONATION_ID = '00000000-0000-4000-8000-00000000000c';

function notificationsMock() {
  const mock = createSupabaseMock({ users: {
    [TEST_TOKEN]: { id: DONOR_ID, user_metadata: { full_name: 'Ada' } },
    [OTHER_TOKEN]: { id: RECEIVER_ID, user_metadata: { full_name: 'Grace' } },
  } });
  mock.seed('gamificacion', DONOR_ID, [{ bricks: 100, nivel: { id: 3, nombre: 'Three-Seven-Five' }, logros: [] }]);
  mock.seed('gamificacion', RECEIVER_ID, [{ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, logros: [] }]);
  return mock;
}

test('las rutas de bandeja y lectura global exigen sesion y métodos explícitos', async () => {
  const context = await startTestServer({ supabase: notificationsMock() });
  const inboxUrl = `${context.baseUrl}/api/notificaciones`;
  try {
    assert.equal((await fetch(inboxUrl)).status, 401);
    assert.equal((await fetch(`${inboxUrl}/leer-todas`, { method: 'POST' })).status, 401);
    const get = authFetch(TEST_TOKEN);
    const wrongReadMethod = await get(inboxUrl, { method: 'POST' });
    assert.equal(wrongReadMethod.status, 405);
    assert.equal(wrongReadMethod.headers.get('allow'), 'GET');
    const wrongMarkMethod = await get(`${inboxUrl}/leer-todas`);
    assert.equal(wrongMarkMethod.status, 405);
    assert.equal(wrongMarkMethod.headers.get('allow'), 'POST');
    const markOnePath = `${inboxUrl}/${DONATION_ID}/leer`;
    assert.equal((await fetch(markOnePath, { method: 'POST' })).status, 401);
    const wrongMarkOneMethod = await get(markOnePath);
    assert.equal(wrongMarkOneMethod.status, 405);
    assert.equal(wrongMarkOneMethod.headers.get('allow'), 'POST');
    assert.deepEqual(await (await get(`${inboxUrl}?userId=${RECEIVER_ID}`)).json(), { error: 'PARAMETRO_INVALIDO' });
    assert.deepEqual(await (await get(`${inboxUrl}?cursor=`)).json(), { error: 'PARAMETRO_INVALIDO' });
  } finally {
    await context.close();
  }
});

test('el regalo confirmado crea un evento propio, agradecer no limpia lectura y el duplicado es conflicto', async () => {
  const mock = notificationsMock();
  const context = await startTestServer({ supabase: mock });
  const donor = authFetch(TEST_TOKEN);
  const receiver = authFetch(OTHER_TOKEN);
  const inboxUrl = `${context.baseUrl}/api/notificaciones`;
  try {
    const gift = await donor(`${context.baseUrl}/api/ranking/regalar`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ receptorId: RECEIVER_ID }),
    });
    assert.equal(gift.status, 200);
    const received = await receiver(inboxUrl);
    const receiverInbox = await received.json();
    assert.equal(receiverInbox.unreadCount, 1);
    assert.equal(receiverInbox.notifications.length, 1);
    const notification = receiverInbox.notifications[0];
    assert.equal(notification.type, 'gift_received');
    assert.equal(notification.canThank, true);
    assert.equal(notification.data.user, 'Ada');
    assert.equal(notification.data.amount, 50);
    assert.equal('user_id' in notification, false);

    const thanked = await receiver(`${inboxUrl}/${notification.id}/agradecer`, { method: 'POST' });
    assert.equal(thanked.status, 200);
    assert.deepEqual(await thanked.json(), { ok: true });
    const afterThanks = await (await receiver(inboxUrl)).json();
    assert.equal(afterThanks.unreadCount, 1);
    assert.equal(afterThanks.notifications[0].isRead, false);
    assert.equal(afterThanks.notifications[0].canThank, false);

    const duplicate = await receiver(`${inboxUrl}/${notification.id}/agradecer`, { method: 'POST' });
    assert.equal(duplicate.status, 409);
    assert.deepEqual(await duplicate.json(), { error: 'REGALO_YA_AGRADECIDO' });
    const forged = await donor(`${inboxUrl}/${notification.id}/agradecer`, { method: 'POST' });
    assert.equal(forged.status, 404);

    const thankNotifications = await (await donor(inboxUrl)).json();
    assert.equal(thankNotifications.notifications[0].type, 'gift_thanks');
    assert.equal(thankNotifications.notifications[0].data.user, 'Grace');
    assert.equal(mock.rows('gamificacion', DONOR_ID)[0].bricks, 110);
    assert.equal(mock.rows('gamificacion', DONOR_ID)[0].logros.find(({ id }) => id === 'thanks-for-the-gift').nombre, 'Gratitude is the sign of noble souls');
    assert.equal(mock.rows('gamificacion', RECEIVER_ID)[0].bricks, 50);
    assert.equal(mock.rows('gamificacion', RECEIVER_ID)[0].logros.some(({ id }) => id === 'thanks-for-the-gift'), false);

    const markedOne = await receiver(`${inboxUrl}/${notification.id}/leer`, { method: 'POST' });
    assert.equal(markedOne.status, 200);
    assert.deepEqual(await markedOne.json(), { unreadCount: 0 });
    assert.equal(mock.rows('notificaciones', RECEIVER_ID).find(({ id }) => id === notification.id).is_read, true);
    assert.equal(mock.rows('notificaciones', DONOR_ID).find(({ type }) => type === 'gift_thanks').is_read, false);

    const cleared = await receiver(`${inboxUrl}/leer-todas`, { method: 'POST' });
    assert.deepEqual(await cleared.json(), { unreadCount: 0 });
    assert.equal((await (await receiver(inboxUrl)).json()).notifications[0].isRead, true);
    assert.equal(mock.rows('notificaciones', DONOR_ID).some(({ id }) => id === notification.id), false);
    assert.equal(mock.rows('notificaciones', RECEIVER_ID).some(({ id }) => id === notification.id), true);
  } finally {
    await context.close();
  }
});

test('fallos de persistencia de bandeja devuelven errores controlados', async () => {
  const mock = notificationsMock();
  const context = await startTestServer({ supabase: mock });
  const get = authFetch(TEST_TOKEN);
  try {
    mock.failNext('notificaciones', { code: 'XX000', message: 'private storage detail' }, 'select');
    const failed = await get(`${context.baseUrl}/api/notificaciones`);
    assert.equal(failed.status, 500);
    assert.deepEqual(await failed.json(), { error: 'NOTIFICACIONES_NO_DISPONIBLES' });
  } finally {
    await context.close();
  }
});