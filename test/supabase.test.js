import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { calcularGamificacion, LOGRO_REGALO, OBJETIVOS } from '../src/gamificacion.js';
import { GamificacionRepository } from '../src/gamificacion-repository.js';
import { MinifigurasRepository } from '../src/minifiguras-repository.js';
import { getSupabaseAdminConfig, getSupabaseConfig } from '../src/services/supabase.js';
import { createSupabaseMock } from '../test-support/supabase-mock.js';

test('getSupabaseConfig devuelve null sin variables ni sup.env', () => {
  assert.equal(getSupabaseConfig({ env: {}, envPath: join(tmpdir(), 'no-existe-sup.env') }), null);
  assert.equal(getSupabaseAdminConfig({ env: {}, envPath: join(tmpdir(), 'no-existe-sup.env') }), null);
});

test('getSupabaseConfig prioriza variables de entorno y usa sup.env como alternativa', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'supabase-config-'));
  const envPath = join(directory, 'sup.env');
  await writeFile(envPath, '# comentario\nSUPABASE_URL=https://file.supabase.co\nSUPABASE_ANON_KEY=file-key\n');
    await writeFile(envPath, '# comentario\nSUPABASE_URL=https://file.supabase.co\nSUPABASE_ANON_KEY=file-key\nSUPABASE_SERVICE_ROLE_KEY=server-key\n');
  await writeFile(envPath, '# comentario\nSUPABASE_URL=https://file.supabase.co\nSUPABASE_ANON_KEY=file-key\nSUPABASE_SERVICE_ROLE_KEY=server-key\n');
  try {
    assert.deepEqual(getSupabaseConfig({ env: {}, envPath }), { url: 'https://file.supabase.co', anonKey: 'file-key' });
    assert.deepEqual(
      getSupabaseConfig({ env: { SUPABASE_URL: 'https://env.supabase.co', SUPABASE_ANON_KEY: 'env-key' }, envPath }),
      { url: 'https://env.supabase.co', anonKey: 'env-key' },
    );
    assert.deepEqual(getSupabaseAdminConfig({ env: {}, envPath }), { url: 'https://file.supabase.co', serviceRoleKey: 'server-key' });
    assert.deepEqual(
      getSupabaseAdminConfig({ env: { SUPABASE_URL: 'https://env.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'env-server-key' }, envPath }),
      { url: 'https://env.supabase.co', serviceRoleKey: 'env-server-key' },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('el mock de Supabase aísla filas por usuario, detecta duplicados e inyecta fallos', async () => {
  const mock = createSupabaseMock({ users: { 'token-a': { id: 'user-a' }, 'token-b': { id: 'user-b' } } });
  const clientA = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-a' } } });
  const clientB = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-b' } } });
  const anonymous = mock.createClient('url', 'key');

  assert.equal((await clientA.auth.getUser('token-a')).data.user.id, 'user-a');
  assert.ok((await clientA.auth.getUser('otro')).error);

  assert.equal((await clientA.from('minifiguras').insert({ id: 'X', nombre: 'A', categoria: 'Space' })).error, null);
  assert.equal((await clientB.from('minifiguras').insert({ id: 'X', nombre: 'B', categoria: 'Space' })).error, null);
  assert.equal((await clientA.from('minifiguras').insert({ id: 'X', nombre: 'A2', categoria: 'Space' })).error.code, '23505');
  assert.equal((await anonymous.from('minifiguras').insert({ id: 'Y', nombre: 'N', categoria: 'Space' })).error.code, '42501');

  const { data } = await clientA.from('minifiguras').select('*');
  assert.deepEqual(data.map(({ nombre }) => nombre), ['A']);

  const updated = await clientA.from('minifiguras').update({ nombre: 'A3' }).eq('id', 'X').select('id');
  assert.equal(updated.data.length, 1);
  assert.equal(mock.rows('minifiguras', 'user-b')[0].nombre, 'B');

  mock.failNext('minifiguras');
  assert.ok((await clientA.from('minifiguras').select('*')).error);
  assert.equal((await clientA.from('minifiguras').select('*')).error, null);
});

test('el mock protege perfiles y expone solo la proyección global mediante RPC', async () => {
  const mock = createSupabaseMock({ users: { 'token-a': { id: 'user-a' }, 'token-b': { id: 'user-b' } } });
  const clientA = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-a' } } });
  const clientB = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-b' } } });
  await clientA.from('perfiles_publicos').upsert({ user_id: 'user-a', display_name: 'Ada', avatar_url: 'https://example.com/a.png' });
  assert.equal((await clientA.from('perfiles_publicos').upsert({ user_id: 'user-b', display_name: 'Intruso' })).error.code, '42501');
  assert.deepEqual((await clientB.from('perfiles_publicos').select('*')).data, []);

  mock.seed('gamificacion', 'user-a', [{ bricks: 100, nivel: { id: 3, nombre: 'Three-Seven-Five' } }]);
  mock.seed('minifiguras', 'user-a', [
    { id: 'OLD', nombre: 'Old', estado_coleccion: 'COLECCIÓN', anio: 1980, precio: 5 },
    { id: 'HIGH', nombre: 'High', estado_coleccion: 'COLECCIÓN', anio: 2020, precio: 50, categoria: 'Space', subcategoria: 'Classic', descripcion: 'privada', precio_compra: 1 },
    { id: 'WANTED', nombre: 'Wanted', estado_coleccion: 'BUSCADA', anio: 1970, precio: 100 },
  ]);
  const ranking = (await clientB.rpc('ranking_global')).data;
  assert.deepEqual((await clientA.rpc('gamificacion_dna')).data, {
    principal: 'Newbie', porcentajes: { rarityHunter: 0, collector: 0, explorer: 0, fan: 0 },
  });
  assert.equal((await mock.createClient('url', 'key').rpc('gamificacion_dna')).error.code, '42501');
  assert.deepEqual(Object.keys(ranking[0]).sort(), [
    'avatar_url', 'bricks', 'display_name', 'dna_principal', 'imagen_nivel', 'nivel', 'nombre_nivel', 'regalo_enviado',
    'top5_antiguedad', 'top5_precio', 'total_coleccion', 'user_id',
  ]);
  assert.equal(ranking[0].dna_principal, 'Newbie');
  assert.equal(ranking[0].total_coleccion, 2);
  assert.deepEqual(ranking[0].top5_precio.map(({ id }) => id), ['HIGH', 'OLD']);
  assert.deepEqual(ranking[0].top5_antiguedad.map(({ id }) => id), ['OLD', 'HIGH']);
  const expected = { id: 'HIGH', nombre: 'High', precio: 50, anio: 2020, categoria: 'Space', subcategoria: 'Classic' };
  assert.deepEqual(ranking[0].top5_precio[0], expected);
  assert.deepEqual(ranking[0].top5_antiguedad[1], expected);
});

test('el ranking limita a diez y desempata por user_id', async () => {
  const users = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`token-${index}`, { id: `user-${String(index).padStart(2, '0')}` }]));
  const mock = createSupabaseMock({ users });
  for (let index = 11; index >= 0; index -= 1) {
    mock.seed('gamificacion', `user-${String(index).padStart(2, '0')}`, [{ bricks: 100, nivel: { id: 3, nombre: 'Three-Seven-Five' } }]);
  }
  const client = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-0' } } });
  const ranking = (await client.rpc('ranking_global')).data;
  assert.equal(ranking.length, 10);
  assert.deepEqual(ranking.map(({ user_id }) => user_id), Array.from({ length: 10 }, (_, index) => `user-${String(index).padStart(2, '0')}`));
});

test('ranking_logros proyecta solo datos publicos del Top 10 sin escrituras ni abrir RLS', async () => {
  const mock = createSupabaseMock({ users: { token: { id: 'viewer' } } });
  for (let index = 11; index >= 0; index -= 1) {
    mock.seed('gamificacion', `user-${String(index).padStart(2, '0')}`, [{ bricks: 100,
      nivel: { id: 3, nombre: 'Nivel', privado: 'secret' },
      logros: [{ id: 'logro', nombre: 'Logro', bricks: 10, repetible: false, cantidad: 1, total: 10, donante: 'secret' }],
    }]);
  }
  mock.seed('perfiles_publicos', 'user-00', [{ display_name: 'Ada', email: 'privado' }]);
  const before = mock.rows('gamificacion');
  const client = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token' } } });
  const result = await client.rpc('ranking_logros', { p_usuario_id: 'user-00' });
  assert.equal(result.error, null);
  assert.deepEqual(result.data, { userId: 'user-00', displayName: 'Ada', bricks: 100,
    nivel: { id: 3, nombre: 'Nivel' }, logros: [{ id: 'logro', nombre: 'Logro', bricks: 10, repetible: false, cantidad: 1, total: 10 }] });
  assert.equal((await client.rpc('ranking_logros', { p_usuario_id: 'user-09' })).data.userId, 'user-09');
  assert.equal((await client.rpc('ranking_logros', { p_usuario_id: 'user-10' })).data, null);
  assert.equal((await client.rpc('ranking_logros', { p_usuario_id: 'missing' })).data, null);
  assert.deepEqual((await client.from('gamificacion').select('*')).data, []);
  assert.equal((await mock.createClient('url', 'key').rpc('ranking_logros', { p_usuario_id: 'user-00' })).error.code, '42501');
  assert.deepEqual(mock.rows('gamificacion'), before);
  assert.deepEqual(mock.rows('minifiguras'), []);
  assert.deepEqual(mock.rows('regalos_enviados'), []);
});

test('el mock aplica regalos únicos y revierte la transacción si falla gamificación', async () => {
  const mock = createSupabaseMock({ users: {
    'token-a': { id: 'user-a' }, 'token-b': { id: 'user-b' }, 'token-c': { id: 'user-c' },
  } });
  const clientA = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-a' } } });
  const clientC = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-c' } } });
  mock.seed('gamificacion', 'user-b', [{ bricks: 10, nivel: { id: 0, nombre: 'Duplo' }, logros: [] }]);

  assert.equal((await clientA.rpc('regalar_bricks', { p_receptor_id: 'user-a' })).error.message, 'AUTORREGALO_NO_PERMITIDO');
  assert.equal((await clientA.rpc('regalar_bricks', { p_receptor_id: 'missing' })).error.message, 'RECEPTOR_NO_ENCONTRADO');
  assert.deepEqual((await clientA.rpc('regalar_bricks', { p_receptor_id: 'user-b' })).data, { ok: true });
  assert.equal(mock.rows('gamificacion', 'user-b')[0].bricks, 60);
  assert.equal(mock.rows('gamificacion', 'user-b')[0].logros[0].type, 'regalo');
  assert.equal((await clientA.rpc('regalar_bricks', { p_receptor_id: 'user-b' })).error.message, 'REGALO_YA_ENVIADO');

  mock.failNext('gamificacion', { code: 'PGRST000', message: 'fallo' }, 'update');
  assert.ok((await clientC.rpc('regalar_bricks', { p_receptor_id: 'user-b' })).error);
  assert.equal(mock.rows('gamificacion', 'user-b')[0].bricks, 60);
  assert.equal(mock.rows('regalos_enviados').length, 1);
});

test('dos regalos concurrentes del mismo donante solo incrementan una vez', async () => {
  const mock = createSupabaseMock({ users: { 'token-a': { id: 'user-a' } } });
  const client = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer token-a' } } });
  mock.seed('gamificacion', 'user-b', [{ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, logros: [] }]);
  const results = await Promise.all([
    client.rpc('regalar_bricks', { p_receptor_id: 'user-b' }),
    client.rpc('regalar_bricks', { p_receptor_id: 'user-b' }),
  ]);
  assert.equal(results.filter(({ error }) => error === null).length, 1);
  assert.equal(results.filter(({ error }) => error?.message === 'REGALO_YA_ENVIADO').length, 1);
  assert.equal(mock.rows('gamificacion', 'user-b')[0].bricks, 50);
});

test('scripts SQL de prueba insertan 20 usuarios coherentes y revierten solo su rastro', async () => {
  const db = new PGlite();
  const originalA = '00000000-0000-4000-8000-00000000000a';
  const originalB = '00000000-0000-4000-8000-00000000000b';
  const reservedId = '13000000-0000-4000-8000-000000000001';
  const insertSql = await readFile(new URL('../supabase/insert-miniPeopleDB-prueba.sql', import.meta.url), 'utf8');
  const rollbackSql = await readFile(new URL('../supabase/rollback-miniPeopleDB-prueba.sql', import.meta.url), 'utf8');
  const categories = JSON.parse(await readFile(new URL('../data/categorias-brickset.json', import.meta.url), 'utf8'));
  const tables = ['auth.users', 'public.minifiguras', 'public.gamificacion', 'public.perfiles_publicos', 'public.regalos_enviados'];
  const snapshot = async () => {
    const result = {};
    for (const table of tables) {
      result[table] = (await db.query(`select to_jsonb(item) as data from ${table} item order by to_jsonb(item)::text`)).rows;
    }
    return result;
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
      create table auth.users (
        instance_id uuid, id uuid primary key, aud text, role text, email text unique,
        encrypted_password text, email_confirmed_at timestamptz,
        raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
        confirmation_token text, recovery_token text, email_change_token_new text, email_change text
      );
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    const expectedDnaWeights = {
      'new-mini-person': [5, 60, 15, 20],
      woah: [50, 30, 10, 10],
      'deal-master': [75, 15, 5, 5],
      masterpiece: [90, 5, 0, 5],
      'holy-grail': [95, 5, 0, 0],
      omgold: [95, 0, 0, 5],
      'lets-go': [5, 20, 60, 15],
      collector: [10, 80, 0, 10],
      'step-by-step': [5, 15, 70, 10],
      'bricky-potter': [0, 10, 20, 70],
      'bricky-mouse': [0, 10, 20, 70],
      'its-a-me-mario': [0, 10, 20, 70],
      'green-hill-zone': [0, 10, 20, 70],
      dimensional: [10, 10, 30, 50],
      warsie: [0, 10, 20, 70],
      'in-ny-i-was': [60, 5, 5, 30],
      'welcome-to-the-upsidedown': [30, 10, 10, 50],
      'chill-nancy-im-fine': [40, 10, 10, 40],
      [LOGRO_REGALO.id]: [0, 0, 0, 0],
    };
    const dnaRows = (await db.query('select logro_id, rarity_hunter, collector, explorer, fan from public.dna_ponderaciones order by logro_id')).rows;
    assert.deepEqual(Object.fromEntries(dnaRows.map(({ logro_id, rarity_hunter, collector, explorer, fan }) => [logro_id, [rarity_hunter, collector, explorer, fan]])), expectedDnaWeights);
    assert.deepEqual(Object.keys(expectedDnaWeights).sort(), [...OBJETIVOS.map(({ id }) => id), LOGRO_REGALO.id].sort());
    assert.equal((await db.query("select count(*)::integer as total from pg_policies where schemaname = 'public' and tablename = 'dna_ponderaciones'")).rows[0].total, 0);
    for (const role of ['anon', 'authenticated']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        assert.equal((await db.query('select has_table_privilege($1, $2, $3) as allowed', [role, 'public.dna_ponderaciones', privilege])).rows[0].allowed, false);
      }
      assert.equal((await db.query("select has_function_privilege($1, 'private.dna_calcular(uuid)', 'EXECUTE') as allowed", [role])).rows[0].allowed, false);
    }
    await assert.rejects(db.query("insert into public.dna_ponderaciones values ('invalid-total', 1, 1, 1, 1)"), /dna_ponderaciones_suma_check/);
    await assert.rejects(db.query("insert into public.dna_ponderaciones values ('invalid-range', 101, 0, 0, 0)"), /dna_ponderaciones_pesos_check/);
    await assert.rejects(db.query("insert into public.dna_ponderaciones values ('someone-liked-your-collection', 0, 0, 0, 1)"), /dna_ponderaciones_suma_check/);
    await db.query("update public.dna_ponderaciones set rarity_hunter = 0, collector = 100, explorer = 0, fan = 0 where logro_id = 'new-mini-person'");
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    const reseeded = (await db.query("select rarity_hunter, collector, explorer, fan from public.dna_ponderaciones where logro_id = 'new-mini-person'")).rows[0];
    assert.deepEqual(Object.values(reseeded), expectedDnaWeights['new-mini-person']);
    const dnaUser = '00000000-0000-4000-8000-0000000000dd';
    const dnaMock = createSupabaseMock();
    await db.query('insert into auth.users(id,email) values ($1,$2)', [dnaUser, 'dna-fixture@example.invalid']);
    await db.query("insert into public.gamificacion(user_id, logros) values ($1, '[]'::jsonb)", [dnaUser]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [dnaUser]);
    const originalDnaLogros = (await db.query('select logros from public.gamificacion where user_id = $1', [dnaUser])).rows[0].logros;
    const equalWeights = {
      'test-rarity': [100, 0, 0, 0],
      'test-collector': [0, 100, 0, 0],
      'test-explorer': [0, 0, 100, 0],
      'test-fan': [0, 0, 0, 100],
      'test-balanced': [25, 25, 25, 25],
      'test-near': [26, 25, 25, 24],
    };
    await db.query('insert into public.dna_ponderaciones(logro_id, rarity_hunter, collector, explorer, fan) select key, (value->>0)::smallint, (value->>1)::smallint, (value->>2)::smallint, (value->>3)::smallint from jsonb_each($1::jsonb)', [JSON.stringify(equalWeights)]);
    const verifyDna = async (logros, expectedPrincipal, expectedPercentages, additionalWeights = {}) => {
      await db.query('update public.gamificacion set logros = $2 where user_id = $1', [dnaUser, JSON.stringify(logros)]);
      const beforeDnaRead = (await db.query('select to_jsonb(g) as row from public.gamificacion g where user_id = $1', [dnaUser])).rows[0].row;
      const sqlResult = (await db.query('select private.dna_calcular($1) as data', [dnaUser])).rows[0].data;
      const rankingResult = (await db.query('select dna_principal from public.ranking_global()')).rows;
      const mockResult = dnaMock.calculateDna(logros, additionalWeights);
      assert.equal(sqlResult.principal, expectedPrincipal);
      assert.equal(rankingResult.length, 1);
      assert.equal(rankingResult[0].dna_principal, expectedPrincipal);
      assert.equal(mockResult.principal, expectedPrincipal);
      for (const [name, expected] of Object.entries(expectedPercentages)) {
        assert.ok(Math.abs(Number(sqlResult.porcentajes[name]) - expected) < 1e-10, `${name}: SQL=${sqlResult.porcentajes[name]}, esperado=${expected}`);
        assert.ok(Math.abs(mockResult.porcentajes[name] - expected) < 1e-10, `${name}: mock=${mockResult.porcentajes[name]}, esperado=${expected}`);
      }
      const afterDnaRead = (await db.query('select to_jsonb(g) as row from public.gamificacion g where user_id = $1', [dnaUser])).rows[0].row;
      assert.deepEqual(afterDnaRead, beforeDnaRead);
      return sqlResult;
    };
    await verifyDna([
      { id: 'new-mini-person', cantidad: 2 }, { id: 'woah', cantidad: 1 },
      { id: 'unknown-achievement', cantidad: 1000 }, { id: LOGRO_REGALO.id, cantidad: 1000 },
    ], 'Collector', { rarityHunter: 20, explorer: 40 / 3, collector: 50, fan: 50 / 3 });
    await verifyDna([{ id: 'collector', cantidad: 3 }], 'Collector', { rarityHunter: 10, explorer: 0, collector: 80, fan: 10 });
    await verifyDna([{ id: 'omgold', cantidad: 1 }], 'Rarity Hunter', { rarityHunter: 95, explorer: 0, collector: 0, fan: 5 });
    await verifyDna([{ id: LOGRO_REGALO.id, cantidad: 99 }], 'Newbie', { rarityHunter: 0, explorer: 0, collector: 0, fan: 0 });
    await db.query('update public.gamificacion set logros = $2 where user_id = $1', [dnaUser, JSON.stringify(originalDnaLogros)]);
    const noStateDna = (await db.query('select private.dna_calcular($1) as data', ['00000000-0000-4000-8000-0000000000ff'])).rows[0].data;
    assert.deepEqual(noStateDna, { principal: 'Newbie', porcentajes: { rarityHunter: 0, explorer: 0, collector: 0, fan: 0 } });
    const fourWayTie = Object.keys(equalWeights).slice(0, 4).map((id) => ({ id, cantidad: 1 }));
    await verifyDna(fourWayTie, 'Explorer', { rarityHunter: 25, explorer: 25, collector: 25, fan: 25 }, equalWeights);
    await verifyDna(fourWayTie.filter(({ id }) => id !== 'test-explorer'), 'Collector', { rarityHunter: 100 / 3, explorer: 0, collector: 100 / 3, fan: 100 / 3 }, equalWeights);
    await verifyDna(fourWayTie.filter(({ id }) => id === 'test-fan' || id === 'test-rarity'), 'Fan', { rarityHunter: 50, explorer: 0, collector: 0, fan: 50 }, equalWeights);
    const nearTie = [{ id: 'test-balanced', cantidad: 10000 }, { id: 'test-near', cantidad: 1 }];
    const nearTieResult = await verifyDna(nearTie, 'Rarity Hunter', { rarityHunter: (250000 + 26) / 1000100 * 100, explorer: 250025 / 1000100 * 100, collector: 250025 / 1000100 * 100, fan: 250024 / 1000100 * 100 }, equalWeights);
    assert.deepEqual(Object.values(nearTieResult.porcentajes).map((percentage) => Math.round(Number(percentage))), [25, 25, 25, 25]);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from public.dna_ponderaciones'), /permission denied/);
      await assert.rejects(db.query("insert into public.dna_ponderaciones values ('client-write', 25, 25, 25, 25)"), /permission denied/);
      await assert.rejects(db.query("select private.dna_calcular('00000000-0000-4000-8000-00000000000a')"), /permission denied/);
      await db.exec('reset role');
    }
    await db.query("delete from public.dna_ponderaciones where logro_id like 'test-%'");
    await db.query('delete from public.gamificacion where user_id = $1', [dnaUser]);
    await db.query('delete from auth.users where id = $1', [dnaUser]);
    await db.query('insert into auth.users(id,email) values ($1,$2),($3,$4)', [originalA, 'original-a@example.invalid', originalB, 'original-b@example.invalid']);
    await db.query(`insert into public.minifiguras(user_id,id,nombre,categoria,anio,precio) values ($1,'ORIGINAL','Original','Space',2020,20)`, [originalA]);
    await db.query(`insert into public.perfiles_publicos(user_id,display_name) values ($1,'Original A'),($2,'Original B')`, [originalA, originalB]);
    await db.query('insert into public.regalos_enviados(donante_id,receptor_id) values ($1,$2)', [originalA, originalB]);
    for (const [userId, catalog, gifts] of [
      [originalA, [{ id: 'ORIGINAL', categoria: 'Space', precio: 20, estadoColeccion: 'COLECCIÓN' }], 0],
      [originalB, [], 1],
    ]) {
      const state = calcularGamificacion(catalog, categories, gifts);
      await db.query('insert into public.gamificacion(user_id,bricks,nivel,siguiente_nivel,progreso,logros) values ($1,$2,$3,$4,$5,$6)', [
        userId, state.bricks, JSON.stringify(state.nivel), JSON.stringify(state.siguienteNivel), JSON.stringify(state.progreso), JSON.stringify(state.logros),
      ]);
    }
    const original = await snapshot();
    await db.exec(insertSql);
    assert.equal((await db.query('select count(*)::integer as total from auth.users')).rows[0].total, 22);
    const users = (await db.query("select * from auth.users where raw_user_meta_data->>'minipeopledb_seed' = 'lego-13-prueba-v1' order by id")).rows;
    assert.equal(users.length, 20);
    assert.ok(users.every((user) => user.encrypted_password === null && user.email.endsWith('@example.invalid')));
    const mock = createSupabaseMock({ users: Object.fromEntries(users.map((user) => [user.id, { id: user.id }])) });
    const levels = new Set();
    for (const user of users) {
      const rows = (await db.query('select to_jsonb(item) as data from public.minifiguras item where user_id = $1', [user.id])).rows.map(({ data }) => data);
      const state = (await db.query('select * from public.gamificacion where user_id = $1', [user.id])).rows[0];
      const gifts = (await db.query('select count(*)::integer as total from public.regalos_enviados where receptor_id = $1', [user.id])).rows[0].total;
      mock.seed('minifiguras', user.id, rows);
      mock.seed('gamificacion', user.id, [state]);
      const client = mock.createClient('url', 'key', { global: { headers: { Authorization: `Bearer ${user.id}` } } });
      const catalog = await new MinifigurasRepository({ client, userId: user.id, categoriasRepository: { read: async () => categories } }).readCatalog();
      const stored = await new GamificacionRepository({ client, userId: user.id }).read();
      const expected = calcularGamificacion(catalog, categories, gifts);
      assert.equal(stored.bricks, expected.bricks);
      assert.deepEqual(stored.nivel, expected.nivel);
      assert.deepEqual(stored.siguienteNivel, expected.siguienteNivel);
      assert.deepEqual(stored.progreso, expected.progreso);
      const metrics = (items) => items.map(({ descripcion, ...item }) => item);
      assert.deepEqual(metrics(stored.logros), metrics(expected.logros));
      assert.equal(catalog.filter((item) => item.estadoColeccion === 'BUSCADA').length, 1);
      assert.ok(catalog.filter((item) => item.observada).length <= 10);
      levels.add(stored.nivel.id);
    }
    assert.ok(levels.size >= 8);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [originalA]);
    const ranking = (await db.query('select * from public.ranking_global()')).rows;
    assert.equal(ranking.length, 10);
    assert.ok(ranking.every((entry) => entry.top5_precio.length >= 3 && entry.top5_antiguedad.length >= 3));
    assert.ok(ranking.every((entry) => typeof entry.dna_principal === 'string'));
    const ownDnaBefore = (await db.query('select to_jsonb(g) as row from public.gamificacion g where user_id = $1', [originalA])).rows[0].row;
    const ownDna = (await db.query('select public.gamificacion_dna() as data')).rows[0].data;
    const directDna = (await db.query('select private.dna_calcular($1) as data', [originalA])).rows[0].data;
    assert.deepEqual(ownDna, directDna);
    assert.deepEqual(Object.keys(ownDna).sort(), ['porcentajes', 'principal']);
    assert.deepEqual(Object.keys(ownDna.porcentajes).sort(), ['collector', 'explorer', 'fan', 'rarityHunter']);
    assert.deepEqual((await db.query('select to_jsonb(g) as row from public.gamificacion g where user_id = $1', [originalA])).rows[0].row, ownDnaBefore);
    await db.exec('set role anon');
    await assert.rejects(db.query('select public.gamificacion_dna()'), /permission denied/);
    await db.exec('reset role');
    await db.exec('set role authenticated');
    assert.deepEqual((await db.query('select public.gamificacion_dna() as data')).rows[0].data, ownDna);
    assert.equal((await db.query("select has_function_privilege('authenticated', 'public.ranking_global()', 'EXECUTE') as allowed")).rows[0].allowed, true);
    await db.exec('reset role');
    assert.equal((await db.query('select public.ranking_logros($1) as data', [originalA])).rows[0].data, null);
    assert.ok((await db.query('select public.ranking_logros($1) as data', [ranking[0].user_id])).rows[0].data.logros.length > 0);
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await db.query("select has_function_privilege($1, 'public.gamificacion_dna()', 'EXECUTE') as allowed", [role])).rows[0].allowed, role === 'authenticated');
    }

    const inserted = await snapshot();
    await assert.rejects(db.exec(insertSql), /Seed collision/);
    await db.exec('rollback');
    assert.deepEqual(await snapshot(), inserted);
    await db.query('insert into public.regalos_enviados(donante_id,receptor_id) values ($1,$2)', [reservedId, originalA]);
    await assert.rejects(db.exec(rollbackSql), /gifted Bricks to non-seeded users/);
    await db.exec('rollback');
    assert.equal((await db.query('select count(*)::integer as total from auth.users')).rows[0].total, 22);
    await db.query('delete from public.regalos_enviados where donante_id = $1 and receptor_id = $2', [reservedId, originalA]);
    await db.exec(rollbackSql);
    assert.deepEqual(await snapshot(), original);
    await db.exec(rollbackSql);
    assert.deepEqual(await snapshot(), original);

    await db.query('insert into auth.users(id,email) values ($1,$2)', [reservedId, 'non-seeded@example.invalid']);
    const collision = await snapshot();
    await assert.rejects(db.exec(insertSql), /Seed collision/);
    await db.exec('rollback');
    assert.deepEqual(await snapshot(), collision);
    await assert.rejects(db.exec(rollbackSql), /not owned by this seed/);
    await db.exec('rollback');
    assert.deepEqual(await snapshot(), collision);
  } finally {
    await db.close();
  }
});
