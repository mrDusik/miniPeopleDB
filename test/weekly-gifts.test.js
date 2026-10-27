import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { calcularGamificacion } from '../src/gamificacion.js';

test('los regalos semanales conservan pagos directos y unifican el hito V2 de recibidos', () => {
  assert.equal(calcularGamificacion([], [], 1).bricks, 70);
  assert.equal(calcularGamificacion([], [], 0, 0, 1).bricks, 25);
  assert.equal(calcularGamificacion([], [], 6, 0, 4).bricks, 440);
  const state = calcularGamificacion([], [], 1, 1, 2);
  assert.equal(state.bricks, 85);
  assert.deepEqual(state.logros.find(({ id }) => id === 'oh-you-shouldnt-have'), {
    id: 'oh-you-shouldnt-have', type: 'regalo', nombre: "Oh! you shouldn't have!",
    descripcion: 'Has recibido tu primer regalo', bricks: 20, repetible: false, cantidad: 1, total: 20,
  });
  assert.equal(state.logros.some(({ id }) => ['someone-liked-your-collection', 'youre-on-fire-this-week', 'thanks-for-the-gift'].includes(id)), false);
  assert.equal(state.bricks, 20 + 50 + 2 * 5 + 5);

  const socialSources = { friends: 0, sent_pending: 0, accepted_sent: 0, accepted_received: 0, thanks_sent: 1 };
  const firstThanks = calcularGamificacion([], [], 0, 0, 0, socialSources);
  assert.equal(firstThanks.logros.find(({ id }) => id === 'gratitude-is-the-sign-of-noble-souls')?.total, 5);
  assert.equal(firstThanks.logros.some(({ id }) => id === 'great-manners'), false);
  const tenThanks = calcularGamificacion([], [], 0, 0, 0, { ...socialSources, thanks_sent: 10 });
  assert.equal(tenThanks.logros.find(({ id }) => id === 'gratitude-is-the-sign-of-noble-souls')?.total, 5);
  assert.equal(tenThanks.logros.find(({ id }) => id === 'great-manners')?.total, 30);
  const thanksReceived = calcularGamificacion([], [], 0, 10, 0, { ...socialSources, thanks_sent: 0, thanks_received: 10 });
  assert.equal(thanksReceived.bricks, 50);
  assert.equal(thanksReceived.logros.length, 0);
});

test('avisos de regalos y gracias usan usernames y migran nombres Google históricos sin cambiar lectura', async () => {
  const db = new PGlite();
  const donor = '00000000-0000-4000-8000-000000000001';
  const receiver = '00000000-0000-4000-8000-000000000002';
  try {
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
    const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
    await db.exec(schema);
    await db.query('insert into auth.users(id) values ($1), ($2)', [donor, receiver]);
    await db.query('insert into public.user_profiles(user_id, username) values ($1, $2), ($3, $4)', [donor, 'Donor_1', receiver, 'Receiver_2']);
    await db.query('insert into public.perfiles_publicos(user_id, display_name) values ($1, $2), ($3, $4)', [donor, 'Google Donor', receiver, 'Google Receiver']);
    await db.exec("insert into public.gamificacion(user_id, bricks) select id, 100 from auth.users");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [donor]);
    await db.query('select public.regalar_bricks($1)', [receiver]);
    const gift = (await db.query("select id, payload from public.notificaciones where type = 'gift_received'")).rows[0];
    assert.equal(gift.payload.user, 'Donor_1');
    assert.doesNotMatch(gift.payload.message, /Google Donor/);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [receiver]);
    await db.query('select public.agradecer_regalo($1)', [gift.id]);
    const thanks = (await db.query("select id, payload from public.notificaciones where type = 'gift_thanks'")).rows[0];
    assert.equal(thanks.payload.user, 'Receiver_2');
    assert.doesNotMatch(thanks.payload.message, /Google Receiver/);
    await db.exec(`update public.notificaciones set is_read = true, payload = payload - 'actorUserId' || jsonb_build_object(
      'user', case type when 'gift_received' then 'Google Donor' else 'Google Receiver' end,
      'message', 'Texto antiguo de Google'
    ) where type in ('gift_received', 'gift_thanks')`);
    const before = (await db.query('select id, created_at, is_read, gift_thanked_at from public.notificaciones order by id')).rows;
    await db.exec(schema);
    await db.exec(schema);
    const rows = (await db.query('select id, created_at, is_read, gift_thanked_at, type, payload from public.notificaciones order by id')).rows;
    assert.deepEqual(rows.map(({ type, payload, ...row }) => row), before);
    for (const row of rows.filter((notification) => ['gift_received', 'gift_thanks'].includes(notification.type))) {
      assert.equal(row.payload.user, row.type === 'gift_received' ? 'Donor_1' : 'Receiver_2');
      assert.doesNotMatch(row.payload.message, /Google/);
    }
    const unmatched = (await db.query(`insert into public.notificaciones(user_id, type, payload, created_at)
      values ($1, 'gift_thanks', '{"user":"Nombre Google","actorUserId":"invalid","message":"Nombre Google te dio las gracias"}', '2000-01-01')
      returning id`, [donor])).rows[0].id;
    await db.exec(schema);
    const anonymous = (await db.query('select payload, is_read from public.notificaciones where id = $1', [unmatched])).rows[0];
    assert.equal(anonymous.payload.user, 'Coleccionista');
    assert.doesNotMatch(anonymous.payload.message, /Google/);
    assert.equal(anonymous.is_read, false);
  } finally {
    await db.close();
  }
});

test('SQL limita por semana Madrid, conserva el global y permite agradecer cada regalo semanal una vez', async () => {
  const db = new PGlite();
  const donor = '00000000-0000-4000-8000-000000000001';
  const receiver = '00000000-0000-4000-8000-000000000002';
  try {
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
    const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
    await db.exec(schema);
    await db.query(`insert into private.gamificacion_v2_activation(singleton, version, activated_at, available_from)
      values (true, 'v2', '2026-10-08T12:00:00Z', '2026-10-12')`);
    await db.query('insert into auth.users(id) values ($1), ($2)', [donor, receiver]);
    await db.exec(`insert into public.gamificacion(user_id, bricks, nivel) select id, 0, '{"id":0,"nombre":"Duplo"}' from auth.users`);
    await db.query(`insert into public.user_daily_snapshots(user_id, snapshot_date, bricks, level, total_figures, total_value,
      pct_collector, pct_explorer, pct_rarity_hunter, pct_fan, calculation_version)
      select $1::uuid, day::date, 100, 3, 0, 0, 0, 0, 0, 0, 'v2'
      from unnest(array['2026-10-11','2026-10-12','2026-10-18','2026-10-19']) day`, [receiver]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [donor]);
    const send = (date, recipient = receiver) => db.query('select private.regalar_bricks_semanal($1, $2::timestamptz)', [recipient, date]);
    await assert.rejects(send('2026-10-12T10:00:00Z', donor), /AUTORREGALO_NO_PERMITIDO/);
    await assert.rejects(send('2026-10-11T10:00:00Z'), /RECEPTOR_NO_ENCONTRADO/);
    const concurrent = await Promise.allSettled([send('2026-10-12T10:00:00Z'), send('2026-10-12T10:00:00Z')]);
    assert.equal(concurrent.filter(({ status }) => status === 'fulfilled').length, 1);
    assert.match(concurrent.find(({ status }) => status === 'rejected').reason.message, /REGALO_YA_ENVIADO/);
    assert.equal((await db.query('select bricks from public.gamificacion where user_id = $1', [receiver])).rows[0].bricks, 25);
    await assert.rejects(send('2026-10-18T21:59:59Z'), /REGALO_YA_ENVIADO/);
    await db.query('select public.regalar_bricks($1)', [receiver]);
    await assert.rejects(db.query('select public.regalar_bricks($1)', [receiver]), /REGALO_YA_ENVIADO/);
    assert.equal((await db.query('select bricks from public.gamificacion where user_id = $1', [receiver])).rows[0].bricks, 75);
    const firstWeek = (await db.query("select private.ranking_semanal_calcular('2026-10-18T21:59:59Z') as ranking")).rows[0].ranking;
    assert.equal(firstWeek.entries[0].regaloEnviado, true);
    const nextWeek = (await db.query("select private.ranking_semanal_calcular('2026-10-18T22:00:00Z') as ranking")).rows[0].ranking;
    assert.equal(nextWeek.weekStart, '2026-10-19');
    assert.equal(nextWeek.entries[0].regaloEnviado, false);
    await db.exec(`
      create function public.reject_weekly_notification() returns trigger language plpgsql as $$
      begin raise exception 'TEST_WEEKLY_NOTIFICATION_FAILURE'; end; $$;
      create trigger reject_weekly_notification before insert on public.notificaciones
      for each row when (new.type = 'gift_received') execute function public.reject_weekly_notification();
    `);
    await assert.rejects(send('2026-10-18T22:00:00Z'), /TEST_WEEKLY_NOTIFICATION_FAILURE/);
    assert.equal((await db.query('select bricks from public.gamificacion where user_id = $1', [receiver])).rows[0].bricks, 75);
    assert.equal((await db.query('select count(*)::integer as count from public.regalos_enviados')).rows[0].count, 2);
    await db.exec('drop trigger reject_weekly_notification on public.notificaciones');
    await send('2026-10-18T22:00:00Z');
    const state = (await db.query('select bricks, logros from public.gamificacion where user_id = $1', [receiver])).rows[0];
    assert.equal(state.bricks, 80);
    assert.equal(state.logros.find(({ id }) => id === 'oh-you-shouldnt-have').cantidad, 1);
    assert.equal(state.logros.some(({ id }) => ['someone-liked-your-collection', 'youre-on-fire-this-week'].includes(id)), false);
    const gifts = (await db.query("select id, payload from public.notificaciones where user_id = $1 and type = 'gift_received' and payload->>'amount' = '5'", [receiver])).rows;
    assert.equal(gifts.length, 2);
    await db.exec(`
      create function public.reject_thanks_notification() returns trigger language plpgsql as $$
      begin raise exception 'TEST_THANK_NOTIFICATION_FAILURE'; end; $$;
      create trigger reject_thanks_notification before insert on public.notificaciones
      for each row when (new.type = 'gift_thanks') execute function public.reject_thanks_notification();
    `);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [receiver]);
    await assert.rejects(db.query('select public.agradecer_regalo($1)', [gifts[0].id]), /TEST_THANK_NOTIFICATION_FAILURE/);
    assert.equal((await db.query('select count(*)::integer as count from public.agradecimientos_regalo')).rows[0].count, 0);
    assert.equal((await db.query('select gift_thanked_at from public.notificaciones where id = $1', [gifts[0].id])).rows[0].gift_thanked_at, null);
    assert.equal((await db.query('select bricks from public.gamificacion where user_id = $1', [donor])).rows[0].bricks, 0);
    assert.equal((await db.query('select bricks from public.gamificacion where user_id = $1', [receiver])).rows[0].bricks, 80);
    await db.exec('drop trigger reject_thanks_notification on public.notificaciones; drop function public.reject_thanks_notification();');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [receiver]);
    assert.equal((await db.query('select public.regalos_recibidos_count() as count')).rows[0].count, 1);
    assert.equal((await db.query('select public.regalos_semanales_recibidos_count() as count')).rows[0].count, 2);
    for (const gift of gifts) {
      assert.match(gift.payload.message, /Ranking Semanal/);
      await db.query('select public.agradecer_regalo($1)', [gift.id]);
      await assert.rejects(db.query('select public.agradecer_regalo($1)', [gift.id]), /REGALO_YA_AGRADECIDO/);
    }
    const donorAfterThanks = (await db.query('select bricks, logros from public.gamificacion where user_id = $1', [donor])).rows[0];
    const thankerAfterThanks = (await db.query('select bricks, logros from public.gamificacion where user_id = $1', [receiver])).rows[0];
    assert.equal(donorAfterThanks.bricks, 10);
    assert.equal(donorAfterThanks.logros.some(({ id }) => ['gratitude-is-the-sign-of-noble-souls', 'thanks-for-the-gift'].includes(id)), false);
    assert.equal(thankerAfterThanks.bricks, 85);
    assert.equal(thankerAfterThanks.logros.find(({ id }) => id === 'gratitude-is-the-sign-of-noble-souls')?.total, 5);
    assert.equal(thankerAfterThanks.logros.find(({ id }) => id === 'oh-you-shouldnt-have')?.total, 20);
    assert.equal(thankerAfterThanks.logros.some(({ id }) => id === 'great-manners'), false);
    const beforeSchemaReapply = (await db.query('select logros from public.gamificacion where user_id = $1', [receiver])).rows[0].logros;
    await db.exec(schema);
    const migrated = (await db.query('select logros from public.gamificacion where user_id = $1', [receiver])).rows[0].logros;
    assert.deepEqual(migrated, beforeSchemaReapply);
    assert.equal(migrated.some(({ id }) => ['someone-liked-your-collection', 'youre-on-fire-this-week'].includes(id)), false);
    assert.equal((await db.query('select count(*)::integer as count from public.regalos_enviados')).rows[0].count, 3);
    await db.exec('set role authenticated');
    await assert.rejects(db.query("select private.regalar_bricks_semanal($1, '2026-10-19')", [receiver]), /permission denied/);
    await assert.rejects(db.query('insert into public.regalos_enviados(donante_id, receptor_id) values ($1, $2)', [donor, receiver]), /permission denied/);
    await db.exec('reset role');

    const mixedReceiver = '00000000-0000-4000-8000-000000000003';
    const mixedDonors = Array.from({ length: 10 }, (_, index) => `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`);
    await db.query('insert into auth.users(id) select unnest($1::uuid[])', [[mixedReceiver, ...mixedDonors]]);
    await db.query('insert into public.gamificacion(user_id) select unnest($1::uuid[])', [[mixedReceiver, ...mixedDonors]]);
    await db.query(`insert into public.regalos_enviados(donante_id, receptor_id, semana)
      select donor_id, $1, case when ordinal <= 6 then '0001-01-01'::date else '2026-10-26'::date end
      from unnest($2::uuid[]) with ordinality as donors(donor_id, ordinal)`, [mixedReceiver, mixedDonors]);
    await db.query('select private.gamificacion_reconstruir_social(array[$1::uuid])', [mixedReceiver]);
    const mixed = (await db.query('select bricks, logros from public.gamificacion where user_id = $1', [mixedReceiver])).rows[0];
    assert.equal(mixed.bricks, 440);
    assert.equal(mixed.logros.find(({ id }) => id === 'oh-you-shouldnt-have').total, 20);
    assert.equal(mixed.logros.find(({ id }) => id === 'is-it-my-birthday-or-what').total, 100);
    assert.equal(mixed.logros.some(({ id }) => ['someone-liked-your-collection', 'youre-on-fire-this-week'].includes(id)), false);
  } finally {
    await db.close();
  }
});