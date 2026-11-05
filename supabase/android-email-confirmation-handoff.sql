begin;

create table if not exists private.android_email_handoffs (
  id uuid primary key,
  email_digest text not null check (email_digest ~ '^[0-9a-f]{64}$'),
  public_key jsonb not null,
  proof_digest text not null check (proof_digest ~ '^[0-9a-f]{64}$'),
  state text not null default 'pending' check (state in ('pending', 'published')),
  encrypted_payload jsonb,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  constraint android_email_handoffs_payload_state_check
    check ((state = 'pending' and encrypted_payload is null)
      or (state = 'published' and encrypted_payload is not null))
);

alter table private.android_email_handoffs enable row level security;
revoke all on table private.android_email_handoffs from public, anon, authenticated, service_role;

create or replace function public.android_email_handoff_create(
  p_id uuid,
  p_email_digest text,
  p_public_key jsonb,
  p_proof_digest text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  delete from private.android_email_handoffs where expires_at <= now();
  if p_id is null
    or p_email_digest !~ '^[0-9a-f]{64}$'
    or p_proof_digest !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_public_key) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_public_key)) not between 3 and 6
    or p_public_key->>'kty' is distinct from 'RSA'
    or p_public_key->>'n' !~ '^[A-Za-z0-9_-]+$'
    or length(p_public_key->>'n') not between 300 and 1024
    or p_public_key->>'e' is distinct from 'AQAB'
    or p_public_key ?| array['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth']
    or exists (
      select 1 from jsonb_object_keys(p_public_key) as property(key)
      where key not in ('kty', 'n', 'e', 'alg', 'key_ops', 'ext')
    )
    or (p_public_key ? 'alg' and p_public_key->>'alg' is distinct from 'RSA-OAEP-256')
    or (p_public_key ? 'key_ops' and p_public_key->'key_ops' is distinct from '["encrypt"]'::jsonb)
    or (p_public_key ? 'ext' and p_public_key->'ext' is distinct from 'true'::jsonb)
    or octet_length(p_public_key::text) > 4096 then
    raise exception using errcode = '22023', message = 'HANDOFF_INVALIDO';
  end if;

  insert into private.android_email_handoffs (id, email_digest, public_key, proof_digest)
  values (p_id, p_email_digest, p_public_key, p_proof_digest);
  return true;
end;
$$;

create or replace function public.android_email_handoff_public_key(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_public_key jsonb;
begin
  delete from private.android_email_handoffs where expires_at <= now();
  select public_key into v_public_key
  from private.android_email_handoffs
  where id = p_id and state = 'pending' and expires_at > now();
  return v_public_key;
end;
$$;

create or replace function public.android_email_handoff_publish(
  p_id uuid,
  p_encrypted_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_email text;
  v_email_confirmed_at timestamptz;
  v_email_digest text;
begin
  delete from private.android_email_handoffs where expires_at <= now();
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'HANDOFF_NO_AUTORIZADO';
  end if;
  select email, email_confirmed_at into v_email, v_email_confirmed_at
  from auth.users where id = auth.uid();
  if v_email is null or v_email_confirmed_at is null then
    raise exception using errcode = '42501', message = 'HANDOFF_NO_AUTORIZADO';
  end if;
  v_email_digest := encode(sha256(convert_to(lower(btrim(v_email)), 'UTF8')), 'hex');

  if jsonb_typeof(p_encrypted_payload) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_encrypted_payload)) is distinct from 3
    or p_encrypted_payload->>'iv' is null
    or p_encrypted_payload->>'wrappedKey' is null
    or p_encrypted_payload->>'ciphertext' is null
    or jsonb_typeof(p_encrypted_payload->'iv') is distinct from 'string'
    or jsonb_typeof(p_encrypted_payload->'wrappedKey') is distinct from 'string'
    or jsonb_typeof(p_encrypted_payload->'ciphertext') is distinct from 'string'
    or p_encrypted_payload->>'iv' !~ '^[A-Za-z0-9_-]{16}$'
    or p_encrypted_payload->>'wrappedKey' !~ '^[A-Za-z0-9_-]+$'
    or length(p_encrypted_payload->>'wrappedKey') not between 342 and 1024
    or p_encrypted_payload->>'ciphertext' !~ '^[A-Za-z0-9_-]+$'
    or length(p_encrypted_payload->>'ciphertext') not between 43 and 20000
    or exists (
      select 1 from jsonb_object_keys(p_encrypted_payload) as property(key)
      where key not in ('iv', 'wrappedKey', 'ciphertext')
    )
    or octet_length(p_encrypted_payload::text) > 16384 then
    raise exception using errcode = '22023', message = 'HANDOFF_INVALIDO';
  end if;

  update private.android_email_handoffs
  set state = 'published', encrypted_payload = p_encrypted_payload
  where id = p_id
    and email_digest = v_email_digest
    and state = 'pending'
    and expires_at > now();
  if not found then
    raise exception using errcode = '42501', message = 'HANDOFF_NO_AUTORIZADO';
  end if;
  return true;
end;
$$;

create or replace function public.android_email_handoff_consume(
  p_id uuid,
  p_proof_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_state text;
  v_payload jsonb;
begin
  delete from private.android_email_handoffs where expires_at <= now();
  if p_proof_digest !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select state into v_state
  from private.android_email_handoffs
  where id = p_id and proof_digest = p_proof_digest and expires_at > now();
  if not found then
    return null;
  end if;
  if v_state = 'pending' then
    return jsonb_build_object('status', 'pending');
  end if;
  delete from private.android_email_handoffs
  where id = p_id
    and proof_digest = p_proof_digest
    and state = 'published'
    and expires_at > now()
  returning encrypted_payload into v_payload;
  if not found then
    return null;
  end if;
  return jsonb_build_object('status', 'ready', 'payload', v_payload);
end;
$$;

revoke all on function public.android_email_handoff_create(uuid, text, jsonb, text) from public, anon, authenticated, service_role;
revoke all on function public.android_email_handoff_public_key(uuid) from public, anon, authenticated, service_role;
revoke all on function public.android_email_handoff_publish(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.android_email_handoff_consume(uuid, text) from public, anon, authenticated, service_role;

grant execute on function public.android_email_handoff_create(uuid, text, jsonb, text) to anon;
grant execute on function public.android_email_handoff_public_key(uuid) to anon;
grant execute on function public.android_email_handoff_publish(uuid, jsonb) to authenticated;
grant execute on function public.android_email_handoff_consume(uuid, text) to anon;

commit;
