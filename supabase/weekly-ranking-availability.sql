begin;

alter table public.notificaciones drop constraint if exists notificaciones_type_check;
alter table public.notificaciones add constraint notificaciones_type_check check (type in (
  'gift_received', 'gift_thanks', 'ranking_entered', 'ranking_exited', 'daily_summary',
  'friend_request', 'friend_request_accepted', 'weekly_ranking_available'
));

create table if not exists private.weekly_ranking_publications (
  week_start date primary key,
  published_at timestamptz not null default clock_timestamp()
);
alter table private.weekly_ranking_publications enable row level security;
revoke all on table private.weekly_ranking_publications from public, anon, authenticated, service_role;

create or replace function private.publish_weekly_ranking_availability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_context record;
  v_member_count integer;
  v_published boolean;
begin
  select * into strict v_context
  from private.ranking_semanal_contexto(
    ((new.snapshot_date + 1)::timestamp at time zone 'Europe/Madrid') - interval '1 microsecond'
  );
  if not v_context.available then
    return new;
  end if;

  select count(*)::integer into v_member_count
  from private.daily_sync_weekly_membership(new.snapshot_date);
  if v_member_count = 0 then
    return new;
  end if;

  insert into private.weekly_ranking_publications(week_start)
  values (v_context.week_start)
  on conflict (week_start) do nothing
  returning true into v_published;

  if v_published then
    insert into public.notificaciones(user_id, type, payload)
    select users.id, 'weekly_ranking_available', jsonb_build_object(
      'weekStart', v_context.week_start,
      'message', 'El Ranking Semanal de esta semana ya está disponible.'
    )
    from auth.users users;
  end if;
  return new;
end;
$$;

revoke all on function private.publish_weekly_ranking_availability() from public, anon, authenticated, service_role;
drop trigger if exists daily_sync_weekly_ranking_available on private.daily_sync_runs;
create trigger daily_sync_weekly_ranking_available
after update of status on private.daily_sync_runs
for each row
when (old.status is distinct from new.status and new.status = 'completed')
execute function private.publish_weekly_ranking_availability();

do $$
declare
  v_context record;
begin
  select * into strict v_context
  from private.ranking_semanal_contexto(clock_timestamp());
  if v_context.available and exists (
    select 1 from private.daily_sync_weekly_membership(v_context.reference_date)
  ) then
    insert into private.weekly_ranking_publications(week_start)
    values (v_context.week_start)
    on conflict (week_start) do nothing;
  end if;
end;
$$;

commit;