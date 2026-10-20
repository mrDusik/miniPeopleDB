-- MiniPeopleDB: schema for Supabase Auth users.
-- Run this script in the Supabase SQL Editor.

create table if not exists public.minifiguras (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  nombre text not null,
  descripcion text,
  categoria text not null,
  subcategoria text,
  anio integer,
  estado_coleccion text not null default 'COLECCIÓN',
  precio_compra numeric(12, 2),
  fecha_compra date,
  precio numeric(12, 2),
  fecha_registro timestamptz not null default now(),
  observada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint minifiguras_id_canonico_check check (id = upper(btrim(id)) and length(btrim(id)) > 0),
  constraint minifiguras_nombre_no_vacio_check check (length(btrim(nombre)) > 0),
  constraint minifiguras_estado_check check (estado_coleccion in ('COLECCIÓN', 'BUSCADA')),
  constraint minifiguras_anio_check check (anio is null or anio between 0 and 9999),
  constraint minifiguras_precio_compra_check check (precio_compra is null or precio_compra >= 0),
  constraint minifiguras_precio_check check (precio is null or precio >= 0)
);

create index if not exists minifiguras_user_id_idx
  on public.minifiguras (user_id);

create index if not exists minifiguras_user_observada_idx
  on public.minifiguras (user_id, observada)
  where observada = true;

create index if not exists minifiguras_user_categoria_idx
  on public.minifiguras (user_id, categoria, subcategoria);

create table if not exists public.gamificacion (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  bricks integer not null default 0,
  nivel jsonb not null default '{}'::jsonb,
  siguiente_nivel jsonb,
  progreso jsonb not null default '{}'::jsonb,
  logros jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gamificacion_bricks_check check (bricks >= 0),
  constraint gamificacion_nivel_object_check check (jsonb_typeof(nivel) = 'object'),
  constraint gamificacion_siguiente_nivel_object_check check (
    siguiente_nivel is null or jsonb_typeof(siguiente_nivel) = 'object'
  ),
  constraint gamificacion_progreso_object_check check (jsonb_typeof(progreso) = 'object'),
  constraint gamificacion_logros_array_check check (jsonb_typeof(logros) = 'array')
);

create table if not exists public.user_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  snapshot_date date not null,
  total_figures integer not null,
  total_value numeric(14, 2) not null,
  bricks integer not null,
  level integer not null,
  pct_collector numeric(5, 2) not null,
  pct_explorer numeric(5, 2) not null,
  pct_rarity_hunter numeric(5, 2) not null,
  pct_fan numeric(5, 2) not null,
  created_at timestamptz not null default now(),
  constraint user_daily_snapshots_total_figures_check check (total_figures >= 0),
  constraint user_daily_snapshots_total_value_check check (total_value >= 0),
  constraint user_daily_snapshots_bricks_check check (bricks >= 0),
  constraint user_daily_snapshots_level_check check (level >= 0),
  constraint user_daily_snapshots_dna_range_check check (
    pct_collector between 0 and 100
    and pct_explorer between 0 and 100
    and pct_rarity_hunter between 0 and 100
    and pct_fan between 0 and 100
  ),
  constraint user_daily_snapshots_dna_sum_check check (
    (pct_collector = 0 and pct_explorer = 0 and pct_rarity_hunter = 0 and pct_fan = 0)
    or abs(pct_collector + pct_explorer + pct_rarity_hunter + pct_fan - 100) <= 0.02
  ),
  constraint user_daily_snapshots_user_date_key unique (user_id, snapshot_date)
);

create index if not exists user_daily_snapshots_user_date_idx
  on public.user_daily_snapshots (user_id, snapshot_date desc);

create table if not exists public.gamificacion_categoria_version (
  singleton boolean primary key default true check (singleton),
  fingerprint text not null default '',
  updated_at timestamptz not null default now(),
  constraint gamificacion_categoria_fingerprint_check check (fingerprint = '' or fingerprint ~ '^[0-9a-f]{64}$')
);

insert into public.gamificacion_categoria_version (singleton, fingerprint)
values (true, '')
on conflict (singleton) do nothing;

alter table public.gamificacion_categoria_version enable row level security;
revoke all on table public.gamificacion_categoria_version from public, anon, authenticated;
grant select on table public.gamificacion_categoria_version to service_role;

create table if not exists public.dna_ponderaciones (
  logro_id text primary key,
  rarity_hunter smallint not null,
  collector smallint not null,
  explorer smallint not null,
  fan smallint not null,
  constraint dna_ponderaciones_pesos_check check (
    rarity_hunter between 0 and 100
    and collector between 0 and 100
    and explorer between 0 and 100
    and fan between 0 and 100
  ),
  constraint dna_ponderaciones_suma_check check (
    (logro_id in ('someone-liked-your-collection', 'thanks-for-the-gift') and rarity_hunter = 0 and collector = 0 and explorer = 0 and fan = 0)
    or (logro_id not in ('someone-liked-your-collection', 'thanks-for-the-gift') and rarity_hunter + collector + explorer + fan = 100)
  )
);

alter table public.dna_ponderaciones
  drop constraint if exists dna_ponderaciones_suma_check;

alter table public.dna_ponderaciones
  add constraint dna_ponderaciones_suma_check check (
    (logro_id in ('someone-liked-your-collection', 'thanks-for-the-gift') and rarity_hunter = 0 and collector = 0 and explorer = 0 and fan = 0)
    or (logro_id not in ('someone-liked-your-collection', 'thanks-for-the-gift') and rarity_hunter + collector + explorer + fan = 100)
  );

insert into public.dna_ponderaciones (logro_id, rarity_hunter, collector, explorer, fan)
values
  ('new-mini-person', 0, 80, 10, 10),
  ('woah', 50, 20, 10, 20),
  ('deal-master', 80, 10, 0, 10),
  ('masterpiece', 90, 5, 0, 5),
  ('holy-grail', 80, 10, 0, 10),
  ('omgold', 95, 5, 0, 0),
  ('lets-go', 0, 5, 90, 5),
  ('collector', 5, 90, 0, 5),
  ('step-by-step', 5, 45, 50, 0),
  ('bricky-potter', 0, 10, 20, 70),
  ('bricky-mouse', 0, 10, 20, 70),
  ('its-a-me-mario', 0, 10, 20, 70),
  ('green-hill-zone', 0, 10, 20, 70),
  ('dimensional', 60, 10, 20, 10),
  ('warsie', 0, 10, 20, 70),
  ('in-ny-i-was', 80, 10, 0, 10),
  ('welcome-to-the-upsidedown', 60, 30, 0, 10),
  ('chill-nancy-im-fine', 80, 10, 0, 10),
  ('the-legend', 0, 10, 20, 70),
  ('heh-there-is-another-one-for-you', 0, 10, 20, 70),
  ('change-will-not-come-in-a-single-sunrise', 0, 10, 20, 70),
  ('start-poetry', 0, 10, 20, 70),
  ('mental-breakdown', 90, 5, 0, 5),
  ('the-dark-plastic', 90, 5, 0, 5),
  ('concrete-savanna', 90, 5, 0, 5),
  ('youre-shooting-for-the-stars', 20, 40, 0, 40),
  ('strike', 20, 40, 0, 40),
  ('retired-police', 90, 5, 5, 0),
  ('retired-firefighter', 90, 5, 5, 0),
  ('retired-doctor', 90, 5, 5, 0),
  ('trio-of-senior-citizens', 90, 5, 0, 5),
  ('antiquarian', 80, 10, 0, 10),
  ('to-lay-the-groundwork', 50, 50, 0, 0),
  ('investor', 50, 50, 0, 0),
  ('investment-fund', 50, 50, 0, 0),
  ('almost-millionaire', 50, 50, 0, 0),
  ('weirdo', 100, 0, 0, 0),
  ('hooked', 0, 100, 0, 0),
  ('land-ho', 0, 0, 100, 0),
  ('nerd', 0, 0, 0, 100),
  ('someone-liked-your-collection', 0, 0, 0, 0),
  ('thanks-for-the-gift', 0, 0, 0, 0)
on conflict (logro_id) do update set
  rarity_hunter = excluded.rarity_hunter,
  collector = excluded.collector,
  explorer = excluded.explorer,
  fan = excluded.fan;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.daily_sync_runs (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  status text not null default 'pending',
  phase text not null default 'prices',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  lease_owner uuid,
  lease_expires_at timestamptz,
  total_users integer not null default 0,
  failed_prices integer not null default 0,
  result jsonb,
  error_code text,
  constraint daily_sync_runs_status_check check (status in ('pending', 'running', 'completed', 'failed')),
  constraint daily_sync_runs_phase_check check (phase in ('prices', 'users', 'completed')),
  constraint daily_sync_runs_counts_check check (total_users >= 0 and failed_prices >= 0)
);

create unique index if not exists daily_sync_runs_one_active_idx
  on private.daily_sync_runs ((true))
  where status in ('pending', 'running');

create table if not exists private.daily_sync_users (
  run_id uuid not null references private.daily_sync_runs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  attempts integer not null default 0,
  checkpoint_at timestamptz,
  error_code text,
  updated_at timestamptz not null default now(),
  primary key (run_id, user_id),
  constraint daily_sync_users_status_check check (status in ('pending', 'processing', 'completed', 'failed', 'skipped')),
  constraint daily_sync_users_attempts_check check (attempts >= 0)
);

create index if not exists daily_sync_users_work_idx
  on private.daily_sync_users (run_id, user_id)
  where status in ('pending', 'processing');

create table if not exists private.daily_sync_prices (
  run_id uuid not null references private.daily_sync_runs (id) on delete cascade,
  figure_id text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  price numeric(12, 2),
  failure_code text,
  checkpoint_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (run_id, figure_id),
  constraint daily_sync_prices_id_check check (length(btrim(figure_id)) > 0),
  constraint daily_sync_prices_status_check check (status in ('pending', 'processing', 'completed', 'failed', 'unavailable')),
  constraint daily_sync_prices_attempts_check check (attempts >= 0),
  constraint daily_sync_prices_price_check check (price is null or price >= 0),
  constraint daily_sync_prices_result_check check (
    (status = 'completed' and price is not null and failure_code is null)
    or (status = 'failed' and price is null and failure_code is not null)
    or (status = 'unavailable' and price is null and failure_code = 'PRICE_NOT_KNOWN')
    or status in ('pending', 'processing')
  )
);

create table if not exists private.daily_sync_figure_prices (
  figure_id text primary key,
  price numeric(12, 2) not null,
  fetched_at timestamptz not null,
  constraint daily_sync_figure_prices_id_check check (length(btrim(figure_id)) > 0),
  constraint daily_sync_figure_prices_price_check check (price >= 0)
);

create index if not exists daily_sync_figure_prices_fetched_at_idx
  on private.daily_sync_figure_prices (fetched_at);

insert into private.daily_sync_figure_prices (figure_id, price, fetched_at)
select distinct on (prices.figure_id) prices.figure_id, prices.price, prices.checkpoint_at
from private.daily_sync_prices prices
join private.daily_sync_runs runs on runs.id = prices.run_id
where runs.status = 'completed'
  and prices.status = 'completed'
  and prices.price is not null
order by prices.figure_id, prices.checkpoint_at desc
on conflict (figure_id) do nothing;

create table if not exists public.regalos_enviados (
  donante_id uuid not null references auth.users (id) on delete cascade,
  receptor_id uuid not null references auth.users (id) on delete cascade,
  fecha timestamptz not null default now(),
  primary key (donante_id, receptor_id),
  constraint regalos_enviados_distintos_check check (donante_id <> receptor_id)
);

create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  snapshot_date date,
  gift_donante_id uuid,
  gift_thanked_at timestamptz,
  constraint notificaciones_type_check check (type in (
    'gift_received', 'gift_thanks', 'ranking_entered', 'ranking_exited', 'daily_summary',
    'friend_request', 'friend_request_accepted'
  )),
  constraint notificaciones_payload_object_check check (jsonb_typeof(payload) = 'object'),
  constraint notificaciones_gift_reference_check check (
    (type = 'gift_received' and gift_donante_id is not null)
    or (type <> 'gift_received' and gift_donante_id is null)
  ),
  constraint notificaciones_gift_thanked_check check (type = 'gift_received' or gift_thanked_at is null),
  constraint notificaciones_snapshot_reference_check check (
    (type = 'daily_summary' and snapshot_date is not null)
    or (type <> 'daily_summary' and snapshot_date is null)
  ),
  constraint notificaciones_gift_key unique (id, user_id),
  constraint notificaciones_regalo_fk foreign key (gift_donante_id, user_id)
    references public.regalos_enviados (donante_id, receptor_id) on delete cascade
);

alter table public.notificaciones drop constraint if exists notificaciones_type_check;
alter table public.notificaciones add constraint notificaciones_type_check check (type in (
  'gift_received', 'gift_thanks', 'ranking_entered', 'ranking_exited', 'daily_summary',
  'friend_request', 'friend_request_accepted'
));

create index if not exists notificaciones_user_created_idx
  on public.notificaciones (user_id, created_at desc, id desc);

alter table public.regalos_enviados add column if not exists semana date not null default '0001-01-01';
alter table public.notificaciones add column if not exists gift_semana date not null default '0001-01-01';
alter table public.notificaciones drop constraint if exists notificaciones_regalo_fk;
alter table public.regalos_enviados drop constraint if exists regalos_enviados_pkey;
alter table public.regalos_enviados add primary key (donante_id, receptor_id, semana);
alter table public.notificaciones add constraint notificaciones_regalo_fk
  foreign key (gift_donante_id, user_id, gift_semana)
  references public.regalos_enviados (donante_id, receptor_id, semana) on delete cascade;

create index if not exists notificaciones_user_unread_idx
  on public.notificaciones (user_id)
  where is_read = false;

create unique index if not exists notificaciones_daily_snapshot_key
  on public.notificaciones (user_id, snapshot_date)
  where type = 'daily_summary';

drop index if exists public.notificaciones_gift_received_key;
create unique index notificaciones_gift_received_key
  on public.notificaciones (user_id, gift_donante_id, gift_semana)
  where type = 'gift_received';

create table if not exists public.agradecimientos_regalo (
  gift_notification_id uuid primary key references public.notificaciones (id) on delete cascade,
  thanker_id uuid not null references auth.users (id) on delete cascade,
  donor_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint agradecimientos_regalo_distintos_check check (thanker_id <> donor_id)
);

create table if not exists private.thanks_reward_ownership_migration (
  singleton boolean primary key default true check (singleton),
  applied boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into private.thanks_reward_ownership_migration (singleton, applied)
values (true, false)
on conflict (singleton) do nothing;
alter table private.thanks_reward_ownership_migration enable row level security;
revoke all on table private.thanks_reward_ownership_migration from public, anon, authenticated, service_role;

create table if not exists public.ranking_top10_membership (
  user_id uuid not null references auth.users (id) on delete cascade,
  ranking_type text not null,
  position smallint not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, ranking_type),
  constraint ranking_top10_type_check check (ranking_type in ('global', 'weekly')),
  constraint ranking_top10_position_check check (position between 1 and 10)
);

create index if not exists ranking_top10_position_idx
  on public.ranking_top10_membership (ranking_type, position, user_id);

create table if not exists private.ranking_top10_reconciliation_state (
  singleton boolean primary key default true check (singleton),
  initialized boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into private.ranking_top10_reconciliation_state (singleton, initialized)
values (true, false)
on conflict (singleton) do nothing;

create or replace function public.iniciar_daily_sync(p_price_cache_ttl_hours integer)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_run_id uuid;
  v_snapshot_date date;
  v_status text;
  v_total_users integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_NO_AUTORIZADO';
  end if;
  if p_price_cache_ttl_hours not between 0 and 8760 then
    raise exception using errcode = '22023', message = 'DAILY_SYNC_TTL_INVALIDO';
  end if;

  select id, snapshot_date, status
  into v_run_id, v_snapshot_date, v_status
  from private.daily_sync_runs
  where status in ('pending', 'running')
  order by created_at
  limit 1
  for update;

  if v_run_id is not null then
    return jsonb_build_object('jobId', v_run_id, 'status', v_status, 'snapshotDate', v_snapshot_date);
  end if;

  v_snapshot_date := (clock_timestamp() at time zone 'Europe/Madrid')::date;
  begin
    insert into private.daily_sync_runs (snapshot_date, status, phase)
    values (v_snapshot_date, 'pending', 'prices')
    returning id into v_run_id;
  exception when unique_violation then
    select id, snapshot_date, status
    into v_run_id, v_snapshot_date, v_status
    from private.daily_sync_runs
    where status in ('pending', 'running')
    order by created_at
    limit 1;
    return jsonb_build_object('jobId', v_run_id, 'status', v_status, 'snapshotDate', v_snapshot_date);
  end;

  insert into private.daily_sync_users (run_id, user_id)
  select v_run_id, users.id
  from auth.users users;

  get diagnostics v_total_users = row_count;
  update private.daily_sync_runs set total_users = v_total_users where id = v_run_id;

  insert into private.daily_sync_prices (
    run_id, figure_id, status, price, checkpoint_at
  )
  select distinct
    v_run_id,
    figures.id,
    case when p_price_cache_ttl_hours > 0 and cache.fetched_at >= clock_timestamp() - make_interval(hours => p_price_cache_ttl_hours) then 'completed' else 'pending' end,
    case when p_price_cache_ttl_hours > 0 and cache.fetched_at >= clock_timestamp() - make_interval(hours => p_price_cache_ttl_hours) then cache.price else null end,
    case when p_price_cache_ttl_hours > 0 and cache.fetched_at >= clock_timestamp() - make_interval(hours => p_price_cache_ttl_hours) then cache.fetched_at else null end
  from public.minifiguras figures
  join private.daily_sync_users work_users
    on work_users.run_id = v_run_id and work_users.user_id = figures.user_id
  left join private.daily_sync_figure_prices cache
    on cache.figure_id = figures.id;

  update public.minifiguras figures
  set precio = work.price, updated_at = clock_timestamp()
  from private.daily_sync_prices work
  join private.daily_sync_users work_users
    on work_users.run_id = work.run_id
  where work.run_id = v_run_id
    and work.status = 'completed'
    and figures.user_id = work_users.user_id
    and figures.id = work.figure_id
    and figures.precio is distinct from work.price;

  return jsonb_build_object(
    'jobId', v_run_id,
    'status', 'pending',
    'snapshotDate', v_snapshot_date
  );
end;
$$;

create or replace function public.consultar_daily_sync(p_run_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_run private.daily_sync_runs%rowtype;
  v_processed_users integer;
  v_total_users integer;
  v_failed_prices integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_NO_AUTORIZADO';
  end if;

  select * into v_run from private.daily_sync_runs where id = p_run_id;
  if not found then
    return null;
  end if;

  select count(*) filter (where status = 'completed')::integer,
    count(*)::integer
  into v_processed_users, v_total_users
  from private.daily_sync_users
  where run_id = p_run_id;

  select count(*)::integer into v_failed_prices
  from private.daily_sync_prices
  where run_id = p_run_id and status = 'failed';

  return jsonb_build_object(
    'jobId', v_run.id,
    'status', v_run.status,
    'snapshotDate', v_run.snapshot_date,
    'processedUsers', coalesce(v_processed_users, 0),
    'totalUsers', coalesce(v_total_users, 0),
    'failedPrices', coalesce(v_failed_prices, 0),
    'result', v_run.result,
    'errorCode', v_run.error_code
  );
end;
$$;

create or replace function public.iniciar_daily_sync()
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
  select public.iniciar_daily_sync(24);
$$;

create or replace function public.recuperar_daily_sync()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_run_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_NO_AUTORIZADO';
  end if;

  select runs.id into v_run_id
  from private.daily_sync_runs runs
  where runs.status in ('pending', 'running')
  order by runs.created_at
  limit 1;
  if v_run_id is null then return null; end if;
  return public.consultar_daily_sync(v_run_id);
end;
$$;

create or replace function public.reclamar_daily_sync(p_run_id uuid, p_lease_owner uuid, p_lease_seconds integer default 120)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_run private.daily_sync_runs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_NO_AUTORIZADO';
  end if;
  if p_lease_owner is null or p_lease_seconds not between 15 and 600 then
    raise exception using errcode = '22023', message = 'DAILY_SYNC_LEASE_INVALIDO';
  end if;

  select * into v_run from private.daily_sync_runs where id = p_run_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'DAILY_SYNC_NO_ENCONTRADO';
  end if;
  if v_run.status not in ('pending', 'running') then
    return false;
  end if;
  if v_run.lease_expires_at > clock_timestamp() and v_run.lease_owner is distinct from p_lease_owner then
    return false;
  end if;

  update private.daily_sync_runs
  set status = 'running',
      started_at = coalesce(started_at, clock_timestamp()),
      lease_owner = p_lease_owner,
      lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      updated_at = clock_timestamp()
  where id = p_run_id;
  return true;
end;
$$;

create or replace function public.renovar_daily_sync(p_run_id uuid, p_lease_owner uuid, p_lease_seconds integer default 120)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_NO_AUTORIZADO';
  end if;
  if p_lease_owner is null or p_lease_seconds not between 15 and 600 then
    raise exception using errcode = '22023', message = 'DAILY_SYNC_LEASE_INVALIDO';
  end if;

  update private.daily_sync_runs
  set lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      updated_at = clock_timestamp()
  where id = p_run_id
    and status = 'running'
    and lease_owner = p_lease_owner
    and lease_expires_at > clock_timestamp();
  return found;
end;
$$;

create or replace function public.leer_daily_sync_usuarios(
  p_run_id uuid, p_lease_owner uuid, p_after_user_id uuid default null, p_limit integer default 1000
)
returns table (user_id uuid, status text, attempts integer)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_NO_AUTORIZADO';
  end if;
  if p_limit not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'DAILY_SYNC_PAGINA_INVALIDA';
  end if;
  if not exists (
    select 1 from private.daily_sync_runs
    where daily_sync_runs.id = p_run_id and daily_sync_runs.status = 'running'
      and daily_sync_runs.lease_owner = p_lease_owner
      and daily_sync_runs.lease_expires_at > clock_timestamp()
  ) then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_LEASE_CADUCADO';
  end if;

  return query
  select work.user_id, work.status, work.attempts
  from private.daily_sync_users work
  where work.run_id = p_run_id
    and work.status in ('pending', 'processing')
    and (p_after_user_id is null or work.user_id > p_after_user_id)
  order by work.user_id
  limit p_limit;
end;
$$;

create or replace function public.leer_daily_sync_precios(
  p_run_id uuid, p_lease_owner uuid, p_after_figure_id text default null, p_limit integer default 1000
)
returns table (figure_id text, status text, attempts integer)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_NO_AUTORIZADO';
  end if;
  if p_limit not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'DAILY_SYNC_PAGINA_INVALIDA';
  end if;
  if not exists (
    select 1 from private.daily_sync_runs
    where daily_sync_runs.id = p_run_id and daily_sync_runs.status = 'running'
      and daily_sync_runs.lease_owner = p_lease_owner
      and daily_sync_runs.lease_expires_at > clock_timestamp()
  ) then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_LEASE_CADUCADO';
  end if;

  return query
  select work.figure_id, work.status, work.attempts
  from private.daily_sync_prices work
  where work.run_id = p_run_id
    and work.status in ('pending', 'processing')
    and (p_after_figure_id is null or work.figure_id > p_after_figure_id)
  order by work.figure_id
  limit p_limit;
end;
$$;

create or replace function public.aplicar_daily_sync_precio(
  p_run_id uuid,
  p_lease_owner uuid,
  p_figure_id text,
  p_success boolean,
  p_price numeric default null,
  p_failure_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_run private.daily_sync_runs%rowtype;
  v_work private.daily_sync_prices%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_NO_AUTORIZADO';
  end if;
  if p_figure_id is null or length(btrim(p_figure_id)) = 0 or p_success is null then
    raise exception using errcode = '22023', message = 'DAILY_SYNC_PRECIO_INVALIDO';
  end if;

  select * into v_run from private.daily_sync_runs where id = p_run_id for update;
  if not found or v_run.status <> 'running' or v_run.lease_owner is distinct from p_lease_owner
    or v_run.lease_expires_at <= clock_timestamp() then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_LEASE_CADUCADO';
  end if;

  select * into v_work
  from private.daily_sync_prices
  where run_id = p_run_id and figure_id = p_figure_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'DAILY_SYNC_ID_NO_INCLUIDO';
  end if;
  if v_work.status in ('completed', 'unavailable') then
    return true;
  end if;

  if p_success then
    if p_price is null or p_price::text = 'NaN' or p_price < 0 or p_price > 9999999999.99 or p_failure_code is not null then
      raise exception using errcode = '22023', message = 'DAILY_SYNC_PRECIO_INVALIDO';
    end if;
    insert into private.daily_sync_figure_prices (figure_id, price, fetched_at)
    values (p_figure_id, p_price, clock_timestamp())
    on conflict (figure_id) do update set
      price = excluded.price,
      fetched_at = excluded.fetched_at;
    update public.minifiguras figures
    set precio = p_price, updated_at = clock_timestamp()
    where figures.id = p_figure_id
      and exists (
        select 1 from private.daily_sync_users work_users
        where work_users.run_id = p_run_id and work_users.user_id = figures.user_id
      );
    update private.daily_sync_prices
    set status = 'completed', price = p_price, failure_code = null,
        attempts = attempts + 1, checkpoint_at = clock_timestamp(), updated_at = clock_timestamp()
    where run_id = p_run_id and figure_id = p_figure_id;
  else
    if p_price is not null or p_failure_code is null then
      raise exception using errcode = '22023', message = 'DAILY_SYNC_PRECIO_INVALIDO';
    end if;
    if p_failure_code = 'PRICE_NOT_KNOWN' then
      update private.daily_sync_prices
      set status = 'unavailable', price = null, failure_code = p_failure_code,
          attempts = attempts + 1, checkpoint_at = clock_timestamp(), updated_at = clock_timestamp()
      where run_id = p_run_id and figure_id = p_figure_id;
    else
      if p_failure_code not in ('SCRAPER_ERROR', 'TIMEOUT', 'RATE_LIMIT', 'INVALID_RESPONSE') then
        raise exception using errcode = '22023', message = 'DAILY_SYNC_PRECIO_INVALIDO';
      end if;
      update private.daily_sync_prices
      set status = 'failed', price = null, failure_code = p_failure_code,
          attempts = attempts + 1, checkpoint_at = clock_timestamp(), updated_at = clock_timestamp()
      where run_id = p_run_id and figure_id = p_figure_id;
      update private.daily_sync_runs
      set failed_prices = (
        select count(*)::integer from private.daily_sync_prices
        where run_id = p_run_id and status = 'failed'
      ), updated_at = clock_timestamp()
      where id = p_run_id;
    end if;
  end if;
  return true;
end;
$$;

create or replace function private.daily_sync_user_revision(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
  select md5(jsonb_build_object(
    'figures', coalesce((
      select jsonb_agg(jsonb_build_array(
        figures.id, figures.nombre, figures.descripcion, figures.categoria, figures.subcategoria,
        figures.anio, figures.estado_coleccion, figures.precio_compra, figures.fecha_compra,
        figures.precio, figures.fecha_registro, figures.observada
      ) order by figures.id)
      from public.minifiguras figures where figures.user_id = p_user_id
    ), '[]'::jsonb),
    'gifts', coalesce((
      select jsonb_agg(jsonb_build_array(gifts.donante_id, gifts.fecha) order by gifts.donante_id)
      from public.regalos_enviados gifts where gifts.receptor_id = p_user_id
    ), '[]'::jsonb),
    'thanks', coalesce((
      select jsonb_agg(jsonb_build_array(
        thanks.gift_notification_id, thanks.thanker_id, thanks.donor_id, thanks.created_at
      ) order by thanks.gift_notification_id)
      from public.agradecimientos_regalo thanks
      where thanks.thanker_id = p_user_id or thanks.donor_id = p_user_id
    ), '[]'::jsonb),
    'fingerprint', coalesce((
      select version.fingerprint from public.gamificacion_categoria_version version where version.singleton = true
    ), '')
  )::text)
$$;

create or replace function public.leer_daily_sync_fuentes(p_run_id uuid, p_lease_owner uuid, p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_figures jsonb;
  v_gifts_received integer;
  v_weekly_gifts_received integer;
  v_thanks_sent integer;
  v_thanks_received integer;
  v_fingerprint text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_NO_AUTORIZADO';
  end if;
  if not exists (
    select 1 from private.daily_sync_runs runs
    where runs.id = p_run_id and runs.status = 'running' and runs.lease_owner = p_lease_owner
      and runs.lease_expires_at > clock_timestamp()
  ) or not exists (
    select 1 from private.daily_sync_users work
    where work.run_id = p_run_id and work.user_id = p_user_id
  ) then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_LEASE_CADUCADO';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', figures.id,
    'categoria', figures.categoria,
    'subcategoria', figures.subcategoria,
    'anio', figures.anio,
    'estadoColeccion', figures.estado_coleccion,
    'precio', figures.precio,
    'precioCompra', figures.precio_compra
  ) order by figures.id), '[]'::jsonb)
  into v_figures
  from public.minifiguras figures
  where figures.user_id = p_user_id;

  select count(*) filter (where gifts.semana = '0001-01-01')::integer,
    count(*) filter (where gifts.semana <> '0001-01-01')::integer
  into v_gifts_received, v_weekly_gifts_received
  from public.regalos_enviados gifts where gifts.receptor_id = p_user_id;
  select count(*) filter (where thanks.thanker_id = p_user_id)::integer,
    count(*) filter (where thanks.donor_id = p_user_id)::integer
  into v_thanks_sent, v_thanks_received
  from public.agradecimientos_regalo thanks
  where thanks.thanker_id = p_user_id or thanks.donor_id = p_user_id;
  select version.fingerprint into v_fingerprint
  from public.gamificacion_categoria_version version where version.singleton = true;

  return jsonb_build_object(
    'revision', private.daily_sync_user_revision(p_user_id),
    'figures', v_figures,
    'giftsReceived', coalesce(v_gifts_received, 0),
    'weeklyGiftsReceived', coalesce(v_weekly_gifts_received, 0),
    'thanksSent', coalesce(v_thanks_sent, 0),
    'thanksReceived', coalesce(v_thanks_received, 0),
    'fingerprint', coalesce(v_fingerprint, '')
  );
end;
$$;

create or replace function public.capturar_daily_sync_usuario(
  p_run_id uuid,
  p_lease_owner uuid,
  p_user_id uuid,
  p_expected_revision text,
  p_state jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_run private.daily_sync_runs%rowtype;
  v_work private.daily_sync_users%rowtype;
  v_revision text;
  v_dna jsonb;
  v_total_figures integer;
  v_total_value numeric(14, 2);
  v_level integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_NO_AUTORIZADO';
  end if;

  select * into v_run from private.daily_sync_runs where id = p_run_id for update;
  if not found or v_run.status <> 'running' or v_run.lease_owner is distinct from p_lease_owner
    or v_run.lease_expires_at <= clock_timestamp() then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_LEASE_CADUCADO';
  end if;
  select * into v_work
  from private.daily_sync_users
  where run_id = p_run_id and user_id = p_user_id
  for update;
  if not found then
    return false;
  end if;
  if v_work.status = 'completed' then
    return true;
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object'
    or jsonb_typeof(p_state->'nivel') <> 'object'
    or jsonb_typeof(p_state->'logros') <> 'array'
    or jsonb_typeof(p_state->'progreso') <> 'object'
    or (p_state->'siguiente_nivel' is not null and jsonb_typeof(p_state->'siguiente_nivel') not in ('object', 'null')) then
    raise exception using errcode = '22023', message = 'DAILY_SYNC_ESTADO_INVALIDO';
  end if;
  if (p_state->>'bricks') !~ '^[0-9]+$'
    or (p_state->'nivel'->>'id') !~ '^[0-9]+$' then
    raise exception using errcode = '22023', message = 'DAILY_SYNC_ESTADO_INVALIDO';
  end if;
  v_level := (p_state->'nivel'->>'id')::integer;

  perform 1 from public.gamificacion_categoria_version where singleton = true for share;
  perform 1 from public.gamificacion where user_id = p_user_id for update;
  lock table public.minifiguras, public.regalos_enviados in share mode;
  v_revision := private.daily_sync_user_revision(p_user_id);
  if v_revision is distinct from p_expected_revision then
    return false;
  end if;

  select count(*)::integer,
    coalesce(sum(case
      when precio is not null then precio
      when precio_compra is not null then precio_compra
      else 0
    end), 0)::numeric(14, 2)
  into v_total_figures, v_total_value
  from public.minifiguras
  where user_id = p_user_id and estado_coleccion = 'COLECCIÓN';

  insert into public.gamificacion (
    user_id, bricks, nivel, siguiente_nivel, progreso, logros, updated_at
  ) values (
    p_user_id,
    (p_state->>'bricks')::integer,
    p_state->'nivel',
    case when p_state->'siguiente_nivel' is null or p_state->'siguiente_nivel' = 'null'::jsonb then null else p_state->'siguiente_nivel' end,
    p_state->'progreso',
    p_state->'logros',
    clock_timestamp()
  ) on conflict (user_id) do update set
    bricks = excluded.bricks,
    nivel = excluded.nivel,
    siguiente_nivel = excluded.siguiente_nivel,
    progreso = excluded.progreso,
    logros = excluded.logros,
    updated_at = excluded.updated_at;

  v_dna := private.dna_calcular(p_user_id);
  insert into public.user_daily_snapshots (
    user_id, snapshot_date, total_figures, total_value, bricks, level,
    pct_collector, pct_explorer, pct_rarity_hunter, pct_fan
  ) values (
    p_user_id, v_run.snapshot_date, v_total_figures, v_total_value,
    (p_state->>'bricks')::integer, v_level,
    round((v_dna->'porcentajes'->>'collector')::numeric, 2),
    round((v_dna->'porcentajes'->>'explorer')::numeric, 2),
    round((v_dna->'porcentajes'->>'rarityHunter')::numeric, 2),
    round((v_dna->'porcentajes'->>'fan')::numeric, 2)
  ) on conflict (user_id, snapshot_date) do update set
    total_figures = excluded.total_figures,
    total_value = excluded.total_value,
    bricks = excluded.bricks,
    level = excluded.level,
    pct_collector = excluded.pct_collector,
    pct_explorer = excluded.pct_explorer,
    pct_rarity_hunter = excluded.pct_rarity_hunter,
    pct_fan = excluded.pct_fan;

  update private.daily_sync_users
  set status = 'completed', attempts = attempts + 1,
      checkpoint_at = clock_timestamp(), error_code = null, updated_at = clock_timestamp()
  where run_id = p_run_id and user_id = p_user_id;
  return true;
end;
$$;

create or replace function public.fallar_daily_sync_usuario(
  p_run_id uuid, p_lease_owner uuid, p_user_id uuid, p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_run private.daily_sync_runs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_NO_AUTORIZADO';
  end if;
  if p_error_code is null or p_error_code not in ('CAPTURA_FALLIDA', 'MAX_RETRIES', 'FUENTES_INVALIDAS') then
    raise exception using errcode = '22023', message = 'DAILY_SYNC_ERROR_INVALIDO';
  end if;

  select * into v_run from private.daily_sync_runs where id = p_run_id for update;
  if not found or v_run.status <> 'running' or v_run.lease_owner is distinct from p_lease_owner
    or v_run.lease_expires_at <= clock_timestamp() then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_LEASE_CADUCADO';
  end if;

  update private.daily_sync_users
  set status = 'failed', attempts = attempts + 1, checkpoint_at = clock_timestamp(),
      error_code = p_error_code, updated_at = clock_timestamp()
  where run_id = p_run_id and user_id = p_user_id and status <> 'completed';
  return found;
end;
$$;

create or replace function private.ranking_semanal_contexto(p_instante timestamptz)
returns table (
  available boolean,
  available_from date,
  reference_date date,
  week_start date,
  week_end date
)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  with fecha_local as (
    select (p_instante at time zone 'Europe/Madrid')::date as fecha
  )
  select
    fecha >= date '2026-10-12',
    date '2026-10-12',
    fecha,
    fecha - (extract(isodow from fecha)::integer - 1),
    fecha - (extract(isodow from fecha)::integer - 1) + 6
  from fecha_local;
$$;

create or replace function private.daily_sync_weekly_membership(p_snapshot_date date)
returns table (user_id uuid, rank_position smallint)
language sql
stable
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
  with context as (
    select * from private.ranking_semanal_contexto(
      ((p_snapshot_date + 1)::timestamp at time zone 'Europe/Madrid') - interval '1 microsecond'
    )
  ), baselines as (
    select snapshot.user_id, snapshot.bricks
    from public.user_daily_snapshots snapshot
    cross join context
    where snapshot.snapshot_date = context.week_start - 1
  ), latest as (
    select distinct on (snapshot.user_id) snapshot.user_id, snapshot.bricks
    from public.user_daily_snapshots snapshot
    cross join context
    where snapshot.snapshot_date between context.week_start and least(context.week_end, context.reference_date)
    order by snapshot.user_id, snapshot.snapshot_date desc
  ), ranked as (
    select latest.user_id,
      row_number() over (order by latest.bricks - baselines.bricks desc, latest.user_id) as rank_position
    from latest
    join baselines using (user_id)
    join public.gamificacion using (user_id)
  )
  select ranked.user_id, ranked.rank_position::smallint
  from ranked cross join context
  where context.available and ranked.rank_position <= 10
  order by ranked.rank_position;
$$;

create or replace function public.finalizar_daily_sync(p_run_id uuid, p_lease_owner uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_run private.daily_sync_runs%rowtype;
  v_processed_users integer;
  v_total_users integer;
  v_failed_prices integer;
  v_failed_users integer;
  v_result jsonb;
  v_has_weekly_baseline boolean;
  v_weekly_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_NO_AUTORIZADO';
  end if;

  select * into v_run from private.daily_sync_runs where id = p_run_id for update;
  if not found or v_run.status <> 'running' or v_run.lease_owner is distinct from p_lease_owner
    or v_run.lease_expires_at <= clock_timestamp() then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_LEASE_CADUCADO';
  end if;
  if exists (
    select 1 from private.daily_sync_users
    where run_id = p_run_id and status in ('pending', 'processing')
  ) or exists (
    select 1 from private.daily_sync_prices
    where run_id = p_run_id and status in ('pending', 'processing')
  ) then
    raise exception using errcode = 'P0001', message = 'DAILY_SYNC_TRABAJO_INCOMPLETO';
  end if;

  select count(*) filter (where status = 'completed')::integer,
    count(*)::integer,
    count(*) filter (where status = 'failed')::integer
  into v_processed_users, v_total_users, v_failed_users
  from private.daily_sync_users where run_id = p_run_id;
  select count(*) filter (where status = 'failed')::integer
  into v_failed_prices
  from private.daily_sync_prices where run_id = p_run_id;

  if v_failed_users > 0 then
    update private.daily_sync_runs
    set status = 'failed', phase = 'completed', completed_at = clock_timestamp(),
        lease_owner = null, lease_expires_at = null, result = null,
        error_code = 'USERS_FAILED', total_users = v_total_users,
        failed_prices = v_failed_prices, updated_at = clock_timestamp()
    where id = p_run_id;
    return public.consultar_daily_sync(p_run_id);
  end if;

  with snapshots_to_publish as (
    select current_snapshot.user_id, current_snapshot.snapshot_date,
      current_snapshot.total_figures, current_snapshot.total_value, current_snapshot.bricks,
      current_snapshot.level, current_snapshot.pct_collector, current_snapshot.pct_explorer,
      current_snapshot.pct_rarity_hunter, current_snapshot.pct_fan,
      previous_snapshot.id as previous_id,
      previous_snapshot.snapshot_date as previous_snapshot_date,
      previous_snapshot.total_figures as previous_total_figures,
      previous_snapshot.total_value as previous_total_value,
      previous_snapshot.bricks as previous_bricks,
      previous_snapshot.level as previous_level,
      previous_snapshot.pct_collector as previous_pct_collector,
      previous_snapshot.pct_explorer as previous_pct_explorer,
      previous_snapshot.pct_rarity_hunter as previous_pct_rarity_hunter,
      previous_snapshot.pct_fan as previous_pct_fan
    from public.user_daily_snapshots current_snapshot
    join private.daily_sync_users work
      on work.user_id = current_snapshot.user_id and work.run_id = p_run_id and work.status = 'completed'
    left join lateral (
      select previous.*
      from public.user_daily_snapshots previous
      where previous.user_id = current_snapshot.user_id
        and previous.snapshot_date < current_snapshot.snapshot_date
      order by previous.snapshot_date desc
      limit 1
    ) previous_snapshot on true
    where current_snapshot.snapshot_date = v_run.snapshot_date
  ), comparison_dates as (
    select snapshot_date from snapshots_to_publish
    union
    select previous_snapshot_date from snapshots_to_publish where previous_snapshot_date is not null
  ), global_positions as (
    select ranked.snapshot_date, ranked.user_id, ranked.rank_position::smallint as rank_position
    from (
      select snapshot.snapshot_date, snapshot.user_id,
        row_number() over (
          partition by snapshot.snapshot_date
          order by snapshot.level desc, snapshot.bricks desc, snapshot.user_id asc
        ) as rank_position
      from public.user_daily_snapshots snapshot
      where snapshot.snapshot_date in (select snapshot_date from comparison_dates)
    ) ranked
    where ranked.rank_position <= 10
  ), weekly_positions as (
    select dates.snapshot_date, members.user_id, members.rank_position
    from comparison_dates dates
    cross join lateral private.daily_sync_weekly_membership(dates.snapshot_date) members
  )
  insert into public.notificaciones (user_id, type, payload, snapshot_date)
  select current.user_id,
    'daily_summary',
    jsonb_build_object(
      'snapshotDate', current.snapshot_date,
      'hasPrevious', current.previous_id is not null
    ) || case when current.previous_id is null then '{}'::jsonb else jsonb_build_object(
      'deltas', jsonb_build_object(
        'figures', current.total_figures - current.previous_total_figures,
        'valueEur', current.total_value - current.previous_total_value,
        'bricks', current.bricks - current.previous_bricks,
        'level', current.level - current.previous_level,
        'dna', jsonb_build_object(
          'collector', current.pct_collector - current.previous_pct_collector,
          'explorer', current.pct_explorer - current.previous_pct_explorer,
          'rarityHunter', current.pct_rarity_hunter - current.previous_pct_rarity_hunter,
          'fan', current.pct_fan - current.previous_pct_fan
        )
      )
      || case when current_global.rank_position is not null and previous_global.rank_position is not null
        then jsonb_build_object('globalPosition', previous_global.rank_position - current_global.rank_position)
        else '{}'::jsonb end
      || case when current_weekly.rank_position is not null and previous_weekly.rank_position is not null
        then jsonb_build_object('weeklyPosition', previous_weekly.rank_position - current_weekly.rank_position)
        else '{}'::jsonb end
    ) end,
    current.snapshot_date
  from snapshots_to_publish current
  left join global_positions current_global
    on current_global.user_id = current.user_id and current_global.snapshot_date = current.snapshot_date
  left join global_positions previous_global
    on previous_global.user_id = current.user_id and previous_global.snapshot_date = current.previous_snapshot_date
  left join weekly_positions current_weekly
    on current_weekly.user_id = current.user_id and current_weekly.snapshot_date = current.snapshot_date
  left join weekly_positions previous_weekly
    on previous_weekly.user_id = current.user_id and previous_weekly.snapshot_date = current.previous_snapshot_date
  on conflict (user_id, snapshot_date) where type = 'daily_summary'
  do update set payload = excluded.payload;

  select exists (
    select 1 from public.ranking_top10_membership where ranking_type = 'weekly'
  ) into v_has_weekly_baseline;
  select count(*)::integer into v_weekly_count
  from private.daily_sync_weekly_membership(v_run.snapshot_date);
  if v_weekly_count > 0 then
    if v_has_weekly_baseline then
      insert into public.notificaciones (user_id, type, payload)
      select current_members.user_id, 'ranking_entered', jsonb_build_object(
        'ranking', 'weekly', 'position', current_members.rank_position,
        'message', 'Has entrado en el Top 10 del Ranking Semanal en el puesto ' || current_members.rank_position || '.'
      )
      from private.daily_sync_weekly_membership(v_run.snapshot_date) current_members
      left join public.ranking_top10_membership previous_members
        on previous_members.user_id = current_members.user_id and previous_members.ranking_type = 'weekly'
      where previous_members.user_id is null;

      insert into public.notificaciones (user_id, type, payload)
      select previous_members.user_id, 'ranking_exited', jsonb_build_object(
        'ranking', 'weekly',
        'message', 'Has salido del Top 10 del Ranking Semanal.'
      )
      from public.ranking_top10_membership previous_members
      left join private.daily_sync_weekly_membership(v_run.snapshot_date) current_members
        on current_members.user_id = previous_members.user_id
      where previous_members.ranking_type = 'weekly' and current_members.user_id is null;
    end if;

    delete from public.ranking_top10_membership where ranking_type = 'weekly';
    insert into public.ranking_top10_membership (user_id, ranking_type, position, updated_at)
    select user_id, 'weekly', rank_position, clock_timestamp()
    from private.daily_sync_weekly_membership(v_run.snapshot_date)
    on conflict (user_id, ranking_type) do update set
      position = excluded.position,
      updated_at = excluded.updated_at;
  end if;

  v_result := jsonb_build_object(
    'success', true,
    'processedUsers', coalesce(v_processed_users, 0),
    'timestamp', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
  update private.daily_sync_runs
  set status = 'completed', phase = 'completed', completed_at = clock_timestamp(),
      lease_owner = null, lease_expires_at = null, result = v_result,
      error_code = null, total_users = coalesce(v_total_users, 0),
      failed_prices = coalesce(v_failed_prices, 0), updated_at = clock_timestamp()
  where id = p_run_id;
  return public.consultar_daily_sync(p_run_id);
end;
$$;

create or replace function public.fallar_daily_sync(p_run_id uuid, p_lease_owner uuid, p_error_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_run private.daily_sync_runs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_NO_AUTORIZADO';
  end if;
  if p_error_code is null or p_error_code not in ('WORKER_ERROR', 'MAX_RETRIES', 'STORAGE_ERROR', 'CONFIGURATION_ERROR') then
    raise exception using errcode = '22023', message = 'DAILY_SYNC_ERROR_INVALIDO';
  end if;

  select * into v_run from private.daily_sync_runs where id = p_run_id for update;
  if not found or v_run.status <> 'running' or v_run.lease_owner is distinct from p_lease_owner
    or v_run.lease_expires_at <= clock_timestamp() then
    raise exception using errcode = '42501', message = 'DAILY_SYNC_LEASE_CADUCADO';
  end if;
  update private.daily_sync_runs
  set status = 'failed', phase = 'completed', completed_at = clock_timestamp(),
      lease_owner = null, lease_expires_at = null, result = null,
      error_code = p_error_code, updated_at = clock_timestamp()
  where id = p_run_id;
  return public.consultar_daily_sync(p_run_id);
end;
$$;

revoke all on function public.iniciar_daily_sync(integer) from public, anon, authenticated;
revoke all on function public.iniciar_daily_sync() from public, anon, authenticated;
revoke all on function public.consultar_daily_sync(uuid) from public, anon, authenticated;
revoke all on function public.recuperar_daily_sync() from public, anon, authenticated;
revoke all on function public.reclamar_daily_sync(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.renovar_daily_sync(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.leer_daily_sync_usuarios(uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.leer_daily_sync_precios(uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.aplicar_daily_sync_precio(uuid, uuid, text, boolean, numeric, text) from public, anon, authenticated;
revoke all on function private.daily_sync_user_revision(uuid) from public, anon, authenticated;
revoke all on function public.leer_daily_sync_fuentes(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.capturar_daily_sync_usuario(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.fallar_daily_sync_usuario(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.finalizar_daily_sync(uuid, uuid) from public, anon, authenticated;
revoke all on function private.daily_sync_weekly_membership(date) from public, anon, authenticated;
revoke all on function public.fallar_daily_sync(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.iniciar_daily_sync(integer) to service_role;
grant execute on function public.iniciar_daily_sync() to service_role;
grant execute on function public.consultar_daily_sync(uuid) to service_role;
grant execute on function public.recuperar_daily_sync() to service_role;
grant execute on function public.reclamar_daily_sync(uuid, uuid, integer) to service_role;
grant execute on function public.renovar_daily_sync(uuid, uuid, integer) to service_role;
grant execute on function public.leer_daily_sync_usuarios(uuid, uuid, uuid, integer) to service_role;
grant execute on function public.leer_daily_sync_precios(uuid, uuid, text, integer) to service_role;
grant execute on function public.aplicar_daily_sync_precio(uuid, uuid, text, boolean, numeric, text) to service_role;
grant execute on function public.leer_daily_sync_fuentes(uuid, uuid, uuid) to service_role;
grant execute on function public.capturar_daily_sync_usuario(uuid, uuid, uuid, text, jsonb) to service_role;
grant execute on function public.fallar_daily_sync_usuario(uuid, uuid, uuid, text) to service_role;
grant execute on function public.finalizar_daily_sync(uuid, uuid) to service_role;
grant execute on function public.fallar_daily_sync(uuid, uuid, text) to service_role;

create or replace function private.dna_calcular(p_usuario_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
  with weighted as (
    select
      case
        when jsonb_typeof(achievement.item->'cantidad') = 'number'
          and (achievement.item->>'cantidad')::numeric > 0
        then (achievement.item->>'cantidad')::numeric * weights.rarity_hunter::numeric
        else 0::numeric
      end as rarity_hunter,
      case
        when jsonb_typeof(achievement.item->'cantidad') = 'number'
          and (achievement.item->>'cantidad')::numeric > 0
        then (achievement.item->>'cantidad')::numeric * weights.collector::numeric
        else 0::numeric
      end as collector,
      case
        when jsonb_typeof(achievement.item->'cantidad') = 'number'
          and (achievement.item->>'cantidad')::numeric > 0
        then (achievement.item->>'cantidad')::numeric * weights.explorer::numeric
        else 0::numeric
      end as explorer,
      case
        when jsonb_typeof(achievement.item->'cantidad') = 'number'
          and (achievement.item->>'cantidad')::numeric > 0
        then (achievement.item->>'cantidad')::numeric * weights.fan::numeric
        else 0::numeric
      end as fan
    from public.gamificacion gamification
    cross join lateral jsonb_array_elements(gamification.logros) as achievement(item)
    join public.dna_ponderaciones weights on weights.logro_id = achievement.item->>'id'
    where gamification.user_id = p_usuario_id
      and weights.logro_id <> 'someone-liked-your-collection'
  ), scores as (
    select
      coalesce(sum(rarity_hunter), 0)::numeric as rarity_hunter,
      coalesce(sum(collector), 0)::numeric as collector,
      coalesce(sum(explorer), 0)::numeric as explorer,
      coalesce(sum(fan), 0)::numeric as fan
    from weighted
  ), totals as (
    select *, rarity_hunter + collector + explorer + fan as total
    from scores
  )
  select jsonb_build_object(
    'principal', case
      when total = 0 then 'Newbie'
      when explorer >= collector and explorer >= fan and explorer >= rarity_hunter then 'Explorer'
      when collector >= fan and collector >= rarity_hunter then 'Collector'
      when fan >= rarity_hunter then 'Fan'
      else 'Rarity Hunter'
    end,
    'porcentajes', jsonb_build_object(
      'rarityHunter', case when total = 0 then 0::numeric else rarity_hunter * 100 / total end,
      'explorer', case when total = 0 then 0::numeric else explorer * 100 / total end,
      'collector', case when total = 0 then 0::numeric else collector * 100 / total end,
      'fan', case when total = 0 then 0::numeric else fan * 100 / total end
    )
  )
  from totals;
$$;

create or replace function public.gamificacion_dna()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_usuario_id uuid := auth.uid();
begin
  if v_usuario_id is null then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;
  return private.dna_calcular(v_usuario_id);
end;
$$;

create table if not exists public.perfiles_publicos (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  updated_at timestamptz not null default now(),
  constraint perfiles_publicos_display_name_check check (length(btrim(display_name)) between 1 and 120)
);

create table if not exists public.user_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  username text not null,
  avatar_url text,
  currency text not null default 'EUR',
  language text not null default 'es',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_username_check check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  constraint user_profiles_avatar_url_check check (avatar_url is null or avatar_url ~* '^https?://[^[:space:]]+$'),
  constraint user_profiles_currency_check check (currency in ('EUR')),
  constraint user_profiles_language_check check (language in ('es'))
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  pair_low_id uuid generated always as (least(sender_id, recipient_id)) stored,
  pair_high_id uuid generated always as (greatest(sender_id, recipient_id)) stored,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_requests_distinct_users_check check (sender_id <> recipient_id),
  constraint friend_requests_status_check check (status in ('pending', 'rejected', 'accepted')),
  constraint friend_requests_pair_key unique (pair_low_id, pair_high_id)
);

create index if not exists friend_requests_sender_status_idx
  on public.friend_requests (sender_id, status, created_at desc);
create index if not exists friend_requests_recipient_status_idx
  on public.friend_requests (recipient_id, status, created_at desc);

create table if not exists public.friendships (
  user_low_id uuid not null references auth.users (id) on delete cascade,
  user_high_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_low_id, user_high_id),
  constraint friendships_ordered_pair_check check (user_low_id < user_high_id)
);

create index if not exists friendships_high_user_idx on public.friendships (user_high_id, user_low_id);

alter table public.notificaciones add column if not exists social_request_id uuid;
alter table public.notificaciones add column if not exists social_request_accepted boolean not null default false;
alter table public.notificaciones drop constraint if exists notificaciones_social_reference_check;
alter table public.notificaciones add constraint notificaciones_social_reference_check check (
  (type in ('friend_request', 'friend_request_accepted') and social_request_id is not null)
  or (type not in ('friend_request', 'friend_request_accepted') and social_request_id is null)
);
alter table public.notificaciones drop constraint if exists notificaciones_social_payload_check;
alter table public.notificaciones add constraint notificaciones_social_payload_check check (
  type not in ('friend_request', 'friend_request_accepted')
  or (payload ? 'user' and jsonb_typeof(payload->'user') = 'string'
    and length(btrim(payload->>'user')) between 3 and 20 and payload - 'user' = '{}'::jsonb)
);
alter table public.notificaciones drop constraint if exists notificaciones_social_accepted_check;
alter table public.notificaciones add constraint notificaciones_social_accepted_check check (
  type = 'friend_request' or social_request_accepted = false
);
alter table public.notificaciones drop constraint if exists notificaciones_social_request_fk;
alter table public.notificaciones add constraint notificaciones_social_request_fk
  foreign key (social_request_id) references public.friend_requests (id) on delete cascade;
create unique index if not exists notificaciones_social_event_key
  on public.notificaciones (user_id, type, social_request_id)
  where social_request_id is not null;

do $$
declare
  legacy_profile record;
  candidate_username text;
  candidate_suffix integer;
begin
  lock table public.user_profiles in share row exclusive mode;
  for legacy_profile in
    select user_id, avatar_url
    from public.user_profiles
    where not onboarding_completed and username = 'Coleccionista'
    order by created_at asc, user_id asc
    for update
  loop
    candidate_suffix := 1;
    loop
      candidate_username := 'Coleccionista' || candidate_suffix::text;
      exit when not exists (
        select 1 from public.user_profiles profile
        where lower(profile.username) = lower(candidate_username)
      );
      candidate_suffix := candidate_suffix + 1;
    end loop;

    update public.user_profiles
    set username = candidate_username, updated_at = now()
    where user_id = legacy_profile.user_id;

    insert into public.perfiles_publicos(user_id, display_name, avatar_url, updated_at)
    values (legacy_profile.user_id, candidate_username, legacy_profile.avatar_url, now())
    on conflict (user_id) do update set
      display_name = excluded.display_name,
      avatar_url = coalesce(excluded.avatar_url, public.perfiles_publicos.avatar_url),
      updated_at = excluded.updated_at;
  end loop;
end;
$$;

create unique index if not exists user_profiles_username_lower_uidx
  on public.user_profiles (lower(username));

create table if not exists public.user_profile_favorite_categories (
  user_id uuid not null references public.user_profiles (user_id) on delete cascade,
  category_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, category_name),
  constraint user_profile_favorite_categories_name_check check (length(btrim(category_name)) > 0)
);

create or replace function private.limit_profile_favorite_categories()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  previous_category text;
begin
  if tg_op = 'UPDATE' and old.user_id = new.user_id then
    previous_category := old.category_name;
  end if;
  perform 1 from public.user_profiles where user_id = new.user_id for update;
  if (select count(*) from public.user_profile_favorite_categories
    where user_id = new.user_id and category_name <> new.category_name
      and category_name is distinct from previous_category) >= 3 then
    raise exception using errcode = '23514', message = 'LIMITE_CATEGORIAS_FAVORITAS';
  end if;
  return new;
end;
$$;

drop trigger if exists profile_favorites_limit on public.user_profile_favorite_categories;
create trigger profile_favorites_limit
  before insert or update on public.user_profile_favorite_categories
  for each row execute function private.limit_profile_favorite_categories();
revoke all on function private.limit_profile_favorite_categories() from public, anon, authenticated;

create or replace function private.protect_completed_user_profile()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if old.onboarding_completed and (
    new.username is distinct from old.username
    or not new.onboarding_completed
  ) then
    raise exception using errcode = '23514', message = 'USERNAME_INMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists user_profiles_protect_completed on public.user_profiles;
create trigger user_profiles_protect_completed
  before update on public.user_profiles
  for each row execute function private.protect_completed_user_profile();

revoke all on function private.protect_completed_user_profile() from public, anon, authenticated;

create index if not exists gamificacion_ranking_idx
  on public.gamificacion (bricks desc, user_id asc);

create index if not exists minifiguras_ranking_idx
  on public.minifiguras (user_id, estado_coleccion, precio desc, anio asc);

create index if not exists regalos_enviados_receptor_idx
  on public.regalos_enviados (receptor_id);

alter table public.minifiguras enable row level security;
alter table public.gamificacion enable row level security;
alter table public.dna_ponderaciones enable row level security;
alter table public.perfiles_publicos enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_profile_favorite_categories enable row level security;
alter table public.regalos_enviados enable row level security;
alter table public.user_daily_snapshots enable row level security;
alter table public.notificaciones enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.agradecimientos_regalo enable row level security;
alter table public.ranking_top10_membership enable row level security;
alter table private.ranking_top10_reconciliation_state enable row level security;
alter table private.daily_sync_runs enable row level security;
alter table private.daily_sync_users enable row level security;
alter table private.daily_sync_prices enable row level security;
alter table private.daily_sync_figure_prices enable row level security;

revoke all on table public.user_daily_snapshots from public, anon, authenticated;
grant select on table public.user_daily_snapshots to authenticated;
revoke all on table public.user_profiles from public, anon, authenticated;
grant select, insert, update on table public.user_profiles to authenticated;
revoke all on table public.user_profile_favorite_categories from public, anon, authenticated;
grant select, insert, update, delete on table public.user_profile_favorite_categories to authenticated;
revoke all on table public.perfiles_publicos from public, anon, authenticated;
grant select, insert, update on table public.perfiles_publicos to authenticated;
revoke all on table public.notificaciones from public, anon, authenticated, service_role;
grant select on table public.notificaciones to authenticated;
grant update (is_read) on table public.notificaciones to authenticated;
revoke all on table public.friend_requests, public.friendships from public, anon, authenticated, service_role;
grant select on table public.friend_requests, public.friendships to authenticated;
revoke all on table public.agradecimientos_regalo from public, anon, authenticated, service_role;
revoke all on table public.ranking_top10_membership from public, anon, authenticated, service_role;
revoke all on table private.ranking_top10_reconciliation_state from public, anon, authenticated, service_role;
revoke all on table private.daily_sync_runs from public, anon, authenticated;
revoke all on table private.daily_sync_users from public, anon, authenticated;
revoke all on table private.daily_sync_prices from public, anon, authenticated;
revoke all on table private.daily_sync_figure_prices from public, anon, authenticated;

drop policy if exists "Users can view their minifiguras" on public.minifiguras;
create policy "Users can view their minifiguras"
  on public.minifiguras for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their daily snapshots" on public.user_daily_snapshots;
create policy "Users can view their daily snapshots"
  on public.user_daily_snapshots for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their notifications" on public.notificaciones;
create policy "Users can view their notifications"
  on public.notificaciones for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can mark their notifications read" on public.notificaciones;
create policy "Users can mark their notifications read"
  on public.notificaciones for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Participants can view friend requests" on public.friend_requests;
drop policy if exists "Recipients can view friend requests" on public.friend_requests;
create policy "Recipients can view friend requests"
  on public.friend_requests for select
  to authenticated
  using ((select auth.uid()) = recipient_id);

drop policy if exists "Participants can view friendships" on public.friendships;
create policy "Participants can view friendships"
  on public.friendships for select
  to authenticated
  using ((select auth.uid()) in (user_low_id, user_high_id));

drop policy if exists "Users can insert their minifiguras" on public.minifiguras;
create policy "Users can insert their minifiguras"
  on public.minifiguras for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their minifiguras" on public.minifiguras;
create policy "Users can update their minifiguras"
  on public.minifiguras for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their minifiguras" on public.minifiguras;
create policy "Users can delete their minifiguras"
  on public.minifiguras for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their gamificacion" on public.gamificacion;
create policy "Users can view their gamificacion"
  on public.gamificacion for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their gamificacion" on public.gamificacion;
create policy "Users can insert their gamificacion"
  on public.gamificacion for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their gamificacion" on public.gamificacion;
create policy "Users can update their gamificacion"
  on public.gamificacion for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their gamificacion" on public.gamificacion;
create policy "Users can delete their gamificacion"
  on public.gamificacion for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their public profile" on public.perfiles_publicos;
create policy "Users can view their public profile"
  on public.perfiles_publicos for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their public profile" on public.perfiles_publicos;
create policy "Users can insert their public profile"
  on public.perfiles_publicos for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their public profile" on public.perfiles_publicos;
create policy "Users can update their public profile"
  on public.perfiles_publicos for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view their user profile" on public.user_profiles;
create policy "Users can view their user profile"
  on public.user_profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their user profile" on public.user_profiles;
create policy "Users can insert their user profile"
  on public.user_profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their user profile" on public.user_profiles;
create policy "Users can update their user profile"
  on public.user_profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their user profile" on public.user_profiles;
create policy "Users can delete their user profile"
  on public.user_profiles for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their favorite categories" on public.user_profile_favorite_categories;
create policy "Users can view their favorite categories"
  on public.user_profile_favorite_categories for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their favorite categories" on public.user_profile_favorite_categories;
create policy "Users can insert their favorite categories"
  on public.user_profile_favorite_categories for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their favorite categories" on public.user_profile_favorite_categories;
create policy "Users can update their favorite categories"
  on public.user_profile_favorite_categories for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their favorite categories" on public.user_profile_favorite_categories;
create policy "Users can delete their favorite categories"
  on public.user_profile_favorite_categories for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.amigos_buscar(p_query text)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  bricks integer,
  nivel jsonb,
  posicion_global bigint,
  relationship_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or auth.role() is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;
  if length(btrim(coalesce(p_query, ''))) < 3 then
    raise exception using errcode = '22023', message = 'CONSULTA_DEMASIADO_CORTA';
  end if;

  return query
  with ranked as (
    select game.user_id, game.bricks, game.nivel,
      row_number() over (order by game.bricks desc, game.user_id asc) as global_position
    from public.gamificacion game
  )
  select profile.user_id, profile.username,
    coalesce(profile.avatar_url, public_profile.avatar_url),
    coalesce(ranked.bricks, 0), coalesce(ranked.nivel, '{}'::jsonb), ranked.global_position,
    case
      when friendship.user_low_id is not null then 'friend'
      when request.id is null then 'none'
      when request.sender_id = current_user_id and request.status in ('pending', 'rejected') then 'request_sent'
      when request.recipient_id = current_user_id and request.status = 'pending' then 'request_received'
      when request.status = 'rejected' then 'request_rejected'
      else 'none'
    end
  from public.user_profiles profile
  left join public.perfiles_publicos public_profile on public_profile.user_id = profile.user_id
  left join ranked on ranked.user_id = profile.user_id
  left join public.friend_requests request
    on request.pair_low_id = least(current_user_id, profile.user_id)
    and request.pair_high_id = greatest(current_user_id, profile.user_id)
  left join public.friendships friendship
    on friendship.user_low_id = least(current_user_id, profile.user_id)
    and friendship.user_high_id = greatest(current_user_id, profile.user_id)
  where profile.user_id <> current_user_id
    and lower(profile.username) like '%' || lower(btrim(p_query)) || '%'
  order by lower(profile.username), profile.user_id
  limit 50;
end;
$$;

create or replace function public.amigos_listar(p_tipo text)
returns table (
  relationship_id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  bricks integer,
  nivel jsonb,
  posicion_global bigint,
  status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or auth.role() is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;
  if p_tipo is null or p_tipo not in ('friends', 'sent', 'received') then
    raise exception using errcode = '22023', message = 'TIPO_DE_LISTA_INVALIDO';
  end if;

  return query
  with ranked as (
    select game.user_id, game.bricks, game.nivel,
      row_number() over (order by game.bricks desc, game.user_id asc) as global_position
    from public.gamificacion game
  ), relations as (
    select null::uuid as relation_id,
      case when friendship.user_low_id = current_user_id then friendship.user_high_id else friendship.user_low_id end as other_user_id,
      'accepted'::text as relation_status, friendship.created_at as relation_created_at
    from public.friendships friendship
    where p_tipo = 'friends'
      and current_user_id in (friendship.user_low_id, friendship.user_high_id)
    union all
    select request.id,
      case when p_tipo = 'sent' then request.recipient_id else request.sender_id end,
      case when p_tipo = 'sent' then 'pending' else request.status end, request.created_at
    from public.friend_requests request
    where ((p_tipo = 'sent' and request.sender_id = current_user_id)
      or (p_tipo = 'received' and request.recipient_id = current_user_id))
      and request.status in ('pending', 'rejected')
  )
  select relations.relation_id, profile.user_id, profile.username,
    coalesce(profile.avatar_url, public_profile.avatar_url),
    coalesce(ranked.bricks, 0), coalesce(ranked.nivel, '{}'::jsonb), ranked.global_position,
    relations.relation_status, relations.relation_created_at
  from relations
  join public.user_profiles profile on profile.user_id = relations.other_user_id
  left join public.perfiles_publicos public_profile on public_profile.user_id = profile.user_id
  left join ranked on ranked.user_id = profile.user_id
  order by relations.relation_created_at desc, profile.user_id;
end;
$$;

create or replace function public.amigos_enviar(p_receptor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request_id uuid;
  sender_username text;
begin
  if current_user_id is null or auth.role() is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;
  if p_receptor_id is null or p_receptor_id = current_user_id then
    raise exception using errcode = '22023', message = 'AUTORRELACION_NO_PERMITIDA';
  end if;
  if not exists (select 1 from public.user_profiles where user_id = p_receptor_id) then
    raise exception using errcode = 'P0002', message = 'USUARIO_NO_ENCONTRADO';
  end if;
  if exists (
    select 1 from public.friend_requests
    where pair_low_id = least(current_user_id, p_receptor_id)
      and pair_high_id = greatest(current_user_id, p_receptor_id)
  ) or exists (
    select 1 from public.friendships
    where user_low_id = least(current_user_id, p_receptor_id)
      and user_high_id = greatest(current_user_id, p_receptor_id)
  ) then
    raise exception using errcode = '23505', message = 'SOLICITUD_EXISTENTE';
  end if;

  select username into sender_username from public.user_profiles where user_id = current_user_id;
  insert into public.friend_requests(sender_id, recipient_id)
  values (current_user_id, p_receptor_id) returning id into request_id;
  insert into public.notificaciones(user_id, type, payload, social_request_id)
  values (p_receptor_id, 'friend_request', jsonb_build_object('user', sender_username), request_id);
  return jsonb_build_object('ok', true, 'requestId', request_id, 'status', 'pending');
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'SOLICITUD_EXISTENTE';
end;
$$;

create or replace function public.amigos_rechazar(p_solicitud_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request_status text;
begin
  if current_user_id is null or auth.role() is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;
  select status into request_status from public.friend_requests
  where id = p_solicitud_id and recipient_id = current_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'SOLICITUD_NO_ENCONTRADA';
  end if;
  if request_status = 'accepted' then
    raise exception using errcode = '23514', message = 'SOLICITUD_YA_ACEPTADA';
  end if;
  if request_status = 'pending' then
    update public.friend_requests set status = 'rejected', updated_at = now() where id = p_solicitud_id;
  end if;
  return jsonb_build_object('ok', true, 'status', 'rejected');
end;
$$;

create or replace function public.amigos_aceptar(p_solicitud_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request_sender_id uuid;
  request_recipient_id uuid;
  request_status text;
  recipient_username text;
begin
  if current_user_id is null or auth.role() is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;
  select sender_id, recipient_id, status
  into request_sender_id, request_recipient_id, request_status
  from public.friend_requests where id = p_solicitud_id for update;
  if not found or request_recipient_id <> current_user_id then
    raise exception using errcode = 'P0002', message = 'SOLICITUD_NO_ENCONTRADA';
  end if;
  if request_status = 'accepted' then
    update public.notificaciones set social_request_accepted = true
    where type = 'friend_request' and social_request_id = p_solicitud_id and user_id = current_user_id;
    return jsonb_build_object('ok', true, 'status', 'accepted', 'alreadyAccepted', true);
  end if;

  update public.friend_requests set status = 'accepted', updated_at = now() where id = p_solicitud_id;
  insert into public.friendships(user_low_id, user_high_id)
  values (least(request_sender_id, request_recipient_id), greatest(request_sender_id, request_recipient_id))
  on conflict (user_low_id, user_high_id) do nothing;
  select username into recipient_username from public.user_profiles where user_id = current_user_id;
  insert into public.notificaciones(user_id, type, payload, social_request_id)
  values (request_sender_id, 'friend_request_accepted', jsonb_build_object('user', recipient_username), p_solicitud_id)
  on conflict (user_id, type, social_request_id) where social_request_id is not null do nothing;
  update public.notificaciones set social_request_accepted = true
  where type = 'friend_request' and social_request_id = p_solicitud_id and user_id = current_user_id;
  return jsonb_build_object('ok', true, 'status', 'accepted', 'alreadyAccepted', false);
end;
$$;

revoke all on function public.amigos_buscar(text) from public, anon;
revoke all on function public.amigos_listar(text) from public, anon;
revoke all on function public.amigos_enviar(uuid) from public, anon;
revoke all on function public.amigos_rechazar(uuid) from public, anon;
revoke all on function public.amigos_aceptar(uuid) from public, anon;
grant execute on function public.amigos_buscar(text) to authenticated;
grant execute on function public.amigos_listar(text) to authenticated;
grant execute on function public.amigos_enviar(uuid) to authenticated;
grant execute on function public.amigos_rechazar(uuid) to authenticated;
grant execute on function public.amigos_aceptar(uuid) to authenticated;

create or replace function public.amigos_perfil(p_usuario_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  profile_result jsonb;
begin
  if current_user_id is null or auth.role() is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;
  if p_usuario_id is null or p_usuario_id = current_user_id then
    raise exception using errcode = '22023', message = 'PERFIL_NO_PERMITIDO';
  end if;

  select jsonb_build_object(
    'userId', profile.user_id,
    'username', profile.username,
    'avatarUrl', coalesce(profile.avatar_url, public_profile.avatar_url),
    'bricks', coalesce(game.bricks, 0),
    'level', jsonb_build_object(
      'id', coalesce((game.nivel->>'id')::integer, 0),
      'name', coalesce(game.nivel->>'nombre', 'Duplo')
    ),
    'dna', private.dna_calcular(profile.user_id)->'porcentajes',
    'top5Price', coalesce((
      select jsonb_agg(entry.data order by entry.position)
      from (
        select jsonb_strip_nulls(jsonb_build_object(
          'id', figure.id, 'name', figure.nombre, 'price', figure.precio,
          'year', figure.anio, 'category', figure.categoria, 'subcategory', figure.subcategoria
        )) as data,
        row_number() over (order by figure.precio desc nulls last, figure.fecha_compra asc nulls last, figure.fecha_registro desc) as position
        from public.minifiguras figure
        where figure.user_id = profile.user_id and figure.estado_coleccion = 'COLECCIÓN'
        order by figure.precio desc nulls last, figure.fecha_compra asc nulls last, figure.fecha_registro desc
        limit 5
      ) entry
    ), '[]'::jsonb),
    'top5Age', coalesce((
      select jsonb_agg(entry.data order by entry.position)
      from (
        select jsonb_strip_nulls(jsonb_build_object(
          'id', figure.id, 'name', figure.nombre, 'year', figure.anio,
          'price', figure.precio, 'category', figure.categoria, 'subcategory', figure.subcategoria
        )) as data,
        row_number() over (order by figure.anio asc nulls last, figure.precio desc nulls last, figure.fecha_registro desc) as position
        from public.minifiguras figure
        where figure.user_id = profile.user_id and figure.estado_coleccion = 'COLECCIÓN'
        order by figure.anio asc nulls last, figure.precio desc nulls last, figure.fecha_registro desc
        limit 5
      ) entry
    ), '[]'::jsonb),
    'collection', jsonb_build_object(
      'total', (select count(*) from public.minifiguras figure
        where figure.user_id = profile.user_id and figure.estado_coleccion = 'COLECCIÓN'),
      'latest', coalesce((
        select jsonb_agg(entry.data order by entry.position)
        from (
          select jsonb_strip_nulls(jsonb_build_object(
            'id', figure.id, 'name', figure.nombre, 'year', figure.anio,
            'price', figure.precio, 'category', figure.categoria, 'subcategory', figure.subcategoria
          )) as data,
          row_number() over (order by figure.fecha_registro desc, figure.id asc) as position
          from public.minifiguras figure
          where figure.user_id = profile.user_id and figure.estado_coleccion = 'COLECCIÓN'
          order by figure.fecha_registro desc, figure.id asc
          limit 5
        ) entry
      ), '[]'::jsonb)
    ),
    'wanted', jsonb_build_object(
      'total', (select count(*) from public.minifiguras figure
        where figure.user_id = profile.user_id and figure.estado_coleccion = 'BUSCADA'),
      'latest', coalesce((
        select jsonb_agg(entry.data order by entry.position)
        from (
          select jsonb_strip_nulls(jsonb_build_object(
            'id', figure.id, 'name', figure.nombre, 'year', figure.anio,
            'price', figure.precio, 'category', figure.categoria, 'subcategory', figure.subcategoria
          )) as data,
          row_number() over (order by figure.fecha_registro desc, figure.id asc) as position
          from public.minifiguras figure
          where figure.user_id = profile.user_id and figure.estado_coleccion = 'BUSCADA'
          order by figure.fecha_registro desc, figure.id asc
          limit 5
        ) entry
      ), '[]'::jsonb)
    ),
    'achievements', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', achievement.item->'id', 'type', achievement.item->'type',
        'name', achievement.item->'nombre', 'description', achievement.item->'descripcion',
        'bricks', achievement.item->'bricks', 'repeatable', achievement.item->'repetible',
        'quantity', achievement.item->'cantidad', 'total', achievement.item->'total'
      )) order by case when achievement.item->>'type' = 'regalo' then 1 else 0 end,
        case when achievement.item->>'type' <> 'regalo' then coalesce((achievement.item->>'total')::numeric, 0) end desc,
        achievement.position)
      from jsonb_array_elements(coalesce(game.logros, '[]'::jsonb)) with ordinality as achievement(item, position)
    ), '[]'::jsonb)
  ) into profile_result
  from public.user_profiles profile
  left join public.perfiles_publicos public_profile on public_profile.user_id = profile.user_id
  left join public.gamificacion game on game.user_id = profile.user_id
  where profile.user_id = p_usuario_id;

  return profile_result;
end;
$$;

revoke all on function public.amigos_perfil(uuid) from public, anon;
grant execute on function public.amigos_perfil(uuid) to authenticated;

create or replace function public.amigos_resumen(p_tipo text, p_query text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  selected_rows jsonb;
  result_rows jsonb;
begin
  if auth.uid() is null or auth.role() is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;
  if p_tipo = 'search' then
    select coalesce(jsonb_agg(to_jsonb(person)), '[]'::jsonb) into selected_rows
    from public.amigos_buscar(p_query) person;
  else
    select coalesce(jsonb_agg(to_jsonb(person)), '[]'::jsonb) into selected_rows
    from public.amigos_listar(p_tipo) person;
  end if;

  with ranked as (
    select game.user_id, row_number() over (
      order by coalesce((game.nivel->>'id')::numeric, 0) desc, game.bricks desc, game.user_id asc
    ) as position
    from public.gamificacion game
  )
  select coalesce(jsonb_agg(person.item || jsonb_build_object(
    'nivel', jsonb_build_object('id', coalesce((person.item->'nivel'->>'id')::integer, 0),
      'nombre', coalesce(person.item->'nivel'->>'nombre', 'Duplo')),
    'posicion_global', ranked.position,
    'total_coleccion', (select count(*) from public.minifiguras figure
      where figure.user_id = (person.item->>'user_id')::uuid and figure.estado_coleccion = 'COLECCIÓN'),
    'dna_principal', dna.data->>'principal',
    'dna_rasgos', case when dna.data->>'principal' = 'Newbie' then '[]'::jsonb else (
      select jsonb_agg(trait.data order by trait.is_principal desc, trait.percentage desc, trait.ordinal)
      from (
        select jsonb_build_object('nombre', traits.name, 'porcentaje', (dna.data->'porcentajes'->>traits.key)::numeric) as data,
          traits.name = dna.data->>'principal' as is_principal,
          (dna.data->'porcentajes'->>traits.key)::numeric as percentage, traits.ordinal
        from (values ('rarityHunter', 'Rarity Hunter', 1), ('explorer', 'Explorer', 2),
          ('collector', 'Collector', 3), ('fan', 'Fan', 4)) traits(key, name, ordinal)
        order by is_principal desc, percentage desc, traits.ordinal
        limit 2
      ) trait
    ) end
  ) order by person.ordinal), '[]'::jsonb) into result_rows
  from jsonb_array_elements(selected_rows) with ordinality person(item, ordinal)
  left join ranked on ranked.user_id = (person.item->>'user_id')::uuid
  cross join lateral (select private.dna_calcular((person.item->>'user_id')::uuid) as data) dna;
  return result_rows;
end;
$$;

create or replace function public.amigos_eliminar(p_amigo_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  request_id uuid;
  removed_count integer;
begin
  if actor_id is null or auth.role() is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;
  if p_amigo_id is null or p_amigo_id = actor_id then
    raise exception using errcode = '22023', message = 'AUTORRELACION_NO_PERMITIDA';
  end if;
  select id into request_id from public.friend_requests
  where pair_low_id = least(actor_id, p_amigo_id) and pair_high_id = greatest(actor_id, p_amigo_id)
    and status = 'accepted'
  for update;
  delete from public.friendships
  where user_low_id = least(actor_id, p_amigo_id) and user_high_id = greatest(actor_id, p_amigo_id);
  get diagnostics removed_count = row_count;
  if removed_count > 0 and request_id is not null then
    delete from public.friend_requests where id = request_id and status = 'accepted';
  end if;
  return jsonb_build_object('ok', true, 'removed', removed_count > 0);
end;
$$;

revoke all on function public.amigos_eliminar(uuid) from public, anon, service_role;
grant execute on function public.amigos_eliminar(uuid) to authenticated;

create or replace function public.amigos_contadores()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or auth.role() is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;
  return jsonb_build_object(
    'friends', (select count(*) from public.friendships where actor_id in (user_low_id, user_high_id)),
    'sent', (select count(*) from public.friend_requests where sender_id = actor_id and status in ('pending', 'rejected')),
    'received', (select count(*) from public.friend_requests where recipient_id = actor_id and status in ('pending', 'rejected'))
  );
end;
$$;

revoke all on function public.amigos_resumen(text, text), public.amigos_contadores() from public, anon, service_role;
grant execute on function public.amigos_resumen(text, text), public.amigos_contadores() to authenticated;

create or replace function public.guardar_perfil_usuario(
  p_username text,
  p_avatar_url text,
  p_currency text,
  p_language text,
  p_favorite_categories text[]
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_username text;
  v_onboarding_completed boolean;
  v_avatar_url text := nullif(btrim(p_avatar_url), '');
begin
  if v_user_id is null or auth.role() is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;

  if coalesce(cardinality(p_favorite_categories), 0) > 3 then
    raise exception using errcode = '23514', message = 'PERFIL_INVALIDO';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_favorite_categories, array[]::text[])) as selected(category_name)
    where length(btrim(selected.category_name)) = 0
  ) then
    raise exception using errcode = '22023', message = 'CATEGORIA_INVALIDA';
  end if;

  select username, onboarding_completed
  into v_username, v_onboarding_completed
  from public.user_profiles
  where user_id = v_user_id
  for update;

  if found and v_onboarding_completed and v_username is distinct from p_username then
    raise exception using errcode = '23514', message = 'USERNAME_INMUTABLE';
  end if;

  insert into public.user_profiles (
    user_id, username, avatar_url, currency, language, onboarding_completed, updated_at
  ) values (
    v_user_id, p_username, v_avatar_url, p_currency, p_language, true, now()
  )
  on conflict (user_id) do update set
    avatar_url = excluded.avatar_url,
    currency = excluded.currency,
    language = excluded.language,
    onboarding_completed = true,
    updated_at = excluded.updated_at;

  delete from public.user_profile_favorite_categories
  where user_id = v_user_id;

  insert into public.user_profile_favorite_categories (user_id, category_name)
  select v_user_id, favorites.category_name
  from (
    select distinct btrim(selected.category_name) as category_name
    from unnest(coalesce(p_favorite_categories, array[]::text[])) as selected(category_name)
  ) as favorites;

  insert into public.perfiles_publicos (user_id, display_name, avatar_url, updated_at)
  values (v_user_id, p_username, v_avatar_url, now())
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.guardar_perfil_usuario(text, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.guardar_perfil_usuario(text, text, text, text, text[]) to authenticated;

create or replace function public.eliminar_cuenta_usuario()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or auth.role() is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;
  delete from auth.users where id = current_user_id;
  if not found then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;
end;
$$;

revoke all on function public.eliminar_cuenta_usuario() from public, anon, authenticated;
grant execute on function public.eliminar_cuenta_usuario() to authenticated;

update public.perfiles_publicos as public_profile
set display_name = profile.username
from public.user_profiles as profile
where public_profile.user_id = profile.user_id
  and public_profile.display_name is distinct from profile.username;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notificaciones'
    ) then
    execute 'alter publication supabase_realtime add table public.notificaciones';
  end if;
end;
$$;

begin;
drop function if exists public.ranking_global();
drop function if exists public.ranking_global(text);

create or replace function public.aplicar_recalculo_gamificacion_categorias(
  p_fingerprint text,
  p_estados jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_fingerprint text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'RECALCULO_CATEGORIAS_NO_AUTORIZADO';
  end if;
  if p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
    or p_estados is null or jsonb_typeof(p_estados) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'RECALCULO_CATEGORIAS_INVALIDO';
  end if;

  select fingerprint into v_fingerprint
  from public.gamificacion_categoria_version
  where singleton = true
  for update;

  if v_fingerprint = p_fingerprint then
    return false;
  end if;

  insert into public.gamificacion (
    user_id, bricks, nivel, siguiente_nivel, progreso, logros, updated_at
  )
  select
    (estado->>'user_id')::uuid,
    (estado->>'bricks')::integer,
    estado->'nivel',
    case when estado->'siguiente_nivel' = 'null'::jsonb then null else estado->'siguiente_nivel' end,
    estado->'progreso',
    estado->'logros',
    now()
  from jsonb_array_elements(p_estados) as estados(estado)
  on conflict (user_id) do update set
    bricks = excluded.bricks,
    nivel = excluded.nivel,
    siguiente_nivel = excluded.siguiente_nivel,
    progreso = excluded.progreso,
    logros = excluded.logros,
    updated_at = excluded.updated_at;

  update public.gamificacion_categoria_version
  set fingerprint = p_fingerprint, updated_at = now()
  where singleton = true;

  return true;
end;
$$;

revoke all on function public.aplicar_recalculo_gamificacion_categorias(text, jsonb) from public, anon, authenticated;
grant execute on function public.aplicar_recalculo_gamificacion_categorias(text, jsonb) to service_role;

create function public.ranking_global(p_criterio text default 'nivel')
returns table (
  user_id uuid,
  avatar_url text,
  display_name text,
  bricks integer,
  nivel integer,
  nombre_nivel text,
  imagen_nivel text,
  total_coleccion bigint,
  top5_precio jsonb,
  top5_antiguedad jsonb,
  regalo_enviado boolean,
  dna_principal text,
  dna_rasgos jsonb
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with candidates as (
    select g.user_id, g.bricks, g.nivel, g.logros,
      (select count(*) from public.minifiguras m where m.user_id = g.user_id and m.estado_coleccion = 'COLECCIÓN') as total_coleccion,
      private.dna_calcular(g.user_id) as dna
    from public.gamificacion g
    where auth.uid() is not null
      and p_criterio in ('nivel', 'coleccion', 'rarityHunter', 'collector', 'explorer', 'fan')
  ), level_top_users as (
    select * from candidates
    order by coalesce((nivel->>'id')::numeric, 0) desc, bricks desc, user_id asc
    limit 10
  ), top_users as (
    select *, case p_criterio
      when 'coleccion' then total_coleccion::numeric
      when 'nivel' then coalesce((nivel->>'id')::numeric, 0)
      else coalesce((dna->'porcentajes'->>p_criterio)::numeric, 0)
    end as criterio_valor
    from level_top_users
    order by criterio_valor desc, coalesce((nivel->>'id')::integer, 0) desc, bricks desc, user_id asc
  )
  select
    top_users.user_id,
    p.avatar_url,
    coalesce(user_profile.username, 'Coleccionista') as display_name,
    top_users.bricks,
    coalesce((top_users.nivel->>'id')::integer, 0) as nivel,
    coalesce(top_users.nivel->>'nombre', 'Duplo') as nombre_nivel,
    case coalesce((top_users.nivel->>'id')::integer, 0)
      when 3 then '/level_images/3_threesevenfive.png'
      when 4 then '/level_images/4_citizen.png'
      when 5 then '/level_images/5_skeleton.png'
      when 6 then '/level_images/6_pirate.png'
      when 7 then '/level_images/7_captain.png'
      when 8 then '/level_images/8_redbearb.png'
      when 9 then '/level_images/9_forestman.png'
      when 10 then '/level_images/10_wolfpack.png'
      when 11 then '/level_images/11_wolfpackmaster.png'
      when 12 then '/level_images/12_ninja.png'
      when 13 then '/level_images/13_rx.png'
      when 14 then '/level_images/14_dragonform.png'
      when 15 then '/level_images/15_spacebaby.jpg'
      when 16 then '/level_images/16_spaceman.jpg'
      when 17 then '/level_images/17_blacktron.png'
      else '/level_images/9_forestman.png'
    end as imagen_nivel,
    top_users.total_coleccion,
    coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', ranked.id, 'nombre', ranked.nombre, 'precio', ranked.precio, 'categoria', ranked.categoria, 'subcategoria', ranked.subcategoria, 'anio', ranked.anio)) order by ranked.position)
      from (
        select m.id, m.nombre, m.precio, m.categoria, m.subcategoria, m.anio, row_number() over (order by m.precio desc nulls last, m.fecha_compra asc nulls last, m.fecha_registro desc) as position
        from public.minifiguras m
        where m.user_id = top_users.user_id and m.estado_coleccion = 'COLECCIÓN'
        order by m.precio desc nulls last, m.fecha_compra asc nulls last, m.fecha_registro desc
        limit 5
      ) ranked
    ), '[]'::jsonb) as top5_precio,
    coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', ranked.id, 'nombre', ranked.nombre, 'anio', ranked.anio, 'precio', ranked.precio, 'categoria', ranked.categoria, 'subcategoria', ranked.subcategoria)) order by ranked.position)
      from (
        select m.id, m.nombre, m.anio, m.precio, m.categoria, m.subcategoria, row_number() over (order by m.anio asc nulls last, m.precio desc nulls last, m.fecha_registro desc) as position
        from public.minifiguras m
        where m.user_id = top_users.user_id and m.estado_coleccion = 'COLECCIÓN'
        order by m.anio asc nulls last, m.precio desc nulls last, m.fecha_registro desc
        limit 5
      ) ranked
    ), '[]'::jsonb) as top5_antiguedad,
    exists (
      select 1 from public.regalos_enviados r
      where r.donante_id = auth.uid() and r.receptor_id = top_users.user_id
        and r.semana = '0001-01-01'
    ) as regalo_enviado,
    dna.data->>'principal' as dna_principal,
    case when p_criterio in ('rarityHunter', 'collector', 'explorer', 'fan') then
      jsonb_build_array(jsonb_build_object(
        'nombre', case p_criterio
          when 'rarityHunter' then 'Rarity Hunter'
          when 'collector' then 'Collector'
          when 'explorer' then 'Explorer'
          when 'fan' then 'Fan'
        end,
        'porcentaje', coalesce((dna.data->'porcentajes'->>p_criterio)::numeric, 0)
      ))
    when dna.data->>'principal' = 'Newbie' then '[]'::jsonb else (
      select jsonb_agg(jsonb_build_object('nombre', ranked.nombre, 'porcentaje', ranked.porcentaje)
        order by ranked.es_principal desc, ranked.porcentaje desc, ranked.ordinal)
      from (
        select trait.nombre, (dna.data->'porcentajes'->>trait.key)::numeric as porcentaje,
          trait.nombre = dna.data->>'principal' as es_principal, trait.ordinal
        from (values
          ('rarityHunter', 'Rarity Hunter', 0),
          ('explorer', 'Explorer', 1),
          ('collector', 'Collector', 2),
          ('fan', 'Fan', 3)
        ) as trait(key, nombre, ordinal)
        order by es_principal desc, porcentaje desc, trait.ordinal
        limit 2
      ) ranked
    ) end as dna_rasgos
  from top_users
  cross join lateral (select top_users.dna as data) dna
  left join public.perfiles_publicos p on p.user_id = top_users.user_id
  left join public.user_profiles user_profile on user_profile.user_id = top_users.user_id
  where auth.uid() is not null
  order by top_users.criterio_valor desc, coalesce((top_users.nivel->>'id')::integer, 0) desc, top_users.bricks desc, top_users.user_id asc;
$$;

create or replace function private.ranking_semanal_calcular(p_instante timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_context record;
  v_entries jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;

  select * into strict v_context
  from private.ranking_semanal_contexto(p_instante);

  if v_context.available then
    with baselines as (
      select snapshot.user_id, snapshot.bricks
      from public.user_daily_snapshots snapshot
      where snapshot.snapshot_date = v_context.week_start - 1
    ), latest as (
      select distinct on (snapshot.user_id)
        snapshot.user_id, snapshot.bricks, snapshot.snapshot_date
      from public.user_daily_snapshots snapshot
      where snapshot.snapshot_date between v_context.week_start
        and least(v_context.week_end, v_context.reference_date)
      order by snapshot.user_id, snapshot.snapshot_date desc
    ), candidates as (
      select
        latest.user_id,
        latest.snapshot_date,
        latest.bricks - baselines.bricks as bricks_semanales,
        gamificacion.bricks,
        gamificacion.nivel,
        private.dna_calcular(latest.user_id) as dna,
        (select count(*) from public.minifiguras figure
          where figure.user_id = latest.user_id and figure.estado_coleccion = 'COLECCIÓN') as total_coleccion
      from latest
      join baselines on baselines.user_id = latest.user_id
      join public.gamificacion gamificacion on gamificacion.user_id = latest.user_id
      order by latest.bricks - baselines.bricks desc, latest.user_id asc
      limit 10
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'userId', candidate.user_id,
      'avatarUrl', profile.avatar_url,
      'displayName', coalesce(user_profile.username, 'Coleccionista'),
      'bricks', candidate.bricks,
      'nivel', coalesce((candidate.nivel->>'id')::integer, 0),
      'nombreNivel', coalesce(candidate.nivel->>'nombre', 'Duplo'),
      'imagenNivel', case coalesce((candidate.nivel->>'id')::integer, 0)
        when 3 then '/level_images/3_threesevenfive.png'
        when 4 then '/level_images/4_citizen.png'
        when 5 then '/level_images/5_skeleton.png'
        when 6 then '/level_images/6_pirate.png'
        when 7 then '/level_images/7_captain.png'
        when 8 then '/level_images/8_redbearb.png'
        when 9 then '/level_images/9_forestman.png'
        when 10 then '/level_images/10_wolfpack.png'
        when 11 then '/level_images/11_wolfpackmaster.png'
        when 12 then '/level_images/12_ninja.png'
        when 13 then '/level_images/13_rx.png'
        when 14 then '/level_images/14_dragonform.png'
        when 15 then '/level_images/15_spacebaby.jpg'
        when 16 then '/level_images/16_spaceman.jpg'
        when 17 then '/level_images/17_blacktron.png'
        else '/level_images/9_forestman.png'
      end,
      'totalColeccion', candidate.total_coleccion,
      'top5Precio', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', ranked.id, 'nombre', ranked.nombre, 'precio', ranked.precio,
          'categoria', ranked.categoria, 'subcategoria', ranked.subcategoria, 'anio', ranked.anio
        )) order by ranked.position)
        from (
          select figure.id, figure.nombre, figure.precio, figure.categoria, figure.subcategoria, figure.anio,
            row_number() over (order by figure.precio desc nulls last, figure.fecha_compra asc nulls last, figure.fecha_registro desc) as position
          from public.minifiguras figure
          where figure.user_id = candidate.user_id and figure.estado_coleccion = 'COLECCIÓN'
          order by figure.precio desc nulls last, figure.fecha_compra asc nulls last, figure.fecha_registro desc
          limit 5
        ) ranked
      ), '[]'::jsonb),
      'top5Antiguedad', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id', ranked.id, 'nombre', ranked.nombre, 'anio', ranked.anio, 'precio', ranked.precio,
          'categoria', ranked.categoria, 'subcategoria', ranked.subcategoria
        )) order by ranked.position)
        from (
          select figure.id, figure.nombre, figure.anio, figure.precio, figure.categoria, figure.subcategoria,
            row_number() over (order by figure.anio asc nulls last, figure.precio desc nulls last, figure.fecha_registro desc) as position
          from public.minifiguras figure
          where figure.user_id = candidate.user_id and figure.estado_coleccion = 'COLECCIÓN'
          order by figure.anio asc nulls last, figure.precio desc nulls last, figure.fecha_registro desc
          limit 5
        ) ranked
      ), '[]'::jsonb),
      'regaloEnviado', exists (
        select 1 from public.regalos_enviados gift
        where gift.donante_id = auth.uid() and gift.receptor_id = candidate.user_id
          and gift.semana = v_context.week_start
      ),
      'dnaPrincipal', candidate.dna->>'principal',
      'dnaRasgos', case when candidate.dna->>'principal' = 'Newbie' then '[]'::jsonb else coalesce((
        select jsonb_agg(jsonb_build_object('nombre', ranked.nombre, 'porcentaje', ranked.porcentaje)
          order by ranked.es_principal desc, ranked.porcentaje desc, ranked.ordinal)
        from (
          select trait.nombre, (candidate.dna->'porcentajes'->>trait.key)::numeric as porcentaje,
            trait.nombre = candidate.dna->>'principal' as es_principal, trait.ordinal
          from (values
            ('rarityHunter', 'Rarity Hunter', 0),
            ('explorer', 'Explorer', 1),
            ('collector', 'Collector', 2),
            ('fan', 'Fan', 3)
          ) as trait(key, nombre, ordinal)
          order by es_principal desc, porcentaje desc, trait.ordinal
          limit 2
        ) ranked
      ), '[]'::jsonb) end,
      'bricksSemanales', candidate.bricks_semanales,
      'snapshotDate', candidate.snapshot_date
    ) order by candidate.bricks_semanales desc, candidate.user_id asc), '[]'::jsonb)
    into v_entries
    from candidates candidate
    left join public.perfiles_publicos profile on profile.user_id = candidate.user_id
    left join public.user_profiles user_profile on user_profile.user_id = candidate.user_id;
  end if;

  return jsonb_build_object(
    'available', v_context.available and jsonb_array_length(v_entries) > 0,
    'availableFrom', v_context.available_from,
    'weekStart', v_context.week_start,
    'weekEnd', v_context.week_end,
    'entries', v_entries
  );
end;
$$;

create or replace function public.ranking_semanal()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;
  return private.ranking_semanal_calcular(clock_timestamp());
end;
$$;

create or replace function public.ranking_logros(p_usuario_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with top_users as (
    select g.user_id, g.bricks, g.nivel, g.logros
    from public.gamificacion g
    order by g.bricks desc, g.user_id asc
    limit 10
  ), eligible_users as (
    select user_id from top_users
    union
    select (entry->>'userId')::uuid
    from jsonb_array_elements(public.ranking_semanal()->'entries') entry
  )
  select jsonb_build_object(
    'userId', g.user_id,
    'displayName', coalesce(user_profile.username, 'Coleccionista'),
    'bricks', g.bricks,
    'nivel', jsonb_build_object('id', coalesce((g.nivel->>'id')::integer, 0), 'nombre', coalesce(g.nivel->>'nombre', 'Duplo')),
    'logros', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', item->'id', 'type', item->'type', 'nombre', item->'nombre',
        'descripcion', item->'descripcion', 'bricks', item->'bricks',
        'repetible', item->'repetible', 'cantidad', item->'cantidad', 'total', item->'total'
      )) order by position)
      from jsonb_array_elements(g.logros) with ordinality as achievements(item, position)
    ), '[]'::jsonb)
  )
  from public.gamificacion g
  left join public.perfiles_publicos p on p.user_id = g.user_id
  left join public.user_profiles user_profile on user_profile.user_id = g.user_id
  where g.user_id = p_usuario_id and auth.uid() is not null
    and g.user_id in (select user_id from eligible_users);
$$;

create or replace function private.regalar_bricks(p_receptor_id uuid, p_semana date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_donante_id uuid := auth.uid();
  v_bricks integer;
  v_cantidad integer;
  v_nivel_id integer;
  v_nivel_nombre text;
  v_siguiente_id integer;
  v_siguiente_nombre text;
  v_desde integer;
  v_hasta integer;
  v_logros jsonb;
  v_nombre_donante text;
  v_amount integer := case when p_semana = '0001-01-01' then 50 else 5 end;
  v_achievement_id text := case when p_semana = '0001-01-01' then 'someone-liked-your-collection' else 'youre-on-fire-this-week' end;
begin
  if v_donante_id is null then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;
  if p_receptor_id = v_donante_id then
    raise exception using errcode = 'P0001', message = 'AUTORREGALO_NO_PERMITIDO';
  end if;

  select g.bricks, g.logros into v_bricks, v_logros
  from public.gamificacion g
  where g.user_id = p_receptor_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'RECEPTOR_NO_ENCONTRADO';
  end if;

  begin
    insert into public.regalos_enviados (donante_id, receptor_id, semana)
    values (v_donante_id, p_receptor_id, p_semana);
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'REGALO_YA_ENVIADO';
  end;

  select count(*)::integer into v_cantidad
  from public.regalos_enviados
  where receptor_id = p_receptor_id
    and (semana = '0001-01-01') = (p_semana = '0001-01-01');
  v_bricks := v_bricks + v_amount;

  select level.id, level.nombre, level.umbral, next_level.id, next_level.nombre, coalesce(next_level.umbral, level.umbral)
  into v_nivel_id, v_nivel_nombre, v_desde, v_siguiente_id, v_siguiente_nombre, v_hasta
  from (values
    (0,'Duplo',0),(1,'Stud',20),(2,'Plate',50),(3,'Three-Seven-Five',100),(4,'Citizen',200),(5,'Skeleton',300),
    (6,'Pirate',400),(7,'Captain',500),(8,'Redbeard',750),(9,'Forestman',1000),(10,'Wolfpack',1500),(11,'Wolfpack Master',2000),
    (12,'Ninja',2500),(13,'RX',3000),(14,'Dragon Form',5000),(15,'Space Baby',6000),(16,'Space Man',7000),(17,'Blacktron',8000),
    (18,'Technic',9000),(19,'Majisto',10000),(20,'Castle Knight',12500),(21,'Chrome Gold',15000),(22,'Wooden Duck',20000),
    (23,'De Billund',30000),(24,'Mr. Kirk',50000),(25,'Mr. Gold',100000)
  ) as level(id,nombre,umbral)
  left join (values
    (0,'Duplo',0),(1,'Stud',20),(2,'Plate',50),(3,'Three-Seven-Five',100),(4,'Citizen',200),(5,'Skeleton',300),
    (6,'Pirate',400),(7,'Captain',500),(8,'Redbeard',750),(9,'Forestman',1000),(10,'Wolfpack',1500),(11,'Wolfpack Master',2000),
    (12,'Ninja',2500),(13,'RX',3000),(14,'Dragon Form',5000),(15,'Space Baby',6000),(16,'Space Man',7000),(17,'Blacktron',8000),
    (18,'Technic',9000),(19,'Majisto',10000),(20,'Castle Knight',12500),(21,'Chrome Gold',15000),(22,'Wooden Duck',20000),
    (23,'De Billund',30000),(24,'Mr. Kirk',50000),(25,'Mr. Gold',100000)
  ) as next_level(id,nombre,umbral) on next_level.id = level.id + 1
  where level.umbral <= v_bricks
  order by level.umbral desc
  limit 1;

  select coalesce(jsonb_agg(item), '[]'::jsonb) into v_logros
  from jsonb_array_elements(v_logros) item
  where item->>'id' <> v_achievement_id;
  v_logros := v_logros || jsonb_build_array(jsonb_build_object(
    'id', v_achievement_id,
    'type', 'regalo',
    'nombre', case when v_amount = 50 then 'Your collection is top!' else 'You''re on fire this week!' end,
    'descripcion', case when v_amount = 50 then 'Has aparecido en el ranking global y te han hecho un regalo.' else 'Has aparecido en el ranking semanal y te han hecho un regalo.' end,
    'bricks', v_amount,
    'repetible', true,
    'cantidad', v_cantidad,
    'total', v_cantidad * v_amount
  ));

  update public.gamificacion
  set bricks = v_bricks,
      nivel = jsonb_build_object('id', v_nivel_id, 'nombre', v_nivel_nombre, 'umbral', v_desde),
      siguiente_nivel = case when v_siguiente_id is null then null else jsonb_build_object('id', v_siguiente_id, 'nombre', v_siguiente_nombre, 'umbral', v_hasta) end,
      progreso = jsonb_build_object(
        'actual', v_bricks,
        'desde', v_desde,
        'hasta', v_hasta,
        'porcentaje', case when v_siguiente_id is null then 100 else round(least(100, greatest(0, ((v_bricks - v_desde)::numeric / (v_hasta - v_desde)) * 100))) end
      ),
      logros = v_logros,
      updated_at = now()
  where user_id = p_receptor_id;

  select coalesce(profile.username, 'Coleccionista') into v_nombre_donante
  from public.user_profiles profile
  where profile.user_id = v_donante_id;
  v_nombre_donante := coalesce(v_nombre_donante, 'Coleccionista');

  insert into public.notificaciones (user_id, type, payload, gift_donante_id, gift_semana)
  values (
    p_receptor_id,
    'gift_received',
    jsonb_build_object(
      'user', v_nombre_donante,
      'actorUserId', v_donante_id,
      'amount', v_amount,
      'message', case when v_amount = 50
        then 'El usuario ' || v_nombre_donante || ' vio tus tops en el Ranking Global y te regaló 50 Bricks 🧱'
        else 'El usuario ' || v_nombre_donante || ' vio tus tops en el Ranking Semanal y te regaló 5 Bricks 🧱' end
    ),
    v_donante_id,
    p_semana
  );

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.regalar_bricks(p_receptor_id uuid)
returns jsonb language sql security definer
set search_path = pg_catalog, public, private, pg_temp
as $$ select private.regalar_bricks(p_receptor_id, '0001-01-01'::date); $$;

create or replace function private.regalar_bricks_semanal(p_receptor_id uuid, p_instante timestamptz)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_ranking jsonb := private.ranking_semanal_calcular(p_instante);
begin
  if p_receptor_id = auth.uid() then
    raise exception using errcode = 'P0001', message = 'AUTORREGALO_NO_PERMITIDO';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(v_ranking->'entries') entry
    where entry->>'userId' = p_receptor_id::text
  ) then
    raise exception using errcode = 'P0001', message = 'RECEPTOR_NO_ENCONTRADO';
  end if;
  return private.regalar_bricks(p_receptor_id, (v_ranking->>'weekStart')::date);
end;
$$;

create or replace function public.regalar_bricks_semanal(p_receptor_id uuid)
returns jsonb language sql security definer
set search_path = pg_catalog, public, private, pg_temp
as $$ select private.regalar_bricks_semanal(p_receptor_id, clock_timestamp()); $$;

revoke all on function private.regalar_bricks(uuid, date) from public, anon, authenticated, service_role;
revoke all on function private.regalar_bricks_semanal(uuid, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.regalar_bricks_semanal(uuid) from public, anon, service_role;
grant execute on function public.regalar_bricks_semanal(uuid) to authenticated;

create or replace function private.gamificacion_ajustar_bricks(p_user_id uuid, p_delta integer)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_bricks integer;
  v_level_id integer;
  v_level_name text;
  v_next_id integer;
  v_next_name text;
  v_from integer;
  v_to integer;
begin
  if p_delta = 0 then
    raise exception using errcode = '22023', message = 'RECOMPENSA_INVALIDA';
  end if;
  select bricks + p_delta into v_bricks
  from public.gamificacion where user_id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'USUARIO_NO_ENCONTRADO';
  end if;
  if v_bricks < 0 then
    raise exception using errcode = '22023', message = 'RECOMPENSA_INVALIDA';
  end if;

  select current_level.id, current_level.nombre, current_level.umbral,
    next_level.id, next_level.nombre, coalesce(next_level.umbral, current_level.umbral)
  into v_level_id, v_level_name, v_from, v_next_id, v_next_name, v_to
  from (values
    (0,'Duplo',0),(1,'Stud',20),(2,'Plate',50),(3,'Three-Seven-Five',100),(4,'Citizen',200),(5,'Skeleton',300),
    (6,'Pirate',400),(7,'Captain',500),(8,'Redbeard',750),(9,'Forestman',1000),(10,'Wolfpack',1500),(11,'Wolfpack Master',2000),
    (12,'Ninja',2500),(13,'RX',3000),(14,'Dragon Form',5000),(15,'Space Baby',6000),(16,'Space Man',7000),(17,'Blacktron',8000),
    (18,'Technic',9000),(19,'Majisto',10000),(20,'Castle Knight',12500),(21,'Chrome Gold',15000),(22,'Wooden Duck',20000),
    (23,'De Billund',30000),(24,'Mr. Kirk',50000),(25,'Mr. Gold',100000)
  ) as current_level(id, nombre, umbral)
  left join (values
    (0,'Duplo',0),(1,'Stud',20),(2,'Plate',50),(3,'Three-Seven-Five',100),(4,'Citizen',200),(5,'Skeleton',300),
    (6,'Pirate',400),(7,'Captain',500),(8,'Redbeard',750),(9,'Forestman',1000),(10,'Wolfpack',1500),(11,'Wolfpack Master',2000),
    (12,'Ninja',2500),(13,'RX',3000),(14,'Dragon Form',5000),(15,'Space Baby',6000),(16,'Space Man',7000),(17,'Blacktron',8000),
    (18,'Technic',9000),(19,'Majisto',10000),(20,'Castle Knight',12500),(21,'Chrome Gold',15000),(22,'Wooden Duck',20000),
    (23,'De Billund',30000),(24,'Mr. Kirk',50000),(25,'Mr. Gold',100000)
  ) as next_level(id, nombre, umbral) on next_level.id = current_level.id + 1
  where current_level.umbral <= v_bricks
  order by current_level.umbral desc
  limit 1;

  update public.gamificacion
  set bricks = v_bricks,
      nivel = jsonb_build_object('id', v_level_id, 'nombre', v_level_name, 'umbral', v_from),
      siguiente_nivel = case when v_next_id is null then null else jsonb_build_object('id', v_next_id, 'nombre', v_next_name, 'umbral', v_to) end,
      progreso = jsonb_build_object(
        'actual', v_bricks,
        'desde', v_from,
        'hasta', v_to,
        'porcentaje', case when v_next_id is null then 100 else round(least(100, greatest(0, ((v_bricks - v_from)::numeric / (v_to - v_from)) * 100))) end
      ),
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

create or replace function private.migrar_propiedad_logro_agradecimiento()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_applied boolean;
  v_user record;
  v_logros jsonb;
begin
  select applied into v_applied
  from private.thanks_reward_ownership_migration
  where singleton = true
  for update;
  if coalesce(v_applied, false) then
    return;
  end if;

  for v_user in
    select users.user_id,
      count(*) filter (where thanks.thanker_id = users.user_id)::integer as sent_count,
      count(*) filter (where thanks.donor_id = users.user_id)::integer as received_count
    from (
      select thanker_id as user_id from public.agradecimientos_regalo
      union
      select donor_id as user_id from public.agradecimientos_regalo
    ) users
    join public.gamificacion gamification on gamification.user_id = users.user_id
    join public.agradecimientos_regalo thanks
      on thanks.thanker_id = users.user_id or thanks.donor_id = users.user_id
    group by users.user_id
  loop
    select logros into v_logros
    from public.gamificacion where user_id = v_user.user_id;
    select coalesce(jsonb_agg(entries.item order by entries.ordinality), '[]'::jsonb)
    into v_logros
    from jsonb_array_elements(v_logros) with ordinality as entries(item, ordinality)
    where entries.item->>'id' <> 'thanks-for-the-gift';
    if v_user.received_count > 0 then
      v_logros := v_logros || jsonb_build_array(jsonb_build_object(
        'id', 'thanks-for-the-gift',
        'type', 'regalo',
        'nombre', 'Gratitude is the sign of noble souls',
        'descripcion', 'Un coleccionista te dio las gracias por tu regalo.',
        'bricks', 5,
        'repetible', true,
        'cantidad', v_user.received_count,
        'total', v_user.received_count * 5
      ));
    end if;
    update public.gamificacion
    set logros = v_logros, updated_at = clock_timestamp()
    where user_id = v_user.user_id;
    if v_user.received_count <> v_user.sent_count then
      perform private.gamificacion_ajustar_bricks(
        v_user.user_id, (v_user.received_count - v_user.sent_count) * 5
      );
    end if;
  end loop;

  update private.thanks_reward_ownership_migration
  set applied = true, updated_at = clock_timestamp()
  where singleton = true;
end;
$$;

select private.migrar_propiedad_logro_agradecimiento();

update public.gamificacion gamification
set logros = (
  select coalesce(jsonb_agg(
    case when achievement.item->>'id' = 'thanks-for-the-gift' then
      jsonb_set(
        jsonb_set(achievement.item, '{nombre}', to_jsonb('Gratitude is the sign of noble souls'::text), true),
        '{descripcion}', to_jsonb('Un coleccionista te dio las gracias por tu regalo.'::text), true
      )
    else achievement.item end
    order by achievement.ordinality
  ), '[]'::jsonb)
  from jsonb_array_elements(gamification.logros) with ordinality as achievement(item, ordinality)
), updated_at = clock_timestamp()
where gamification.logros @> '[{"id":"thanks-for-the-gift"}]'::jsonb
  and exists (
    select 1
    from jsonb_array_elements(gamification.logros) as achievement(item)
    where achievement.item->>'id' = 'thanks-for-the-gift'
      and (
        achievement.item->>'nombre' is distinct from 'Gratitude is the sign of noble souls'
        or achievement.item->>'descripcion' is distinct from 'Un coleccionista te dio las gracias por tu regalo.'
      )
  );

with notification_actors as (
  select notification.id, notification.type, notification.gift_semana,
    case when notification.type = 'gift_received' then notification.gift_donante_id
      else coalesce(
        case when notification.payload->>'actorUserId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (notification.payload->>'actorUserId')::uuid end,
        acknowledgment.user_id
      ) end as actor_id
  from public.notificaciones notification
  left join lateral (
    select case when count(distinct thanks.thanker_id) = 1
      then (array_agg(distinct thanks.thanker_id))[1] end as user_id
    from public.agradecimientos_regalo thanks
    where notification.type = 'gift_thanks'
      and thanks.donor_id = notification.user_id
      and thanks.created_at = notification.created_at
  ) acknowledgment on true
  where notification.type in ('gift_received', 'gift_thanks')
), updated_identity as (
  select actor.id, jsonb_build_object(
    'user', coalesce(profile.username, 'Coleccionista'),
    'actorUserId', actor.actor_id,
    'message', case when actor.type = 'gift_thanks'
      then coalesce(profile.username, 'Coleccionista') || ' te dio las gracias por tu regalo.'
      when actor.gift_semana = '0001-01-01'::date
      then 'El usuario ' || coalesce(profile.username, 'Coleccionista') || ' vio tus tops en el Ranking Global y te regaló 50 Bricks 🧱'
      else 'El usuario ' || coalesce(profile.username, 'Coleccionista') || ' vio tus tops en el Ranking Semanal y te regaló 5 Bricks 🧱'
    end
  ) as identity_payload
  from notification_actors actor
  left join public.user_profiles profile on profile.user_id = actor.actor_id
)
update public.notificaciones notification
set payload = notification.payload || identity.identity_payload
from updated_identity identity
where notification.id = identity.id
  and notification.payload is distinct from notification.payload || identity.identity_payload;

create or replace function public.agradecer_regalo(p_notification_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_thanker_id uuid := auth.uid();
  v_notification public.notificaciones%rowtype;
  v_thanker_name text;
  v_thanks_count integer;
  v_logros jsonb;
begin
  if v_thanker_id is null then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;

  select * into v_notification
  from public.notificaciones
  where id = p_notification_id
    and user_id = v_thanker_id
    and type = 'gift_received'
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'REGALO_NO_ENCONTRADO';
  end if;
  if exists (select 1 from public.agradecimientos_regalo where gift_notification_id = p_notification_id) then
    raise exception using errcode = 'P0001', message = 'REGALO_YA_AGRADECIDO';
  end if;

  perform 1 from public.gamificacion
  where user_id in (v_thanker_id, v_notification.gift_donante_id)
  order by user_id
  for update;

  insert into public.agradecimientos_regalo (gift_notification_id, thanker_id, donor_id)
  values (p_notification_id, v_thanker_id, v_notification.gift_donante_id);
  update public.notificaciones set gift_thanked_at = clock_timestamp()
  where id = p_notification_id;

  perform private.gamificacion_ajustar_bricks(v_notification.gift_donante_id, 10);

  select coalesce(profile.username, 'Coleccionista') into v_thanker_name
  from public.user_profiles profile where profile.user_id = v_thanker_id;
  v_thanker_name := coalesce(v_thanker_name, 'Coleccionista');
  insert into public.notificaciones (user_id, type, payload)
  values (
    v_notification.gift_donante_id,
    'gift_thanks',
    jsonb_build_object(
      'user', v_thanker_name,
      'actorUserId', v_thanker_id,
      'amount', 5,
      'message', v_thanker_name || ' te dio las gracias por tu regalo.'
    )
  );

  select logros into v_logros from public.gamificacion where user_id = v_notification.gift_donante_id;
  select count(*)::integer into v_thanks_count
  from public.agradecimientos_regalo where donor_id = v_notification.gift_donante_id;
  select coalesce(jsonb_agg(item), '[]'::jsonb) into v_logros
  from jsonb_array_elements(v_logros) item
  where item->>'id' <> 'thanks-for-the-gift';
  v_logros := v_logros || jsonb_build_array(jsonb_build_object(
    'id', 'thanks-for-the-gift',
    'type', 'regalo',
    'nombre', 'Gratitude is the sign of noble souls',
    'descripcion', 'Un coleccionista te dio las gracias por tu regalo.',
    'bricks', 5,
    'repetible', true,
    'cantidad', v_thanks_count,
    'total', v_thanks_count * 5
  ));
  update public.gamificacion set logros = v_logros, updated_at = now()
  where user_id = v_notification.gift_donante_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.regalos_recibidos_count()
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.regalos_enviados
  where receptor_id = auth.uid() and auth.uid() is not null and semana = '0001-01-01';
$$;

create or replace function public.regalos_semanales_recibidos_count()
returns integer language sql security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select count(*)::integer from public.regalos_enviados
  where receptor_id = auth.uid() and auth.uid() is not null and semana <> '0001-01-01';
$$;
revoke all on function public.regalos_semanales_recibidos_count() from public, anon, service_role;
grant execute on function public.regalos_semanales_recibidos_count() to authenticated;

update public.gamificacion gamification
set logros = (
  select jsonb_agg(case when item->>'id' = 'someone-liked-your-collection'
    then jsonb_set(item, '{nombre}', to_jsonb('Your collection is top!'::text)) else item end order by position)
  from jsonb_array_elements(gamification.logros) with ordinality as achievements(item, position)
)
where exists (
  select 1 from jsonb_array_elements(gamification.logros) item
  where item->>'id' = 'someone-liked-your-collection' and item->>'nombre' <> 'Your collection is top!'
);

create or replace function public.agradecimientos_regalo_count()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;
  return jsonb_build_object(
    'sent', (select count(*)::integer from public.agradecimientos_regalo where thanker_id = v_user_id),
    'received', (select count(*)::integer from public.agradecimientos_regalo where donor_id = v_user_id)
  );
end;
$$;

create or replace function public.recalcular_agradecimientos_regalo_count(p_user_ids uuid[])
returns table (user_id uuid, sent_count integer, received_count integer)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'RECALCULO_AGRADECIMIENTOS_NO_AUTORIZADO';
  end if;
  if p_user_ids is null or cardinality(p_user_ids) > 10000 then
    raise exception using errcode = '22023', message = 'RECALCULO_AGRADECIMIENTOS_INVALIDO';
  end if;
  return query
  select requested.user_id,
    (select count(*)::integer from public.agradecimientos_regalo thanks where thanks.thanker_id = requested.user_id),
    (select count(*)::integer from public.agradecimientos_regalo thanks where thanks.donor_id = requested.user_id)
  from (select distinct ids.user_id from unnest(p_user_ids) as ids(user_id)) requested;
end;
$$;

revoke all on function public.ranking_global(text) from public, anon;
revoke all on function public.ranking_semanal() from public, anon;
revoke all on function private.ranking_semanal_contexto(timestamptz) from public, anon, authenticated;
revoke all on function private.ranking_semanal_calcular(timestamptz) from public, anon, authenticated;
revoke all on function public.ranking_logros(uuid) from public, anon;
revoke all on function public.regalar_bricks(uuid) from public, anon;
revoke all on function public.regalos_recibidos_count() from public, anon;
revoke all on function public.agradecer_regalo(uuid) from public, anon, service_role;
revoke all on function public.agradecimientos_regalo_count() from public, anon, service_role;
revoke all on function public.recalcular_agradecimientos_regalo_count(uuid[]) from public, anon, authenticated;
revoke all on function private.gamificacion_ajustar_bricks(uuid, integer) from public, anon, authenticated, service_role;
revoke all on function private.migrar_propiedad_logro_agradecimiento() from public, anon, authenticated, service_role;
revoke all on function private.dna_calcular(uuid) from public, anon, authenticated;
revoke all on function public.gamificacion_dna() from public, anon;
revoke all on table public.dna_ponderaciones from public, anon, authenticated;
grant execute on function public.ranking_global(text) to authenticated;
grant execute on function public.ranking_semanal() to authenticated;
grant execute on function public.ranking_logros(uuid) to authenticated;
grant execute on function public.regalar_bricks(uuid) to authenticated;
grant execute on function public.regalos_recibidos_count() to authenticated;
grant execute on function public.agradecer_regalo(uuid) to authenticated;
grant execute on function public.agradecimientos_regalo_count() to authenticated;
grant execute on function public.recalcular_agradecimientos_regalo_count(uuid[]) to service_role;
grant execute on function public.gamificacion_dna() to authenticated;

create or replace function private.reconcile_global_top10()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_initialized boolean;
begin
  select initialized into v_initialized
  from private.ranking_top10_reconciliation_state
  where singleton = true
  for update;

  if v_initialized then
    insert into public.notificaciones (user_id, type, payload)
    with current_members as (
      select ranked.user_id,
        row_number() over (order by coalesce((ranked.nivel->>'id')::integer, 0) desc, ranked.bricks desc, ranked.user_id asc) as rank_position
      from public.gamificacion ranked
      order by coalesce((ranked.nivel->>'id')::integer, 0) desc, ranked.bricks desc, ranked.user_id asc
      limit 10
    )
    select current_members.user_id, 'ranking_entered', jsonb_build_object(
      'ranking', 'global',
      'position', current_members.rank_position,
      'message', 'Has entrado en el Top 10 del Ranking Global en el puesto ' || current_members.rank_position || '.'
    )
    from current_members
    left join public.ranking_top10_membership previous_members
      on previous_members.user_id = current_members.user_id and previous_members.ranking_type = 'global'
    where previous_members.user_id is null;

    insert into public.notificaciones (user_id, type, payload)
    with current_members as (
      select ranked.user_id
      from public.gamificacion ranked
      order by coalesce((ranked.nivel->>'id')::integer, 0) desc, ranked.bricks desc, ranked.user_id asc
      limit 10
    )
    select previous_members.user_id, 'ranking_exited', jsonb_build_object(
      'ranking', 'global',
      'message', 'Has salido del Top 10 del Ranking Global.'
    )
    from public.ranking_top10_membership previous_members
    left join current_members on current_members.user_id = previous_members.user_id
    where previous_members.ranking_type = 'global' and current_members.user_id is null;
  end if;

  delete from public.ranking_top10_membership where ranking_type = 'global';
  insert into public.ranking_top10_membership (user_id, ranking_type, position, updated_at)
  select ranked.user_id, 'global', ranked.rank_position::smallint, clock_timestamp()
  from (
    select gamification.user_id,
      row_number() over (order by coalesce((gamification.nivel->>'id')::integer, 0) desc, gamification.bricks desc, gamification.user_id asc) as rank_position
    from public.gamificacion gamification
    order by coalesce((gamification.nivel->>'id')::integer, 0) desc, gamification.bricks desc, gamification.user_id asc
    limit 10
  ) ranked;
  update private.ranking_top10_reconciliation_state
  set initialized = true, updated_at = clock_timestamp()
  where singleton = true;
  return null;
end;
$$;

drop trigger if exists gamificacion_global_top10_reconcile on public.gamificacion;
create trigger gamificacion_global_top10_reconcile
after insert or update or delete on public.gamificacion
for each statement execute function private.reconcile_global_top10();

do $$
begin
  if not (select initialized from private.ranking_top10_reconciliation_state where singleton = true) then
    insert into public.ranking_top10_membership (user_id, ranking_type, position, updated_at)
    select ranked.user_id, 'global', ranked.rank_position::smallint, clock_timestamp()
    from (
      select gamification.user_id,
        row_number() over (order by coalesce((gamification.nivel->>'id')::integer, 0) desc, gamification.bricks desc, gamification.user_id asc) as rank_position
      from public.gamificacion gamification
      order by coalesce((gamification.nivel->>'id')::integer, 0) desc, gamification.bricks desc, gamification.user_id asc
      limit 10
    ) ranked
    on conflict (user_id, ranking_type) do nothing;
    update private.ranking_top10_reconciliation_state
    set initialized = true, updated_at = clock_timestamp()
    where singleton = true;
  end if;
end;
$$;

revoke all on function private.reconcile_global_top10() from public, anon, authenticated, service_role;
commit;