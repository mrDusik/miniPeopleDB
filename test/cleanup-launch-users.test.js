import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { fingerprint } from '../src/category-gamification-recalculator.js';
import { calcularGamificacion } from '../src/gamificacion.js';
import { cleanupLaunchUsers, parseCleanupArgs } from '../scripts/cleanup-launch-users.js';

const projectRef = 'abcdefghijklmnopqrst';
const ids = [1, 2, 3, 4, 5].map((id) => `00000000-0000-4000-8000-00000000000${id}`);
const categorias = [];

test('exige una revision explicita del plan y confirmaciones antes de aplicar', () => {
  const project = ['--confirm-project', projectRef];
  assert.equal(parseCleanupArgs(project).apply, false);
  assert.throws(() => parseCleanupArgs([...project, '--apply', '--confirm-backup', '--confirm-maintenance']), /--confirm-plan/);
  assert.throws(() => parseCleanupArgs([...project, '--apply', '--confirm-plan', 'a'.repeat(64)]), /--confirm-backup/);
  assert.throws(() => parseCleanupArgs([...project, '--delete-all']), /Unknown option/);
});

test('el CLI usa la CA indicada por sslrootcert y aborta antes de conectar si no puede leerla', () => {
  const script = fileURLToPath(new URL('../scripts/cleanup-launch-users.js', import.meta.url));
  const url = `postgresql://postgres.${projectRef}:fixture@aws-0-test.pooler.supabase.com:5432/postgres`;
  const result = spawnSync(process.execPath, [script, '--confirm-project', projectRef], {
    env: { ...process.env, SUPABASE_DB_URL: `${url}?sslmode=verify-full&sslrootcert=certificado-inexistente-para-prueba.pem` },
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No se pudo leer el certificado CA indicado por sslrootcert/);
});

test('limpia cuentas, regalos y la ventana semanal sin perder colecciones ni capturas anteriores', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql as $$ select current_user::text $$;
      create table auth.users (id uuid primary key, email text unique);
    `);
    await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
    await db.query('update public.gamificacion_categoria_version set fingerprint = $1', [fingerprint(categorias)]);
    await db.exec(`
      insert into private.gamificacion_v2_activation(singleton, version, activated_at, available_from)
      values (true, 'v2', '2020-01-01', '2020-01-06')
    `);
    const options = { client: db, categorias, projectRef };
    const applyOptions = { ...options, apply: true, confirmBackup: true, confirmMaintenance: true };
    const names = ['davidcardenas', 'mrDusik', 'onichan', 'cuentaPrueba'];
    for (const [index, name] of names.entries()) {
      await db.query('insert into auth.users(id) values ($1)', [ids[index]]);
      if (index === 2) await assert.rejects(cleanupLaunchUsers(options), /exactamente las tres/);
      await db.query('insert into public.user_profiles(user_id, username) values ($1, $2)', [ids[index], name]);
    }
    await db.query(`insert into public.minifiguras(user_id, id, nombre, categoria)
      values ($1, 'COL101', 'Ejemplo', 'Space'), ($2, 'COL101', 'De prueba', 'Space')`, [ids[0], ids[3]]);
    await db.query(`insert into public.friendships(user_low_id, user_high_id) values ($1, $2), ($1, $3)`, [ids[0], ids[1], ids[3]]);
    const { rows: [{ monday, baseline, previous }] } = await db.query(`
      select week::text as monday, (week - 1)::text as baseline, (week - 2)::text as previous
      from (select date_trunc('week', now() at time zone 'Europe/Madrid')::date as week) dates
    `);
    await db.query(`insert into public.regalos_enviados(donante_id, receptor_id, semana)
      values ($1, $2, '0001-01-01'), ($3, $1, $4)`, [ids[0], ids[1], ids[3], monday]);
    const { rows: [{ id: notificationId }] } = await db.query(`
      insert into public.notificaciones(user_id, type, gift_donante_id)
      values ($1, 'gift_received', $2) returning id`, [ids[1], ids[0]]);
    await db.query(`
      insert into public.agradecimientos_regalo(gift_notification_id, thanker_id, donor_id)
      values ($1, $2, $3)`, [notificationId, ids[1], ids[0]]);
    await db.query(`insert into public.notificaciones(user_id, type, payload) values
      ($1, 'gift_thanks', '{}'), ($1, 'weekly_ranking_available', jsonb_build_object('weekStart', $2::text))`, [ids[0], monday]);
    await db.query(`insert into public.notificaciones(user_id, type, snapshot_date)
      values ($1, 'daily_summary', $2)`, [ids[0], previous]);
    const withGift = calcularGamificacion([], categorias, 1);
    await db.query("insert into public.gamificacion(user_id, bricks, nivel) values ($1, 60, '{\"id\":1}')", [ids[0]]);
    await db.query("insert into public.gamificacion(user_id, bricks, nivel) values ($1, 900, '{\"id\":4}')", [ids[3]]);
    await db.query('insert into public.gamificacion(user_id, bricks, nivel, logros) values ($1, $2, $3::jsonb, $4::jsonb)',
      [ids[1], withGift.bricks, JSON.stringify(withGift.nivel), JSON.stringify(withGift.logros)]);
    await db.query(`
      insert into public.user_daily_snapshots(
        user_id, snapshot_date, total_figures, total_value, bricks, level,
        pct_collector, pct_explorer, pct_rarity_hunter, pct_fan, calculation_version
      ) values ($1, $2, 1, 10, 50, 1, 0, 0, 0, 0, 'v2'),
        ($1, $3, 1, 10, 55, 1, 0, 0, 0, 0, 'v2'), ($1, $4, 1, 10, 60, 1, 0, 0, 0, 0, 'v2'),
        ($5, $2, 0, 0, 0, 0, 0, 0, 0, 0, 'v2')
    `, [ids[0], previous, baseline, monday, ids[3]]);
    await db.query("insert into public.ranking_top10_membership(user_id, ranking_type, position) values ($1, 'weekly', 1)", [ids[0]]);
    await db.query('insert into private.weekly_ranking_publications(week_start) values ($1)', [monday]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ids[0]]);
    const readRanking = async () => (await db.query('select public.ranking_semanal() as ranking')).rows[0].ranking;
    assert.equal((await readRanking()).available, true);

    const preview = await cleanupLaunchUsers(options);
    assert.equal(preview.aplicado, false);
    assert.deepEqual(preview.eliminar, [{ id: ids[3], username: names[3] }]);
    assert.equal(preview.registros_a_retirar.regalos, 2);
    assert.equal(preview.semanal.capturas_de_cuentas_conservadas, 2);
    assert.equal(preview.conservar[1].bricks_antes, withGift.bricks);
    assert.ok(preview.conservar[1].logros_antes.some(({ id }) => id === 'oh-you-shouldnt-have'));
    assert.ok(!preview.conservar[1].logros_despues.some(({ id }) => id === 'oh-you-shouldnt-have'));
    const readIds = async () => (await db.query('select id from auth.users order by id')).rows.map(({ id }) => id);
    assert.deepEqual(await readIds(), ids.slice(0, 4));

    await db.query('insert into auth.users(id) values ($1)', [ids[4]]);
    await assert.rejects(cleanupLaunchUsers({ ...applyOptions, confirmPlan: preview.huella }), /plan ha cambiado/);
    assert.deepEqual(await readIds(), ids);
    await db.query("insert into public.gamificacion(user_id, bricks, nivel) values ($1, 850, '{\"id\":4}')", [ids[4]]);
    await db.query('insert into public.friendships(user_low_id, user_high_id) values ($1, $2)', [ids[3], ids[4]]);
    const updated = await cleanupLaunchUsers(options);
    assert.deepEqual(updated.eliminar[1], { id: ids[4], username: null });
    await db.exec(`
      create function public.reject_snapshot_cleanup() returns trigger language plpgsql as $$
      begin raise exception 'fallo provocado'; end $$;
      create trigger reject_snapshot_cleanup before delete on public.user_daily_snapshots
      for each statement execute function public.reject_snapshot_cleanup();
    `);
    await assert.rejects(cleanupLaunchUsers({ ...applyOptions, confirmPlan: updated.huella }), /fallo provocado/);
    assert.deepEqual(await readIds(), ids);
    assert.deepEqual(await cleanupLaunchUsers(options), updated);
    await db.exec('drop trigger reject_snapshot_cleanup on public.user_daily_snapshots');
    // Exercise reconciliation before Auth's foreign-key cascades finish.
    await db.exec(`
      create function public.reconcile_during_auth_delete() returns trigger language plpgsql as $$
      begin update public.gamificacion set bricks = bricks where user_id <> old.id; return null; end $$;
      create trigger "00_reconcile_during_auth_delete" after delete on auth.users
      for each row execute function public.reconcile_during_auth_delete();
    `);

    const result = await cleanupLaunchUsers({ ...applyOptions, confirmPlan: updated.huella });
    assert.equal(result.aplicado, true);
    assert.deepEqual(await readIds(), ids.slice(0, 3));
    assert.deepEqual((await db.query('select user_id, nombre from public.minifiguras')).rows, [{ user_id: ids[0], nombre: 'Ejemplo' }]);
    assert.deepEqual((await db.query('select snapshot_date::text from public.user_daily_snapshots')).rows, [{ snapshot_date: previous }]);
    assert.deepEqual((await db.query("select type from public.notificaciones where type = 'daily_summary'")).rows, [{ type: 'daily_summary' }]);
    const after = await cleanupLaunchUsers(options);
    assert.deepEqual(Object.values(after.registros_a_retirar), [0, 0, 0, 0, 0, 0]);
    assert.equal(after.conservar[0].bricks_antes,
      calcularGamificacion([{ id: 'COL101', categoria: 'Space', estadoColeccion: 'COLECCIÓN' }], categorias, 0, 0, 0, { friends: 1 }).bricks);
    assert.deepEqual(after.conservar[1].logros_antes, preview.conservar[1].logros_despues);
    const ranking = await readRanking();
    assert.equal(ranking.available, false);
    assert.deepEqual(ranking.entries, []);
  } finally {
    await db.close();
  }
});
