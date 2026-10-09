import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('el Top 10 Global reconcilia entradas, salidas y reentradas sin efectos al leer ni alertas al sembrar', async () => {
  const db = new PGlite();
  const userId = (index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
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
    await db.query('insert into auth.users(id, email) select $1::uuid, $2', [userId(0), 'rank-0@example.invalid']);
    for (let index = 1; index < 12; index += 1) {
      await db.query('insert into auth.users(id, email) values ($1, $2)', [userId(index), `rank-${index}@example.invalid`]);
    }
    await db.query(`
      insert into public.gamificacion(user_id, bricks, nivel)
      select id, 100, '{"id":5,"nombre":"Five"}'::jsonb from auth.users
    `);

    await db.query("delete from public.notificaciones where type in ('ranking_entered', 'ranking_exited')");
    await db.query("delete from public.ranking_top10_membership where ranking_type = 'global'");
    await db.query('update private.ranking_top10_reconciliation_state set initialized = false where singleton = true');
    await db.exec(schema);
    assert.equal((await db.query("select count(*)::integer as count from public.ranking_top10_membership where ranking_type = 'global'")).rows[0].count, 10);
    assert.equal((await db.query("select count(*)::integer as count from public.notificaciones where type in ('ranking_entered', 'ranking_exited')")).rows[0].count, 0);

    await db.query("update public.gamificacion set nivel = '{\"id\":6,\"nombre\":\"Six\"}'::jsonb where user_id = $1", [userId(10)]);
    const entered = (await db.query("select type, payload from public.notificaciones where user_id = $1 and type = 'ranking_entered'", [userId(10)])).rows;
    assert.equal(entered.length, 1);
    assert.equal(entered[0].payload.ranking, 'global');
    assert.equal(entered[0].payload.position, 1);
    assert.equal((await db.query("select count(*)::integer as count from public.notificaciones where user_id = $1 and type = 'ranking_exited'", [userId(9)])).rows[0].count, 1);

    const transitionCount = (await db.query("select count(*)::integer as count from public.notificaciones where type in ('ranking_entered', 'ranking_exited')")).rows[0].count;
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId(0)]);
    await db.query('select * from public.ranking_global()');
    await db.query('select * from public.ranking_global()');
    assert.equal((await db.query("select count(*)::integer as count from public.notificaciones where type in ('ranking_entered', 'ranking_exited')")).rows[0].count, transitionCount);

    await db.query("update public.gamificacion set nivel = '{\"id\":5,\"nombre\":\"Five\"}'::jsonb where user_id = $1", [userId(10)]);
    assert.equal((await db.query("select count(*)::integer as count from public.notificaciones where user_id = $1 and type = 'ranking_exited'", [userId(10)])).rows[0].count, 1);
    assert.equal((await db.query("select count(*)::integer as count from public.notificaciones where user_id = $1 and type = 'ranking_entered'", [userId(9)])).rows[0].count, 1);
    await db.query("update public.gamificacion set nivel = '{\"id\":6,\"nombre\":\"Six\"}'::jsonb where user_id = $1", [userId(10)]);
    assert.equal((await db.query("select count(*)::integer as count from public.notificaciones where user_id = $1 and type = 'ranking_entered'", [userId(10)])).rows[0].count, 2);
    assert.equal((await db.query("select position from public.ranking_top10_membership where user_id = $1 and ranking_type = 'global'", [userId(10)])).rows[0].position, 1);
  } finally {
    await db.close();
  }
});