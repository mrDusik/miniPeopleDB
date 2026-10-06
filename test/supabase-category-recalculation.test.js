import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('el recálculo global transaccional solo acepta service_role y es idempotente por fingerprint', async () => {
  const db = new PGlite();
  const userId = '00000000-0000-4000-8000-00000000000a';
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
      create table auth.users (
        instance_id uuid, id uuid primary key, aud text, role text, email text unique,
        encrypted_password text, email_confirmed_at timestamptz,
        raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
        confirmation_token text, recovery_token text, email_change_token_new text, email_change text
      );
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id, email) values ($1, $2)', [userId, 'recalc@example.invalid']);
    const fingerprint = 'a'.repeat(64);
    const states = [{
      user_id: userId,
      bricks: 59,
      nivel: { id: 1, nombre: 'Stud' },
      siguiente_nivel: { id: 2, nombre: 'Plate' },
      progreso: { actual: 59, desde: 20, hasta: 50, porcentaje: 100 },
      logros: [{ id: 'collector', bricks: 50, cantidad: 1, total: 50 }],
    }];

    await db.query("select set_config('request.jwt.claim.role', 'authenticated', false)");
    await assert.rejects(
      db.query('select public.aplicar_recalculo_gamificacion_categorias($1, $2::jsonb)', [fingerprint, JSON.stringify(states)]),
      /RECALCULO_CATEGORIAS_NO_AUTORIZADO/,
    );
    assert.equal((await db.query('select count(*)::integer as count from public.gamificacion')).rows[0].count, 0);

    await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");
    await assert.rejects(
      db.query('select public.aplicar_recalculo_gamificacion_categorias($1, $2::jsonb)', [null, null]),
      /RECALCULO_CATEGORIAS_INVALIDO/,
    );
    const applied = await db.query('select public.aplicar_recalculo_gamificacion_categorias($1, $2::jsonb) as applied', [fingerprint, JSON.stringify(states)]);
    assert.equal(applied.rows[0].applied, true);
    const persisted = (await db.query('select bricks, logros from public.gamificacion where user_id = $1', [userId])).rows[0];
    assert.equal(persisted.bricks, 59);
    assert.deepEqual(persisted.logros, states[0].logros);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    assert.equal((await db.query('select private.dna_calcular($1) as dna', [userId])).rows[0].dna.principal, 'Collector');
    assert.equal((await db.query('select bricks from public.ranking_global() where user_id = $1', [userId])).rows[0].bricks, 59);

    const repeated = await db.query('select public.aplicar_recalculo_gamificacion_categorias($1, $2::jsonb) as applied', [fingerprint, JSON.stringify([{ ...states[0], bricks: 999 }])]);
    assert.equal(repeated.rows[0].applied, false);
    assert.equal((await db.query('select bricks from public.gamificacion where user_id = $1', [userId])).rows[0].bricks, 59);

    await assert.rejects(
      db.query('select public.aplicar_recalculo_gamificacion_categorias($1, $2::jsonb)', ['b'.repeat(64), JSON.stringify([{ ...states[0], bricks: -1 }])]),
      /gamificacion_bricks_check/,
    );
    assert.equal((await db.query('select fingerprint from public.gamificacion_categoria_version where singleton = true')).rows[0].fingerprint, fingerprint);
    assert.equal((await db.query('select bricks from public.gamificacion where user_id = $1', [userId])).rows[0].bricks, 59);

    assert.equal((await db.query("select has_function_privilege('anon', 'public.aplicar_recalculo_gamificacion_categorias(text,jsonb)', 'EXECUTE') as allowed")).rows[0].allowed, false);
    assert.equal((await db.query("select has_function_privilege('authenticated', 'public.aplicar_recalculo_gamificacion_categorias(text,jsonb)', 'EXECUTE') as allowed")).rows[0].allowed, false);
  } finally {
    await db.close();
  }
});