import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from '../src/server.js';

test('CORS permite solo el origen local Android y los headers/métodos necesarios', async () => {
  const server = createServer({
    supabaseConfig: { url: 'https://project.supabase.test', anonKey: 'anon-public-test' },
    adminConfig: null,
    cronSecret: null,
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const apiUrl = `http://127.0.0.1:${address.port}/minifiguras`;

  try {
    const config = await fetch(new URL('/config/supabase', apiUrl), {
      headers: { Origin: 'https://localhost' },
    });
    assert.equal(config.status, 200);
    assert.equal(config.headers.get('access-control-allow-origin'), 'https://localhost');
    assert.deepEqual(Object.keys(await config.json()), ['url', 'anonKey']);

    const allowed = await fetch(apiUrl, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://localhost',
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'authorization,content-type,x-gamificacion',
      },
    });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://localhost');
    assert.equal(allowed.headers.get('access-control-allow-methods'), 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    assert.equal(allowed.headers.get('access-control-allow-headers'), 'Authorization, Content-Type, X-Gamificacion');
    assert.equal(allowed.headers.get('access-control-allow-credentials'), null);
    assert.match(allowed.headers.get('vary'), /Origin/);

    const unsupportedHeader = await fetch(apiUrl, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://localhost',
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'authorization,x-admin-secret',
      },
    });
    assert.equal(unsupportedHeader.status, 403);

    const untrustedOrigin = await fetch(apiUrl, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://attacker.example',
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'authorization',
      },
    });
    assert.equal(untrustedOrigin.headers.get('access-control-allow-origin'), null);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
