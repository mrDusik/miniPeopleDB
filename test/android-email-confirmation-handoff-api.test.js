import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createSupabaseMock } from '../test-support/supabase-mock.js';
import { TEST_TOKEN, TEST_USER, startTestServer } from '../test-support/server.js';

const EMAIL_DIGEST = createHash('sha256').update(TEST_USER.email).digest('hex');
const PUBLIC_KEY = { kty: 'RSA', n: 'A'.repeat(342), e: 'AQAB' };
const PAYLOAD = { iv: 'a'.repeat(16), wrappedKey: 'b'.repeat(344), ciphertext: 'c'.repeat(64) };
const ROOT = '/api/android/email-handoff';

function handoffMock(now = () => new Date()) {
  const user = { ...TEST_USER, email_confirmed_at: '2026-11-05T00:00:00.000Z' };
  return createSupabaseMock({ users: { [TEST_TOKEN]: user }, now });
}

async function createHandoff(baseUrl) {
  return fetch(`${baseUrl}${ROOT}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ emailDigest: EMAIL_DIGEST, publicKey: PUBLIC_KEY }),
  });
}

test('create, public-key, publish and consume use anon/JWT RPCs, no-store responses and ciphertext only', async () => {
  const mock = handoffMock();
  const context = await startTestServer({ supabase: mock });
  try {
    const created = await createHandoff(context.baseUrl);
    assert.equal(created.status, 201);
    assert.equal(created.headers.get('cache-control'), 'no-store');
    const handoff = await created.json();
    assert.match(handoff.handoffId, /^[0-9a-f-]{36}$/);
    assert.match(handoff.pollProof, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(Date.parse(handoff.expiresAt) - Date.now() <= 24 * 60 * 60 * 1000, true);

    const publicKeyResponse = await fetch(`${context.baseUrl}${ROOT}/${handoff.handoffId}/public-key`);
    assert.equal(publicKeyResponse.status, 200);
    assert.equal(publicKeyResponse.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await publicKeyResponse.json(), { publicKey: PUBLIC_KEY });

    const waiting = await fetch(`${context.baseUrl}${ROOT}/${handoff.handoffId}/consume`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pollProof: handoff.pollProof }),
    });
    assert.equal(waiting.status, 202);
    assert.deepEqual(await waiting.json(), { status: 'pending' });

    const publish = await fetch(`${context.baseUrl}${ROOT}/${handoff.handoffId}/publish`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TEST_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ payload: PAYLOAD }),
    });
    assert.equal(publish.status, 200);
    assert.deepEqual(await publish.json(), { ok: true });

    const consumed = await fetch(`${context.baseUrl}${ROOT}/${handoff.handoffId}/consume`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pollProof: handoff.pollProof }),
    });
    assert.equal(consumed.status, 200);
    const consumedBody = await consumed.json();
    assert.deepEqual(consumedBody, { payload: PAYLOAD });
    assert.equal(JSON.stringify(consumedBody).includes(TEST_TOKEN), false);
    assert.equal((await fetch(`${context.baseUrl}${ROOT}/${handoff.handoffId}/consume`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pollProof: handoff.pollProof }),
    })).status, 404);
    assert.deepEqual(mock.adminCalls(), []);
  } finally {
    await context.close();
  }
});

test('handoff API rejects malformed input, missing or unconfirmed users, wrong email, proof and expired records generically', async () => {
  let instant = new Date('2026-11-05T00:00:00.000Z');
  const mock = handoffMock(() => instant);
  const context = await startTestServer({ supabase: mock, options: { now: () => instant } });
  try {
    const invalid = await fetch(`${context.baseUrl}${ROOT}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ emailDigest: 'not-a-digest', publicKey: PUBLIC_KEY }),
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { error: 'HANDOFF_INVALIDO' });

    const created = await createHandoff(context.baseUrl);
    const handoff = await created.json();
    const unauthorized = await fetch(`${context.baseUrl}${ROOT}/${handoff.handoffId}/publish`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: PAYLOAD }),
    });
    assert.equal(unauthorized.status, 401);
    assert.deepEqual(await unauthorized.json(), { error: 'HANDOFF_NO_AUTORIZADO' });

    const badProof = await fetch(`${context.baseUrl}${ROOT}/${handoff.handoffId}/consume`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pollProof: 'x'.repeat(43) }),
    });
    assert.equal(badProof.status, 404);
    assert.deepEqual(await badProof.json(), { error: 'HANDOFF_NO_ENCONTRADO' });

    const badPayload = await fetch(`${context.baseUrl}${ROOT}/${handoff.handoffId}/publish`, {
      method: 'POST',
      headers: { authorization: `Bearer ${TEST_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ payload: { access_token: 'plaintext-token' } }),
    });
    assert.equal(badPayload.status, 400);
    assert.equal(JSON.stringify(await badPayload.json()).includes('plaintext-token'), false);

    instant = new Date(instant.getTime() + 24 * 60 * 60 * 1000 + 1);
    const expired = await fetch(`${context.baseUrl}${ROOT}/${handoff.handoffId}/public-key`);
    assert.equal(expired.status, 404);
    assert.deepEqual(await expired.json(), { error: 'HANDOFF_NO_ENCONTRADO' });
    assert.deepEqual(mock.adminCalls(), []);
  } finally {
    await context.close();
  }
});

test('handoff creation is rate-limited per client and does not cache rejection responses', async () => {
  const context = await startTestServer({ supabase: handoffMock() });
  try {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await createHandoff(context.baseUrl);
      assert.equal(response.status, 201);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    const limited = await createHandoff(context.baseUrl);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await limited.json(), { error: 'HANDOFF_NO_DISPONIBLE' });
  } finally {
    await context.close();
  }
});
