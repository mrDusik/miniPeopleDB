-- ONLY miniPeopleDB_prueba. Run in its Supabase SQL Editor as postgres.
-- Synthetic users have no password or Google identity and cannot sign in.
-- Prices and metadata are fixtures, not current Brickset valuations.
begin;

do $$
begin
  if exists (
    select 1 from auth.users
    where id in (
      select ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid
      from generate_series(1, 20) as positions(position)
    ) or email in (
      select 'minipeopledb-seed-' || lpad(position::text, 2, '0') || '@example.invalid'
      from generate_series(1, 20) as positions(position)
    )
  ) then
    raise exception 'Seed collision or already inserted. Run the matching rollback before inserting again.';
  end if;
end;
$$;

insert into public.gamificacion_categoria_version (singleton, fingerprint)
values (true, '')
on conflict (singleton) do update set fingerprint = excluded.fingerprint, updated_at = now();

insert into private.thanks_reward_ownership_migration (singleton, applied)
values (true, true)
on conflict (singleton) do update set applied = true, updated_at = now();

insert into private.ranking_top10_reconciliation_state (singleton, initialized)
values (true, false)
on conflict (singleton) do update set initialized = false, updated_at = now();

insert into public.dna_ponderaciones (logro_id, rarity_hunter, collector, explorer, fan)
values
  ('new-mini-person', 0, 80, 10, 10),
  ('woah', 50, 20, 10, 20),
  ('deal-master', 80, 10, 0, 10),
  ('masterpiece', 90, 5, 0, 5),
  ('holy-grail', 80, 10, 0, 10),
  ('omgold', 95, 5, 0, 0),
  ('lets-go', 0, 5, 90, 5),
  ('collector', 5, 90, 0, 5),
  ('step-by-step', 5, 45, 50, 0),
  ('bricky-potter', 0, 10, 20, 70),
  ('bricky-mouse', 0, 10, 20, 70),
  ('its-a-me-mario', 0, 10, 20, 70),
  ('green-hill-zone', 0, 10, 20, 70),
  ('dimensional', 60, 10, 20, 10),
  ('warsie', 0, 10, 20, 70),
  ('in-ny-i-was', 80, 10, 0, 10),
  ('welcome-to-the-upsidedown', 60, 30, 0, 10),
  ('chill-nancy-im-fine', 80, 10, 0, 10),
  ('the-legend', 0, 10, 20, 70),
  ('heh-there-is-another-one-for-you', 0, 10, 20, 70),
  ('change-will-not-come-in-a-single-sunrise', 0, 10, 20, 70),
  ('start-poetry', 0, 10, 20, 70),
  ('mental-breakdown', 90, 5, 0, 5),
  ('the-dark-plastic', 90, 5, 0, 5),
  ('concrete-savanna', 90, 5, 0, 5),
  ('youre-shooting-for-the-stars', 20, 40, 0, 40),
  ('strike', 20, 40, 0, 40),
  ('retired-police', 90, 5, 5, 0),
  ('retired-firefighter', 90, 5, 5, 0),
  ('retired-doctor', 90, 5, 5, 0),
  ('trio-of-senior-citizens', 90, 5, 0, 5),
  ('antiquarian', 80, 10, 0, 10),
  ('to-lay-the-groundwork', 50, 50, 0, 0),
  ('investor', 50, 50, 0, 0),
  ('investment-fund', 50, 50, 0, 0),
  ('almost-millionaire', 50, 50, 0, 0),
  ('weirdo', 100, 0, 0, 0),
  ('hooked', 0, 100, 0, 0),
  ('land-ho', 0, 0, 100, 0),
  ('nerd', 0, 0, 0, 100),
  ('someone-liked-your-collection', 0, 0, 0, 0),
  ('thanks-for-the-gift', 0, 0, 0, 0)
on conflict (logro_id) do update set
  rarity_hunter = excluded.rarity_hunter,
  collector = excluded.collector,
  explorer = excluded.explorer,
  fan = excluded.fan;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid,
  'authenticated', 'authenticated',
  'minipeopledb-seed-' || lpad(position::text, 2, '0') || '@example.invalid',
  null, now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object(
    'full_name', 'Coleccionista Prueba ' || lpad(position::text, 2, '0'),
    'minipeopledb_seed', 'lego-13-prueba-v1'
  ),
  now(), now(), '', '', '', ''
from generate_series(1, 20) as positions(position);

insert into public.perfiles_publicos (user_id, display_name, avatar_url)
select id, raw_user_meta_data->>'full_name', null
from auth.users
where raw_user_meta_data->>'minipeopledb_seed' = 'lego-13-prueba-v1'
  and id in (
    select ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid
    from generate_series(1, 20) as positions(position)
  );

insert into public.minifiguras (
  user_id, id, nombre, descripcion, categoria, subcategoria, anio,
  estado_coleccion, precio_compra, fecha_compra, precio, fecha_registro, observada
)
select
  ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid,
  figure.id, figure.nombre || ' - Prueba ' || position,
  'Dato sintetico del seed lego-13-prueba-v1.',
  figure.categoria, figure.subcategoria, figure.anio,
  'COLECCI' || chr(211) || 'N',
  round(figure.precio * position / 10 * 0.7, 2),
  date '2026-01-01' + position + figure.orden,
  round(figure.precio * position / 10, 2),
  timestamptz '2026-01-01 00:00:00+00' + (position * 10 + figure.orden) * interval '1 day',
  figure.orden <= 2
from generate_series(1, 20) as positions(position)
cross join (values
  (1, 'COL001', 'Tribal Hunter', 'Collectible Minifigures', 'Collectible Minifigures Other', 2010, 3::numeric),
  (2, 'SW0001', 'Battle Droid', 'Star Wars', null, 1999, 15::numeric),
  (3, 'HP001', 'Harry Potter', 'Harry Potter', null, 2001, 55::numeric),
  (4, 'ST008', 'Stranger Things 008', 'Stranger Things', null, 2019, 120::numeric),
  (5, 'ST009', 'Stranger Things 009', 'Stranger Things', null, 2019, 350::numeric),
  (6, 'COL002', 'Cheerleader', 'Collectible Minifigures', 'Collectible Minifigures Other', 2010, 40::numeric),
  (7, 'COL003', 'Caveman', 'Collectible Minifigures', 'Collectible Minifigures Other', 2010, 75::numeric),
  (8, 'COL161', 'Mr. Gold', 'Collectible Minifigures', 'Collectible Minifigures Other', 2013, 500::numeric),
  (9, 'SW0465A', 'Star Wars 0465A', 'Star Wars', null, 2013, 325::numeric)
) as figure(orden, id, nombre, categoria, subcategoria, anio, precio)
where figure.orden <= 3 + position % 7;

insert into public.minifiguras (
  user_id, id, nombre, descripcion, categoria, subcategoria, anio,
  estado_coleccion, precio, fecha_registro, observada
)
select
  ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid,
  'COL004', 'Zombie buscado - Prueba ' || position,
  'Buscada sintetica del seed lego-13-prueba-v1.',
  'Collectible Minifigures', 'Collectible Minifigures Other', 2010,
  'BUSCADA', 25 + position,
  timestamptz '2026-09-01 00:00:00+00' + position * interval '1 day',
  position % 2 = 0
from generate_series(1, 20) as positions(position);

insert into public.regalos_enviados (donante_id, receptor_id, fecha)
select
  ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid,
  ('13000000-0000-4000-8000-' || lpad(((position + displacement - 1) % 20 + 1)::text, 12, '0'))::uuid,
  timestamptz '2026-09-01 00:00:00+00' + position * interval '1 day'
from generate_series(1, 20) as positions(position)
cross join lateral generate_series(1, 1 + position % 3) as displacements(displacement);

insert into public.notificaciones (user_id, type, payload, is_read, created_at, gift_donante_id)
select
  gift.receptor_id,
  'gift_received',
  jsonb_build_object(
    'user', coalesce(profile.display_name, 'Coleccionista'),
    'amount', 50,
    'message', 'El usuario ' || coalesce(profile.display_name, 'Coleccionista') || ' vio tus tops en el Ranking Global y te regaló 50 Bricks 🧱'
  ),
  mod(row_number() over (order by gift.donante_id, gift.receptor_id), 3) = 0,
  gift.fecha,
  gift.donante_id
from public.regalos_enviados gift
left join public.perfiles_publicos profile on profile.user_id = gift.donante_id
where gift.donante_id in (
  select ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid
  from generate_series(1, 20) as positions(position)
) and gift.receptor_id in (
  select ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid
  from generate_series(1, 20) as positions(position)
);

with gift_notifications as (
  select notification.id, notification.user_id, notification.gift_donante_id, notification.created_at,
    row_number() over (order by notification.created_at, notification.id) as ordinal
  from public.notificaciones notification
  where notification.type = 'gift_received'
    and notification.user_id in (
      select ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid
      from generate_series(1, 20) as positions(position)
    )
    and notification.gift_donante_id in (
      select ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid
      from generate_series(1, 20) as positions(position)
    )
)
insert into public.agradecimientos_regalo (gift_notification_id, thanker_id, donor_id, created_at)
select id, user_id, gift_donante_id, created_at + interval '1 minute'
from gift_notifications
where ordinal % 3 = 0;

update public.notificaciones notification
set gift_thanked_at = thanks.created_at
from public.agradecimientos_regalo thanks
where notification.id = thanks.gift_notification_id;

insert into public.notificaciones (user_id, type, payload, is_read, created_at)
select
  thanks.donor_id,
  'gift_thanks',
  jsonb_build_object(
    'user', coalesce(profile.display_name, 'Coleccionista'),
    'amount', 5,
    'message', coalesce(profile.display_name, 'Coleccionista') || ' te dio las gracias por tu regalo.'
  ),
  false,
  thanks.created_at
from public.agradecimientos_regalo thanks
left join public.perfiles_publicos profile on profile.user_id = thanks.thanker_id
where thanks.thanker_id in (
  select ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid
  from generate_series(1, 20) as positions(position)
) and thanks.donor_id in (
  select ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid
  from generate_series(1, 20) as positions(position)
);

with collection as (
  select * from public.minifiguras
  where user_id in (
    select ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid
    from generate_series(1, 20) as positions(position)
  ) and estado_coleccion = 'COLECCI' || chr(211) || 'N'
), counts as (
  select user_id,
    count(*)::integer as new_mini,
    count(*) filter (where precio > 10)::integer as woah,
    count(*) filter (where precio > 50)::integer as deal,
    count(*) filter (where precio > 100)::integer as masterpiece,
    count(*) filter (where precio > 300)::integer as grail,
    count(*) filter (where id = 'COL161')::integer as gold,
    count(distinct (categoria, subcategoria)) filter (where subcategoria is not null)::integer as subcategories,
    count(distinct categoria)::integer as categories,
    least(1, count(*) filter (where categoria = 'Harry Potter'))::integer as potter,
    least(1, count(*) filter (where categoria = 'Star Wars'))::integer as warsie,
    count(*) filter (where id = 'SW0465A')::integer as ny,
    count(*) filter (where id = 'ST008')::integer as upside,
    count(*) filter (where id = 'ST009')::integer as nancy,
    count(*) filter (where anio < 2000)::integer as antiquarian,
    coalesce(sum(coalesce(precio, precio_compra, 0)), 0)::numeric as collection_value
  from collection group by user_id
), base_achievements as (
  select counts.user_id, jsonb_agg(jsonb_build_object(
    'id', objective.id, 'nombre', objective.nombre, 'descripcion', objective.descripcion,
    'bricks', objective.bricks, 'repetible', objective.repetible,
    'cantidad', objective.cantidad, 'total', objective.bricks * objective.cantidad
  ) order by objective.orden) as logros
  from counts
  cross join lateral (values
    (1, 'new-mini-person', 'New mini person', 'Anadir una nueva minifigura.', 1, true, new_mini),
    (2, 'woah', 'WOAH!', 'Anadir una minifigura valorada en mas de 10 euros.', 10, true, woah),
    (3, 'deal-master', 'Deal master', 'Anadir una minifigura valorada en mas de 50 euros.', 50, true, deal),
    (4, 'masterpiece', 'Masterpiece', 'Anadir una minifigura valorada en mas de 100 euros.', 100, true, masterpiece),
    (5, 'holy-grail', 'Holy grail', 'Anadir una minifigura valorada en mas de 300 euros.', 500, true, grail),
    (6, 'omgold', 'OMGold!!', 'Anadir la minifigura COL161.', 5000, true, gold),
    (7, 'lets-go', 'Let''s go!', 'Anadir la primera minifigura de una subcategoria.', 5, true, subcategories),
    (9, 'step-by-step', 'Step by step', 'Anadir la primera minifigura de una categoria.', 3, true, categories),
    (10, 'bricky-potter', 'Bricky Potter', 'Anadir la primera minifigura de la categoria Harry Potter.', 10, false, potter),
    (15, 'warsie', 'Warsie', 'Anadir la primera minifigura de la categoria Star Wars.', 10, false, warsie),
    (16, 'in-ny-i-was', 'In NY, I was', 'Anadir la minifigura SW0465A.', 3000, false, ny),
    (17, 'welcome-to-the-upsidedown', 'Welcome to the Upsidedown!', 'Anadir la minifigura ST008.', 100, false, upside),
    (18, 'chill-nancy-im-fine', 'Chill, Nancy. I''m fine', 'Anadir la minifigura ST009.', 700, false, nancy),
    (19, 'antiquarian', 'Antiquarian', 'Anadir una minifigura anterior al ano 2000.', 60, true, antiquarian),
    (20, 'to-lay-the-groundwork', 'To lay the groundwork', 'Alcanzar un valor total de coleccion de 500 euros.', 500, false, (collection_value >= 500)::integer),
    (21, 'investor', 'Investor', 'Alcanzar un valor total de coleccion de 1000 euros.', 1000, false, (collection_value >= 1000)::integer),
    (22, 'investment-fund', 'Investment fund', 'Alcanzar un valor total de coleccion de 5000 euros.', 5000, false, (collection_value >= 5000)::integer),
    (23, 'almost-millionaire', 'Almost millionaire', 'Alcanzar un valor total de coleccion de 10000 euros.', 10000, false, (collection_value >= 10000)::integer)
  ) as objective(orden, id, nombre, descripcion, bricks, repetible, cantidad)
  where objective.cantidad > 0
  group by counts.user_id
), dna_scores as (
  select base.user_id,
    sum((achievement.item->>'cantidad')::numeric * weights.rarity_hunter) as rarity_hunter,
    sum((achievement.item->>'cantidad')::numeric * weights.collector) as collector,
    sum((achievement.item->>'cantidad')::numeric * weights.explorer) as explorer,
    sum((achievement.item->>'cantidad')::numeric * weights.fan) as fan
  from base_achievements base
  cross join lateral jsonb_array_elements(base.logros) as achievement(item)
  join public.dna_ponderaciones weights on weights.logro_id = achievement.item->>'id'
  group by base.user_id
), dna_totals as (
  select *, rarity_hunter + collector + explorer + fan as total from dna_scores
), achievements as (
  select base.user_id, base.logros || coalesce(jsonb_agg(jsonb_build_object(
    'id', objective.id, 'nombre', objective.nombre, 'descripcion', objective.descripcion,
    'bricks', objective.bricks, 'repetible', false, 'cantidad', 1, 'total', objective.bricks
  ) order by objective.orden) filter (where objective.cumple), '[]'::jsonb) as logros
  from base_achievements base
  join dna_totals dna on dna.user_id = base.user_id
  cross join lateral (values
    (1, 'weirdo', 'Weirdo.', 'Alcanza un porcentaje de Rarity Hunter superior al 50%.', 500, dna.total > 0 and dna.rarity_hunter * 100 / dna.total > 50),
    (2, 'hooked', 'Hooked.', 'Alcanza un porcentaje de Collector superior al 50%.', 50, dna.total > 0 and dna.collector * 100 / dna.total > 50),
    (3, 'land-ho', 'Land ho!', 'Alcanza un porcentaje de Explorer superior al 50%.', 100, dna.total > 0 and dna.explorer * 100 / dna.total > 50),
    (4, 'nerd', 'Nerd.', 'Alcanza un porcentaje de Fan superior al 50%.', 300, dna.total > 0 and dna.fan * 100 / dna.total > 50)
  ) as objective(orden, id, nombre, descripcion, bricks, cumple)
  group by base.user_id, base.logros
), with_gifts as (
  select achievements.user_id, achievements.logros || jsonb_build_array(jsonb_build_object(
    'id', 'someone-liked-your-collection', 'type', 'regalo',
    'nombre', 'Someone liked your collection',
    'descripcion', 'Has aparecido en el ranking global y te han hecho un regalo.',
    'bricks', 50, 'repetible', true, 'cantidad', received.cantidad, 'total', 50 * received.cantidad
  )) as logros
  from achievements
  cross join lateral (
    select count(*)::integer as cantidad
    from public.regalos_enviados where receptor_id = achievements.user_id
  ) received
), with_thanks as (
  select with_gifts.user_id,
    with_gifts.logros || case when thanks.cantidad > 0 then jsonb_build_array(jsonb_build_object(
      'id', 'thanks-for-the-gift', 'type', 'regalo',
      'nombre', 'Gratitude is the sign of noble souls',
      'descripcion', 'Un coleccionista te dio las gracias por tu regalo.',
      'bricks', 5, 'repetible', true, 'cantidad', thanks.cantidad, 'total', 5 * thanks.cantidad
    )) else '[]'::jsonb end as logros,
    thanks.cantidad as thanks_received
  from with_gifts
  cross join lateral (
    select count(*)::integer as cantidad
    from public.agradecimientos_regalo where donor_id = with_gifts.user_id
  ) thanks
), balances as (
  select user_id, logros, (
    select sum((item->>'total')::integer)::integer from jsonb_array_elements(logros) as items(item)
  ) + 5 * thanks_received as bricks
  from with_thanks
), levels as (
  select * from (values
    (0, 'Duplo', 0), (1, 'Stud', 20), (2, 'Plate', 50), (3, 'Three-Seven-Five', 100),
    (4, 'Citizen', 200), (5, 'Skeleton', 300), (6, 'Pirate', 400), (7, 'Captain', 500),
    (8, 'Redbeard', 750), (9, 'Forestman', 1000), (10, 'Wolfpack', 1500),
    (11, 'Wolfpack Master', 2000), (12, 'Ninja', 2500), (13, 'RX', 3000),
    (14, 'Dragon Form', 5000), (15, 'Space Baby', 6000), (16, 'Space Man', 7000),
    (17, 'Blacktron', 8000), (18, 'Technic', 9000), (19, 'Majisto', 10000),
    (20, 'Castle Knight', 12500), (21, 'Chrome Gold', 15000), (22, 'Wooden Duck', 20000),
    (23, 'De Billund', 30000), (24, 'Mr. Kirk', 50000), (25, 'Mr. Gold', 100000)
  ) as level(id, nombre, umbral)
)
insert into public.gamificacion (user_id, bricks, nivel, siguiente_nivel, progreso, logros)
select balances.user_id, balances.bricks,
  jsonb_build_object('id', current_level.id, 'nombre', current_level.nombre, 'umbral', current_level.umbral),
  case when next_level.id is null then null else
    jsonb_build_object('id', next_level.id, 'nombre', next_level.nombre, 'umbral', next_level.umbral) end,
  jsonb_build_object(
    'actual', balances.bricks, 'desde', current_level.umbral,
    'hasta', coalesce(next_level.umbral, current_level.umbral),
    'porcentaje', case when next_level.id is null then 100 else
      floor(((balances.bricks - current_level.umbral)::double precision / (next_level.umbral - current_level.umbral)) * 100 + 0.5)::integer end
  ), balances.logros
from balances
cross join lateral (
  select * from levels where umbral <= balances.bricks order by umbral desc limit 1
) current_level
left join levels next_level on next_level.id = current_level.id + 1;

with collection_metrics as (
  select user_id,
    count(*)::integer as total_figures,
    coalesce(sum(coalesce(precio, precio_compra, 0)), 0)::numeric(14, 2) as total_value
  from public.minifiguras
  where estado_coleccion = 'COLECCI' || chr(211) || 'N'
  group by user_id
), current_values as (
  select gamification.user_id,
    gamification.bricks,
    coalesce((gamification.nivel->>'id')::integer, 0) as level,
    coalesce(metrics.total_figures, 0) as total_figures,
    coalesce(metrics.total_value, 0)::numeric(14, 2) as total_value,
    private.dna_calcular(gamification.user_id) as dna
  from public.gamificacion gamification
  left join collection_metrics metrics using (user_id)
  where gamification.user_id in (
    select ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid
    from generate_series(1, 20) as positions(position)
  )
), snapshot_rows as (
  select user_id, date '2026-10-08' as snapshot_date,
    greatest(total_figures - 1, 0) as total_figures,
    greatest(total_value - 10, 0)::numeric(14, 2) as total_value,
    greatest(bricks - 10, 0) as bricks,
    greatest(level - 1, 0) as level,
    round((dna->'porcentajes'->>'collector')::numeric, 2) as pct_collector,
    round((dna->'porcentajes'->>'explorer')::numeric, 2) as pct_explorer,
    round((dna->'porcentajes'->>'rarityHunter')::numeric, 2) as pct_rarity_hunter,
    round((dna->'porcentajes'->>'fan')::numeric, 2) as pct_fan
  from current_values
  union all
  select user_id, date '2026-10-09', total_figures, total_value, bricks, level,
    round((dna->'porcentajes'->>'collector')::numeric, 2),
    round((dna->'porcentajes'->>'explorer')::numeric, 2),
    round((dna->'porcentajes'->>'rarityHunter')::numeric, 2),
    round((dna->'porcentajes'->>'fan')::numeric, 2)
  from current_values
)
insert into public.user_daily_snapshots (
  user_id, snapshot_date, total_figures, total_value, bricks, level,
  pct_collector, pct_explorer, pct_rarity_hunter, pct_fan
)
select user_id, snapshot_date, total_figures, total_value, bricks, level,
  pct_collector, pct_explorer, pct_rarity_hunter, pct_fan
from snapshot_rows;

with ranked_snapshots as (
  select snapshot.*,
    row_number() over (partition by snapshot_date order by level desc, bricks desc, user_id asc) as rank_position
  from public.user_daily_snapshots snapshot
), snapshot_pairs as (
  select current.user_id, current.snapshot_date,
    current.total_figures, previous.total_figures as previous_total_figures,
    current.total_value, previous.total_value as previous_total_value,
    current.bricks, previous.bricks as previous_bricks,
    current.level, previous.level as previous_level,
    current.pct_collector, previous.pct_collector as previous_pct_collector,
    current.pct_explorer, previous.pct_explorer as previous_pct_explorer,
    current.pct_rarity_hunter, previous.pct_rarity_hunter as previous_pct_rarity_hunter,
    current.pct_fan, previous.pct_fan as previous_pct_fan,
    current.rank_position, previous.rank_position as previous_rank_position
  from ranked_snapshots current
  join ranked_snapshots previous on previous.user_id = current.user_id
    and previous.snapshot_date = date '2026-10-08'
  where current.snapshot_date = date '2026-10-09'
)
insert into public.notificaciones (user_id, type, payload, snapshot_date)
select user_id, 'daily_summary',
  jsonb_build_object(
    'snapshotDate', snapshot_date,
    'hasPrevious', true,
    'deltas', jsonb_build_object(
      'figures', total_figures - previous_total_figures,
      'valueEur', total_value - previous_total_value,
      'bricks', bricks - previous_bricks,
      'level', level - previous_level,
      'dna', jsonb_build_object(
        'collector', pct_collector - previous_pct_collector,
        'explorer', pct_explorer - previous_pct_explorer,
        'rarityHunter', pct_rarity_hunter - previous_pct_rarity_hunter,
        'fan', pct_fan - previous_pct_fan
      )
    ) || case when rank_position <= 10 and previous_rank_position <= 10
      then jsonb_build_object('globalPosition', previous_rank_position - rank_position)
      else '{}'::jsonb end
  ), snapshot_date
from snapshot_pairs;

insert into public.notificaciones (user_id, type, payload)
select user_id, 'ranking_entered', jsonb_build_object(
  'ranking', 'global', 'position', position,
  'message', 'Has entrado en el Top 10 del Ranking Global en el puesto ' || position || '.'
)
from public.ranking_top10_membership
where ranking_type = 'global' and position = 1 and user_id in (
  select ('13000000-0000-4000-8000-' || lpad(position::text, 12, '0'))::uuid
  from generate_series(1, 20) as positions(position)
);

commit;

select count(*) as usuarios_insertados
from auth.users
where raw_user_meta_data->>'minipeopledb_seed' = 'lego-13-prueba-v1';