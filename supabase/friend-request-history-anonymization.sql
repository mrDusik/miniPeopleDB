begin;

alter table public.notificaciones drop constraint if exists notificaciones_social_payload_check;

update public.notificaciones
set payload = '{}'::jsonb
where type = 'friend_request' and social_request_id is null and payload <> '{}'::jsonb;

alter table public.notificaciones add constraint notificaciones_social_payload_check check (
  type not in ('friend_request', 'friend_request_accepted')
  or (type = 'friend_request' and social_request_id is null and payload = '{}'::jsonb)
  or (social_request_id is not null and payload ? 'user' and jsonb_typeof(payload->'user') = 'string'
    and length(btrim(payload->>'user')) between 3 and 20 and payload - 'user' = '{}'::jsonb)
);

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
  set social_request_id = null, payload = '{}'::jsonb
  where type = 'friend_request' and social_request_id = p_solicitud_id and user_id = current_user_id;
  delete from public.friend_requests where id = p_solicitud_id;
  perform private.gamificacion_reconstruir_social(array[request_sender_id, current_user_id]);
  return jsonb_build_object('ok', true, 'status', 'rejected');
end;
$$;

revoke all on function public.amigos_rechazar(uuid) from public, anon, service_role;
grant execute on function public.amigos_rechazar(uuid) to authenticated;

commit;
