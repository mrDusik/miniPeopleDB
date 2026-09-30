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

alter table public.minifiguras enable row level security;
alter table public.gamificacion enable row level security;

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