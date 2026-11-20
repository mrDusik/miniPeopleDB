import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createResendContactMailer } from '../src/contact-email.js';
import { startTestServer } from '../test-support/server.js';

const deletion = '/api/solicitar-borrado';
const email = 'person@example.test';

function post(base, path = deletion, body = { email }) {
  return fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

for (const maintenanceMode of [false, true]) {
  test(`páginas legales públicas y enlazadas; mantenimiento=${maintenanceMode}`, async (t) => {
    const { baseUrl, close } = await startTestServer({
      options: { maintenanceMode, contactEmailSender: async () => {} },
    });
    t.after(close);
    for (const [path, peer] of [['/privacidad', '/eliminar-cuenta'], ['/eliminar-cuenta', '/privacidad']]) {
      const response = await fetch(baseUrl + path, { redirect: 'error' });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /text\/html/);
      assert.ok((await response.text()).includes(`href="${peer}"`));
      assert.equal((await fetch(baseUrl + path, { method: 'HEAD' })).status, 200);
    }
    for (const path of ['/privacidad.css', '/solicitud-borrado.js']) {
      assert.equal((await fetch(baseUrl + path)).status, 200);
    }
    if (maintenanceMode) {
      for (const path of ['/api/profile', '/minifiguras']) {
        assert.equal((await fetch(baseUrl + path)).status, 503);
      }
      assert.equal((await post(baseUrl, '/api/contact', { email, message: 'Hola' })).status, 503);
      assert.equal((await post(baseUrl)).status, 200);
    }
  });
}

test('el POST anónimo no inicializa Supabase y comparte el límite de Contacto', async (t) => {
  const sent = [];
  let supabaseCalls = 0;
  const { baseUrl, close } = await startTestServer({
    options: {
      maintenanceMode: false,
      createSupabaseClient: () => { supabaseCalls += 1; throw new Error('Unexpected Supabase call'); },
      now: () => new Date('2026-01-01T10:00:00Z'),
      contactEmailSender: createResendContactMailer({
        apiKey: 'fake-key',
        fromEmail: 'contact@example.test',
        recipientEmail: 'support@example.test',
        fetchImpl: async (_url, init) => {
          sent.push(JSON.parse(init.body));
          return { ok: true };
        },
      }),
    },
  });
  t.after(close);
  for (const body of [null, [], {}, { email: 'invalid' }, { email, username: null }, { email, username: 'no spaces' },
    { email, message: 'unexpected' }, { email: 'a'.repeat(8192) }]) {
    assert.equal((await post(baseUrl, deletion, body)).status, 400);
  }
  assert.equal((await post(baseUrl, `${deletion}?email=${email}`)).status, 400);
  assert.equal((await fetch(baseUrl + deletion, { method: 'POST', body: 'email=a' })).status, 400);
  assert.equal(sent.length, 0);

  const accepted = await post(baseUrl, deletion, { email, username: ' BrickFan ' });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await accepted.json(), { ok: true });
  assert.equal(sent[0].subject, 'Solicitud de eliminación de cuenta de MiniPeopleDB');
  assert.equal(sent[0].reply_to, email);
  assert.match(sent[0].text, /Usuario declarado: BrickFan/);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    assert.equal((await post(baseUrl, '/api/contact', { email, message: 'Hola' })).status, 200);
  }
  const limited = await post(baseUrl);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '60');
  assert.equal(sent.length, 5);
  assert.equal(supabaseCalls, 0);
});

test('el formulario sin sesión conserva los campos ante un fallo y confirma solo el envío al reintentar', { timeout: 5000 }, async (t) => {
  let fail = true;
  const { baseUrl, close } = await startTestServer({
    options: { maintenanceMode: false, contactEmailSender: async () => { if (fail) throw new Error('provider'); } },
  });
  t.after(close);
  const url = `${baseUrl}/eliminar-cuenta`;
  const dom = new JSDOM(await (await fetch(url)).text(), { url, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom;
  let submission;
  window.fetch = (input, init) => {
    assert.equal(input, baseUrl + deletion);
    assert.equal(init.credentials, 'omit');
    assert.equal(Object.keys(init.headers).some((key) => key.toLowerCase() === 'authorization'), false);
    submission = fetch(input, init);
    return submission;
  };
  window.eval(await (await fetch(`${baseUrl}/solicitud-borrado.js`)).text());
  const form = window.document.querySelector('form');
  const status = window.document.querySelector('[role="status"]');
  assert.equal(form.hidden, false);
  const input = form.elements.namedItem('email');
  input.value = email;
  const submit = () => new Promise((resolve) => {
    const observer = new window.MutationObserver(() => {
      if (form.hasAttribute('aria-busy')) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(form, { attributes: true, attributeFilter: ['aria-busy'] });
    form.dispatchEvent(new window.Event('submit', { cancelable: true }));
  });
  const failed = submit();
  assert.equal(form.getAttribute('aria-busy'), 'true');
  assert.equal((await submission).status, 503);
  await failed;
  assert.match(status.textContent, /No se pudo confirmar/);
  assert.equal(input.value, email);
  fail = false;
  await submit();
  assert.match(status.textContent, /Solicitud enviada.+Tu cuenta aún no se ha eliminado/);
  assert.equal(input.value, '');
});
