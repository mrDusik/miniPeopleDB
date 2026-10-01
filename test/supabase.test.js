import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getSupabaseConfig } from '../src/services/supabase.js';
import { createSupabaseMock } from '../test-support/supabase-mock.js';

test('getSupabaseConfig devuelve null sin variables ni sup.env', () => {
  assert.equal(getSupabaseConfig({ env: {}, envPath: join(tmpdir(), 'no-existe-sup.env') }), null);
});

test('getSupabaseConfig prioriza variables de entorno y usa sup.env como alternativa', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'supabase-config-'));
  const envPath = join(directory, 'sup.env');
  await writeFile(envPath, '# comentario\nSUPABASE_URL=https://file.supabase.co\nSUPABASE_ANON_KEY=file-key\n');
  try {
    assert.deepEqual(getSupabaseConfig({ env: {}, envPath }), { url: 'https://file.supabase.co', anonKey: 'file-key' });
    assert.deepEqual(
      getSupabaseConfig({ env: { SUPABASE_URL: 'https://env.supabase.co', SUPABASE_ANON_KEY: 'env-key' }, envPath }),
      { url: 'https://env.supabase.co', anonKey: 'env-key' },
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
    { id: 'HIGH', nombre: 'High', estado_coleccion: 'COLECCIÓN', anio: 2020, precio: 50 },
    { id: 'WANTED', nombre: 'Wanted', estado_coleccion: 'BUSCADA', anio: 1970, precio: 100 },
  ]);
  const ranking = (await clientB.rpc('ranking_global')).data;
  assert.deepEqual(Object.keys(ranking[0]).sort(), [
    'avatar_url', 'bricks', 'display_name', 'imagen_nivel', 'nivel', 'nombre_nivel', 'regalo_enviado',
    'top5_antiguedad', 'top5_precio', 'total_coleccion', 'user_id',
  ]);
  assert.equal(ranking[0].total_coleccion, 2);
  assert.deepEqual(ranking[0].top5_precio.map(({ id }) => id), ['HIGH', 'OLD']);
  assert.deepEqual(ranking[0].top5_antiguedad.map(({ id }) => id), ['OLD', 'HIGH']);
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
