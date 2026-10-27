import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { migrateGamificationV2, resolveBricksetFullNames } from '../src/gamification-v2-migration.js';
import { calcularGamificacion } from '../src/gamificacion.js';
import { parseCutoverConfirmations, projectRefFromDatabaseUrl } from '../scripts/migrate-gamification-v2.js';

test('la URL PostgreSQL identifica el project ref directo o mediante el usuario pooler', () => {
  const projectRef = 'abcdefghijklmnopqrst';
  assert.equal(projectRefFromDatabaseUrl(`postgresql://postgres:${'password'}@db.${projectRef}.supabase.co:5432/postgres`), projectRef);
  assert.equal(projectRefFromDatabaseUrl(`postgresql://postgres.${projectRef}:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres`), projectRef);
  assert.throws(() => projectRefFromDatabaseUrl('postgresql://postgres:password@localhost:5432/postgres'), /project ref/);
});

test('la preparacion V2 exige propietario y confirmacion y schema no ejecuta el reset', async () => {
  const db = new PGlite();
  const userId = '00000000-0000-4000-8000-000000000001';
  const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  const migrationTemplate = await readFile(new URL('../supabase/prepare-gamification-v2.sql', import.meta.url), 'utf8');
  const migration = migrationTemplate.replaceAll('REPLACE_WITH_PROJECT_REF', 'abcdefghijklmnopqrst');
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
    await db.exec(schema);
    assert.equal((await db.query("select to_regclass('private.gamificacion_v2_migration') is null as absent")).rows[0].absent, true);
    await assert.rejects(db.exec(migrationTemplate), /GAMIFICACION_V2_CONFIRMAR_PROYECTO/);
    await db.exec('rollback');
    const mismatchedProject = migration.replace(
      "set local app.gamification_v2_project_confirmation = 'abcdefghijklmnopqrst';",
      "set local app.gamification_v2_project_confirmation = 'zyxwvutsrqponmlkjihg';",
    );
    await assert.rejects(db.exec(mismatchedProject), /GAMIFICACION_V2_CONFIRMAR_PROYECTO/);
    await db.exec('rollback');
    await db.query('insert into auth.users(id, email) values ($1, $2)', [userId, 'v2@example.invalid']);
    await db.query("insert into public.gamificacion(user_id, bricks, nivel) values ($1, 7, '{\"id\":0,\"nombre\":\"Duplo\"}')", [userId]);
    await db.query(`insert into public.user_daily_snapshots(
      user_id, snapshot_date, total_figures, total_value, bricks, level,
      pct_collector, pct_explorer, pct_rarity_hunter, pct_fan
    ) values ($1, '2026-10-01', 0, 0, 7, 0, 0, 0, 0, 0)`, [userId]);

    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.exec(migration), /GAMIFICACION_V2_SOLO_PROPIETARIO/);
      await db.exec('rollback; reset role');
    }

    await db.exec(migration);
    const marker = (await db.query('select version, project_ref, status from private.gamificacion_v2_migration where singleton')).rows[0];
    assert.deepEqual(marker, { version: 'v2', project_ref: 'abcdefghijklmnopqrst', status: 'prepared' });
    assert.equal((await db.query('select bricks from public.gamificacion where user_id = $1', [userId])).rows[0].bricks, 7);
    assert.equal((await db.query('select count(*)::integer as count from public.user_daily_snapshots where user_id = $1', [userId])).rows[0].count, 1);

    await db.exec(schema);
    assert.deepEqual((await db.query('select version, project_ref, status from private.gamificacion_v2_migration where singleton')).rows[0], marker);
    assert.equal((await db.query('select bricks from public.gamificacion where user_id = $1', [userId])).rows[0].bricks, 7);
    assert.equal((await db.query('select count(*)::integer as count from public.user_daily_snapshots where user_id = $1', [userId])).rows[0].count, 1);
  } finally {
    await db.close();
  }
});

test('la recuperacion de nombres consulta cada ID compartido una vez y no escribe durante la lectura', async () => {
  const db = new PGlite();
  const userA = '00000000-0000-4000-8000-0000000000a1';
  const userB = '00000000-0000-4000-8000-0000000000b1';
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create function auth.role() returns text language sql as $$ select 'postgres' $$;
      create table auth.users (id uuid primary key, email text unique);
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query('insert into auth.users(id, email) values ($1, $2), ($3, $4)', [
      userA, 'name-a@example.invalid', userB, 'name-b@example.invalid',
    ]);
    await db.query(`insert into public.minifiguras(user_id, id, nombre, descripcion, categoria, nombre_completo)
      values ($1, 'COL100', 'Convention figure', null, 'Space', null),
        ($2, 'COL100', 'Visible name stays', 'Visible description stays', 'Space', null),
        ($2, 'COL200', 'Known figure', null, 'Space', 'Known figure, Toy Fair 2022')`, [userA, userB]);

    const requestedIds = [];
    const names = await resolveBricksetFullNames({
      client: db,
      brickset: { async getFullName(id) { requestedIds.push(id); return `${id}, Comic-Con 2022`; } },
    });
    assert.deepEqual(requestedIds, ['COL100']);
    assert.deepEqual([...names], [['COL100', 'COL100, Comic-Con 2022']]);
    const beforeFailure = (await db.query('select id, nombre, descripcion, nombre_completo from public.minifiguras order by user_id, id')).rows;
    assert.deepEqual(beforeFailure, [
      { id: 'COL100', nombre: 'Convention figure', descripcion: null, nombre_completo: null },
      { id: 'COL100', nombre: 'Visible name stays', descripcion: 'Visible description stays', nombre_completo: null },
      { id: 'COL200', nombre: 'Known figure', descripcion: null, nombre_completo: 'Known figure, Toy Fair 2022' },
    ]);
    await assert.rejects(resolveBricksetFullNames({
      client: db,
      brickset: { async getFullName() { throw new Error('BRICKSET_SERIES_HTTP'); } },
    }), { code: 'BRICKSET_NOMBRES_INCOMPLETOS', failedIds: ['COL100'] });
    assert.deepEqual((await db.query('select id, nombre, descripcion, nombre_completo from public.minifiguras order by user_id, id')).rows, beforeFailure);
  } finally {
    await db.close();
  }
});

test('el corte V2 es atomico, reconstruye cuentas sociales y rechaza leases antiguos', async () => {
  const db = new PGlite();
  const userA = '00000000-0000-4000-8000-0000000000a1';
  const userB = '00000000-0000-4000-8000-0000000000b1';
  const runId = '10000000-0000-4000-8000-000000000001';
  const leaseOwner = '20000000-0000-4000-8000-000000000001';
  const projectRef = 'wvcnftjhvcdxmuqpjqda';
  const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  const preparation = (await readFile(new URL('../supabase/prepare-gamification-v2.sql', import.meta.url), 'utf8'))
    .replaceAll('REPLACE_WITH_PROJECT_REF', projectRef);
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
      create table auth.users (id uuid primary key, email text unique, raw_user_meta_data jsonb);
    `);
    await db.exec(schema);
    await db.exec(preparation);
    await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");
    await assert.rejects(
      db.query('select public.aplicar_recalculo_gamificacion_categorias($1, $2::jsonb, $3)', ['a'.repeat(64), '[]', 'v2']),
      /RECALCULO_CATEGORIAS_MIGRACION_NO_APLICADA/,
    );
    await db.query('insert into auth.users(id, email, raw_user_meta_data) values ($1, $2, $3), ($4, $5, $6)', [
      userA, 'a@example.invalid', '{"provider":"google","full_name":"User A"}',
      userB, 'b@example.invalid', '{"provider":"google","full_name":"User B"}',
    ]);
    await db.query(`insert into public.user_profiles(user_id, username, avatar_url, currency, language, onboarding_completed)
      values ($1, 'User_A', 'https://avatars.example/a.png', 'EUR', 'es', true),
        ($2, 'User_B', 'https://avatars.example/b.png', 'EUR', 'es', true)`, [userA, userB]);
    await db.query(`insert into public.perfiles_publicos(user_id, display_name, avatar_url)
      values ($1, 'User_A', 'https://avatars.example/a.png'), ($2, 'User_B', 'https://avatars.example/b.png')
      on conflict (user_id) do update set display_name = excluded.display_name, avatar_url = excluded.avatar_url`, [userA, userB]);
    await db.query(`insert into public.user_profile_favorite_categories(user_id, category_name)
      values ($1, 'Space'), ($2, 'Castle')`, [userA, userB]);
    await db.query(`insert into public.gamificacion(user_id, bricks, nivel, logros)
      values ($1, 900, '{"id":8,"nombre":"Redbeard"}',
        '[{"id":"someone-liked-your-collection","nombre":"Old gift","bricks":50,"repetible":true,"cantidad":1,"total":50}]')`, [userA]);
    await db.query(`insert into public.friend_requests(sender_id, recipient_id, status)
      values ($1, $2, 'accepted')`, [userA, userB]);
    await db.query('insert into public.friendships(user_low_id, user_high_id) values ($1, $2)', [userA, userB]);
    await db.query(`insert into public.minifiguras(user_id, id, nombre, descripcion, categoria, subcategoria, estado_coleccion, nombre_completo)
      values
        ($1, 'MIGRATION-1', 'Kept figure', 'Visible description', 'Other', null, 'COLECCIÓN', null),
        ($2, 'HP-ALIAS', 'Wizard', 'Fantastic Beasts', 'Collectible Minifigures', 'Harry Potter / Harry Potter Series 1 Fantastic Beasts', 'COLECCIÓN', 'Wizard, Fantastic Beasts'),
        ($2, 'WHATIF-ALIAS', 'What If figure', null, 'Collectible Minifigures', 'Super Heroes / Marvel Studios Series 1 What If', 'COLECCIÓN', 'What If figure')`, [userA, userB]);
    await db.query(`insert into public.regalos_enviados(donante_id, receptor_id, semana)
      values ($1, $2, '0001-01-01')`, [userA, userB]);
    const giftNotification = (await db.query(`insert into public.notificaciones(
      user_id, type, payload, gift_donante_id, gift_semana
    ) values ($1, 'gift_received', '{"user":"A","amount":50}', $2, '0001-01-01') returning id`, [userB, userA])).rows[0].id;
    await db.query(`insert into public.agradecimientos_regalo(gift_notification_id, thanker_id, donor_id)
      values ($1, $2, $3)`, [giftNotification, userB, userA]);
    await db.query(`insert into public.user_daily_snapshots(
      user_id, snapshot_date, total_figures, total_value, bricks, level,
      pct_collector, pct_explorer, pct_rarity_hunter, pct_fan
    ) values ($1, '2026-10-01', 1, 10, 900, 8, 25, 25, 25, 25)`, [userA]);
    await db.query(`insert into private.daily_sync_runs(
      id, snapshot_date, status, phase, lease_owner, lease_expires_at, total_users
    ) values ($1, '2026-10-01', 'running', 'users', $2, clock_timestamp() + interval '1 hour', 2)`, [runId, leaseOwner]);

    const fullNamesById = new Map([['MIGRATION-1', 'Kept figure, Comic-Con 2022']]);
    const categories = [{ categoria: 'Collectible Minifigures', total: 845, subcategorias: [
      { subcategoria: 'Harry Potter / Harry Potter Series 1 / Fantastic Beasts', total: 6, anioInicio: 2018 },
      { subcategoria: 'Super Heroes / Marvel Studios Series 1 / What If...?', total: 4, anioInicio: 2021 },
    ] }];
    const migrate = (options = {}) => migrateGamificationV2({
      client: db, projectRef, categorias: categories, confirmBackup: true, confirmMaintenance: true,
      confirmCatalogCoverage: true, fullNamesById, ...options,
    });
    await assert.rejects(migrate({ confirmBackup: false }), /GAMIFICACION_V2_BACKUP_NO_CONFIRMADO/);
    await assert.rejects(migrate({ confirmBackup: false, allowNoBackupForTest: true, beforeCommit: async () => {
      throw new Error('CUTOVER_TEST_NO_BACKUP');
    } }), /CUTOVER_TEST_NO_BACKUP/);
    assert.equal((await db.query('select status from private.gamificacion_v2_migration where singleton')).rows[0].status, 'prepared');
    await assert.rejects(migrate({ beforeCommit: async () => {
      await assert.rejects(
        db.query('select public.aplicar_recalculo_gamificacion_categorias($1, $2::jsonb, $3)', ['b'.repeat(64), '[]', 'v2']),
        /RECALCULO_CATEGORIAS_MIGRACION_NO_APLICADA/,
      );
      throw new Error('CUTOVER_FAULT');
    } }), /CUTOVER_FAULT/);
    assert.equal((await db.query('select status from private.gamificacion_v2_migration where singleton')).rows[0].status, 'prepared');
    assert.equal((await db.query('select count(*)::integer as count from public.regalos_enviados')).rows[0].count, 1);
    assert.equal((await db.query('select status from private.daily_sync_runs where id = $1', [runId])).rows[0].status, 'running');
    assert.equal((await db.query("select nombre_completo from public.minifiguras where id = 'MIGRATION-1'")).rows[0].nombre_completo, null);
    assert.deepEqual((await db.query(`select id, subcategoria from public.minifiguras where id in ('HP-ALIAS', 'WHATIF-ALIAS') order by id`)).rows, [
      { id: 'HP-ALIAS', subcategoria: 'Harry Potter / Harry Potter Series 1 Fantastic Beasts' },
      { id: 'WHATIF-ALIAS', subcategoria: 'Super Heroes / Marvel Studios Series 1 What If' },
    ]);

    const result = await migrate();
    assert.equal(result.applied, true);
    assert.equal(result.users, 2);
    assert.equal(result.recoveredNames, 1);
    assert.equal(result.migratedSubcategoryReferences, 2);
    assert.match(result.fingerprint, /^[0-9a-f]{64}$/);
    assert.equal((await db.query('select count(*)::integer as count from public.gamificacion')).rows[0].count, 2);
    const userAState = (await db.query('select bricks, logros from public.gamificacion where user_id = $1', [userA])).rows[0];
    const expectedUserA = calcularGamificacion([{
      id: 'MIGRATION-1', nombre: 'Kept figure', descripcion: 'Visible description',
      nombreCompleto: 'Kept figure, Comic-Con 2022', categoria: 'Other', estadoColeccion: 'COLECCIÓN',
    }], categories, 0, 0, 0, {
      friends: 1, sent_pending: 0, accepted_sent: 1, accepted_received: 0,
      global_gifts_received: 0, weekly_gifts_received: 0, thanks_sent: 0, thanks_received: 0,
    });
    assert.equal(userAState.bricks, expectedUserA.bricks);
    assert.deepEqual(userAState.logros, expectedUserA.logros);
    assert.equal(userAState.logros.some(({ id }) => id === 'someone-liked-your-collection'), false);
    const userBState = (await db.query('select bricks, logros from public.gamificacion where user_id = $1', [userB])).rows[0];
    const userBFigures = (await db.query(`select id, nombre, descripcion, nombre_completo, categoria, subcategoria,
      estado_coleccion, anio, precio, precio_compra from public.minifiguras where user_id = $1 order by id`, [userB])).rows.map((figure) => ({
      id: figure.id, nombre: figure.nombre, descripcion: figure.descripcion,
      nombreCompleto: figure.nombre_completo, categoria: figure.categoria,
      subcategoria: figure.subcategoria, estadoColeccion: figure.estado_coleccion,
      anio: figure.anio ?? undefined, precio: figure.precio ?? undefined,
      precioCompra: figure.precio_compra ?? undefined,
    }));
    const expectedUserB = calcularGamificacion(userBFigures, categories, 0, 0, 0, {
      friends: 1, sent_pending: 0, accepted_sent: 0, accepted_received: 1,
      global_gifts_received: 0, weekly_gifts_received: 0, thanks_sent: 0, thanks_received: 0,
    });
    assert.equal(userBState.bricks, expectedUserB.bricks);
    assert.deepEqual(userBState.logros, expectedUserB.logros);
    assert.equal(userBState.logros.some(({ id }) => id === 'handshake'), true);
    assert.equal((await db.query('select count(*)::integer as count from public.minifiguras where user_id = $1', [userA])).rows[0].count, 1);
    assert.deepEqual((await db.query(`select id, nombre, descripcion, categoria, subcategoria, nombre_completo
      from public.minifiguras where user_id = $1 order by id`, [userB])).rows, [
      { id: 'HP-ALIAS', nombre: 'Wizard', descripcion: 'Fantastic Beasts', categoria: 'Collectible Minifigures',
        subcategoria: 'Harry Potter / Harry Potter Series 1 / Fantastic Beasts', nombre_completo: 'Wizard, Fantastic Beasts' },
      { id: 'WHATIF-ALIAS', nombre: 'What If figure', descripcion: null, categoria: 'Collectible Minifigures',
        subcategoria: 'Super Heroes / Marvel Studios Series 1 / What If...?', nombre_completo: 'What If figure' },
    ]);
    assert.deepEqual((await db.query("select nombre, descripcion, nombre_completo from public.minifiguras where id = 'MIGRATION-1'")).rows[0], {
      nombre: 'Kept figure', descripcion: 'Visible description', nombre_completo: 'Kept figure, Comic-Con 2022',
    });
    assert.equal((await db.query('select count(*)::integer as count from public.friendships')).rows[0].count, 1);
    assert.equal((await db.query('select status from public.friend_requests where sender_id = $1 and recipient_id = $2', [userA, userB])).rows[0].status, 'accepted');
    assert.equal((await db.query('select raw_user_meta_data->>\'full_name\' as name from auth.users where id = $1', [userA])).rows[0].name, 'User A');
    assert.equal((await db.query('select username, avatar_url from public.user_profiles where user_id = $1', [userA])).rows[0].username, 'User_A');
    assert.equal((await db.query('select avatar_url from public.perfiles_publicos where user_id = $1', [userA])).rows[0].avatar_url, 'https://avatars.example/a.png');
    assert.equal((await db.query('select category_name from public.user_profile_favorite_categories where user_id = $1', [userA])).rows[0].category_name, 'Space');
    for (const table of ['public.regalos_enviados', 'public.agradecimientos_regalo', 'public.notificaciones', 'public.user_daily_snapshots']) {
      assert.equal((await db.query(`select count(*)::integer as count from ${table}`)).rows[0].count, 0);
    }
    assert.equal((await db.query("select count(*)::integer as count from public.ranking_top10_membership where ranking_type = 'weekly'")).rows[0].count, 0);
    assert.equal((await db.query('select status, lease_owner from private.daily_sync_runs where id = $1', [runId])).rows[0].status, 'failed');
    assert.equal((await db.query('select initialized from private.ranking_top10_reconciliation_state where singleton')).rows[0].initialized, true);
    assert.equal((await db.query('select fingerprint from public.gamificacion_categoria_version where singleton')).rows[0].fingerprint, result.fingerprint);
    assert.equal((await db.query('select available_from = (date_trunc(\'week\', activated_at at time zone \'Europe/Madrid\')::date + 7) as valid from private.gamificacion_v2_activation')).rows[0].valid, true);
    assert.equal((await db.query('select count(*)::integer as count from public.notificaciones')).rows[0].count, 0);

    await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");
    assert.equal((await db.query('select public.reclamar_daily_sync($1, $2) as claimed', [runId, leaseOwner])).rows[0].claimed, false);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userA]);
    await db.query("select set_config('request.jwt.claim.role', 'authenticated', false)");
    await db.query('select public.regalar_bricks($1)', [userB]);
    const availableFrom = (await db.query('select available_from::text as date from private.gamificacion_v2_activation')).rows[0].date;
    await db.query(`insert into public.user_daily_snapshots(
      user_id, snapshot_date, total_figures, total_value, bricks, level,
      pct_collector, pct_explorer, pct_rarity_hunter, pct_fan, calculation_version
    ) values ($1, $2::date, 1, 10, 75, 1, 25, 25, 25, 25, 'v2')`, [userB, availableFrom]);
    const firstV2Week = (await db.query(`
      select private.ranking_semanal_calcular(($1::date + time '12:00') at time zone 'Europe/Madrid') as result
    `, [availableFrom])).rows[0].result;
    assert.equal(firstV2Week.available, false);
    assert.deepEqual(firstV2Week.entries, []);
    const repeated = await migrate({ confirmCatalogCoverage: false });
    assert.equal(repeated.applied, false);
    assert.equal(repeated.migratedSubcategoryReferences, 0);
    assert.equal((await db.query('select count(*)::integer as count from public.friendships')).rows[0].count, 1);
    await db.exec(schema);
    assert.equal((await db.query('select available_from::text as date from private.gamificacion_v2_activation')).rows[0].date, availableFrom);
    assert.equal((await db.query('select count(*)::integer as count from public.regalos_enviados')).rows[0].count, 1);
    assert.equal((await db.query("select count(*)::integer as count from public.notificaciones where type = 'gift_received'")).rows[0].count, 1);
    assert.equal((await db.query("select count(*)::integer as count from public.user_daily_snapshots where calculation_version = 'v2'")).rows[0].count, 1);
    assert.equal((await db.query('select status from private.gamificacion_v2_migration where singleton')).rows[0].status, 'applied');
    assert.equal((await db.query(`select count(*)::integer as count from public.minifiguras
      where subcategoria in ('Harry Potter / Harry Potter Series 1 Fantastic Beasts', 'Super Heroes / Marvel Studios Series 1 What If')`)).rows[0].count, 0);
  } finally {
    await db.close();
  }
});

test('omitir backup solo se permite para el project ref desechable confirmado', () => {
  const testProjectRef = 'wvcnftjhvcdxmuqpjqda';
  const commonFlags = ['--confirm-maintenance', '--confirm-catalog-coverage'];
  assert.deepEqual(parseCutoverConfirmations([
    '--confirm-project', testProjectRef, '--test-no-backup', ...commonFlags,
  ]), { projectRef: testProjectRef, confirmBackup: false, allowNoBackupForTest: true });
  assert.throws(() => parseCutoverConfirmations([
    '--confirm-project', 'abcdefghijklmnopqrst', '--test-no-backup', ...commonFlags,
  ]), /solo se permite para el proyecto de pruebas/);
  assert.throws(() => parseCutoverConfirmations([
    '--confirm-project', testProjectRef, ...commonFlags,
  ]), /exactamente una opcion/);
});