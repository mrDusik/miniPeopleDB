import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseMock } from '../test-support/supabase-mock.js';
import { TEST_TOKEN, TEST_USER, authFetch, startTestServer } from '../test-support/server.js';

const CONTACT_PATH = '/api/contact';

async function submit(baseUrl, body, init = {}) {
  return fetch(`${baseUrl}${CONTACT_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...init.headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  });
}

test('el contacto anónimo acepta Email o Username y entrega los valores al correo', async () => {
  const sent = [];
  const context = await startTestServer({
    options: { contactEmailSender: async (contact) => sent.push(contact) },
  });
  try {
    const emailResponse = await submit(context.baseUrl, {
      email: ' person@example.com ',
      username: '',
      message: '  No puedo iniciar sesión.  ',
    });
    const usernameResponse = await submit(context.baseUrl, {
      email: '',
      username: ' BrickFan ',
      message: 'Tengo una pregunta.',
    });

    assert.equal(emailResponse.status, 200);
    assert.deepEqual(await emailResponse.json(), { ok: true });
    assert.equal(emailResponse.headers.get('cache-control'), 'no-store');
    assert.equal(usernameResponse.status, 200);
    assert.deepEqual(sent, [
      { email: 'person@example.com', username: null, message: 'No puedo iniciar sesión.' },
      { email: null, username: 'BrickFan', message: 'Tengo una pregunta.' },
    ]);
  } finally {
    await context.close();
  }
});

test('el contacto acepta 1000 caracteres y rechaza 1001 sin enviar otro correo', async () => {
  const sent = [];
  const context = await startTestServer({
    options: { contactEmailSender: async (contact) => sent.push(contact) },
  });
  try {
    const message = 'x'.repeat(1000);
    const accepted = await submit(context.baseUrl, { username: 'BrickFan', message });
    assert.equal(accepted.status, 200);
    const rejected = await submit(context.baseUrl, { username: 'BrickFan', message: `${message}x` });
    assert.equal(rejected.status, 400);
    assert.deepEqual(await rejected.json(), { error: 'CONTACTO_INVALIDO' });
    assert.deepEqual(sent, [{ email: null, username: 'BrickFan', message }]);
  } finally {
    await context.close();
  }
});

test('el contacto anónimo rechaza campos incompletos, inválidos o no permitidos', async () => {
  const sent = [];
  const context = await startTestServer({
    options: { contactEmailSender: async (contact) => sent.push(contact) },
  });
  try {
    for (const body of [
      { email: '', username: '', message: 'Hola' },
      { email: 'invalid', username: '', message: 'Hola' },
      { email: '', username: 'invalid name', message: 'Hola' },
      { email: 'person@example.com', username: '', message: '   ' },
      { email: 'person@example.com', username: '', message: `x${'x'.repeat(1000)}` },
      { email: 'person@example.com', username: '', message: 'Hola', extra: true },
    ]) {
      const response = await submit(context.baseUrl, body);
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.deepEqual(await response.json(), { error: 'CONTACTO_INVALIDO' });
    }

    assert.equal((await submit(context.baseUrl, '{')).status, 400);
    assert.equal(sent.length, 0);
    assert.equal((await fetch(`${context.baseUrl}${CONTACT_PATH}`, { method: 'GET' })).status, 405);
    assert.equal((await fetch(`${context.baseUrl}${CONTACT_PATH}?source=login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'person@example.com', message: 'Hola' }),
    })).status, 400);
  } finally {
    await context.close();
  }
});

test('el contacto limita solicitudes por origen antes de llamar al proveedor', async () => {
  let sentCount = 0;
  const context = await startTestServer({
    options: {
      contactEmailSender: async () => { sentCount += 1; },
      now: () => new Date('2026-11-17T09:00:00.000Z'),
    },
  });
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal((await submit(context.baseUrl, { username: 'BrickFan', message: 'Hola' })).status, 200);
    }
    const limited = await submit(context.baseUrl, { username: 'BrickFan', message: 'Otro mensaje' });
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('retry-after'), '60');
    assert.deepEqual(await limited.json(), { error: 'CONTACTO_LIMITE_EXCEDIDO' });
    assert.equal(sentCount, 5);
  } finally {
    await context.close();
  }
});

test('un fallo del proveedor devuelve un error genérico sin éxito aparente', async () => {
  const context = await startTestServer({
    options: { contactEmailSender: async () => { throw new Error('provider details'); } },
  });
  try {
    const response = await submit(context.baseUrl, { email: 'person@example.com', message: 'Hola' });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'CONTACTO_NO_DISPONIBLE' });
  } finally {
    await context.close();
  }
});

test('el contacto autenticado deriva la identidad verificada e ignora identidad enviada por el cliente', async () => {
  const supabase = createSupabaseMock({ users: { [TEST_TOKEN]: TEST_USER } });
  supabase.seed('user_profiles', TEST_USER.id, [{
    username: 'VerifiedFan',
    avatar_url: null,
    currency: 'EUR',
    language: 'es',
    onboarding_completed: true,
  }]);
  const sent = [];
  const context = await startTestServer({
    supabase,
    options: { contactEmailSender: async (contact) => sent.push(contact) },
  });
  try {
    const response = await authFetch(TEST_TOKEN)(`${context.baseUrl}${CONTACT_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'forged@example.com',
        username: 'ForgedFan',
        message: 'Necesito ayuda con mi cuenta.',
      }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(sent, [{
      email: TEST_USER.email,
      username: 'VerifiedFan',
      message: 'Necesito ayuda con mi cuenta.',
    }]);
  } finally {
    await context.close();
  }
});

test('el contacto rechaza un bearer inválido sin degradarlo a una solicitud anónima', async () => {
  let sentCount = 0;
  const context = await startTestServer({
    options: { contactEmailSender: async () => { sentCount += 1; } },
  });
  try {
    const response = await authFetch('invalid-token')(`${context.baseUrl}${CONTACT_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'person@example.com', message: 'Hola' }),
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'NO_AUTENTICADO' });
    assert.equal(sentCount, 0);
  } finally {
    await context.close();
  }
});
