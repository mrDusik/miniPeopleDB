begin;

drop trigger if exists gamificacion_depurar_destacados on public.gamificacion;
drop function if exists public.establecer_logro_destacado(text, boolean);
drop function if exists public.gamificacion_con_destacados();
drop function if exists private.depurar_logros_destacados();

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

drop function if exists private.logros_publicos(uuid, integer);
drop table if exists public.logros_destacados;

commit;
