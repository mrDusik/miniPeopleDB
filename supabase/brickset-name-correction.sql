begin;

create or replace function public.leer_correccion_nombres_brickset(
  p_after_id text default null, p_limit integer default 500
)
returns table (id text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'CORRECCION_NOMBRES_NO_AUTORIZADA';
  end if;
  if p_limit is null or p_limit not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'CORRECCION_NOMBRES_PAGINA_INVALIDA';
  end if;
  return query
    select distinct figures.id from public.minifiguras figures
    where p_after_id is null or figures.id > p_after_id
    order by figures.id limit p_limit;
end;
$$;

create or replace function public.aplicar_correccion_nombres_brickset(
  p_id text, p_nombre text, p_descripcion text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_updated integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'CORRECCION_NOMBRES_NO_AUTORIZADA';
  end if;
  if p_id is null or length(btrim(p_id)) = 0 or p_id <> btrim(p_id)
    or p_nombre is null or length(btrim(p_nombre)) = 0 then
    raise exception using errcode = '22023', message = 'CORRECCION_NOMBRES_INVALIDA';
  end if;
  update public.minifiguras figures
  set nombre = btrim(p_nombre), descripcion = nullif(btrim(p_descripcion), '')
  where figures.id = p_id
    and (figures.nombre is distinct from btrim(p_nombre)
      or figures.descripcion is distinct from nullif(btrim(p_descripcion), ''));
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.leer_correccion_nombres_brickset(text, integer) from public, anon, authenticated;
revoke all on function public.aplicar_correccion_nombres_brickset(text, text, text) from public, anon, authenticated;
grant execute on function public.leer_correccion_nombres_brickset(text, integer) to service_role;
grant execute on function public.aplicar_correccion_nombres_brickset(text, text, text) to service_role;

notify pgrst, 'reload schema';
commit;