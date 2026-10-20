alter table private.daily_sync_prices
  drop constraint if exists daily_sync_prices_status_check;

alter table private.daily_sync_prices
  add constraint daily_sync_prices_status_check
  check (status in ('pending', 'processing', 'completed', 'failed', 'unavailable'));

alter table private.daily_sync_prices
  drop constraint if exists daily_sync_prices_result_check;

alter table private.daily_sync_prices
  add constraint daily_sync_prices_result_check check (
    (status = 'completed' and price is not null and failure_code is null)
    or (status = 'failed' and price is null and failure_code is not null)
    or (status = 'unavailable' and price is null and failure_code = 'PRICE_NOT_KNOWN')
    or status in ('pending', 'processing')
  );

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