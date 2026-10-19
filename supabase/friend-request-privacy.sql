begin;

drop policy if exists "Participants can view friend requests" on public.friend_requests;
drop policy if exists "Recipients can view friend requests" on public.friend_requests;
create policy "Recipients can view friend requests"
  on public.friend_requests for select
  to authenticated
  using ((select auth.uid()) = recipient_id);

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

revoke all on function public.amigos_buscar(text), public.amigos_listar(text) from public, anon;
grant execute on function public.amigos_buscar(text), public.amigos_listar(text) to authenticated;

notify pgrst, 'reload schema';
commit;