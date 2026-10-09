import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CursorNotificacionesInvalidoError,
  NotificacionesNoDisponiblesError,
  NotificacionesRepository,
} from '../src/notificaciones-repository.js';
import { createSupabaseMock } from '../test-support/supabase-mock.js';

const notificationId = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;

test('pagina por fecha e id estable, cuenta solo las no leidas propias y proyecta datos publicos', async () => {
  const mock = createSupabaseMock({ users: { tokenA: { id: 'user-a' }, tokenB: { id: 'user-b' } } });
  const clientA = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer tokenA' } } });
  mock.seed('notificaciones', 'user-a', Array.from({ length: 16 }, (_, index) => ({
    id: notificationId(index + 1),
    type: index === 15 ? 'daily_summary' : 'gift_received',
    payload: index === 15
      ? { snapshotDate: '2026-10-09', hasPrevious: false, privateId: 'hidden' }
      : { user: `User ${index}`, amount: 50, message: 'Gift', privateId: 'hidden' },
    is_read: index === 3,
    created_at: '2026-10-09T10:00:00.000Z',
  })));
  mock.seed('notificaciones', 'user-b', [{ id: notificationId(99), type: 'gift_thanks', payload: {}, is_read: false }]);
  const repository = new NotificacionesRepository({ client: clientA });

  const first = await repository.list();
  assert.equal(first.notifications.length, 15);
  assert.equal(first.unreadCount, 15);
  assert.equal(first.nextCursor !== null, true);
  assert.deepEqual(first.notifications.map(({ id }) => id), Array.from({ length: 15 }, (_, index) => notificationId(16 - index)));
  assert.deepEqual(first.notifications[0].data, { snapshotDate: '2026-10-09', hasPrevious: false });
  assert.equal(first.notifications[0].canThank, undefined);
  assert.equal(first.notifications[1].canThank, true);

  const second = await repository.list({ cursor: first.nextCursor });
  assert.equal(second.notifications.length, 1);
  assert.equal(second.notifications[0].id, notificationId(1));
  assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.notifications, ...second.notifications].map(({ id }) => id)).size, 16);

  await assert.rejects(repository.list({ cursor: 'not-a-cursor' }), CursorNotificacionesInvalidoError);
  assert.deepEqual(await repository.markRead(notificationId(16)), { unreadCount: 14 });
  assert.equal(mock.rows('notificaciones', 'user-a').find(({ id }) => id === notificationId(16)).is_read, true);
  assert.equal(mock.rows('notificaciones', 'user-b')[0].is_read, false);
  assert.deepEqual(await repository.markAllRead(), { unreadCount: 0 });
  assert.equal(mock.rows('notificaciones', 'user-b')[0].is_read, false);
  assert.deepEqual(await repository.markAllRead(), { unreadCount: 0 });
});

test('oculta errores de persistencia y nunca devuelve filas de otra sesión', async () => {
  const mock = createSupabaseMock({ users: { token: { id: 'user-a' } } });
  const client = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token' } } });
  const repository = new NotificacionesRepository({ client });
  mock.failNext('notificaciones', { code: 'XX000', message: 'private storage detail' }, 'select');

  await assert.rejects(repository.list(), (error) => {
    assert.ok(error instanceof NotificacionesNoDisponiblesError);
    assert.equal(error.message.includes('private storage detail'), false);
    return true;
  });
});