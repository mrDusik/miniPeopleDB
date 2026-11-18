begin;

alter table public.notificaciones drop constraint if exists notificaciones_social_reference_check;
alter table public.notificaciones add constraint notificaciones_social_reference_check check (
  (type = 'friend_request' and (social_request_id is not null or social_request_accepted = false))
  or (type = 'friend_request_accepted' and social_request_id is not null)
  or (type not in ('friend_request', 'friend_request_accepted') and social_request_id is null)
);

update public.notificaciones notification
set social_request_id = null
from public.friend_requests request
where request.status = 'rejected'
  and notification.type = 'friend_request'
  and notification.social_request_id = request.id
  and notification.user_id = request.recipient_id;

delete from public.friend_requests where status = 'rejected';

alter table public.friend_requests drop constraint if exists friend_requests_status_check;
alter table public.friend_requests add constraint friend_requests_status_check
  check (status in ('pending', 'accepted'));

create or replace function public.amigos_rechazar(p_solicitud_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request_sender_id uuid;
  request_status text;
begin
  if current_user_id is null or auth.role() is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;
  select sender_id, status into request_sender_id, request_status from public.friend_requests
  where id = p_solicitud_id and recipient_id = current_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'SOLICITUD_NO_ENCONTRADA';
  end if;
  if request_status = 'accepted' then
    raise exception using errcode = '23514', message = 'SOLICITUD_YA_ACEPTADA';
  end if;
  update public.notificaciones
  set social_request_id = null
  where type = 'friend_request' and social_request_id = p_solicitud_id and user_id = current_user_id;
  delete from public.friend_requests where id = p_solicitud_id;
  perform private.gamificacion_reconstruir_social(array[request_sender_id, current_user_id]);
  return jsonb_build_object('ok', true, 'status', 'rejected');
end;
$$;

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
    'sent', (select count(*) from public.friend_requests where sender_id = actor_id and status = 'pending'),
    'received', (select count(*) from public.friend_requests where recipient_id = actor_id and status = 'pending')
  );
end;
$$;

revoke all on function public.amigos_rechazar(uuid) from public, anon, service_role;
grant execute on function public.amigos_rechazar(uuid) to authenticated;
revoke all on function public.amigos_contadores() from public, anon, service_role;
grant execute on function public.amigos_contadores() to authenticated;

notify pgrst, 'reload schema';
commit;
