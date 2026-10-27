import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Client } from 'pg';

const databaseUrl = process.env.FEATURED_TEST_DATABASE_URL;

test('destacados: bloqueo real del ultimo hueco y seleccion contra perdida', { skip: !databaseUrl }, async () => {
  const url = new URL(databaseUrl);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
  assert.match(url.pathname, /^\/featured_test_/);
  const first = new Client({ connectionString: databaseUrl });
  const second = new Client({ connectionString: databaseUrl });
  const userId = '00000000-0000-4000-8000-0000000000a1';
  const logros = JSON.stringify(Array.from({ length: 6 }, (_, index) => ({ id: `earned-${index}`, cantidad: 1, total: 0 })));
  const begin = async (client, asUser = true) => {
    await client.query('begin');
    await client.query("set local lock_timeout = '150ms'");
    if (asUser) {
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
      await client.query('set local role authenticated');
    }
  };
  const mark = (client, id) => client.query('select public.establecer_logro_destacado($1, true)', [id]);
  try {
    await first.connect();
    await second.connect();
    await first.query(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      grant usage on schema auth to authenticated;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$ select 'authenticated'::text $$;
      create table auth.users(id uuid primary key, email text unique);
    `);
    await first.query(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await first.query(await readFile(new URL('../supabase/featured-achievements.sql', import.meta.url), 'utf8'));
    await first.query('insert into auth.users(id) values ($1)', [userId]);
    await first.query('insert into public.gamificacion(user_id, logros) values ($1, $2)', [userId, logros]);
    await begin(first);
    for (let index = 0; index < 4; index += 1) await mark(first, `earned-${index}`);
    await first.query('commit');

    await begin(first);
    await mark(first, 'earned-4');
    await begin(second);
    await assert.rejects(mark(second, 'earned-5'), { code: '55P03' });
    await second.query('rollback');
    await first.query('commit');
    await begin(second);
    await assert.rejects(mark(second, 'earned-5'), /LIMITE_LOGROS_DESTACADOS/);
    await second.query('rollback');
    assert.equal((await first.query('select count(*)::int as count from public.logros_destacados')).rows[0].count, 5);

    await begin(first, false);
    await first.query("update public.gamificacion set logros = '[]' where user_id = $1", [userId]);
    await begin(second);
    await assert.rejects(mark(second, 'earned-0'), { code: '55P03' });
    await second.query('rollback');
    await first.query('commit');
    await begin(second);
    await assert.rejects(mark(second, 'earned-0'), /LOGRO_INVALIDO/);
    await second.query('rollback');
    assert.equal((await first.query('select count(*)::int as count from public.logros_destacados')).rows[0].count, 0);

    await first.query('update public.gamificacion set logros = $1 where user_id = $2', [logros, userId]);
    await begin(first);
    await mark(first, 'earned-0');
    await begin(second, false);
    await assert.rejects(second.query("update public.gamificacion set logros = '[]' where user_id = $1", [userId]), { code: '55P03' });
    await second.query('rollback');
    await first.query('commit');
    await second.query("update public.gamificacion set logros = '[]' where user_id = $1", [userId]);
    assert.equal((await first.query('select count(*)::int as count from public.logros_destacados')).rows[0].count, 0);
  } finally {
    await first.query('rollback').catch(() => {});
    await second.query('rollback').catch(() => {});
    await first.end();
    await second.end();
  }
});