begin;

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

notify pgrst, 'reload schema';
commit;