import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const ownerId = '00000000-0000-4000-8000-0000000000a1';
const otherId = '00000000-0000-4000-8000-0000000000b1';

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create schema private;
    create role anon;
    create role authenticated;
    create role service_role;
    grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table auth.users (id uuid primary key);
    create table public.gamificacion (
      user_id uuid primary key references auth.users(id) on delete cascade,
      bricks integer default 0, nivel jsonb default '{"id":0,"nombre":"Duplo"}',
      siguiente_nivel jsonb, progreso jsonb default '{}', logros jsonb default '[]'
    );
    create table public.user_profiles(user_id uuid primary key, username text);
    create table public.perfiles_publicos(user_id uuid primary key);
    create function public.ranking_semanal() returns jsonb language sql as $$
      select '{"entries":[]}'::jsonb
    $$;
  `);
  await db.query('insert into auth.users values ($1), ($2)', [ownerId, otherId]);
  await db.exec(await readFile(new URL('../supabase/featured-achievements.sql', import.meta.url), 'utf8'));
  return db;
}

async function actor(db, userId, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? '']);
  await db.exec(`set role ${role}`);
}

test('destacados: migracion vacia, RLS propia, sin DML directo y cascada', async () => {
  const db = await setup();
  try {
    assert.deepEqual((await db.query('select * from public.logros_destacados')).rows, []);
    await db.query('insert into public.logros_destacados values ($1, $2)', [ownerId, 'collector']);
    await actor(db, otherId);
    assert.deepEqual((await db.query('select * from public.logros_destacados')).rows, []);
    await assert.rejects(db.query('insert into public.logros_destacados values ($1, $2)', [otherId, 'collector']), /permission denied/);
    await assert.rejects(db.query('delete from public.logros_destacados'), /permission denied/);
    await actor(db, ownerId);
    assert.equal((await db.query('select * from public.logros_destacados')).rows.length, 1);
    await actor(db, null, 'anon');
    await assert.rejects(db.query('select * from public.logros_destacados'), /permission denied/);
    await db.exec('reset role');
    await db.query('delete from auth.users where id = $1', [ownerId]);
    assert.deepEqual((await db.query('select * from public.logros_destacados')).rows, []);
  } finally {
    await db.close();
  }
});

test('destacados: RPC propia idempotente, cupo por ID, regalos y errores seguros', async () => {
  const db = await setup();
  const achievements = Array.from({ length: 7 }, (_, index) => ({
    id: `earned-${index}`, cantidad: index === 0 ? 20 : 1, total: index,
    ...(index === 1 ? { type: 'regalo' } : {}),
  }));
  try {
    await db.query('insert into public.gamificacion(user_id, bricks, logros) values ($1, 123, $2)', [ownerId, JSON.stringify(achievements)]);
    await actor(db, ownerId);
    for (let index = 0; index < 5; index += 1) {
      await db.query('select public.establecer_logro_destacado($1, true)', [`earned-${index}`]);
    }
    await db.query("select public.establecer_logro_destacado('earned-0', true)");
    await assert.rejects(db.query("select public.establecer_logro_destacado('earned-5', true)"), /LIMITE_LOGROS_DESTACADOS/);
    await assert.rejects(db.query("select public.establecer_logro_destacado('not-earned', true)"), /LOGRO_INVALIDO/);
    await assert.rejects(db.query('select public.establecer_logro_destacado(null, true)'), /LOGRO_INVALIDO/);
    await db.query("select public.establecer_logro_destacado('earned-0', false)");
    await db.query("select public.establecer_logro_destacado('earned-0', false)");
    await db.query("select public.establecer_logro_destacado('earned-5', true)");
    const state = (await db.query('select public.gamificacion_con_destacados() as state')).rows[0].state;
    assert.deepEqual(state.logrosDestacados, ['earned-1', 'earned-2', 'earned-3', 'earned-4', 'earned-5']);
    assert.equal(state.bricks, 123);
    assert.deepEqual(state.logros, achievements);
    await actor(db, otherId);
    assert.equal((await db.query('select public.gamificacion_con_destacados() as state')).rows[0].state, null);
    await assert.rejects(db.query("select public.establecer_logro_destacado('earned-1', true)"), /LOGRO_INVALIDO/);
    await actor(db, null);
    await assert.rejects(db.query("select public.establecer_logro_destacado('earned-1', true)"), /NO_AUTENTICADO/);
    await actor(db, null, 'anon');
    await assert.rejects(db.query("select public.establecer_logro_destacado('earned-1', true)"), /permission denied/);
    await assert.rejects(db.query('select public.gamificacion_con_destacados()'), /permission denied/);
  } finally {
    await db.close();
  }
});

test('destacados: perdida, reduccion, recuperacion y rollback transaccional', async () => {
  const db = await setup();
  try {
    await db.query(`insert into public.gamificacion(user_id, logros) values ($1,
      '[{"id":"collector","cantidad":20},{"id":"social","cantidad":1}]')`, [ownerId]);
    await actor(db, ownerId);
    await db.query("select public.establecer_logro_destacado('collector', true)");
    await db.query("select public.establecer_logro_destacado('social', true)");
    await db.exec('reset role');
    await db.exec('begin');
    await db.query("update public.gamificacion set logros = '[]' where user_id = $1", [ownerId]);
    assert.equal((await db.query('select * from public.logros_destacados')).rows.length, 0);
    await db.exec('rollback');
    assert.equal((await db.query('select * from public.logros_destacados')).rows.length, 2);
    await db.query(`update public.gamificacion set logros = '[{"id":"collector","cantidad":1}]' where user_id = $1`, [ownerId]);
    assert.deepEqual((await db.query('select logro_id from public.logros_destacados')).rows, [{ logro_id: 'collector' }]);
    await db.query(`update public.gamificacion set logros = '[{"id":"collector","cantidad":1},{"id":"social","cantidad":1}]' where user_id = $1`, [ownerId]);
    assert.deepEqual((await db.query('select logro_id from public.logros_destacados')).rows, [{ logro_id: 'collector' }]);
    await db.exec(await readFile(new URL('../supabase/featured-achievements.sql', import.meta.url), 'utf8'));
    assert.equal((await db.query('select * from public.logros_destacados')).rows.length, 1);
  } finally {
    await db.close();
  }
});

test('destacados: rollback de despliegue conserva gamificacion y permite reinstalar sin estrellas', async () => {
  const db = await setup();
  try {
    await db.query(`insert into public.gamificacion(user_id, bricks, logros)
      values ($1, 17, '[{"id":"collector","cantidad":1,"total":17}]')`, [ownerId]);
    await actor(db, ownerId);
    await db.query("select public.establecer_logro_destacado('collector', true)");
    await db.exec('reset role');
    const before = (await db.query('select * from public.gamificacion')).rows;
    await db.exec(await readFile(new URL('../supabase/rollback-featured-achievements.sql', import.meta.url), 'utf8'));
    assert.equal((await db.query("select to_regclass('public.logros_destacados') as name")).rows[0].name, null);
    assert.equal((await db.query("select to_regprocedure('public.establecer_logro_destacado(text,boolean)') as name")).rows[0].name, null);
    assert.deepEqual((await db.query('select * from public.gamificacion')).rows, before);
    await db.exec(await readFile(new URL('../supabase/featured-achievements.sql', import.meta.url), 'utf8'));
    assert.deepEqual((await db.query('select * from public.logros_destacados')).rows, []);
    assert.deepEqual((await db.query('select * from public.gamificacion')).rows, before);
  } finally {
    await db.close();
  }
});

test('destacados: RPC propia filtra campos privados tambien al consultarla directamente', async () => {
  const db = await setup();
  try {
    await db.query(`insert into public.gamificacion(user_id, logros) values ($1,
      '[{"id":"collector","nombre":"Collector","bricks":1,"cantidad":1,"total":1,"dna_weights":{"fan":100},"private":"hidden"}]')`, [ownerId]);
    await actor(db, ownerId);
    const state = (await db.query('select public.gamificacion_con_destacados() as state')).rows[0].state;
    assert.deepEqual(state.logros, [{ id: 'collector', nombre: 'Collector', bricks: 1, cantidad: 1, total: 1 }]);
    await db.exec('reset role');
    assert.equal((await db.query('select logros from public.gamificacion')).rows[0].logros[0].private, 'hidden');
  } finally {
    await db.close();
  }
});