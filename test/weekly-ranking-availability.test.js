import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('avisa una vez por semana tras completar la primera captura comparable', async () => {
  const db = new PGlite();
  const userId = (index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
  const leaseOwner = userId(99);

  async function addSnapshot(id, date, bricks) {
    await db.query(`
      insert into public.user_daily_snapshots (
        user_id, snapshot_date, total_figures, total_value, bricks, level,
        pct_collector, pct_explorer, pct_rarity_hunter, pct_fan, calculation_version
      ) values ($1, $2, 1, 50, $3, 1, 25, 25, 25, 25, 'v2')
    `, [id, date, bricks]);
  }

  async function completeRun(date) {
    const run = (await db.query(`
      insert into private.daily_sync_runs(snapshot_date, status, phase)
      values ($1, 'running', 'users') returning id
    `, [date])).rows[0];
    await db.query('update private.daily_sync_runs set status = $1, phase = $2 where id = $3', ['completed', 'completed', run.id]);
  }

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
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    assert.equal((await db.query(`
      select has_table_privilege('authenticated', 'private.weekly_ranking_publications', 'select') as authenticated_select,
        has_table_privilege('service_role', 'private.weekly_ranking_publications', 'select') as service_select,
        has_function_privilege('authenticated', 'private.publish_weekly_ranking_availability()', 'execute') as authenticated_execute,
        has_function_privilege('service_role', 'private.publish_weekly_ranking_availability()', 'execute') as service_execute
    `)).rows[0].authenticated_select, false);
    const publicationPrivileges = (await db.query(`
      select has_table_privilege('service_role', 'private.weekly_ranking_publications', 'select') as service_select,
        has_function_privilege('authenticated', 'private.publish_weekly_ranking_availability()', 'execute') as authenticated_execute,
        has_function_privilege('service_role', 'private.publish_weekly_ranking_availability()', 'execute') as service_execute
    `)).rows[0];
    assert.deepEqual(publicationPrivileges, { service_select: false, authenticated_execute: false, service_execute: false });
    await db.query(`
      insert into private.gamificacion_v2_activation(singleton, version, activated_at, available_from)
      values (true, 'v2', '2026-10-08T12:00:00Z', '2026-10-12')
    `);
    await db.query('insert into auth.users(id, email) values ($1, $2), ($3, $4)', [
      userId(1), 'first@example.invalid', userId(2), 'second@example.invalid',
    ]);
    await db.query(`
      insert into public.gamificacion(user_id, bricks, nivel)
      values ($1, 120, '{"id":1,"nombre":"Stud"}'), ($2, 0, '{"id":0,"nombre":"Duplo"}')
    `, [userId(1), userId(2)]);

    await addSnapshot(userId(1), '2026-10-25', 100);
    await addSnapshot(userId(1), '2026-10-26', 120);

    await db.query('begin');
    await completeRun('2026-10-26');
    await db.query('rollback');
    assert.equal((await db.query("select count(*)::integer as count from public.notificaciones where type = 'weekly_ranking_available'")).rows[0].count, 0);
    assert.equal((await db.query('select count(*)::integer as count from private.weekly_ranking_publications')).rows[0].count, 0);

    await completeRun('2026-10-26');
    const firstWeek = await db.query("select user_id, payload, is_read from public.notificaciones where type = 'weekly_ranking_available' order by user_id");
    assert.equal(firstWeek.rows.length, 2);
    assert.deepEqual(firstWeek.rows.map(({ user_id }) => user_id), [userId(1), userId(2)]);
    assert.deepEqual(firstWeek.rows.map(({ payload, is_read }) => [payload.weekStart, is_read]), [
      ['2026-10-26', false], ['2026-10-26', false],
    ]);

    await completeRun('2026-10-27');
    assert.equal((await db.query("select count(*)::integer as count from public.notificaciones where type = 'weekly_ranking_available'")).rows[0].count, 2);

    await completeRun('2026-11-02');
    assert.equal((await db.query("select count(*)::integer as count from public.notificaciones where type = 'weekly_ranking_available'")).rows[0].count, 2);
    await addSnapshot(userId(1), '2026-11-01', 120);
    await addSnapshot(userId(1), '2026-11-02', 130);
    await completeRun('2026-11-02');
    const nextWeek = await db.query("select count(*)::integer as count from public.notificaciones where type = 'weekly_ranking_available'");
    assert.equal(nextWeek.rows[0].count, 4);
  } finally {
    await db.close();
  }
});

test('la migracion silencia la semana actual si el ranking ya estaba disponible', async () => {
  const db = new PGlite();
  const userId = '00000000-0000-4000-8000-000000000001';
  const shiftDate = (value, days) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };

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
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    const current = (await db.query(`
      select to_char((clock_timestamp() at time zone 'Europe/Madrid')::date, 'YYYY-MM-DD') as today,
        to_char(date_trunc('week', clock_timestamp() at time zone 'Europe/Madrid')::date, 'YYYY-MM-DD') as week_start
    `)).rows[0];
    const availableFrom = shiftDate(current.week_start, -7);
    const activatedAt = `${shiftDate(current.week_start, -14)}T12:00:00Z`;
    await db.query(`
      insert into private.gamificacion_v2_activation(singleton, version, activated_at, available_from)
      values (true, 'v2', $1::timestamptz, $2::date)
    `, [activatedAt, availableFrom]);
    await db.query('insert into auth.users(id, email) values ($1, $2)', [userId, 'current@example.invalid']);
    await db.query(`
      insert into public.gamificacion(user_id, bricks, nivel)
      values ($1, 120, '{"id":1,"nombre":"Stud"}')
    `, [userId]);
    await db.query(`
      insert into public.user_daily_snapshots (
        user_id, snapshot_date, total_figures, total_value, bricks, level,
        pct_collector, pct_explorer, pct_rarity_hunter, pct_fan, calculation_version
      ) values ($1, $2::date - 1, 1, 50, 100, 1, 25, 25, 25, 25, 'v2'),
        ($1, $3::date, 1, 50, 120, 1, 25, 25, 25, 25, 'v2')
    `, [userId, current.week_start, current.today]);

    await db.exec(await readFile(new URL('../supabase/weekly-ranking-availability.sql', import.meta.url), 'utf8'));
    assert.deepEqual((await db.query('select week_start::text from private.weekly_ranking_publications')).rows, [
      { week_start: current.week_start },
    ]);
    assert.equal((await db.query("select count(*)::integer as count from public.notificaciones where type = 'weekly_ranking_available'")).rows[0].count, 0);

    const run = (await db.query(`
      insert into private.daily_sync_runs(snapshot_date, status, phase)
      values ($1, 'running', 'users') returning id
    `, [current.today])).rows[0];
    await db.query("update private.daily_sync_runs set status = 'completed' where id = $1", [run.id]);
    assert.equal((await db.query("select count(*)::integer as count from public.notificaciones where type = 'weekly_ranking_available'")).rows[0].count, 0);
  } finally {
    await db.close();
  }
});