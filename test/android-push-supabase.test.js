import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const USER_A = '00000000-0000-4000-8000-0000000000a1';
const USER_B = '00000000-0000-4000-8000-0000000000b1';
const INSTALL_A = '10000000-0000-4000-8000-0000000000a1';
const INSTALL_B = '10000000-0000-4000-8000-0000000000b1';
const NOTIFICATION_A = '20000000-0000-4000-8000-0000000000a1';
const NOTIFICATION_B = '20000000-0000-4000-8000-0000000000b1';

async function databaseWithPushSchema() {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create role anon;
    create role authenticated;
    create role service_role;
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.role() returns text language sql as $$
      select nullif(current_setting('request.jwt.claim.role', true), '')
    $$;
    create table auth.users (id uuid primary key, email text unique);
  `);
  await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/android-push-notifications.sql', import.meta.url), 'utf8'));
  return db;
}

async function seedNotificationsAndInstallations(db) {
  await db.query('insert into auth.users(id, email) values ($1, $2), ($3, $4)', [
    USER_A, 'push-a@example.invalid', USER_B, 'push-b@example.invalid',
  ]);
  await db.query(`insert into public.notificaciones(id, user_id, type, payload)
    values ($1, $2, 'weekly_ranking_available', '{"secret":"never-in-push"}'),
      ($3, $4, 'weekly_ranking_available', '{"secret":"other-user"}')`,
  [NOTIFICATION_A, USER_A, NOTIFICATION_B, USER_B]);
  await db.query(`insert into public.android_push_installations
    (installation_id, user_id, fcm_token, permission_state, active)
    values ($1, $2, 'opaque-token-a-123456789012345', 'granted', true),
      ($3, $4, 'opaque-token-b-123456789012345', 'granted', true)`,
  [INSTALL_A, USER_A, INSTALL_B, USER_B]);
}

async function asServiceRole(db, query, parameters = []) {
  await db.exec("set role service_role; select set_config('request.jwt.claim.role', 'service_role', false)");
  try {
    return await db.query(query, parameters);
  } finally {
    await db.exec('reset role; select set_config(\'request.jwt.claim.role\', \'\', false)');
  }
}

test('la migración es repetible, encola solo inserts y preserva las notificaciones existentes', async () => {
  const db = await databaseWithPushSchema();
  try {
    await db.query('insert into auth.users(id, email) values ($1, $2)', [USER_A, 'repeat@example.invalid']);
    await db.query(`insert into public.notificaciones(id, user_id, type, payload)
      values ($1, $2, 'weekly_ranking_available', '{"message":"existing"}')`, [NOTIFICATION_A, USER_A]);
    await db.query(`update public.notificaciones set payload = '{"message":"updated"}' where id = $1`, [NOTIFICATION_A]);
    assert.equal((await db.query('select count(*)::integer as count from private.android_push_outbox where notification_id = $1', [NOTIFICATION_A])).rows[0].count, 1);
    await db.exec(await readFile(new URL('../supabase/android-push-notifications.sql', import.meta.url), 'utf8'));
    assert.equal((await db.query('select count(*)::integer as count from private.android_push_outbox')).rows[0].count, 1);
    assert.deepEqual((await db.query('select payload from public.notificaciones where id = $1', [NOTIFICATION_A])).rows[0].payload, { message: 'updated' });
  } finally {
    await db.close();
  }
});

test('JWT y RLS confinan registros; service_role no tiene acceso directo ni anon/auth pueden ejecutar RPC', async () => {
  const db = await databaseWithPushSchema();
  try {
    await seedNotificationsAndInstallations(db);
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await db.query('select has_function_privilege($1, $2, $3) as allowed', [
        role, 'public.android_push_claim_events(integer,integer)', 'EXECUTE',
      ])).rows[0].allowed, false);
      assert.equal((await db.query('select has_function_privilege($1, $2, $3) as allowed', [
        role, 'public.android_push_resolve_event_tokens(uuid,uuid)', 'EXECUTE',
      ])).rows[0].allowed, false);
      assert.equal((await db.query('select has_function_privilege($1, $2, $3) as allowed', [
        role, 'public.android_push_record_attempt(uuid,uuid,uuid,text,text,integer)', 'EXECUTE',
      ])).rows[0].allowed, false);
    }

    for (const relation of [
      'public.notificaciones', 'public.android_push_installations',
      'private.android_push_outbox', 'private.android_push_deliveries',
    ]) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        assert.equal((await db.query('select has_table_privilege($1, $2, $3) as allowed', [
          'service_role', relation, privilege,
        ])).rows[0].allowed, false, `${relation} ${privilege}`);
      }
    }
    assert.equal((await db.query('select has_function_privilege($1, $2, $3) as allowed', [
      'service_role', 'public.android_push_claim_events(integer,integer)', 'EXECUTE',
    ])).rows[0].allowed, true);

    await db.exec(`set role authenticated;
      select set_config('request.jwt.claim.role', 'authenticated', false);
      select set_config('request.jwt.claim.sub', '${USER_A}', false)`);
    await db.query(`insert into public.android_push_installations
      (installation_id, user_id, fcm_token, permission_state, active)
      values ($1, $2, 'new-token-a-123456789012345', 'granted', true)`,
    ['10000000-0000-4000-8000-0000000000a2', USER_A]);
    await assert.rejects(db.query('select * from public.android_push_installations'), /permission denied|row-level security/i);
    await assert.rejects(db.query('select fcm_token from public.android_push_installations'), /permission denied/i);
    const ownRegistration = await db.query(`update public.android_push_installations
      set fcm_token = 'rotated-token-a-123456789012345'
      where installation_id = $1 returning installation_id, permission_state`, ['10000000-0000-4000-8000-0000000000a2']);
    assert.deepEqual(ownRegistration.rows, [{
      installation_id: '10000000-0000-4000-8000-0000000000a2', permission_state: 'granted',
    }]);
    await assert.rejects(db.query(`insert into public.android_push_installations
      (installation_id, user_id, fcm_token, permission_state, active)
      values ($1, $2, 'forged-token-123456789012345', 'granted', true)`,
    ['10000000-0000-4000-8000-0000000000a3', USER_B]), /row-level security/i);
    await db.exec(`select set_config('request.jwt.claim.sub', '${USER_B}', false)`);
    assert.deepEqual((await db.query('select installation_id from public.android_push_installations where installation_id = $1', [
      '10000000-0000-4000-8000-0000000000a2',
    ])).rows, []);
    const takeover = await db.query(`update public.android_push_installations
      set fcm_token = 'takeover-token-123456789012345'
      where installation_id = $1 returning installation_id`, [INSTALL_A]);
    assert.deepEqual(takeover.rows, []);
    await db.exec('reset role; select set_config(\'request.jwt.claim.role\', \'\', false); select set_config(\'request.jwt.claim.sub\', \'\', false)');
    assert.equal((await db.query('select fcm_token from public.android_push_installations where installation_id = $1', ['10000000-0000-4000-8000-0000000000a2'])).rows[0].fcm_token, 'rotated-token-a-123456789012345');

    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}; select set_config('request.jwt.claim.role', '${role}', false)`);
      await assert.rejects(db.query('select * from public.android_push_claim_events(1, 60)'), /permission denied|ANDROID_PUSH_NO_AUTORIZADO/i);
      await db.exec('reset role; select set_config(\'request.jwt.claim.role\', \'\', false)');
    }
  } finally {
    await db.close();
  }
});

test('las RPC allowlisted reclaman un evento y devuelven únicamente tokens de su destinatario', async () => {
  const db = await databaseWithPushSchema();
  try {
    await seedNotificationsAndInstallations(db);
    const claimed = await asServiceRole(db, 'select * from public.android_push_claim_events(10, 60)');
    assert.equal(claimed.rows.length, 2);
    const eventA = claimed.rows.find(({ notification_id }) => notification_id === NOTIFICATION_A);
    assert.equal(eventA.notification_id, NOTIFICATION_A);
    const targetsA = await asServiceRole(db, 'select * from public.android_push_resolve_event_tokens($1, $2)', [eventA.event_id, eventA.lease_token]);
    assert.deepEqual(targetsA.rows.map(({ installation_id, fcm_token }) => ({ installation_id, fcm_token })), [
      { installation_id: INSTALL_A, fcm_token: 'opaque-token-a-123456789012345' },
    ]);
    assert.equal(JSON.stringify(targetsA.rows).includes('secret'), false);
    assert.equal((await asServiceRole(db, 'select public.android_push_record_attempt($1, $2, $3, $4, $5, $6) as result', [
      eventA.event_id, eventA.lease_token, INSTALL_A, 'sent', null, 0,
    ])).rows[0].result, 'completed');

    const eventB = claimed.rows.find(({ notification_id }) => notification_id === NOTIFICATION_B);
    const targetsB = await asServiceRole(db, 'select * from public.android_push_resolve_event_tokens($1, $2)', [
      eventB.event_id, eventB.lease_token,
    ]);
    assert.deepEqual(targetsB.rows.map(({ installation_id }) => installation_id), [INSTALL_B]);
    await assert.rejects(asServiceRole(db, 'select * from public.android_push_resolve_event_tokens($1, $2, $3)', [
      eventB.event_id, eventB.lease_token, USER_A,
    ]), /function .* does not exist/i);
    await assert.rejects(asServiceRole(db, 'select public.android_push_record_attempt($1, $2, $3, $4, $5, $6)', [
      eventB.event_id, eventB.lease_token, INSTALL_A, 'sent', null, 0,
    ]), /ANDROID_PUSH_INTENTO_NO_ENCONTRADO/i);
  } finally {
    await db.close();
  }
});

test('retries, invalid tokens, leases y TTL quedan limitados por evento', async () => {
  const db = await databaseWithPushSchema();
  try {
    await seedNotificationsAndInstallations(db);
    const claimed = (await asServiceRole(db, 'select * from public.android_push_claim_events(10, 10)')).rows;
    const event = claimed.find(({ notification_id }) => notification_id === NOTIFICATION_A);
    const targetInstallation = INSTALL_A;
    const targets = await asServiceRole(db, 'select * from public.android_push_resolve_event_tokens($1, $2)', [event.event_id, event.lease_token]);
    assert.equal(targets.rows[0].attempts, 0);
    assert.equal((await asServiceRole(db, 'select public.android_push_record_attempt($1, $2, $3, $4, $5, $6) as result', [
      event.event_id, event.lease_token, targetInstallation, 'retry', 'UNAVAILABLE', 30,
    ])).rows[0].result, 'queued');
    await assert.rejects(asServiceRole(db, 'select * from public.android_push_resolve_event_tokens($1, $2)', [
      event.event_id, event.lease_token,
    ]), /ANDROID_PUSH_EVENTO_NO_RECLAMADO/i);
    await db.query('update private.android_push_outbox set available_at = now() - interval \'1 second\' where id = $1', [event.event_id]);
    await db.query('update private.android_push_deliveries set next_attempt_at = now() - interval \'1 second\' where event_id = $1', [event.event_id]);
    const reclaimed = (await asServiceRole(db, 'select * from public.android_push_claim_events(1, 10)')).rows[0];
    assert.notEqual(reclaimed.lease_token, event.lease_token);
    const secondTarget = (await asServiceRole(db, 'select * from public.android_push_resolve_event_tokens($1, $2)', [
      reclaimed.event_id, reclaimed.lease_token,
    ])).rows[0];
    assert.equal(secondTarget.attempts, 1);
    await asServiceRole(db, 'select public.android_push_record_attempt($1, $2, $3, $4, $5, $6)', [
      reclaimed.event_id, reclaimed.lease_token, targetInstallation, 'invalid', 'UNREGISTERED', 0,
    ]);
    const invalidRegistration = (await db.query('select fcm_token, active, permission_state from public.android_push_installations where installation_id = $1', [INSTALL_A])).rows[0];
    assert.deepEqual(invalidRegistration, { fcm_token: null, active: false, permission_state: 'invalid' });

    await db.query('update private.android_push_outbox set expires_at = now() - interval \'1 second\' where notification_id = $1', [NOTIFICATION_B]);
    assert.equal((await asServiceRole(db, 'select * from public.android_push_claim_events(10, 60)')).rows.length, 0);
    assert.equal((await db.query('select status from private.android_push_outbox where notification_id = $1', [NOTIFICATION_B])).rows[0].status, 'expired');
  } finally {
    await db.close();
  }
});

test('la baja y eliminación de cuenta limpian la propiedad del token y sus eventos', async () => {
  const db = await databaseWithPushSchema();
  try {
    await seedNotificationsAndInstallations(db);
    await db.query('delete from auth.users where id = $1', [USER_A]);
    assert.equal((await db.query('select count(*)::integer as count from public.android_push_installations where installation_id = $1', [INSTALL_A])).rows[0].count, 0);
    assert.equal((await db.query('select count(*)::integer as count from private.android_push_outbox where notification_id = $1', [NOTIFICATION_A])).rows[0].count, 0);
  } finally {
    await db.close();
  }
});
