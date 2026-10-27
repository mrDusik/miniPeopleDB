begin;

create table if not exists public.logros_destacados (
  user_id uuid not null references auth.users(id) on delete cascade,
  logro_id text not null check (length(logro_id) between 1 and 100),
  primary key (user_id, logro_id)
);

alter table public.logros_destacados enable row level security;
revoke all on public.logros_destacados from public, anon, authenticated, service_role;
grant select on public.logros_destacados to authenticated;
drop policy if exists logros_destacados_select_own on public.logros_destacados;
create policy logros_destacados_select_own on public.logros_destacados
  for select to authenticated using (user_id = auth.uid());

create or replace function public.gamificacion_con_destacados()
returns jsonb language sql stable security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select jsonb_build_object(
    'bricks', g.bricks, 'nivel', g.nivel, 'siguienteNivel', g.siguiente_nivel,
    'progreso', g.progreso, 'logros', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', item->'id', 'type', item->'type', 'nombre', item->'nombre',
        'descripcion', item->'descripcion', 'bricks', item->'bricks',
        'repetible', item->'repetible', 'cantidad', item->'cantidad', 'total', item->'total'
      )) order by position)
      from jsonb_array_elements(g.logros) with ordinality as achievements(item, position)
    ), '[]'::jsonb),
    'logrosDestacados', coalesce((select jsonb_agg(d.logro_id order by d.logro_id)
      from public.logros_destacados d where d.user_id = g.user_id), '[]'::jsonb)
  ) from public.gamificacion g where g.user_id = auth.uid() and auth.uid() is not null;
$$;
revoke all on function public.gamificacion_con_destacados() from public, anon, service_role;
grant execute on function public.gamificacion_con_destacados() to authenticated;

create or replace function public.establecer_logro_destacado(p_logro_id text, p_destacado boolean)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_logros jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'NO_AUTENTICADO';
  end if;
  if p_logro_id is null or p_logro_id !~ '^[a-z0-9][a-z0-9-]{0,99}$' or p_destacado is null then
    raise exception using errcode = '22023', message = 'LOGRO_INVALIDO';
  end if;
  select logros into v_logros from public.gamificacion where user_id = v_user_id for update;
  if p_destacado then
    if not exists (select 1 from jsonb_array_elements(coalesce(v_logros, '[]'::jsonb)) entry
      where entry->>'id' = p_logro_id and (entry->>'cantidad')::numeric > 0) then
      raise exception using errcode = '22023', message = 'LOGRO_INVALIDO';
    end if;
    if not exists (select 1 from public.logros_destacados where user_id = v_user_id and logro_id = p_logro_id) then
      if (select count(*) from public.logros_destacados where user_id = v_user_id) >= 5 then
        raise exception using errcode = 'P0001', message = 'LIMITE_LOGROS_DESTACADOS';
      end if;
      insert into public.logros_destacados(user_id, logro_id) values (v_user_id, p_logro_id);
    end if;
  else
    delete from public.logros_destacados where user_id = v_user_id and logro_id = p_logro_id;
  end if;
  return jsonb_build_object('logrosDestacados', coalesce((
    select jsonb_agg(logro_id order by logro_id) from public.logros_destacados where user_id = v_user_id
  ), '[]'::jsonb));
end;
$$;
revoke all on function public.establecer_logro_destacado(text, boolean) from public, anon, service_role;
grant execute on function public.establecer_logro_destacado(text, boolean) to authenticated;

create or replace function private.depurar_logros_destacados()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  delete from public.logros_destacados d where d.user_id = new.user_id
    and not exists (select 1 from jsonb_array_elements(new.logros) entry
      where entry->>'id' = d.logro_id and (entry->>'cantidad')::numeric > 0);
  return new;
end;
$$;
revoke all on function private.depurar_logros_destacados() from public, anon, authenticated, service_role;
drop trigger if exists gamificacion_depurar_destacados on public.gamificacion;
create trigger gamificacion_depurar_destacados after insert or update of logros on public.gamificacion
for each row execute function private.depurar_logros_destacados();

create or replace function private.logros_publicos(p_user_id uuid, p_limite integer default null)
returns jsonb language sql stable
set search_path = pg_catalog, public, pg_temp
as $$
  select coalesce(jsonb_agg(entry.data order by entry.featured desc, entry.is_gift, entry.total desc, entry.position), '[]'::jsonb)
  from (
    select jsonb_strip_nulls(jsonb_build_object(
      'id', achievement.item->'id', 'type', achievement.item->'type',
      'nombre', achievement.item->'nombre', 'descripcion', achievement.item->'descripcion',
      'bricks', achievement.item->'bricks', 'repetible', achievement.item->'repetible',
      'cantidad', achievement.item->'cantidad', 'total', achievement.item->'total',
      'destacado', d.logro_id is not null
    )) as data, d.logro_id is not null as featured,
      coalesce(achievement.item->>'type' = 'regalo', false) as is_gift,
      coalesce((achievement.item->>'total')::numeric, 0) as total, achievement.position
    from public.gamificacion game
    cross join lateral jsonb_array_elements(game.logros) with ordinality as achievement(item, position)
    left join public.logros_destacados d on d.user_id = game.user_id and d.logro_id = achievement.item->>'id'
    where game.user_id = p_user_id
    order by featured desc, is_gift, total desc, achievement.position
    limit p_limite
  ) entry;
$$;

revoke all on function private.logros_publicos(uuid, integer) from public, anon, authenticated, service_role;

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
        'quantity', achievement.item->'cantidad', 'total', achievement.item->'total',
        'featured', achievement.item->'destacado'
      )) order by achievement.position)
      from jsonb_array_elements(private.logros_publicos(profile.user_id, 5)) with ordinality as achievement(item, position)
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
    'logros', private.logros_publicos(g.user_id)
  )
  from public.gamificacion g
  left join public.perfiles_publicos p on p.user_id = g.user_id
  left join public.user_profiles user_profile on user_profile.user_id = g.user_id
  where g.user_id = p_usuario_id and auth.uid() is not null
    and g.user_id in (select user_id from eligible_users);
$$;

revoke all on function public.amigos_perfil(uuid) from public, anon, service_role;
revoke all on function public.ranking_logros(uuid) from public, anon, service_role;
grant execute on function public.amigos_perfil(uuid) to authenticated;
grant execute on function public.ranking_logros(uuid) to authenticated;

commit;
