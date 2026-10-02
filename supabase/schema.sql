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

create table if not exists public.perfiles_publicos (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  updated_at timestamptz not null default now(),
  constraint perfiles_publicos_display_name_check check (length(btrim(display_name)) between 1 and 120)
);

create table if not exists public.regalos_enviados (
  donante_id uuid not null references auth.users (id) on delete cascade,
  receptor_id uuid not null references auth.users (id) on delete cascade,
  fecha timestamptz not null default now(),
  primary key (donante_id, receptor_id),
  constraint regalos_enviados_distintos_check check (donante_id <> receptor_id)
);

create index if not exists gamificacion_ranking_idx
  on public.gamificacion (bricks desc, user_id asc);

create index if not exists minifiguras_ranking_idx
  on public.minifiguras (user_id, estado_coleccion, precio desc, anio asc);

create index if not exists regalos_enviados_receptor_idx
  on public.regalos_enviados (receptor_id);

alter table public.minifiguras enable row level security;
alter table public.gamificacion enable row level security;
alter table public.perfiles_publicos enable row level security;
alter table public.regalos_enviados enable row level security;

drop policy if exists "Users can view their minifiguras" on public.minifiguras;
create policy "Users can view their minifiguras"
  on public.minifiguras for select
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

create or replace function public.ranking_global()
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
  regalo_enviado boolean
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with top_users as (
    select g.user_id, g.bricks, g.nivel
    from public.gamificacion g
    order by g.bricks desc, g.user_id asc
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
    (select count(*) from public.minifiguras m where m.user_id = top_users.user_id and m.estado_coleccion = 'COLECCIÓN') as total_coleccion,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', ranked.id, 'nombre', ranked.nombre, 'precio', ranked.precio) order by ranked.position)
      from (
        select m.id, m.nombre, m.precio, row_number() over (order by m.precio desc nulls last, m.fecha_compra asc nulls last, m.fecha_registro desc) as position
        from public.minifiguras m
        where m.user_id = top_users.user_id and m.estado_coleccion = 'COLECCIÓN'
        order by m.precio desc nulls last, m.fecha_compra asc nulls last, m.fecha_registro desc
        limit 5
      ) ranked
    ), '[]'::jsonb) as top5_precio,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', ranked.id, 'nombre', ranked.nombre, 'anio', ranked.anio, 'precio', ranked.precio) order by ranked.position)
      from (
        select m.id, m.nombre, m.anio, m.precio, row_number() over (order by m.anio asc nulls last, m.precio desc nulls last, m.fecha_registro desc) as position
        from public.minifiguras m
        where m.user_id = top_users.user_id and m.estado_coleccion = 'COLECCIÓN'
        order by m.anio asc nulls last, m.precio desc nulls last, m.fecha_registro desc
        limit 5
      ) ranked
    ), '[]'::jsonb) as top5_antiguedad,
    exists (
      select 1 from public.regalos_enviados r
      where r.donante_id = auth.uid() and r.receptor_id = top_users.user_id
    ) as regalo_enviado
  from top_users
  left join public.perfiles_publicos p on p.user_id = top_users.user_id
  where auth.uid() is not null
  order by top_users.bricks desc, top_users.user_id asc;
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

revoke all on function public.ranking_global() from public, anon;
revoke all on function public.regalar_bricks(uuid) from public, anon;
revoke all on function public.regalos_recibidos_count() from public, anon;
grant execute on function public.ranking_global() to authenticated;
grant execute on function public.regalar_bricks(uuid) to authenticated;
grant execute on function public.regalos_recibidos_count() to authenticated;