import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { createSupabaseMock } from '../test-support/supabase-mock.js';

test('el schema instala snapshots diarios idempotentes, validados y en cascada', async () => {
  const db = new PGlite();
  const userId = '00000000-0000-4000-8000-00000000000a';
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table auth.users (
        instance_id uuid, id uuid primary key, aud text, role text, email text unique,
        encrypted_password text, email_confirmed_at timestamptz,
        raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
        confirmation_token text, recovery_token text, email_change_token_new text, email_change text
      );
    `);

    const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
    await db.exec(schema);
    await db.exec(schema);

    const rankingDates = [
      { instant: '2026-10-11T21:59:59Z', active: false, start: '2026-10-05', end: '2026-10-11' },
      { instant: '2026-10-11T22:00:00Z', active: true, start: '2026-10-12', end: '2026-10-18' },
      { instant: '2026-03-29T01:00:00Z', active: false, start: '2026-03-23', end: '2026-03-29' },
      { instant: '2026-10-25T23:00:00Z', active: true, start: '2026-10-26', end: '2026-11-01' },
    ];
    for (const expected of rankingDates) {
      const context = (await db.query(
        'select * from private.ranking_semanal_contexto($1::timestamptz)',
        [expected.instant],
      )).rows[0];
      assert.equal(context.available, expected.active);
      assert.equal(context.available_from.toISOString().slice(0, 10), '2026-10-12');
      assert.equal(context.week_start.toISOString().slice(0, 10), expected.start);
      assert.equal(context.week_end.toISOString().slice(0, 10), expected.end);
    }
    assert.equal((await db.query("select to_regprocedure('public.ranking_semanal()') is not null as exists")).rows[0].exists, true);
    await db.query('insert into auth.users(id, email) values ($1, $2)', [userId, 'snapshot@example.invalid']);
    await assert.rejects(db.query('select public.ranking_semanal()'), /NO_AUTENTICADO/);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    const emptyWeeklyRanking = (await db.query('select public.ranking_semanal() as result')).rows[0].result;
    assert.equal(emptyWeeklyRanking.available, false);
    assert.equal(emptyWeeklyRanking.availableFrom, '2026-10-12');
    assert.deepEqual(emptyWeeklyRanking.entries, []);
    assert.match(emptyWeeklyRanking.weekStart, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(emptyWeeklyRanking.weekEnd, /^\d{4}-\d{2}-\d{2}$/);

    const snapshot = {
      user_id: userId,
      snapshot_date: '2026-10-07',
      total_figures: 2,
      total_value: 25,
      bricks: 59,
      level: 1,
      pct_collector: 60,
      pct_explorer: 10,
      pct_rarity_hunter: 10,
      pct_fan: 20,
    };
    await db.query(
      `insert into public.user_daily_snapshots (
        user_id, snapshot_date, total_figures, total_value, bricks, level,
        pct_collector, pct_explorer, pct_rarity_hunter, pct_fan
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      Object.values(snapshot),
    );
    const original = (await db.query(
      'select id, created_at from public.user_daily_snapshots where user_id = $1 and snapshot_date = $2',
      [userId, snapshot.snapshot_date],
    )).rows[0];

    await db.query(
      `insert into public.user_daily_snapshots (
        user_id, snapshot_date, total_figures, total_value, bricks, level,
        pct_collector, pct_explorer, pct_rarity_hunter, pct_fan
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      on conflict (user_id, snapshot_date) do update set
        total_figures = excluded.total_figures,
        total_value = excluded.total_value,
        bricks = excluded.bricks,
        level = excluded.level,
        pct_collector = excluded.pct_collector,
        pct_explorer = excluded.pct_explorer,
        pct_rarity_hunter = excluded.pct_rarity_hunter,
        pct_fan = excluded.pct_fan`,
      [userId, snapshot.snapshot_date, 3, 30, 60, 2, 25, 25, 25, 25],
    );
    const updated = (await db.query(
      'select id, created_at, total_figures, total_value, level from public.user_daily_snapshots where user_id = $1 and snapshot_date = $2',
      [userId, snapshot.snapshot_date],
    )).rows[0];
    assert.equal(updated.id, original.id);
    assert.equal(updated.created_at.toISOString(), original.created_at.toISOString());
    assert.equal(updated.total_figures, 3);
    assert.equal(Number(updated.total_value), 30);
    assert.equal(updated.level, 2);

    const invalidRows = [
      { ...snapshot, total_figures: -1 },
      { ...snapshot, total_value: -0.01 },
      { ...snapshot, bricks: -1 },
      { ...snapshot, level: -1 },
      { ...snapshot, pct_collector: 100.01, pct_explorer: 0, pct_rarity_hunter: 0, pct_fan: 0 },
      { ...snapshot, pct_collector: 30, pct_explorer: 30, pct_rarity_hunter: 30, pct_fan: 9 },
    ];
    for (const [index, invalid] of invalidRows.entries()) {
      await assert.rejects(db.query(
        `insert into public.user_daily_snapshots (
          user_id, snapshot_date, total_figures, total_value, bricks, level,
          pct_collector, pct_explorer, pct_rarity_hunter, pct_fan
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [userId, `2026-10-${String(index + 8).padStart(2, '0')}`, invalid.total_figures, invalid.total_value,
          invalid.bricks, invalid.level, invalid.pct_collector, invalid.pct_explorer,
          invalid.pct_rarity_hunter, invalid.pct_fan],
      ));
    }
    await db.query('delete from auth.users where id = $1', [userId]);
    assert.equal((await db.query('select count(*)::integer as count from public.user_daily_snapshots')).rows[0].count, 0);
  } finally {
    await db.close();
  }
});

test('el ranking semanal calcula deltas netos privados antes del Top 10 y publica solo la proyeccion autorizada', async () => {
  const db = new PGlite();
  const userId = (index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
  const rankingUsers = [
    { index: 1, bricks: 900, delta: 450 },
    { index: 2, bricks: 20, delta: 700 },
    { index: 3, bricks: 600, delta: 0 },
    { index: 4, bricks: 500, delta: -100 },
    ...Array.from({ length: 6 }, (_, index) => ({ index: index + 5, bricks: 1000, delta: 1 })),
  ];
  const excludedUsers = [{ index: 11, bricks: 75 }, { index: 12, bricks: 80 }];
  const globalOnlyUsers = Array.from({ length: 10 }, (_, index) => ({ index: index + 20, bricks: 30000 - index }));
  const allUsers = [...rankingUsers, ...excludedUsers, ...globalOnlyUsers];
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table auth.users (
        instance_id uuid, id uuid primary key, aud text, role text, email text unique,
        encrypted_password text, email_confirmed_at timestamptz,
        raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
        confirmation_token text, recovery_token text, email_change_token_new text, email_change text
      );
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id, email) select $1::uuid, $2', [userId(1), 'weekly@example.invalid']);
    for (const user of allUsers.slice(1)) {
      await db.query('insert into auth.users(id, email) values ($1, $2)', [userId(user.index), `user-${user.index}@example.invalid`]);
    }
    for (const user of allUsers) {
      await db.query('insert into public.gamificacion(user_id, bricks, nivel) values ($1, $2, $3)', [
        userId(user.index), user.bricks,
        JSON.stringify({ id: user.index >= 20 ? 25 : 1, nombre: user.index >= 20 ? 'Mr. Gold' : 'Stud' }),
      ]);
    }
    for (const user of rankingUsers) {
      const baseline = user.index === 1 ? 1000 : user.index === 2 ? 500 : user.index === 3 ? 200 : user.index === 4 ? 400 : 100;
      for (const snapshot of [
        { date: '2026-10-11', bricks: baseline },
        { date: '2026-10-13', bricks: baseline + user.delta },
      ]) {
        await db.query(`
          insert into public.user_daily_snapshots (
            user_id, snapshot_date, total_figures, total_value, bricks, level,
            pct_collector, pct_explorer, pct_rarity_hunter, pct_fan
          ) values ($1, $2, 1, 50, $3, 1, 25, 25, 25, 25)
        `, [userId(user.index), snapshot.date, snapshot.bricks]);
      }
    }
    await db.query(`
      insert into public.user_daily_snapshots (
        user_id, snapshot_date, total_figures, total_value, bricks, level,
        pct_collector, pct_explorer, pct_rarity_hunter, pct_fan
      ) values
        ($1, '2026-10-13', 1, 50, 999, 1, 25, 25, 25, 25),
        ($2, '2026-10-11', 1, 50, 100, 1, 25, 25, 25, 25),
        ($2, '2026-10-15', 1, 50, 200, 1, 25, 25, 25, 25)
    `, [userId(11), userId(12)]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId(1)]);

    const beforeLaunch = (await db.query(
      "select private.ranking_semanal_calcular('2026-10-08T12:00:00Z'::timestamptz) as result",
    )).rows[0].result;
    assert.equal(beforeLaunch.available, false);
    assert.deepEqual(beforeLaunch.entries, []);
    const mondayWithoutCapture = (await db.query(
      "select private.ranking_semanal_calcular('2026-10-12T08:00:00Z'::timestamptz) as result",
    )).rows[0].result;
    assert.equal(mondayWithoutCapture.available, false);
    assert.deepEqual(mondayWithoutCapture.entries, []);

    await db.query(`
      insert into public.minifiguras(user_id, id, nombre, categoria, precio, precio_compra, fecha_compra, anio)
      values ($1, 'WEEK-1', 'Weekly figure', 'Test', 200, 50, '2020-01-01', 2020)
    `, [userId(2)]);
    await db.query('insert into public.regalos_enviados(donante_id, receptor_id) values ($1, $2)', [userId(1), userId(2)]);

    const result = (await db.query(
      "select private.ranking_semanal_calcular('2026-10-14T12:00:00Z'::timestamptz) as result",
    )).rows[0].result;
    assert.equal(result.available, true);
    assert.equal(result.weekStart, '2026-10-12');
    assert.equal(result.weekEnd, '2026-10-18');
    assert.equal(result.entries.length, 10);
    assert.deepEqual(result.entries.map(({ userId: id, bricksSemanales }) => [id, bricksSemanales]), [
      [userId(2), 700], [userId(1), 450],
      ...Array.from({ length: 6 }, (_, index) => [userId(index + 5), 1]),
      [userId(3), 0], [userId(4), -100],
    ]);
    assert.equal(result.entries[0].bricks, 20);
    assert.equal(result.entries[0].snapshotDate, '2026-10-13');
    assert.equal(result.entries[0].regaloEnviado, true);
    assert.equal(result.entries[0].totalColeccion, 1);
    assert.equal(result.entries[0].top5Precio[0].id, 'WEEK-1');
    assert.ok(result.entries.every(({ dnaRasgos }) => dnaRasgos.length <= 2));
    assert.deepEqual(Object.keys(result.entries[0]).sort(), [
      'avatarUrl', 'bricks', 'bricksSemanales', 'displayName', 'dnaPrincipal', 'dnaRasgos',
      'imagenNivel', 'nivel', 'nombreNivel', 'regaloEnviado', 'snapshotDate', 'top5Antiguedad',
      'top5Precio', 'totalColeccion', 'userId',
    ].sort());
    assert.equal(JSON.stringify(result).includes('precio_compra'), false);
    assert.equal(JSON.stringify(result).includes('total_value'), false);
    assert.equal(JSON.stringify(result).includes('weekly@example.invalid'), false);
    assert.equal(result.entries.some(({ userId: id }) => id === userId(11) || id === userId(12)), false);
    const globalIds = (await db.query('select user_id from public.ranking_global()')).rows.map(({ user_id }) => user_id);
    assert.equal(globalIds.length, 10);
    assert.equal(globalIds.includes(userId(2)), false);

    assert.equal((await db.query("select has_function_privilege('authenticated', 'public.ranking_semanal()', 'EXECUTE') as allowed")).rows[0].allowed, true);
    assert.equal((await db.query("select has_function_privilege('anon', 'public.ranking_semanal()', 'EXECUTE') as allowed")).rows[0].allowed, false);
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await db.query('select has_function_privilege($1, $2, \'EXECUTE\') as allowed', [
        role, 'private.ranking_semanal_calcular(timestamptz)',
      ])).rows[0].allowed, false);
      assert.equal((await db.query('select has_function_privilege($1, $2, \'EXECUTE\') as allowed', [
        role, 'private.ranking_semanal_contexto(timestamptz)',
      ])).rows[0].allowed, false);
    }
    await db.query('set role authenticated');
    assert.equal((await db.query('select count(*)::integer as count from public.user_daily_snapshots where user_id <> $1', [userId(1)])).rows[0].count, 0);
    await db.query('reset role');
  } finally {
    await db.close();
  }
});

test('las tablas privadas materializan usuarios sin actividad y mantienen un solo run activo', async () => {
  const db = new PGlite();
  const userWithCollection = '00000000-0000-4000-8000-00000000000a';
  const emptyUser = '00000000-0000-4000-8000-00000000000b';
  const runId = '10000000-0000-4000-8000-000000000001';
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table auth.users (
        instance_id uuid, id uuid primary key, aud text, role text, email text unique,
        encrypted_password text, email_confirmed_at timestamptz,
        raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
        confirmation_token text, recovery_token text, email_change_token_new text, email_change text
      );
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id, email) values ($1, $2), ($3, $4)', [
      userWithCollection, 'collection@example.invalid', emptyUser, 'empty@example.invalid',
    ]);
    await db.query('insert into public.minifiguras(user_id, id, nombre, categoria) values ($1, $2, $3, $4)', [
      userWithCollection, 'FIG-1', 'Figure', 'Test',
    ]);
    await db.query(
      "insert into private.daily_sync_runs(id, snapshot_date, status, phase, total_users) values ($1, '2026-10-07', 'pending', 'prices', 2)",
      [runId],
    );
    await db.query('insert into private.daily_sync_users(run_id, user_id) select $1, id from auth.users', [runId]);
    await db.query('insert into private.daily_sync_prices(run_id, figure_id) values ($1, $2)', [runId, 'FIG-1']);

    assert.equal((await db.query('select count(*)::integer as count from private.daily_sync_users where run_id = $1', [runId])).rows[0].count, 2);
    assert.equal((await db.query('select count(*)::integer as count from public.minifiguras where user_id = $1', [emptyUser])).rows[0].count, 0);
    await assert.rejects(
      db.query("insert into private.daily_sync_runs(snapshot_date, status) values ('2026-10-08', 'running')"),
      /daily_sync_runs_one_active_idx/,
    );

    await db.query('delete from auth.users where id = $1', [emptyUser]);
    assert.equal((await db.query('select count(*)::integer as count from private.daily_sync_runs where id = $1', [runId])).rows[0].count, 1);
    assert.equal((await db.query('select count(*)::integer as count from private.daily_sync_users where run_id = $1', [runId])).rows[0].count, 1);
    assert.equal((await db.query('select count(*)::integer as count from private.daily_sync_prices where run_id = $1', [runId])).rows[0].count, 1);
  } finally {
    await db.close();
  }
});

test('RLS limita snapshots al usuario autenticado y bloquea DML y metadatos privados', async () => {
  const db = new PGlite();
  const userA = '00000000-0000-4000-8000-00000000000a';
  const userB = '00000000-0000-4000-8000-00000000000b';
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table auth.users (
        instance_id uuid, id uuid primary key, aud text, role text, email text unique,
        encrypted_password text, email_confirmed_at timestamptz,
        raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
        confirmation_token text, recovery_token text, email_change_token_new text, email_change text
      );
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id, email) values ($1, $2), ($3, $4)', [
      userA, 'user-a@example.invalid', userB, 'user-b@example.invalid',
    ]);
    await db.query(
      `insert into public.user_daily_snapshots (
        user_id, snapshot_date, total_figures, total_value, bricks, level,
        pct_collector, pct_explorer, pct_rarity_hunter, pct_fan
      ) values ($1, '2026-10-07', 1, 10, 20, 1, 25, 25, 25, 25),
               ($2, '2026-10-07', 2, 20, 30, 2, 25, 25, 25, 25)`,
      [userA, userB],
    );

    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userA]);
    await db.query('set role authenticated');
    assert.equal((await db.query('select count(*)::integer as count from public.user_daily_snapshots')).rows[0].count, 1);
    await assert.rejects(db.query("insert into public.user_daily_snapshots(user_id, snapshot_date) values ($1, '2026-10-08')", [userA]));
    await assert.rejects(db.query("update public.user_daily_snapshots set total_figures = 99 where user_id = $1", [userA]));
    await assert.rejects(db.query('delete from public.user_daily_snapshots where user_id = $1', [userA]));
    await assert.rejects(db.query('select * from private.daily_sync_runs'));
    await db.query('reset role');

    await db.query('set role anon');
    await assert.rejects(db.query('select * from public.user_daily_snapshots'));
    await assert.rejects(db.query('insert into public.user_daily_snapshots(user_id, snapshot_date) values ($1, \'2026-10-08\')', [userA]));
    await assert.rejects(db.query('select * from private.daily_sync_users'));
    await db.query('reset role');

    for (const role of ['anon', 'authenticated']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        assert.equal((await db.query('select has_table_privilege($1, $2, $3) as allowed', [role, 'private.daily_sync_runs', privilege])).rows[0].allowed, false);
        if (privilege !== 'SELECT') {
          assert.equal((await db.query('select has_table_privilege($1, $2, $3) as allowed', [role, 'public.user_daily_snapshots', privilege])).rows[0].allowed, false);
        }
      }
    }
    assert.equal((await db.query("select count(*)::integer as count from pg_policies where schemaname = 'public' and tablename = 'user_daily_snapshots' and cmd <> 'SELECT'")).rows[0].count, 0);
    assert.equal((await db.query("select count(*)::integer as count from pg_policies where schemaname = 'private' and tablename like 'daily_sync_%'")).rows[0].count, 0);
  } finally {
    await db.close();
  }
});

test('inicio y estado diario solo se ejecutan por RPC allowlisted y fijan roster/IDs', async () => {
  const db = new PGlite();
  const userA = '00000000-0000-4000-8000-00000000000a';
  const userB = '00000000-0000-4000-8000-00000000000b';
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table auth.users (
        instance_id uuid, id uuid primary key, aud text, role text, email text unique,
        encrypted_password text, email_confirmed_at timestamptz,
        raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
        confirmation_token text, recovery_token text, email_change_token_new text, email_change text
      );
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id, email) values ($1, $2), ($3, $4)', [
      userA, 'user-a@example.invalid', userB, 'user-b@example.invalid',
    ]);
    await db.query(
      `insert into public.minifiguras(user_id, id, nombre, categoria, estado_coleccion)
       values ($1, 'FIG-A', 'Figure A', 'Test', 'COLECCIÓN'),
              ($1, 'FIG-SHARED', 'Shared', 'Test', 'BUSCADA'),
              ($2, 'FIG-SHARED', 'Shared', 'Test', 'COLECCIÓN'),
              ($2, 'FIG-B', 'Figure B', 'Test', 'COLECCIÓN')`,
      [userA, userB],
    );

    for (const role of ['anon', 'authenticated']) {
      assert.equal((await db.query('select has_function_privilege($1, $2, \'EXECUTE\') as allowed', [
        role, 'public.iniciar_daily_sync()',
      ])).rows[0].allowed, false);
      assert.equal((await db.query('select has_function_privilege($1, $2, \'EXECUTE\') as allowed', [
        role, 'public.consultar_daily_sync(uuid)',
      ])).rows[0].allowed, false);
    }
    assert.equal((await db.query("select has_function_privilege('service_role', 'public.iniciar_daily_sync()', 'EXECUTE') as allowed")).rows[0].allowed, true);
    await db.query("select set_config('request.jwt.claim.role', 'authenticated', false)");
    await assert.rejects(db.query('select public.iniciar_daily_sync()'));

    await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");
    const started = (await db.query('select public.iniciar_daily_sync() as data')).rows[0].data;
    assert.match(started.jobId, /^[0-9a-f-]{36}$/i);
    assert.equal(started.status, 'pending');
    const madridDate = (await db.query("select (clock_timestamp() at time zone 'Europe/Madrid')::date::text as today")).rows[0].today;
    assert.equal(started.snapshotDate, madridDate);
    assert.equal((await db.query('select count(*)::integer as count from private.daily_sync_users where run_id = $1', [started.jobId])).rows[0].count, 2);
    assert.equal((await db.query('select count(*)::integer as count from private.daily_sync_prices where run_id = $1', [started.jobId])).rows[0].count, 3);

    const repeated = (await db.query('select public.iniciar_daily_sync() as data')).rows[0].data;
    assert.deepEqual(repeated, started);
    const status = (await db.query('select public.consultar_daily_sync($1) as data', [started.jobId])).rows[0].data;
    assert.deepEqual(Object.keys(status).sort(), [
      'errorCode', 'failedPrices', 'jobId', 'processedUsers', 'result', 'snapshotDate', 'status', 'totalUsers',
    ]);
    assert.equal(status.processedUsers, 0);
    assert.equal(status.totalUsers, 2);
    assert.equal(status.result, null);
    assert.equal(JSON.stringify(status).includes('email'), false);
    assert.equal(JSON.stringify(status).includes('ponderaciones'), false);
    assert.equal((await db.query("select ('2026-01-01 23:30:00+00'::timestamptz at time zone 'Europe/Madrid')::date::text as winter, ('2026-06-01 22:30:00+00'::timestamptz at time zone 'Europe/Madrid')::date::text as summer")).rows[0].winter, '2026-01-02');
    assert.equal((await db.query("select ('2026-06-01 22:30:00+00'::timestamptz at time zone 'Europe/Madrid')::date::text as summer")).rows[0].summer, '2026-06-02');
  } finally {
    await db.close();
  }
});

test('lease diario reemplaza workers caducados y pagina mas de mil usuarios e IDs', async () => {
  const db = new PGlite();
  const oldOwner = '30000000-0000-4000-8000-000000000001';
  const newOwner = '30000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table auth.users (
        instance_id uuid, id uuid primary key, aud text, role text, email text unique,
        encrypted_password text, email_confirmed_at timestamptz,
        raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
        confirmation_token text, recovery_token text, email_change_token_new text, email_change text
      );
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query(`
      insert into auth.users(id)
      select ('00000000-0000-4000-8000-' || lpad(value::text, 12, '0'))::uuid
      from generate_series(1, 1005) value
    `);
    await db.query(`
      insert into public.minifiguras(user_id, id, nombre, categoria)
      select '00000000-0000-4000-8000-000000000001'::uuid,
        'FIG-' || lpad(value::text, 4, '0'), 'Figure', 'Test'
      from generate_series(1, 1005) value
    `);
    await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");
    const started = (await db.query('select public.iniciar_daily_sync() as data')).rows[0].data;
    assert.equal(await db.query('select public.reclamar_daily_sync($1, $2, 120)', [started.jobId, oldOwner]).then(({ rows }) => rows[0].reclamar_daily_sync), true);
    assert.equal(await db.query('select public.reclamar_daily_sync($1, $2, 120)', [started.jobId, newOwner]).then(({ rows }) => rows[0].reclamar_daily_sync), false);

    await db.query('update private.daily_sync_runs set lease_expires_at = clock_timestamp() - interval \'1 second\' where id = $1', [started.jobId]);
    assert.equal(await db.query('select public.reclamar_daily_sync($1, $2, 120)', [started.jobId, newOwner]).then(({ rows }) => rows[0].reclamar_daily_sync), true);
    assert.equal(await db.query('select public.renovar_daily_sync($1, $2, 120)', [started.jobId, oldOwner]).then(({ rows }) => rows[0].renovar_daily_sync), false);
    await assert.rejects(db.query('select * from public.leer_daily_sync_usuarios($1, $2, null, 1000)', [started.jobId, oldOwner]), /DAILY_SYNC_LEASE_CADUCADO/);
    assert.equal(await db.query('select public.renovar_daily_sync($1, $2, 120)', [started.jobId, newOwner]).then(({ rows }) => rows[0].renovar_daily_sync), true);

    const readAllPages = async (functionName, afterColumn, afterValue) => {
      const rows = [];
      let after = null;
      while (true) {
        const page = (await db.query(`select * from public.${functionName}($1, $2, $3, 700)`, [started.jobId, newOwner, after])).rows;
        rows.push(...page);
        if (page.length < 700) break;
        after = page.at(-1)[afterColumn];
      }
      return rows;
    };
    const users = await readAllPages('leer_daily_sync_usuarios', 'user_id');
    const prices = await readAllPages('leer_daily_sync_precios', 'figure_id');
    assert.equal(users.length, 1005);
    assert.equal(prices.length, 1005);
    assert.equal(new Set(users.map(({ user_id }) => user_id)).size, 1005);
    assert.equal(new Set(prices.map(({ figure_id }) => figure_id)).size, 1005);
  } finally {
    await db.close();
  }
});

test('checkpoint de precio deduplica IDs, conserva precios fallidos y no recrea figuras', async () => {
  const db = new PGlite();
  const userA = '00000000-0000-4000-8000-00000000000a';
  const userB = '00000000-0000-4000-8000-00000000000b';
  const leaseOwner = '40000000-0000-4000-8000-000000000001';
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table auth.users (
        instance_id uuid, id uuid primary key, aud text, role text, email text unique,
        encrypted_password text, email_confirmed_at timestamptz,
        raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
        confirmation_token text, recovery_token text, email_change_token_new text, email_change text
      );
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id, email) values ($1, $2), ($3, $4)', [
      userA, 'user-a@example.invalid', userB, 'user-b@example.invalid',
    ]);
    await db.query(
      `insert into public.minifiguras(user_id, id, nombre, categoria, precio)
       values ($1, 'FIG-SHARED', 'Shared A', 'Test', 8),
              ($1, 'FIG-FAIL', 'Failure', 'Test', 6),
              ($2, 'FIG-SHARED', 'Shared B', 'Test', 9),
              ($2, 'FIG-DELETE', 'Deleted', 'Test', 11)`,
      [userA, userB],
    );
    await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");
    const started = (await db.query('select public.iniciar_daily_sync() as data')).rows[0].data;
    await db.query('select public.reclamar_daily_sync($1, $2, 120)', [started.jobId, leaseOwner]);
    assert.equal((await db.query('select count(*)::integer as count from private.daily_sync_prices where run_id = $1', [started.jobId])).rows[0].count, 3);

    await db.query('select public.aplicar_daily_sync_precio($1, $2, $3, true, 12.5, null)', [started.jobId, leaseOwner, 'FIG-SHARED']);
    assert.deepEqual((await db.query('select user_id, precio from public.minifiguras where id = $1 order by user_id', ['FIG-SHARED'])).rows.map(({ precio }) => Number(precio)), [12.5, 12.5]);
    await db.query("select public.aplicar_daily_sync_precio($1, $2, 'FIG-FAIL', false, null, 'TIMEOUT')", [started.jobId, leaseOwner]);
    assert.deepEqual((await db.query('select precio from public.minifiguras where id = $1 order by user_id', ['FIG-FAIL'])).rows.map(({ precio }) => Number(precio)), [6]);
    await assert.rejects(db.query("select public.aplicar_daily_sync_precio($1, $2, 'FIG-FAIL', true, -1, null)", [started.jobId, leaseOwner]), /DAILY_SYNC_PRECIO_INVALIDO/);
    await assert.rejects(db.query("select public.aplicar_daily_sync_precio($1, $2, 'FIG-FAIL', false, null, 'OTHER')", [started.jobId, leaseOwner]), /DAILY_SYNC_PRECIO_INVALIDO/);

    await db.query("delete from public.minifiguras where id = 'FIG-DELETE'");
    await db.query("select public.aplicar_daily_sync_precio($1, $2, 'FIG-DELETE', true, 99, null)", [started.jobId, leaseOwner]);
    assert.equal((await db.query("select count(*)::integer as count from public.minifiguras where id = 'FIG-DELETE'")).rows[0].count, 0);
    assert.equal((await db.query("select status from private.daily_sync_prices where run_id = $1 and figure_id = 'FIG-DELETE'", [started.jobId])).rows[0].status, 'completed');
  } finally {
    await db.close();
  }
});

test('captura rechaza revisiones obsoletas de inventario, regalos y fingerprint sin perder fuentes', async () => {
  const db = new PGlite();
  const userId = '00000000-0000-4000-8000-00000000000a';
  const donorId = '00000000-0000-4000-8000-00000000000b';
  const leaseOwner = '50000000-0000-4000-8000-000000000001';
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table auth.users (
        instance_id uuid, id uuid primary key, aud text, role text, email text unique,
        encrypted_password text, email_confirmed_at timestamptz,
        raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
        confirmation_token text, recovery_token text, email_change_token_new text, email_change text
      );
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id, email) values ($1, $2), ($3, $4)', [
      userId, 'snapshot-user@example.invalid', donorId, 'donor@example.invalid',
    ]);
    await db.query(
      "insert into public.minifiguras(user_id, id, nombre, categoria, estado_coleccion, precio, precio_compra) values ($1, 'FIG-1', 'Figure', 'Test', 'COLECCIÓN', 20, 10)",
      [userId],
    );
    await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");
    const started = (await db.query('select public.iniciar_daily_sync() as data')).rows[0].data;
    await db.query('select public.reclamar_daily_sync($1, $2, 120)', [started.jobId, leaseOwner]);
    const oldState = {
      bricks: 0,
      nivel: { id: 0, nombre: 'Duplo' },
      siguiente_nivel: { id: 1, nombre: 'Stud' },
      progreso: { actual: 0 },
      logros: [],
    };

    const beforeFigureEdit = (await db.query('select public.leer_daily_sync_fuentes($1, $2, $3) as data', [started.jobId, leaseOwner, userId])).rows[0].data;
    await db.query("update public.minifiguras set precio = 30 where user_id = $1 and id = 'FIG-1'", [userId]);
    assert.equal((await db.query('select public.capturar_daily_sync_usuario($1, $2, $3, $4, $5::jsonb) as captured', [
      started.jobId, leaseOwner, userId, beforeFigureEdit.revision, JSON.stringify(oldState),
    ])).rows[0].captured, false);
    const afterFigureEdit = (await db.query('select public.leer_daily_sync_fuentes($1, $2, $3) as data', [started.jobId, leaseOwner, userId])).rows[0].data;
    assert.notEqual(afterFigureEdit.revision, beforeFigureEdit.revision);
    assert.equal(afterFigureEdit.figures[0].precio, 30);

    await db.query('insert into public.regalos_enviados(donante_id, receptor_id) values ($1, $2)', [donorId, userId]);
    assert.equal((await db.query('select public.capturar_daily_sync_usuario($1, $2, $3, $4, $5::jsonb) as captured', [
      started.jobId, leaseOwner, userId, afterFigureEdit.revision, JSON.stringify(oldState),
    ])).rows[0].captured, false);
    const afterGift = (await db.query('select public.leer_daily_sync_fuentes($1, $2, $3) as data', [started.jobId, leaseOwner, userId])).rows[0].data;
    assert.notEqual(afterGift.revision, afterFigureEdit.revision);
    assert.equal(afterGift.giftsReceived, 1);
    assert.equal((await db.query('select count(*)::integer as count from public.regalos_enviados where receptor_id = $1', [userId])).rows[0].count, 1);

    const giftNotification = (await db.query(`
      insert into public.notificaciones(user_id, type, payload, gift_donante_id)
      values ($1, 'gift_received', '{"amount":50}'::jsonb, $2)
      returning id
    `, [userId, donorId])).rows[0];
    await db.query(`
      insert into public.agradecimientos_regalo(gift_notification_id, thanker_id, donor_id)
      values ($1, $2, $3)
    `, [giftNotification.id, userId, donorId]);
    const afterThanks = (await db.query('select public.leer_daily_sync_fuentes($1, $2, $3) as data', [started.jobId, leaseOwner, userId])).rows[0].data;
    assert.notEqual(afterThanks.revision, afterGift.revision);
    assert.equal(afterThanks.thanksSent, 1);
    assert.equal(afterThanks.thanksReceived, 0);
    const donorSources = (await db.query('select public.leer_daily_sync_fuentes($1, $2, $3) as data', [started.jobId, leaseOwner, donorId])).rows[0].data;
    assert.equal(donorSources.thanksSent, 0);
    assert.equal(donorSources.thanksReceived, 1);
    assert.equal((await db.query('select public.capturar_daily_sync_usuario($1, $2, $3, $4, $5::jsonb) as captured', [
      started.jobId, leaseOwner, userId, afterGift.revision, JSON.stringify(oldState),
    ])).rows[0].captured, false);

    await db.query("update public.gamificacion_categoria_version set fingerprint = $1 where singleton = true", ['a'.repeat(64)]);
    assert.equal((await db.query('select public.capturar_daily_sync_usuario($1, $2, $3, $4, $5::jsonb) as captured', [
      started.jobId, leaseOwner, userId, afterThanks.revision, JSON.stringify(oldState),
    ])).rows[0].captured, false);
    const currentSources = (await db.query('select public.leer_daily_sync_fuentes($1, $2, $3) as data', [started.jobId, leaseOwner, userId])).rows[0].data;
    assert.notEqual(currentSources.revision, afterThanks.revision);
    assert.equal(currentSources.fingerprint, 'a'.repeat(64));

    const currentState = {
      bricks: 50,
      nivel: { id: 1, nombre: 'Stud' },
      siguiente_nivel: { id: 2, nombre: 'Plate' },
      progreso: { actual: 50 },
      logros: [{ id: 'someone-liked-your-collection', cantidad: 1, bricks: 50 }],
    };
    assert.equal((await db.query('select public.capturar_daily_sync_usuario($1, $2, $3, $4, $5::jsonb) as captured', [
      started.jobId, leaseOwner, userId, currentSources.revision, JSON.stringify(currentState),
    ])).rows[0].captured, true);
    assert.deepEqual((await db.query('select logros from public.gamificacion where user_id = $1', [userId])).rows[0].logros, currentState.logros);
    const snapshot = (await db.query('select total_figures, total_value, level, pct_collector, pct_explorer, pct_rarity_hunter, pct_fan from public.user_daily_snapshots where user_id = $1', [userId])).rows[0];
    assert.equal(snapshot.total_figures, 1);
    assert.equal(Number(snapshot.total_value), 30);
    assert.equal(snapshot.level, 1);
    assert.deepEqual([
      Number(snapshot.pct_collector), Number(snapshot.pct_explorer),
      Number(snapshot.pct_rarity_hunter), Number(snapshot.pct_fan),
    ], [0, 0, 0, 0]);
    assert.equal((await db.query('select status from private.daily_sync_users where run_id = $1 and user_id = $2', [started.jobId, userId])).rows[0].status, 'completed');
  } finally {
    await db.close();
  }
});

test('captura es atomica y calcula fallback de valor, nivel cero y DNA historico redondeado', async () => {
  const db = new PGlite();
  const collectorId = '00000000-0000-4000-8000-00000000000a';
  const newbieId = '00000000-0000-4000-8000-00000000000b';
  const leaseOwner = '60000000-0000-4000-8000-000000000001';
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table auth.users (
        instance_id uuid, id uuid primary key, aud text, role text, email text unique,
        encrypted_password text, email_confirmed_at timestamptz,
        raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
        confirmation_token text, recovery_token text, email_change_token_new text, email_change text
      );
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id, email) values ($1, $2), ($3, $4)', [
      collectorId, 'collector@example.invalid', newbieId, 'newbie@example.invalid',
    ]);
    await db.query(
      `insert into public.minifiguras(user_id, id, nombre, categoria, estado_coleccion, precio, precio_compra)
       values ($1, 'FIG-MARKET', 'Market', 'Test', 'COLECCIÓN', 20, 10),
              ($1, 'FIG-COMPRA', 'Purchase', 'Test', 'COLECCIÓN', null, 5),
              ($1, 'FIG-WANTED', 'Wanted', 'Test', 'BUSCADA', 100, 1)`,
      [collectorId],
    );
    await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");
    const started = (await db.query('select public.iniciar_daily_sync() as data')).rows[0].data;
    await db.query('select public.reclamar_daily_sync($1, $2, 120)', [started.jobId, leaseOwner]);

    const collectorState = {
      bricks: 59,
      nivel: { id: 1, nombre: 'Stud' },
      siguiente_nivel: { id: 2, nombre: 'Plate' },
      progreso: { actual: 59 },
      logros: [
        { id: 'new-mini-person', cantidad: 2, bricks: 1 },
        { id: 'woah', cantidad: 1, bricks: 10 },
      ],
    };
    const collectorSources = (await db.query('select public.leer_daily_sync_fuentes($1, $2, $3) as data', [started.jobId, leaseOwner, collectorId])).rows[0].data;
    await db.exec(`
      create function public.reject_daily_snapshot() returns trigger language plpgsql as $$
      begin
        raise exception 'FORCED_SNAPSHOT_FAILURE';
      end;
      $$;
      create trigger reject_daily_snapshot before insert on public.user_daily_snapshots
      for each row execute function public.reject_daily_snapshot();
    `);
    await assert.rejects(db.query('select public.capturar_daily_sync_usuario($1, $2, $3, $4, $5::jsonb)', [
      started.jobId, leaseOwner, collectorId, collectorSources.revision, JSON.stringify(collectorState),
    ]), /FORCED_SNAPSHOT_FAILURE/);
    assert.equal((await db.query('select count(*)::integer as count from public.gamificacion where user_id = $1', [collectorId])).rows[0].count, 0);
    assert.equal((await db.query('select count(*)::integer as count from public.user_daily_snapshots where user_id = $1', [collectorId])).rows[0].count, 0);
    assert.equal((await db.query('select status from private.daily_sync_users where run_id = $1 and user_id = $2', [started.jobId, collectorId])).rows[0].status, 'pending');

    await db.exec('drop trigger reject_daily_snapshot on public.user_daily_snapshots; drop function public.reject_daily_snapshot();');
    assert.equal((await db.query('select public.capturar_daily_sync_usuario($1, $2, $3, $4, $5::jsonb) as captured', [
      started.jobId, leaseOwner, collectorId, collectorSources.revision, JSON.stringify(collectorState),
    ])).rows[0].captured, true);
    const collectorSnapshot = (await db.query(
      'select total_figures, total_value, bricks, level, pct_collector, pct_explorer, pct_rarity_hunter, pct_fan from public.user_daily_snapshots where user_id = $1',
      [collectorId],
    )).rows[0];
    assert.equal(collectorSnapshot.total_figures, 2);
    assert.equal(Number(collectorSnapshot.total_value), 25);
    assert.equal(collectorSnapshot.bricks, 59);
    assert.equal(collectorSnapshot.level, 1);
    assert.deepEqual([
      Number(collectorSnapshot.pct_collector), Number(collectorSnapshot.pct_explorer),
      Number(collectorSnapshot.pct_rarity_hunter), Number(collectorSnapshot.pct_fan),
    ], [60, 10, 16.67, 13.33]);

    const newbieState = {
      bricks: 0,
      nivel: { id: 0, nombre: 'Duplo' },
      siguiente_nivel: { id: 1, nombre: 'Stud' },
      progreso: { actual: 0 },
      logros: [],
    };
    const newbieSources = (await db.query('select public.leer_daily_sync_fuentes($1, $2, $3) as data', [started.jobId, leaseOwner, newbieId])).rows[0].data;
    assert.equal(newbieSources.figures.length, 0);
    assert.equal(newbieSources.giftsReceived, 0);
    await db.query('select public.capturar_daily_sync_usuario($1, $2, $3, $4, $5::jsonb)', [
      started.jobId, leaseOwner, newbieId, newbieSources.revision, JSON.stringify(newbieState),
    ]);
    const newbieSnapshot = (await db.query('select total_figures, total_value, bricks, level, pct_collector, pct_explorer, pct_rarity_hunter, pct_fan from public.user_daily_snapshots where user_id = $1', [newbieId])).rows[0];
    assert.deepEqual([
      newbieSnapshot.total_figures, Number(newbieSnapshot.total_value), newbieSnapshot.bricks, newbieSnapshot.level,
      Number(newbieSnapshot.pct_collector), Number(newbieSnapshot.pct_explorer),
      Number(newbieSnapshot.pct_rarity_hunter), Number(newbieSnapshot.pct_fan),
    ], [0, 0, 0, 0, 0, 0, 0, 0]);
  } finally {
    await db.close();
  }
});

test('finalizacion deriva conteos de checkpoints, omite cuentas borradas y nunca finge exito', async () => {
  const db = new PGlite();
  const userA = '00000000-0000-4000-8000-00000000000a';
  const userB = '00000000-0000-4000-8000-00000000000b';
  const leaseOwner = '70000000-0000-4000-8000-000000000001';
  const state = {
    bricks: 0,
    nivel: { id: 0, nombre: 'Duplo' },
    siguiente_nivel: { id: 1, nombre: 'Stud' },
    progreso: { actual: 0 },
    logros: [{ id: 'new-mini-person', cantidad: 1, bricks: 1 }],
  };
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table auth.users (
        instance_id uuid, id uuid primary key, aud text, role text, email text unique,
        encrypted_password text, email_confirmed_at timestamptz,
        raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
        confirmation_token text, recovery_token text, email_change_token_new text, email_change text
      );
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id, email) values ($1, $2), ($3, $4)', [
      userA, 'user-a@example.invalid', userB, 'user-b@example.invalid',
    ]);
    await db.query("select set_config('request.jwt.claim.role', 'authenticated', false)");
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select public.finalizar_daily_sync($1, $2)', [userA, leaseOwner]), /permission denied/);
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");

    const firstRun = (await db.query('select public.iniciar_daily_sync() as data')).rows[0].data;
    await db.query('select public.reclamar_daily_sync($1, $2, 120)', [firstRun.jobId, leaseOwner]);
    await db.query("update private.daily_sync_runs set snapshot_date = '2026-10-12' where id = $1", [firstRun.jobId]);
    await db.query(`
      insert into public.user_daily_snapshots (
        user_id, snapshot_date, total_figures, total_value, bricks, level,
        pct_collector, pct_explorer, pct_rarity_hunter, pct_fan
      ) values ($1, '2026-10-11', 5, 99, 100, 5, 25, 25, 25, 25)
    `, [userA]);
    const sources = (await db.query('select public.leer_daily_sync_fuentes($1, $2, $3) as data', [firstRun.jobId, leaseOwner, userA])).rows[0].data;
    await db.query('select public.capturar_daily_sync_usuario($1, $2, $3, $4, $5::jsonb)', [
      firstRun.jobId, leaseOwner, userA, sources.revision, JSON.stringify(state),
    ]);
    await db.query('select public.capturar_daily_sync_usuario($1, $2, $3, $4, $5::jsonb)', [
      firstRun.jobId, leaseOwner, userA, sources.revision, JSON.stringify(state),
    ]);
    assert.equal((await db.query('select attempts from private.daily_sync_users where run_id = $1 and user_id = $2', [firstRun.jobId, userA])).rows[0].attempts, 1);
    const beforeDelete = (await db.query('select public.consultar_daily_sync($1) as data', [firstRun.jobId])).rows[0].data;
    assert.equal(beforeDelete.processedUsers, 1);
    assert.equal(beforeDelete.totalUsers, 2);
    await assert.rejects(db.query('select public.finalizar_daily_sync($1, $2)', [firstRun.jobId, leaseOwner]), /DAILY_SYNC_TRABAJO_INCOMPLETO/);
    assert.equal((await db.query('select status from private.daily_sync_runs where id = $1', [firstRun.jobId])).rows[0].status, 'running');
    assert.equal((await db.query("select count(*)::integer as total from public.notificaciones where type = 'daily_summary'")).rows[0].total, 0);

    const savedSnapshot = (await db.query('select pct_collector, pct_explorer, pct_rarity_hunter, pct_fan from public.user_daily_snapshots where user_id = $1', [userA])).rows[0];
    await db.query('delete from auth.users where id = $1', [userB]);
    const afterDelete = (await db.query('select public.consultar_daily_sync($1) as data', [firstRun.jobId])).rows[0].data;
    assert.equal(afterDelete.processedUsers, 1);
    assert.equal(afterDelete.totalUsers, 1);
    await db.query("update public.dna_ponderaciones set collector = 0, explorer = 100, fan = 0 where logro_id = 'new-mini-person'");
    const stillSaved = (await db.query('select pct_collector, pct_explorer, pct_rarity_hunter, pct_fan from public.user_daily_snapshots where user_id = $1', [userA])).rows[0];
    assert.deepEqual(Object.values(stillSaved).map(Number), Object.values(savedSnapshot).map(Number));

    const complete = (await db.query('select public.finalizar_daily_sync($1, $2) as data', [firstRun.jobId, leaseOwner])).rows[0].data;
    assert.equal(complete.status, 'completed');
    assert.equal(complete.processedUsers, 1);
    assert.equal(complete.totalUsers, 1);
    assert.deepEqual(complete.result, {
      success: true,
      processedUsers: 1,
      timestamp: complete.result.timestamp,
    });
    assert.match(complete.result.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const dailyNotification = (await db.query("select payload, is_read from public.notificaciones where user_id = $1 and type = 'daily_summary'", [userA])).rows[0];
    assert.equal(dailyNotification.is_read, false);
    assert.equal(dailyNotification.payload.hasPrevious, true);
    assert.deepEqual(dailyNotification.payload.deltas, {
      figures: -5,
      valueEur: -99,
      bricks: -100,
      level: -5,
      globalPosition: 0,
      dna: { collector: 55, explorer: -15, rarityHunter: -25, fan: -15 },
    });
    assert.deepEqual((await db.query("select user_id, position from public.ranking_top10_membership where ranking_type = 'weekly'", [])).rows, [
      { user_id: userA, position: 1 },
    ]);
    assert.equal((await db.query("select count(*)::integer as total from public.notificaciones where type in ('ranking_entered', 'ranking_exited') and payload->>'ranking' = 'weekly'")).rows[0].total, 0);

    const secondRun = (await db.query('select public.iniciar_daily_sync() as data')).rows[0].data;
    await db.query('select public.reclamar_daily_sync($1, $2, 120)', [secondRun.jobId, leaseOwner]);
    await db.query('select public.fallar_daily_sync_usuario($1, $2, $3, $4)', [secondRun.jobId, leaseOwner, userA, 'MAX_RETRIES']);
    const failedUserRun = (await db.query('select public.finalizar_daily_sync($1, $2) as data', [secondRun.jobId, leaseOwner])).rows[0].data;
    assert.equal(failedUserRun.status, 'failed');
    assert.equal(failedUserRun.result, null);
    assert.equal(failedUserRun.errorCode, 'USERS_FAILED');
    assert.equal((await db.query("select count(*)::integer as total from public.notificaciones where type = 'daily_summary' and user_id = $1", [userA])).rows[0].total, 1);

    const thirdRun = (await db.query('select public.iniciar_daily_sync() as data')).rows[0].data;
    await db.query('select public.reclamar_daily_sync($1, $2, 120)', [thirdRun.jobId, leaseOwner]);
    const terminalError = (await db.query('select public.fallar_daily_sync($1, $2, $3) as data', [
      thirdRun.jobId, leaseOwner, 'STORAGE_ERROR',
    ])).rows[0].data;
    assert.equal(terminalError.status, 'failed');
    assert.equal(terminalError.result, null);
    assert.equal(terminalError.errorCode, 'STORAGE_ERROR');
  } finally {
    await db.close();
  }
});

test('el mock separa RPC administrativas del cliente de usuario y rechaza .from() global', async () => {
  const user = { id: '00000000-0000-4000-8000-00000000000a' };
  const mock = createSupabaseMock({ users: { token: user } });
  const userClient = mock.createClient('url', 'anon', { global: { headers: { Authorization: 'Bearer token' } } });
  const adminClient = mock.createAdminClient();
  const started = await adminClient.rpc('iniciar_daily_sync');
  const repeated = await adminClient.rpc('iniciar_daily_sync');

  assert.equal(started.error, null);
  assert.equal(repeated.data.jobId, started.data.jobId);
  assert.throws(() => adminClient.from('minifiguras'), /solo puede ejecutar RPC allowlisted/);
  assert.equal((await userClient.rpc('iniciar_daily_sync')).error.code, '42883');
  assert.deepEqual(mock.adminCalls().map(({ name }) => name), ['iniciar_daily_sync', 'iniciar_daily_sync']);
  assert.equal(mock.analyticsRows('runs').length, 1);
});

test('la cache global se siembra solo con checkpoints recientes e impide acceso de clientes', async () => {
  const db = new PGlite();
  const userId = '00000000-0000-4000-8000-00000000000a';
  const recentRun = '80000000-0000-4000-8000-000000000001';
  const olderRun = '80000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table auth.users (
        instance_id uuid, id uuid primary key, aud text, role text, email text unique,
        encrypted_password text, email_confirmed_at timestamptz,
        raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
        confirmation_token text, recovery_token text, email_change_token_new text, email_change text
      );
    `);
    const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
    await db.exec(schema);
    await db.query('insert into auth.users(id) values ($1)', [userId]);
    await db.query(`
      insert into private.daily_sync_runs(id, snapshot_date, status, phase)
      values ($1, '2026-10-07', 'completed', 'completed'),
             ($2, '2026-10-06', 'completed', 'completed')
    `, [recentRun, olderRun]);
    await db.query(`
      insert into private.daily_sync_prices(run_id, figure_id, status, attempts, price, checkpoint_at)
      values ($1, 'FIG-RECENT', 'completed', 1, 12.50, clock_timestamp() - interval '1 hour'),
             ($2, 'FIG-OLD', 'completed', 1, 9.00, clock_timestamp() - interval '25 hours')
    `, [recentRun, olderRun]);

    await db.exec(schema);
    const seeded = (await db.query(
      'select figure_id, price, fetched_at from private.daily_sync_figure_prices order by figure_id',
    )).rows;
    assert.equal(seeded.length, 1);
    assert.equal(seeded[0].figure_id, 'FIG-RECENT');
    assert.equal(Number(seeded[0].price), 12.5);
    const originalFetchedAt = seeded[0].fetched_at.toISOString();

    await db.query(`
      insert into private.daily_sync_runs(id, snapshot_date, status, phase)
      values ('80000000-0000-4000-8000-000000000003', '2026-10-08', 'completed', 'completed')
    `);
    await db.query(`
      insert into private.daily_sync_prices(run_id, figure_id, status, attempts, price, checkpoint_at)
      values ('80000000-0000-4000-8000-000000000003', 'FIG-RECENT', 'completed', 1, 20, clock_timestamp())
    `);
    await db.exec(schema);
    const unchanged = (await db.query(
      "select price, fetched_at from private.daily_sync_figure_prices where figure_id = 'FIG-RECENT'",
    )).rows[0];
    assert.equal(Number(unchanged.price), 12.5);
    assert.equal(unchanged.fetched_at.toISOString(), originalFetchedAt);

    for (const role of ['anon', 'authenticated']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        assert.equal((await db.query('select has_table_privilege($1, $2, $3) as allowed', [
          role, 'private.daily_sync_figure_prices', privilege,
        ])).rows[0].allowed, false);
      }
      await db.query(`set role ${role}`);
      await assert.rejects(db.query('select * from private.daily_sync_figure_prices'));
      await db.query('reset role');
    }
  } finally {
    await db.close();
  }
});

test('inicio reutiliza precios frescos y solo el refresco exitoso renueva la cache caducada', async () => {
  const db = new PGlite();
  const userId = '00000000-0000-4000-8000-00000000000a';
  const leaseOwner = '90000000-0000-4000-8000-000000000001';
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table auth.users (
        instance_id uuid, id uuid primary key, aud text, role text, email text unique,
        encrypted_password text, email_confirmed_at timestamptz,
        raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
        confirmation_token text, recovery_token text, email_change_token_new text, email_change text
      );
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id) values ($1)', [userId]);
    await db.query(`
      insert into public.minifiguras(user_id, id, nombre, categoria, precio)
      values ($1, 'FIG-FAIL', 'Failure', 'Test', 3),
             ($1, 'FIG-FRESH', 'Fresh', 'Test', 10),
             ($1, 'FIG-STALE', 'Stale', 'Test', 5)
    `, [userId]);
    await db.query(`
      insert into private.daily_sync_figure_prices(figure_id, price, fetched_at)
      values ('FIG-FRESH', 50, clock_timestamp() - interval '2 hours'),
             ('FIG-FAIL', 4, clock_timestamp() - interval '25 hours'),
             ('FIG-STALE', 6, clock_timestamp() - interval '25 hours')
    `);
    await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");

    const started = (await db.query('select public.iniciar_daily_sync() as data')).rows[0].data;
    const priceRows = (await db.query(
      'select figure_id, status, attempts, price from private.daily_sync_prices where run_id = $1 order by figure_id',
      [started.jobId],
    )).rows;
    assert.deepEqual(priceRows.map(({ figure_id, status, attempts, price }) => ({
      figure_id, status, attempts, price: price === null ? null : Number(price),
    })), [
      { figure_id: 'FIG-FAIL', status: 'pending', attempts: 0, price: null },
      { figure_id: 'FIG-FRESH', status: 'completed', attempts: 0, price: 50 },
      { figure_id: 'FIG-STALE', status: 'pending', attempts: 0, price: null },
    ]);
    assert.equal(Number((await db.query("select precio from public.minifiguras where user_id = $1 and id = 'FIG-FRESH'", [userId])).rows[0].precio), 50);

    await db.query('select public.reclamar_daily_sync($1, $2, 120)', [started.jobId, leaseOwner]);
    const pending = (await db.query('select figure_id from public.leer_daily_sync_precios($1, $2, null, 1000) order by figure_id', [
      started.jobId, leaseOwner,
    ])).rows;
    assert.deepEqual(pending.map(({ figure_id }) => figure_id), ['FIG-FAIL', 'FIG-STALE']);

    await db.query("select public.aplicar_daily_sync_precio($1, $2, 'FIG-STALE', true, 8.75, null)", [started.jobId, leaseOwner]);
    const refreshed = (await db.query("select price, fetched_at from private.daily_sync_figure_prices where figure_id = 'FIG-STALE'")).rows[0];
    assert.equal(Number(refreshed.price), 8.75);
    assert.ok(refreshed.fetched_at.getTime() > Date.now() - 5000);
    await db.query("select public.aplicar_daily_sync_precio($1, $2, 'FIG-FAIL', false, null, 'TIMEOUT')", [started.jobId, leaseOwner]);
    const preservedCache = (await db.query("select price, fetched_at from private.daily_sync_figure_prices where figure_id = 'FIG-FAIL'")).rows[0];
    assert.equal(Number(preservedCache.price), 4);
    assert.ok(preservedCache.fetched_at.getTime() < Date.now() - 24 * 60 * 60 * 1000);
    assert.equal(Number((await db.query("select precio from public.minifiguras where user_id = $1 and id = 'FIG-FAIL'", [userId])).rows[0].precio), 3);
    assert.equal((await db.query('select failed_prices from private.daily_sync_runs where id = $1', [started.jobId])).rows[0].failed_prices, 1);
  } finally {
    await db.close();
  }
});

test('los resúmenes diarios incluyen movimiento de ranking elegible y preservan lectura al reintentar el día', async () => {
  const db = new PGlite();
  const userA = '00000000-0000-4000-8000-0000000000a1';
  const userB = '00000000-0000-4000-8000-0000000000b1';
  const userC = '00000000-0000-4000-8000-0000000000c1';
  const leaseOwner = '90000000-0000-4000-8000-0000000000c1';
  const state = (bricks, level) => ({
    bricks,
    nivel: { id: level, nombre: `Level ${level}` },
    siguiente_nivel: null,
    progreso: { actual: bricks },
    logros: [],
  });
  const confirmRun = async (states) => {
    const started = (await db.query('select public.iniciar_daily_sync() as data')).rows[0].data;
    await db.query('select public.reclamar_daily_sync($1, $2, 120)', [started.jobId, leaseOwner]);
    await db.query("update private.daily_sync_runs set snapshot_date = '2026-10-13' where id = $1", [started.jobId]);
    for (const [userId, current] of states) {
      const sources = (await db.query('select public.leer_daily_sync_fuentes($1, $2, $3) as data', [started.jobId, leaseOwner, userId])).rows[0].data;
      await db.query('select public.capturar_daily_sync_usuario($1, $2, $3, $4, $5::jsonb)', [
        started.jobId, leaseOwner, userId, sources.revision, JSON.stringify(current),
      ]);
    }
    return (await db.query('select public.finalizar_daily_sync($1, $2) as data', [started.jobId, leaseOwner])).rows[0].data;
  };

  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$
        select nullif(current_setting('request.jwt.claim.role', true), '')
      $$;
      create table auth.users (id uuid primary key, email text unique);
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id, email) values ($1, $2), ($3, $4), ($5, $6)', [
      userA, 'rank-a@example.invalid', userB, 'rank-b@example.invalid', userC, 'rank-c@example.invalid',
    ]);
    await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");
    await db.query(`
      insert into public.gamificacion(user_id, bricks, nivel) values
        ($1, 100, '{"id":5,"nombre":"Five"}'),
        ($2, 200, '{"id":5,"nombre":"Five"}'),
        ($3, 0, '{"id":0,"nombre":"Zero"}')
    `, [userA, userB, userC]);
    await db.query(`
      insert into public.user_daily_snapshots (
        user_id, snapshot_date, total_figures, total_value, bricks, level,
        pct_collector, pct_explorer, pct_rarity_hunter, pct_fan
      ) values
        ($1, '2026-10-11', 2, 20, 0, 5, 25, 25, 25, 25),
        ($2, '2026-10-11', 2, 20, 0, 5, 25, 25, 25, 25),
        ($1, '2026-10-12', 2, 25, 100, 5, 25, 25, 25, 25),
        ($2, '2026-10-12', 2, 25, 200, 5, 25, 25, 25, 25)
    `, [userA, userB]);

    const completed = await confirmRun([[userA, state(220, 6)], [userB, state(210, 5)], [userC, state(0, 0)]]);
    assert.equal(completed.status, 'completed');
    const summaryA = (await db.query("select id, payload, is_read, created_at from public.notificaciones where user_id = $1 and type = 'daily_summary'", [userA])).rows[0];
    assert.deepEqual({ global: summaryA.payload.deltas.globalPosition, weekly: summaryA.payload.deltas.weeklyPosition }, { global: 1, weekly: 1 });
    const summaryC = (await db.query("select payload from public.notificaciones where user_id = $1 and type = 'daily_summary'", [userC])).rows[0].payload;
    assert.equal(summaryC.hasPrevious, false);
    assert.equal(Object.hasOwn(summaryC, 'deltas'), false);

    await db.query('update public.notificaciones set is_read = true where id = $1', [summaryA.id]);
    const rerun = await confirmRun([[userA, state(200, 6)], [userB, state(210, 5)], [userC, state(0, 0)]]);
    assert.equal(rerun.status, 'completed');
    const updated = (await db.query("select id, payload, is_read, created_at from public.notificaciones where user_id = $1 and type = 'daily_summary'", [userA])).rows[0];
    assert.equal(updated.id, summaryA.id);
    assert.equal(updated.is_read, true);
    assert.equal(updated.created_at.toISOString(), summaryA.created_at.toISOString());
    assert.equal(updated.payload.deltas.bricks, 100);
    assert.equal(updated.payload.deltas.globalPosition, 1);
    assert.equal(updated.payload.deltas.weeklyPosition, 0);
    assert.equal((await db.query("select count(*)::integer as count from public.notificaciones where user_id = $1 and type = 'daily_summary'", [userA])).rows[0].count, 1);
  } finally {
    await db.close();
  }
});

test('el mock publica resúmenes diarios solo al completar y conserva la lectura en reintentos', async () => {
  const userA = '00000000-0000-4000-8000-0000000000a1';
  const userB = '00000000-0000-4000-8000-0000000000b1';
  const leaseOwner = '90000000-0000-4000-8000-0000000000c1';
  const mock = createSupabaseMock({ users: { 'token-a': { id: userA }, 'token-b': { id: userB } } });
  const admin = mock.createAdminClient();
  const clientA = mock.createClient('url', 'anon', { global: { headers: { Authorization: 'Bearer token-a' } } });
  const run = async (stateA, stateB, failB = false) => {
    const started = await admin.rpc('iniciar_daily_sync');
    await admin.rpc('reclamar_daily_sync', { p_run_id: started.data.jobId, p_lease_owner: leaseOwner });
    for (const [userId, state] of [[userA, stateA], [userB, stateB]]) {
      const sources = await admin.rpc('leer_daily_sync_fuentes', {
        p_run_id: started.data.jobId, p_lease_owner: leaseOwner, p_user_id: userId,
      });
      if (userId === userB && failB) {
        await admin.rpc('fallar_daily_sync_usuario', {
          p_run_id: started.data.jobId, p_lease_owner: leaseOwner, p_user_id: userId, p_error_code: 'MAX_RETRIES',
        });
      } else {
        await admin.rpc('capturar_daily_sync_usuario', {
          p_run_id: started.data.jobId, p_lease_owner: leaseOwner, p_user_id: userId,
          p_expected_revision: sources.data.revision, p_state: state,
        });
      }
    }
    return admin.rpc('finalizar_daily_sync', { p_run_id: started.data.jobId, p_lease_owner: leaseOwner });
  };
  const state = (bricks) => ({
    bricks, nivel: { id: 0, nombre: 'Duplo' }, siguiente_nivel: null,
    progreso: { actual: bricks }, logros: [],
  });
  const currentDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  const previousDate = new Date(Date.parse(`${currentDate}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  mock.seed('user_daily_snapshots', userA, [{
    snapshot_date: previousDate, total_figures: 5, total_value: 99, bricks: 100, level: 5,
    pct_collector: 25, pct_explorer: 25, pct_rarity_hunter: 25, pct_fan: 25,
  }]);

  const first = await admin.rpc('iniciar_daily_sync');
  await admin.rpc('reclamar_daily_sync', { p_run_id: first.data.jobId, p_lease_owner: leaseOwner });
  const sourcesA = await admin.rpc('leer_daily_sync_fuentes', {
    p_run_id: first.data.jobId, p_lease_owner: leaseOwner, p_user_id: userA,
  });
  await admin.rpc('capturar_daily_sync_usuario', {
    p_run_id: first.data.jobId, p_lease_owner: leaseOwner, p_user_id: userA,
    p_expected_revision: sourcesA.data.revision, p_state: state(10),
  });
  assert.equal((await admin.rpc('finalizar_daily_sync', { p_run_id: first.data.jobId, p_lease_owner: leaseOwner })).error.message, 'DAILY_SYNC_TRABAJO_INCOMPLETO');
  assert.equal(mock.rows('notificaciones').length, 0);
  const sourcesB = await admin.rpc('leer_daily_sync_fuentes', {
    p_run_id: first.data.jobId, p_lease_owner: leaseOwner, p_user_id: userB,
  });
  await admin.rpc('capturar_daily_sync_usuario', {
    p_run_id: first.data.jobId, p_lease_owner: leaseOwner, p_user_id: userB,
    p_expected_revision: sourcesB.data.revision, p_state: state(0),
  });
  assert.equal((await admin.rpc('finalizar_daily_sync', { p_run_id: first.data.jobId, p_lease_owner: leaseOwner })).data.status, 'completed');
  const notificationA = mock.rows('notificaciones', userA).find(({ type }) => type === 'daily_summary');
  const notificationB = mock.rows('notificaciones', userB).find(({ type }) => type === 'daily_summary');
  assert.deepEqual(notificationA.payload.deltas, {
    figures: -5, valueEur: -99, bricks: -90, level: -5,
    dna: { collector: -25, explorer: -25, rarityHunter: -25, fan: -25 },
  });
  assert.equal(notificationB.payload.hasPrevious, false);
  assert.equal(Object.hasOwn(notificationB.payload, 'deltas'), false);
  await clientA.from('notificaciones').update({ is_read: true }).eq('id', notificationA.id);

  const second = await run(state(5), state(0));
  assert.equal(second.data.status, 'completed');
  const updatedA = mock.rows('notificaciones', userA).filter(({ type }) => type === 'daily_summary');
  assert.equal(updatedA.length, 1);
  assert.equal(updatedA[0].is_read, true);
  assert.equal(updatedA[0].payload.deltas.bricks, -95);

  const failed = await run(state(0), state(0), true);
  assert.equal(failed.data.status, 'failed');
  assert.equal(mock.rows('notificaciones').filter(({ type }) => type === 'daily_summary').length, 2);
});