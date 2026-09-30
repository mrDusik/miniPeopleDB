import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../src/server.js';
import { categoriasMockRaw } from './fixtures.js';
import { createSupabaseMock, minifiguraToRow } from './supabase-mock.js';

export const TEST_TOKEN = 'token-usuario-a';
export const TEST_USER = { id: '00000000-0000-0000-0000-00000000000a', email: 'a@example.com' };
export const OTHER_TOKEN = 'token-usuario-b';
export const OTHER_USER = { id: '00000000-0000-0000-0000-00000000000b', email: 'b@example.com' };
export const TEST_SUPABASE_CONFIG = { url: 'https://proyecto.supabase.test', anonKey: 'anon-key-publica' };

export function createTestSupabase(catalog = [], userId = TEST_USER.id) {
  const supabase = createSupabaseMock({ users: { [TEST_TOKEN]: TEST_USER, [OTHER_TOKEN]: OTHER_USER } });
  supabase.seed('minifiguras', userId, catalog.map(minifiguraToRow));
  return supabase;
}

export function createTestClient(supabase, token = TEST_TOKEN) {
  return supabase.createClient(TEST_SUPABASE_CONFIG.url, TEST_SUPABASE_CONFIG.anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export function authFetch(token = TEST_TOKEN) {
  return (url, init = {}) => globalThis.fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...init.headers },
  });
}

// themesRaw === null leaves the categories file missing.
export async function startTestServer({ catalog = [], themesRaw = categoriasMockRaw, supabase = createTestSupabase(catalog), options = {} } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'minifiguras-server-'));
  const themesPath = join(directory, 'categorias.json');
  if (themesRaw !== null) {
    await writeFile(themesPath, themesRaw);
  }
  const server = createServer({
    themesPath,
    supabaseConfig: TEST_SUPABASE_CONFIG,
    createSupabaseClient: supabase.createClient,
    ...options,
  });
  await new Promise((resolve) => server.listen(0, resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    supabase,
    async close() {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await rm(directory, { recursive: true, force: true });
    },
  };
}
