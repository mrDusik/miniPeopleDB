-- DESTRUCTIVE: ONLY run this in the dedicated miniPeopleDB_prueba project.
-- It removes every application/Auth data row, including non-seed users.
-- Refuses to run unless all 20 reserved synthetic seed identities are valid.
-- Run insert-miniPeopleDB-prueba.sql immediately afterward to restore the test base.
begin;

do $$
begin
  if (
    select count(*) from auth.users
    where raw_user_meta_data->>'minipeopledb_seed' = 'lego-13-prueba-v1'
  ) <> 20 then
    raise exception 'Reset refused: expected exactly 20 miniPeopleDB_prueba seed users.';
  end if;
  if exists (
    select 1 from auth.users
    where raw_user_meta_data->>'minipeopledb_seed' = 'lego-13-prueba-v1'
      and (
        id not in (
          select ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid
          from generate_series(1, 20) as positions(position)
        )
        or email is distinct from 'minipeopledb-seed-' || right(id::text, 2) || '@example.invalid'
      )
  ) then
    raise exception 'Reset refused: a seed marker does not match the reserved test identities.';
  end if;
end;
$$;

truncate table
  public.minifiguras,
  public.gamificacion,
  public.user_daily_snapshots,
  public.gamificacion_categoria_version,
  public.dna_ponderaciones,
  public.regalos_enviados,
  public.notificaciones,
  public.agradecimientos_regalo,
  public.ranking_top10_membership,
  public.perfiles_publicos,
  private.daily_sync_users,
  private.daily_sync_prices,
  private.daily_sync_runs,
  private.daily_sync_figure_prices,
  private.thanks_reward_ownership_migration,
  private.ranking_top10_reconciliation_state,
  auth.users
restart identity cascade;

commit;

select count(*) as usuarios_restantes from auth.users;
