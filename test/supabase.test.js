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
