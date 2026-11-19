begin;

create or replace function private.enqueue_android_push_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_available_at timestamptz := new.created_at;
begin
  if new.type = 'daily_summary' then
    v_available_at := greatest(new.created_at,
      (new.snapshot_date + time '10:00') at time zone 'Europe/Madrid');
  end if;

  insert into private.android_push_outbox (notification_id, available_at, expires_at)
  values (new.id, v_available_at, v_available_at + interval '24 hours')
  on conflict (notification_id) do nothing;
  return new;
end;
$$;

revoke all on function private.enqueue_android_push_notification() from public, anon, authenticated, service_role;

with scheduled as (
  select pending.id,
    greatest(pending.available_at, notification.created_at,
      (notification.snapshot_date + time '10:00') at time zone 'Europe/Madrid') as available_at
  from private.android_push_outbox pending
  join public.notificaciones notification on notification.id = pending.notification_id
  where notification.type = 'daily_summary'
    and pending.status = 'queued'
    and pending.attempts = 0
    and pending.resolved_at is null
)
update private.android_push_outbox pending
set available_at = scheduled.available_at,
    expires_at = greatest(pending.expires_at, scheduled.available_at + interval '24 hours'),
    updated_at = clock_timestamp()
from scheduled
where pending.id = scheduled.id;

commit;
