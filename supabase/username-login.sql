create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists private.username_login_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  attempts integer not null
);

alter table private.username_login_attempts enable row level security;
revoke all on private.username_login_attempts from public, anon, authenticated;

create or replace function public.resolver_acceso_username(p_username text, p_password text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  login_user_id uuid;
  login_email text;
  password_hash text;
  attempt_count integer;
  checked_hash text;
begin
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,20}$'
    or p_password is null or octet_length(p_password) = 0 or octet_length(p_password) > 1024 then
    return null;
  end if;

  select account.id, account.email, account.encrypted_password
  into login_user_id, login_email, password_hash
  from public.user_profiles profile
  join auth.users account on account.id = profile.user_id
  where lower(profile.username) = lower(p_username);

  if login_user_id is not null then
    insert into private.username_login_attempts as attempts (user_id, window_start, attempts)
    values (login_user_id, clock_timestamp(), 1)
    on conflict (user_id) do update set
      attempts = case when attempts.window_start < clock_timestamp() - interval '1 minute' then 1 else attempts.attempts + 1 end,
      window_start = case when attempts.window_start < clock_timestamp() - interval '1 minute' then clock_timestamp() else attempts.window_start end
    returning attempts.attempts into attempt_count;
    if attempt_count > 5 then
      return null;
    end if;
  end if;

  checked_hash := extensions.crypt(p_password, coalesce(nullif(password_hash, ''),
    '$2a$06$DCq7YPn5Rq63x1Lad4cll.2Dy0wRj6M7SMEHcSW/t2QKx3a6xDk3G'));
  if password_hash is not null and password_hash <> '' and checked_hash = password_hash then
    return login_email;
  end if;
  return null;
end;
$$;

revoke all on function public.resolver_acceso_username(text, text) from public, anon, authenticated;
grant execute on function public.resolver_acceso_username(text, text) to anon;