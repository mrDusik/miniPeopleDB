import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { startTestServer } from '../test-support/server.js';

const page = await readFile(new URL('../public/android-email-confirmation.html', import.meta.url), 'utf8');
const callbackScript = await readFile(new URL('../public/android-email-confirmation.js', import.meta.url), 'utf8');
const HANDOFF_ID = '00000000-0000-4000-8000-000000000001';
const SESSION = { access_token: 'confirmed-access-token', refresh_token: 'confirmed-refresh-token' };

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function createCallback({
  search = `?handoff_id=${HANDOFF_ID}&token_hash=one-time-token-hash&type=email`,
  verifyError = null,
} = {}) {
  const keyPair = await webcrypto.subtle.generateKey({
    name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256',
  }, true, ['encrypt', 'decrypt']);
  const publicKey = await webcrypto.subtle.exportKey('jwk', keyPair.publicKey);
  const calls = { verifyOtp: [], publish: [], fetch: [], createClient: [] };
  const dom = new JSDOM(page, { url: `https://backend.test/android-email-confirmation${search}`, runScripts: 'outside-only' });
  const { window } = dom;
  Object.defineProperty(window, 'crypto', { value: webcrypto });
  Object.defineProperty(window, 'TextEncoder', { value: TextEncoder });
  window.supabase = {
    createClient(url, anonKey, options) {
      calls.createClient.push({ url, anonKey, options });
      assert.equal(url, 'https://project.supabase.test');
      assert.equal(anonKey, 'public-anon-key');
      assert.equal(options.auth.persistSession, false);
      assert.equal(options.auth.autoRefreshToken, false);
      assert.equal(options.auth.detectSessionInUrl, false);
      return {
        auth: {
          async verifyOtp(args) {
            calls.verifyOtp.push(args);
            return verifyError
              ? { data: null, error: { message: 'provider detail' } }
              : { data: { session: SESSION }, error: null };
          },
        },
      };
    },
  };
  window.fetch = async (input, init = {}) => {
    const url = new URL(input, window.location.href);
    calls.fetch.push(url.pathname);
    if (url.pathname === '/config/supabase') {
      return { ok: true, json: async () => ({ url: 'https://project.supabase.test', anonKey: 'public-anon-key' }) };
    }
    if (url.pathname === `/api/android/email-handoff/${HANDOFF_ID}/public-key`) {
      return { ok: true, json: async () => ({ publicKey }) };
    }
    if (url.pathname === `/api/android/email-handoff/${HANDOFF_ID}/publish`) {
      calls.publish.push({ init, body: JSON.parse(init.body) });
      return { ok: true };
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  };
  window.eval(callbackScript);
  return { dom, window, keyPair, calls };
}

test('callback publishes only encrypted signup session and immediately removes verification parameters', async () => {
  const { dom, window, keyPair, calls } = await createCallback();
  try {
    assert.equal(window.location.search, '');
    for (let attempt = 0; attempt < 20 && calls.verifyOtp.length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    assert.equal(calls.verifyOtp.length, 1, JSON.stringify({
      message: window.document.querySelector('#confirmation-message').textContent,
      fetch: calls.fetch,
      createClient: calls.createClient,
    }));
    assert.deepEqual(JSON.parse(JSON.stringify(calls.verifyOtp[0])), { token_hash: 'one-time-token-hash', type: 'email' });
    for (let attempt = 0; attempt < 20 && calls.publish.length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    assert.equal(calls.publish.length, 1);
    assert.equal(calls.publish[0].init.cache, 'no-store');
    assert.equal(calls.publish[0].init.headers.authorization, `Bearer ${SESSION.access_token}`);
    const encryptedPayload = calls.publish[0].body.payload;
    assert.deepEqual(Object.keys(encryptedPayload).sort(), ['ciphertext', 'iv', 'wrappedKey']);
    assert.equal(JSON.stringify(encryptedPayload).includes(SESSION.access_token), false);
    assert.equal(JSON.stringify(encryptedPayload).includes(SESSION.refresh_token), false);

    const rawKey = await webcrypto.subtle.decrypt(
      { name: 'RSA-OAEP' }, keyPair.privateKey, decodeBase64Url(encryptedPayload.wrappedKey),
    );
    const aesKey = await webcrypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
    const plaintext = await webcrypto.subtle.decrypt(
      { name: 'AES-GCM', iv: decodeBase64Url(encryptedPayload.iv) },
      aesKey,
      decodeBase64Url(encryptedPayload.ciphertext),
    );
    assert.deepEqual(JSON.parse(new TextDecoder().decode(plaintext)), SESSION);
    assert.equal(window.document.querySelector('#confirmation-message').textContent,
      'Email confirmado. Vuelve a la app Android para continuar.');
  } finally {
    dom.window.close();
  }
});

test('callback rejects duplicate, malformed and non-signup parameters without calling Supabase', async () => {
  for (const search of [
    `?handoff_id=${HANDOFF_ID}&token_hash=first&token_hash=second&type=email`,
    `?handoff_id=${HANDOFF_ID}&token_hash=one-time-token-hash&type=recovery`,
    `?handoff_id=${HANDOFF_ID}&token_hash=one-time-token-hash&type=email&access_token=secret`,
  ]) {
    const { dom, window, calls } = await createCallback({ search });
    try {
      assert.equal(window.location.search, '');
      assert.equal(calls.verifyOtp.length, 0);
      assert.equal(calls.publish.length, 0);
      assert.match(window.document.querySelector('#confirmation-message').textContent, /No se pudo confirmar/);
    } finally {
      dom.window.close();
    }
  }
});

test('failed or previously consumed confirmation shows only a generic recoverable message', async () => {
  const { dom, window, calls } = await createCallback({ verifyError: true });
  try {
    for (let attempt = 0; attempt < 20 && calls.verifyOtp.length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    for (let attempt = 0; attempt < 20
      && !window.document.querySelector('#confirmation-message').textContent.startsWith('No se pudo confirmar'); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    assert.equal(calls.verifyOtp.length, 1, window.document.querySelector('#confirmation-message').textContent);
    assert.equal(calls.publish.length, 0);
    assert.equal(window.document.querySelector('#confirmation-message').textContent,
      'No se pudo confirmar el email. Solicita un nuevo enlace e inténtalo otra vez.');
    assert.equal(window.document.body.textContent.includes('provider detail'), false);
  } finally {
    dom.window.close();
  }
});

test('hosted callback response has no-store and restrictive security headers', async () => {
  const context = await startTestServer();
  try {
    const response = await fetch(`${context.baseUrl}/android-email-confirmation?handoff_id=${HANDOFF_ID}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal((await response.text()).includes('third-party'), false);
  } finally {
    await context.close();
  }
});
