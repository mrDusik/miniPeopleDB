begin;

create table if not exists public.android_push_installations (
  installation_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  fcm_token text unique,
  permission_state text not null default 'unknown'
    check (permission_state in ('unknown', 'granted', 'denied', 'invalid')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint android_push_active_token_check
    check (not active or (permission_state = 'granted' and fcm_token is not null))
);

create index if not exists android_push_installations_owner_idx
  on public.android_push_installations (user_id, installation_id);

alter table public.android_push_installations enable row level security;
revoke all on table public.android_push_installations from public, anon, authenticated, service_role;
grant insert (installation_id, user_id, fcm_token, permission_state, active, updated_at)
  on public.android_push_installations to authenticated;
grant select (installation_id, user_id, permission_state, active, created_at, updated_at)
  on public.android_push_installations to authenticated;
grant update (fcm_token, permission_state, active, updated_at)
  on public.android_push_installations to authenticated;
grant delete on public.android_push_installations to authenticated;

drop policy if exists "Users manage their Android push installation" on public.android_push_installations;
create policy "Users manage their Android push installation"
  on public.android_push_installations for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists private.android_push_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.notificaciones (id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'expired')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  lease_token uuid,
  leased_until timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.android_push_outbox drop constraint if exists android_push_outbox_expiry_check;

create index if not exists android_push_outbox_dispatch_idx
  on private.android_push_outbox (available_at, created_at)
  where status in ('queued', 'processing');

create table if not exists private.android_push_deliveries (
  event_id uuid not null references private.android_push_outbox (id) on delete cascade,
  installation_id uuid not null references public.android_push_installations (installation_id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'retry_wait', 'invalid', 'permanent')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error_code text,
  updated_at timestamptz not null default now(),
  primary key (event_id, installation_id)
);

alter table private.android_push_outbox enable row level security;
alter table private.android_push_deliveries enable row level security;
revoke all on table private.android_push_outbox, private.android_push_deliveries
  from public, anon, authenticated, service_role;

create or replace function private.enqueue_android_push_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  insert into private.android_push_outbox (notification_id)
  values (new.id)
  on conflict (notification_id) do nothing;
  return new;
end;
$$;

revoke all on function private.enqueue_android_push_notification() from public, anon, authenticated, service_role;
drop trigger if exists enqueue_android_push_notification on public.notificaciones;
create trigger enqueue_android_push_notification
  after insert on public.notificaciones
  for each row execute function private.enqueue_android_push_notification();

create or replace function public.android_push_claim_events(p_limit integer default 10, p_lease_seconds integer default 60)
returns table (
  event_id uuid,
  notification_id uuid,
  category text,
  expires_at timestamptz,
  lease_token uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'ANDROID_PUSH_NO_AUTORIZADO';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 50
    or p_lease_seconds is null or p_lease_seconds < 10 or p_lease_seconds > 300 then
    raise exception using errcode = '22023', message = 'ANDROID_PUSH_PARAMETROS_INVALIDOS';
  end if;

  update private.android_push_outbox pending
  set status = 'expired', lease_token = null, leased_until = null, updated_at = clock_timestamp()
  where pending.status in ('queued', 'processing') and pending.expires_at <= clock_timestamp();

  return query
  with candidates as (
    select pending.id
    from private.android_push_outbox pending
    where pending.expires_at > clock_timestamp()
      and pending.available_at <= clock_timestamp()
      and (pending.status = 'queued'
        or (pending.status = 'processing' and pending.leased_until <= clock_timestamp()))
    order by pending.created_at, pending.id
    for update skip locked
    limit p_limit
  ), claimed as (
    update private.android_push_outbox pending
    set status = 'processing',
        attempts = pending.attempts + 1,
        lease_token = gen_random_uuid(),
        leased_until = clock_timestamp() + make_interval(secs => p_lease_seconds),
        updated_at = clock_timestamp()
    from candidates
    where pending.id = candidates.id
    returning pending.id, pending.notification_id, pending.expires_at, pending.lease_token
  )
  select claimed.id, claimed.notification_id, notification.type, claimed.expires_at, claimed.lease_token
  from claimed
  join public.notificaciones notification on notification.id = claimed.notification_id;
end;
$$;

create or replace function public.android_push_resolve_event_tokens(p_event_id uuid, p_lease_token uuid)
returns table (installation_id uuid, fcm_token text, category text, expires_at timestamptz, attempts integer)
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_event private.android_push_outbox%rowtype;
  v_recipient uuid;
  v_category text;
  v_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'ANDROID_PUSH_NO_AUTORIZADO';
  end if;
  if p_event_id is null or p_lease_token is null then
    raise exception using errcode = '22023', message = 'ANDROID_PUSH_PARAMETROS_INVALIDOS';
  end if;

  select * into v_event
  from private.android_push_outbox pending
  where pending.id = p_event_id
    and pending.status = 'processing'
    and pending.lease_token = p_lease_token
    and pending.leased_until > clock_timestamp()
    and pending.expires_at > clock_timestamp()
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'ANDROID_PUSH_EVENTO_NO_RECLAMADO';
  end if;

  select notification.user_id, notification.type
    into v_recipient, v_category
  from public.notificaciones notification
  where notification.id = v_event.notification_id;
  if not found then
    update private.android_push_outbox
      set status = 'expired', lease_token = null, leased_until = null, updated_at = clock_timestamp()
      where id = p_event_id;
    return;
  end if;

  if v_event.resolved_at is null then
    insert into private.android_push_deliveries (event_id, installation_id)
    select p_event_id, installation.installation_id
    from public.android_push_installations installation
    where installation.user_id = v_recipient
      and installation.active
      and installation.permission_state = 'granted'
      and installation.fcm_token is not null
    on conflict on constraint android_push_deliveries_pkey do nothing;

    update private.android_push_outbox
      set resolved_at = clock_timestamp(), updated_at = clock_timestamp()
      where id = p_event_id;
  end if;

  update private.android_push_deliveries delivery
  set status = 'permanent', last_error_code = 'FAILED_PRECONDITION', updated_at = clock_timestamp()
  from public.android_push_installations installation
  where delivery.event_id = p_event_id
    and installation.installation_id = delivery.installation_id
    and (not installation.active or installation.fcm_token is null
      or installation.permission_state <> 'granted');

  select count(*)::integer into v_count
  from private.android_push_deliveries delivery
  where delivery.event_id = p_event_id;
  if v_count = 0 then
    update private.android_push_outbox
      set status = 'completed', lease_token = null, leased_until = null, updated_at = clock_timestamp()
      where id = p_event_id;
    return;
  end if;

  return query
  select installation.installation_id, installation.fcm_token, v_category, v_event.expires_at, delivery.attempts
  from private.android_push_deliveries delivery
  join public.android_push_installations installation
    on installation.installation_id = delivery.installation_id
  where delivery.event_id = p_event_id
    and installation.user_id = v_recipient
    and installation.active
    and installation.permission_state = 'granted'
    and installation.fcm_token is not null
    and (delivery.status = 'pending'
      or (delivery.status = 'retry_wait' and delivery.next_attempt_at <= clock_timestamp()))
  order by installation.installation_id;

  if not found then
    update private.android_push_outbox
    set status = case
          when exists (
            select 1 from private.android_push_deliveries delivery
            where delivery.event_id = p_event_id
              and delivery.status in ('pending', 'retry_wait')
          ) then 'queued'
          else 'completed'
        end,
        available_at = coalesce((
          select min(delivery.next_attempt_at)
          from private.android_push_deliveries delivery
          where delivery.event_id = p_event_id and delivery.status = 'retry_wait'
        ), available_at),
        lease_token = null,
        leased_until = null,
        updated_at = clock_timestamp()
    where id = p_event_id;
  end if;
end;
$$;

create or replace function public.android_push_record_attempt(
  p_event_id uuid,
  p_lease_token uuid,
  p_installation_id uuid,
  p_outcome text,
  p_error_code text default null,
  p_retry_delay_seconds integer default 0
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_event private.android_push_outbox%rowtype;
  v_updated integer;
  v_result text;
  v_retry_at timestamptz;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'ANDROID_PUSH_NO_AUTORIZADO';
  end if;
  if p_event_id is null or p_lease_token is null or p_installation_id is null
    or p_outcome not in ('sent', 'retry', 'invalid', 'permanent')
    or p_retry_delay_seconds is null or p_retry_delay_seconds < 0 or p_retry_delay_seconds > 3600
    or (p_error_code is not null and p_error_code not in (
      'UNAVAILABLE', 'INTERNAL', 'QUOTA_EXCEEDED', 'INVALID_ARGUMENT', 'UNREGISTERED',
      'PERMISSION_DENIED', 'FAILED_PRECONDITION', 'UNKNOWN', 'MAX_ATTEMPTS'
    )) then
    raise exception using errcode = '22023', message = 'ANDROID_PUSH_PARAMETROS_INVALIDOS';
  end if;

  select * into v_event
  from private.android_push_outbox
  where id = p_event_id
    and status = 'processing'
    and lease_token = p_lease_token
    and leased_until > clock_timestamp()
    and expires_at > clock_timestamp()
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'ANDROID_PUSH_EVENTO_NO_RECLAMADO';
  end if;

  v_retry_at := clock_timestamp() + make_interval(secs => p_retry_delay_seconds);
  update private.android_push_deliveries delivery
  set status = case p_outcome
        when 'sent' then 'sent'
        when 'retry' then 'retry_wait'
        when 'invalid' then 'invalid'
        else 'permanent'
      end,
      attempts = delivery.attempts + 1,
      next_attempt_at = case when p_outcome = 'retry' then v_retry_at else delivery.next_attempt_at end,
      last_error_code = p_error_code,
      updated_at = clock_timestamp()
  where delivery.event_id = p_event_id
    and delivery.installation_id = p_installation_id
    and delivery.status in ('pending', 'retry_wait');
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception using errcode = '42501', message = 'ANDROID_PUSH_INTENTO_NO_ENCONTRADO';
  end if;

  if p_outcome = 'invalid' then
    update public.android_push_installations
    set fcm_token = null, active = false, permission_state = 'invalid', updated_at = clock_timestamp()
    where installation_id = p_installation_id;
  end if;

  if exists (
    select 1 from private.android_push_deliveries delivery
    where delivery.event_id = p_event_id and delivery.status = 'pending'
  ) then
    return 'processing';
  end if;

  if exists (
    select 1 from private.android_push_deliveries delivery
    where delivery.event_id = p_event_id and delivery.status = 'retry_wait'
      and delivery.next_attempt_at <= clock_timestamp()
  ) then
    return 'processing';
  end if;

  select min(delivery.next_attempt_at) into v_retry_at
  from private.android_push_deliveries delivery
  where delivery.event_id = p_event_id and delivery.status = 'retry_wait';
  if v_retry_at is not null then
    update private.android_push_outbox
    set status = 'queued', available_at = v_retry_at, lease_token = null, leased_until = null,
        updated_at = clock_timestamp()
    where id = p_event_id;
    return 'queued';
  end if;

  update private.android_push_outbox
  set status = 'completed', lease_token = null, leased_until = null, updated_at = clock_timestamp()
  where id = p_event_id;
  v_result := 'completed';
  return v_result;
end;
$$;

revoke all on function public.android_push_claim_events(integer, integer) from public, anon, authenticated;
revoke all on function public.android_push_resolve_event_tokens(uuid, uuid) from public, anon, authenticated;
revoke all on function public.android_push_record_attempt(uuid, uuid, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.android_push_claim_events(integer, integer) to service_role;
grant execute on function public.android_push_resolve_event_tokens(uuid, uuid) to service_role;
grant execute on function public.android_push_record_attempt(uuid, uuid, uuid, text, text, integer) to service_role;

commit;
