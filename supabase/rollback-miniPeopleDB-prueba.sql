-- ONLY miniPeopleDB_prueba. Removes only users from the matching insert script.
-- App rows, auth identities/sessions and gift links use ON DELETE CASCADE.
begin;

do $$
begin
  if exists (
    select 1 from auth.users
    where id in (
      select ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid
      from generate_series(1, 20) as positions(position)
    ) and (
      raw_user_meta_data->>'minipeopledb_seed' is distinct from 'lego-13-prueba-v1'
      or email is distinct from 'minipeopledb-seed-' || right(id::text, 2) || '@example.invalid'
    )
  ) then
    raise exception 'Rollback refused: a reserved UUID belongs to a user not owned by this seed.';
  end if;

  if exists (
    select 1 from public.regalos_enviados
    where donante_id in (
      select ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid
      from generate_series(1, 20) as positions(position)
    ) and receptor_id not in (
      select ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid
      from generate_series(1, 20) as positions(position)
    )
  ) then
    raise exception 'Rollback refused: seeded users gifted Bricks to non-seeded users; reconcile those gifts first.';
  end if;
end;
$$;

delete from auth.users
where raw_user_meta_data->>'minipeopledb_seed' = 'lego-13-prueba-v1'
  and id in (
    select ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid
    from generate_series(1, 20) as positions(position)
  )
  and email = 'minipeopledb-seed-' || right(id::text, 2) || '@example.invalid';

commit;

select count(*) as usuarios_seed_restantes
from auth.users
where raw_user_meta_data->>'minipeopledb_seed' = 'lego-13-prueba-v1';