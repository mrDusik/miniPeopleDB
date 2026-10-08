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
    (logro_id = 'someone-liked-your-collection' and rarity_hunter = 0 and collector = 0 and explorer = 0 and fan = 0)
    or (logro_id <> 'someone-liked-your-collection' and rarity_hunter + collector + explorer + fan = 100)
  )
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
  ('someone-liked-your-collection', 0, 0, 0, 0)
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
  constraint daily_sync_prices_status_check check (status in ('pending', 'processing', 'completed', 'failed')),
  constraint daily_sync_prices_attempts_check check (attempts >= 0),
  constraint daily_sync_prices_price_check check (price is null or price >= 0),
  constraint daily_sync_prices_result_check check (
    (status = 'completed' and price is not null and failure_code is null)
    or (status = 'failed' and price is null and failure_code is not null)
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
  and prices.checkpoint_at >= clock_timestamp() - interval '24 hours'
order by prices.figure_id, prices.checkpoint_at desc
on conflict (figure_id) do nothing;

create table if not exists public.regalos_enviados (
  donante_id uuid not null references auth.users (id) on delete cascade,
  receptor_id uuid not null references auth.users (id) on delete cascade,
  fecha timestamptz not null default now(),
  primary key (donante_id, receptor_id),
  constraint regalos_enviados_distintos_check check (donante_id <> receptor_id)
);

create or replace function public.iniciar_daily_sync()
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
    case when cache.fetched_at >= clock_timestamp() - interval '24 hours' then 'completed' else 'pending' end,
    case when cache.fetched_at >= clock_timestamp() - interval '24 hours' then cache.price else null end,
    case when cache.fetched_at >= clock_timestamp() - interval '24 hours' then cache.fetched_at else null end
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
  if v_work.status = 'completed' then
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
    if p_price is not null or p_failure_code is null
      or p_failure_code not in ('SCRAPER_ERROR', 'TIMEOUT', 'RATE_LIMIT', 'INVALID_RESPONSE') then
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

  select count(*)::integer into v_gifts_received
  from public.regalos_enviados gifts where gifts.receptor_id = p_user_id;
  select version.fingerprint into v_fingerprint
  from public.gamificacion_categoria_version version where version.singleton = true;

  return jsonb_build_object(
    'revision', private.daily_sync_user_revision(p_user_id),
    'figures', v_figures,
    'giftsReceived', coalesce(v_gifts_received, 0),
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
revoke all on function public.fallar_daily_sync(uuid, uuid, text) from public, anon, authenticated;
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
alter table public.regalos_enviados enable row level security;
alter table public.user_daily_snapshots enable row level security;
alter table private.daily_sync_runs enable row level security;
alter table private.daily_sync_users enable row level security;
alter table private.daily_sync_prices enable row level security;
alter table private.daily_sync_figure_prices enable row level security;

revoke all on table public.user_daily_snapshots from public, anon, authenticated;
grant select on table public.user_daily_snapshots to authenticated;
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
  ), top_users as (
    select *, case p_criterio
      when 'coleccion' then total_coleccion::numeric
      when 'nivel' then coalesce((nivel->>'id')::numeric, 0)
      else coalesce((dna->'porcentajes'->>p_criterio)::numeric, 0)
    end as criterio_valor
    from candidates
    order by criterio_valor desc, coalesce((nivel->>'id')::integer, 0) desc, bricks desc, user_id asc
    limit 10
  )
  select
    top_users.user_id,
    p.avatar_url,
    coalesce(p.display_name, 'Coleccionista') as display_name,
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
      'displayName', coalesce(profile.display_name, 'Coleccionista'),
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
    left join public.perfiles_publicos profile on profile.user_id = candidate.user_id;
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
  )
  select jsonb_build_object(
    'userId', g.user_id,
    'displayName', coalesce(p.display_name, 'Coleccionista'),
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
  from top_users g
  left join public.perfiles_publicos p on p.user_id = g.user_id
  where g.user_id = p_usuario_id and auth.uid() is not null;
$$;

create or replace function public.regalar_bricks(p_receptor_id uuid)
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
    insert into public.regalos_enviados (donante_id, receptor_id)
    values (v_donante_id, p_receptor_id);
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'REGALO_YA_ENVIADO';
  end;

  select count(*)::integer into v_cantidad
  from public.regalos_enviados
  where receptor_id = p_receptor_id;
  v_bricks := v_bricks + 50;

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
  where item->>'id' <> 'someone-liked-your-collection';
  v_logros := v_logros || jsonb_build_array(jsonb_build_object(
    'id', 'someone-liked-your-collection',
    'type', 'regalo',
    'nombre', 'Someone liked your collection',
    'descripcion', 'Has aparecido en el ranking global y te han hecho un regalo.',
    'bricks', 50,
    'repetible', true,
    'cantidad', v_cantidad,
    'total', v_cantidad * 50
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
  where receptor_id = auth.uid() and auth.uid() is not null;
$$;

revoke all on function public.ranking_global(text) from public, anon;
revoke all on function public.ranking_semanal() from public, anon;
revoke all on function private.ranking_semanal_contexto(timestamptz) from public, anon, authenticated;
revoke all on function private.ranking_semanal_calcular(timestamptz) from public, anon, authenticated;
revoke all on function public.ranking_logros(uuid) from public, anon;
revoke all on function public.regalar_bricks(uuid) from public, anon;
revoke all on function public.regalos_recibidos_count() from public, anon;
revoke all on function private.dna_calcular(uuid) from public, anon, authenticated;
revoke all on function public.gamificacion_dna() from public, anon;
revoke all on table public.dna_ponderaciones from public, anon, authenticated;
grant execute on function public.ranking_global(text) to authenticated;
grant execute on function public.ranking_semanal() to authenticated;
grant execute on function public.ranking_logros(uuid) to authenticated;
grant execute on function public.regalar_bricks(uuid) to authenticated;
grant execute on function public.regalos_recibidos_count() to authenticated;
grant execute on function public.gamificacion_dna() to authenticated;
commit;