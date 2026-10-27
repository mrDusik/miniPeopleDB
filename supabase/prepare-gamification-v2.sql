-- Replace both project-ref placeholders with the exact ref verified in the Supabase dashboard.
-- This preparation file does not reset data; the guarded reset is implemented separately.
begin;
set local app.gamification_v2_project_confirmation = 'REPLACE_WITH_PROJECT_REF';

do $$
declare
  v_expected_project_ref constant text := 'REPLACE_WITH_PROJECT_REF';
  v_database_owner text;
  v_is_superuser boolean;
begin
  if v_expected_project_ref = 'REPLACE_WITH_' || 'PROJECT_REF'
    or v_expected_project_ref !~ '^[a-z0-9]{20}$'
    or current_setting('app.gamification_v2_project_confirmation', true) is distinct from v_expected_project_ref then
    raise exception using errcode = '42501', message = 'GAMIFICACION_V2_CONFIRMAR_PROYECTO';
  end if;

  select pg_get_userbyid(datdba)
  into v_database_owner
  from pg_database
  where datname = current_database();

  select coalesce(rolsuper, false)
  into v_is_superuser
  from pg_roles
  where rolname = current_user;

  if not v_is_superuser and current_user is distinct from v_database_owner then
    raise exception using errcode = '42501', message = 'GAMIFICACION_V2_SOLO_PROPIETARIO';
  end if;
end;
$$;

create schema if not exists private;

create table if not exists private.gamificacion_v2_migration (
  singleton boolean primary key default true check (singleton),
  version text not null check (version = 'v2'),
  project_ref text not null check (project_ref ~ '^[a-z0-9]{20}$'),
  fingerprint text not null default '' check (fingerprint = '' or fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'prepared' check (status in ('prepared', 'applying', 'applied')),
  prepared_at timestamptz not null default clock_timestamp(),
  applied_at timestamptz
);
alter table private.gamificacion_v2_migration
  add column if not exists fingerprint text not null default ''
  check (fingerprint = '' or fingerprint ~ '^[0-9a-f]{64}$');
revoke all on table private.gamificacion_v2_migration from public, anon, authenticated, service_role;

do $$
declare
  v_project_ref constant text := current_setting('app.gamification_v2_project_confirmation', true);
begin
  if exists (
    select 1 from private.gamificacion_v2_migration
    where singleton and (version <> 'v2' or project_ref is distinct from v_project_ref)
  ) then
    raise exception using errcode = '55000', message = 'GAMIFICACION_V2_MARCADOR_INCOMPATIBLE';
  end if;

  insert into private.gamificacion_v2_migration(singleton, version, project_ref, status)
  values (true, 'v2', v_project_ref, 'prepared')
  on conflict (singleton) do nothing;
end;
$$;

commit;