import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const USER_ID = '00000000-0000-4000-8000-0000000000a1';
const HANDOFF_ID = '10000000-0000-4000-8000-0000000000a1';
const EMAIL = 'android@example.invalid';
const EMAIL_DIGEST = '44753a95872a1ee50642acc04e481f00bb94f563cccab9248b6454d55a5acfd7';
const PROOF = 'a'.repeat(64);
const PUBLIC_KEY = { kty: 'RSA', n: 'A'.repeat(342), e: 'AQAB' };
const PAYLOAD = { iv: 'a'.repeat(16), wrappedKey: 'b'.repeat(344), ciphertext: 'c'.repeat(64) };

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create schema private;
    create role anon;
    create role authenticated;
    create role service_role;
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table auth.users (
      id uuid primary key,
      email text not null,
      email_confirmed_at timestamptz
    );
    insert into auth.users (id, email, email_confirmed_at)
    values ('${USER_ID}', '${EMAIL}', now());
  `);
  await db.exec(await readFile(new URL('../supabase/android-email-confirmation-handoff.sql', import.meta.url), 'utf8'));
  return db;
}

async function createHandoff(db, id = HANDOFF_ID, proof = PROOF) {
  await db.query(
    'select public.android_email_handoff_create($1, $2, $3::jsonb, $4)',
    [id, EMAIL_DIGEST, JSON.stringify(PUBLIC_KEY), proof],
  );
}

test('email handoff migration restricts table and RPC privileges to their intended roles', async () => {
  const db = await createDatabase();
  try {
    await assert.rejects(db.query(
      'select public.android_email_handoff_create($1, $2, $3::jsonb, $4)',
      [HANDOFF_ID, EMAIL_DIGEST, JSON.stringify({ ...PUBLIC_KEY, d: 'private-key-material' }), PROOF],
    ), /HANDOFF_INVALIDO/);
    for (const role of ['anon', 'authenticated', 'service_role']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        assert.equal((await db.query('select has_table_privilege($1, $2, $3) as allowed', [
          role, 'private.android_email_handoffs', privilege,
        ])).rows[0].allowed, false);
      }
    }

    const permissions = [
      ['android_email_handoff_create(uuid,text,jsonb,text)', 'anon', true],
      ['android_email_handoff_create(uuid,text,jsonb,text)', 'authenticated', false],
      ['android_email_handoff_public_key(uuid)', 'anon', true],
      ['android_email_handoff_public_key(uuid)', 'authenticated', false],
      ['android_email_handoff_publish(uuid,jsonb)', 'authenticated', true],
      ['android_email_handoff_publish(uuid,jsonb)', 'anon', false],
      ['android_email_handoff_consume(uuid,text)', 'anon', true],
      ['android_email_handoff_consume(uuid,text)', 'authenticated', false],
    ];
    for (const [signature, role, expected] of permissions) {
      assert.equal((await db.query('select has_function_privilege($1, $2, $3) as allowed', [
        role, `public.${signature}`, 'EXECUTE',
      ])).rows[0].allowed, expected, `${role} ${signature}`);
    }
    for (const signature of permissions.map(([name]) => name)) {
      assert.equal((await db.query('select has_function_privilege($1, $2, $3) as allowed', [
        'service_role', `public.${signature}`, 'EXECUTE',
      ])).rows[0].allowed, false);
    }

    await assert.rejects(
      db.exec('set role service_role; select * from private.android_email_handoffs'),
      /permission denied/i,
    );
  } finally {
    await db.close();
  }
});

test('confirmed matching account publishes ciphertext once and proof-checks atomic consumption', async () => {
  const db = await createDatabase();
  try {
    await createHandoff(db);
    assert.deepEqual((await db.query('select public.android_email_handoff_public_key($1) as key', [HANDOFF_ID])).rows[0].key, PUBLIC_KEY);
    assert.deepEqual((await db.query('select public.android_email_handoff_consume($1, $2) as result', [HANDOFF_ID, PROOF])).rows[0].result, { status: 'pending' });

    await db.exec(`set role authenticated;
      select set_config('request.jwt.claim.role', 'authenticated', false);
      select set_config('request.jwt.claim.sub', '${USER_ID}', false)`);
    await assert.rejects(
      db.query('select public.android_email_handoff_publish($1, $2::jsonb)', [
        HANDOFF_ID, JSON.stringify({ ...PAYLOAD, access_token: 'plaintext-token' }),
      ]),
      /HANDOFF_INVALIDO/,
    );
    await db.query('select public.android_email_handoff_publish($1, $2::jsonb)', [HANDOFF_ID, JSON.stringify(PAYLOAD)]);
    await assert.rejects(
      db.query('select public.android_email_handoff_publish($1, $2::jsonb)', [HANDOFF_ID, JSON.stringify(PAYLOAD)]),
      /HANDOFF_NO_AUTORIZADO/,
    );
    await db.exec('reset role; select set_config(\'request.jwt.claim.sub\', \'\', false)');

    assert.equal((await db.query('select public.android_email_handoff_consume($1, $2) as payload', [HANDOFF_ID, 'b'.repeat(64)])).rows[0].payload, null);
    assert.deepEqual((await db.query('select public.android_email_handoff_consume($1, $2) as result', [HANDOFF_ID, PROOF])).rows[0].result, {
      status: 'ready', payload: PAYLOAD,
    });
    assert.equal((await db.query('select public.android_email_handoff_consume($1, $2) as payload', [HANDOFF_ID, PROOF])).rows[0].payload, null);
  } finally {
    await db.close();
  }
});

test('handoff rejects an unconfirmed or mismatched email account and cannot read expired ciphertext', async () => {
  const db = await createDatabase();
  try {
    await createHandoff(db);
    const secondHandoffId = '10000000-0000-4000-8000-0000000000a2';
    await createHandoff(db, secondHandoffId);
    await db.query('update auth.users set email_confirmed_at = null where id = $1', [USER_ID]);
    await db.exec(`set role authenticated;
      select set_config('request.jwt.claim.role', 'authenticated', false);
      select set_config('request.jwt.claim.sub', '${USER_ID}', false)`);
    await assert.rejects(
      db.query('select public.android_email_handoff_publish($1, $2::jsonb)', [HANDOFF_ID, JSON.stringify(PAYLOAD)]),
      /HANDOFF_NO_AUTORIZADO/,
    );
    await db.exec('reset role; select set_config(\'request.jwt.claim.sub\', \'\', false)');
    await db.query('update auth.users set email = $1, email_confirmed_at = now() where id = $2', ['other@example.invalid', USER_ID]);
    await db.exec(`set role authenticated;
      select set_config('request.jwt.claim.role', 'authenticated', false);
      select set_config('request.jwt.claim.sub', '${USER_ID}', false)`);
    await assert.rejects(
      db.query('select public.android_email_handoff_publish($1, $2::jsonb)', [secondHandoffId, JSON.stringify(PAYLOAD)]),
      /HANDOFF_NO_AUTORIZADO/,
    );
    await db.exec('reset role; select set_config(\'request.jwt.claim.sub\', \'\', false)');
    await db.query("update private.android_email_handoffs set expires_at = now() - interval '1 second', state = 'published', encrypted_payload = $1::jsonb where id = $2", [JSON.stringify(PAYLOAD), HANDOFF_ID]);
    assert.equal((await db.query('select public.android_email_handoff_public_key($1) as key', [HANDOFF_ID])).rows[0].key, null);
    assert.equal((await db.query('select public.android_email_handoff_consume($1, $2) as payload', [HANDOFF_ID, PROOF])).rows[0].payload, null);
    assert.equal((await db.query('select count(*)::integer as count from private.android_email_handoffs')).rows[0].count, 1);
    assert.equal((await db.query('select id from private.android_email_handoffs')).rows[0].id, secondHandoffId);
  } finally {
    await db.close();
  }
});
