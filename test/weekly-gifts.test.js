import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { calcularGamificacion } from '../src/gamificacion.js';

test('los regalos semanales conservan su importe separado de regalos globales y agradecimientos', () => {
  const state = calcularGamificacion([], [], 1, 1, 2);
  assert.equal(state.bricks, 70);
  assert.equal(state.logros.find(({ id }) => id === 'someone-liked-your-collection').nombre, 'Your collection is top!');
  const weekly = state.logros.find(({ id }) => id === 'youre-on-fire-this-week');
  assert.equal(weekly.nombre, "You're on fire this week!");
  assert.equal(weekly.cantidad, 2);
  assert.equal(weekly.total, 10);
  assert.equal(weekly.type, 'regalo');
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
    await db.query('insert into auth.users(id) values ($1), ($2)', [donor, receiver]);
    await db.exec("insert into public.gamificacion(user_id, bricks, nivel) select id, 100, '{\"id\":3}' from auth.users");
    await db.query(`insert into public.user_daily_snapshots(user_id, snapshot_date, bricks, level, total_figures, total_value,
      pct_collector, pct_explorer, pct_rarity_hunter, pct_fan)
      select $1::uuid, day::date, 100, 3, 0, 0, 0, 0, 0, 0
      from unnest(array['2026-10-11','2026-10-12','2026-10-18','2026-10-19']) day`, [receiver]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [donor]);
    const send = (date, recipient = receiver) => db.query('select private.regalar_bricks_semanal($1, $2::timestamptz)', [recipient, date]);
    await assert.rejects(send('2026-10-12T10:00:00Z', donor), /AUTORREGALO_NO_PERMITIDO/);
    await assert.rejects(send('2026-10-11T10:00:00Z'), /RECEPTOR_NO_ENCONTRADO/);
    const concurrent = await Promise.allSettled([send('2026-10-12T10:00:00Z'), send('2026-10-12T10:00:00Z')]);
    assert.equal(concurrent.filter(({ status }) => status === 'fulfilled').length, 1);
    assert.match(concurrent.find(({ status }) => status === 'rejected').reason.message, /REGALO_YA_ENVIADO/);
    await assert.rejects(send('2026-10-18T21:59:59Z'), /REGALO_YA_ENVIADO/);
    await db.query('select public.regalar_bricks($1)', [receiver]);
    await assert.rejects(db.query('select public.regalar_bricks($1)', [receiver]), /REGALO_YA_ENVIADO/);
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
    assert.equal((await db.query('select bricks from public.gamificacion where user_id = $1', [receiver])).rows[0].bricks, 155);
    assert.equal((await db.query('select count(*)::integer as count from public.regalos_enviados')).rows[0].count, 2);
    await db.exec('drop trigger reject_weekly_notification on public.notificaciones');
    await send('2026-10-18T22:00:00Z');
    const state = (await db.query('select bricks, logros from public.gamificacion where user_id = $1', [receiver])).rows[0];
    assert.equal(state.bricks, 160);
    assert.equal(state.logros.find(({ id }) => id === 'youre-on-fire-this-week').cantidad, 2);
    assert.equal(state.logros.find(({ id }) => id === 'someone-liked-your-collection').nombre, 'Your collection is top!');
    const gifts = (await db.query("select id, payload from public.notificaciones where user_id = $1 and type = 'gift_received' and payload->>'amount' = '5'", [receiver])).rows;
    assert.equal(gifts.length, 2);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [receiver]);
    assert.equal((await db.query('select public.regalos_recibidos_count() as count')).rows[0].count, 1);
    assert.equal((await db.query('select public.regalos_semanales_recibidos_count() as count')).rows[0].count, 2);
    for (const gift of gifts) {
      assert.match(gift.payload.message, /Ranking Semanal/);
      await db.query('select public.agradecer_regalo($1)', [gift.id]);
      await assert.rejects(db.query('select public.agradecer_regalo($1)', [gift.id]), /REGALO_YA_AGRADECIDO/);
    }
    assert.equal((await db.query('select bricks from public.gamificacion where user_id = $1', [donor])).rows[0].bricks, 120);
    await db.query(`update public.gamificacion set logros = jsonb_set(logros, '{0,nombre}', '"Someone liked your collection"') where user_id = $1`, [receiver]);
    await db.exec(schema);
    const migrated = (await db.query('select logros from public.gamificacion where user_id = $1', [receiver])).rows[0].logros;
    assert.equal(migrated.find(({ id }) => id === 'someone-liked-your-collection').nombre, 'Your collection is top!');
    assert.equal((await db.query('select count(*)::integer as count from public.regalos_enviados')).rows[0].count, 3);
    await db.exec('set role authenticated');
    await assert.rejects(db.query("select private.regalar_bricks_semanal($1, '2026-10-19')", [receiver]), /permission denied/);
    await assert.rejects(db.query('insert into public.regalos_enviados(donante_id, receptor_id) values ($1, $2)', [donor, receiver]), /permission denied/);
  } finally {
    await db.close();
  }
});