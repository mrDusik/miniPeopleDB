import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Client } from 'pg';
import { fingerprint } from '../src/category-gamification-recalculator.js';
import { calcularGamificacion } from '../src/gamificacion.js';
import { projectRefFromDatabaseUrl } from './migrate-gamification-v2.js';

const KEEP = ['davidcardenas', 'mrdusik', 'onichan'];
const PROJECT_REF = /^[a-z0-9]{20}$/;
const PLAN_HASH = /^[a-f0-9]{64}$/;
const LOCKED_TABLES = [
  'auth.users', 'private.daily_sync_runs', 'private.gamificacion_v2_activation', 'private.weekly_ranking_publications',
  'public.user_profiles', 'public.minifiguras', 'public.friendships', 'public.friend_requests',
  'public.gamificacion_categoria_version', 'public.gamificacion', 'public.regalos_enviados',
  'public.agradecimientos_regalo', 'public.notificaciones', 'public.user_daily_snapshots',
  'public.ranking_top10_membership',
];

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function parseCleanupArgs(args) {
  const { values } = parseArgs({
    args,
    options: {
      'confirm-project': { type: 'string' },
      apply: { type: 'boolean' },
      'confirm-plan': { type: 'string' },
      'confirm-backup': { type: 'boolean' },
      'confirm-maintenance': { type: 'boolean' },
    },
  });
  const options = {
    projectRef: values['confirm-project'],
    apply: values.apply ?? false,
    confirmPlan: values['confirm-plan'],
    confirmBackup: values['confirm-backup'],
    confirmMaintenance: values['confirm-maintenance'],
  };
  validateConfirmations(options);
  return options;
}

function validateConfirmations({ projectRef, apply, confirmPlan, confirmBackup, confirmMaintenance }) {
  if (!PROJECT_REF.test(projectRef)) throw new Error('Indica --confirm-project con el project ref de Supabase.');
  if (apply && (!PLAN_HASH.test(confirmPlan) || !confirmBackup || !confirmMaintenance)) {
    throw new Error('--apply requiere --confirm-plan <huella>, --confirm-backup y --confirm-maintenance.');
  }
  if (!apply && (confirmPlan !== undefined || confirmBackup || confirmMaintenance)) {
    throw new Error('Las confirmaciones de escritura solo se admiten con --apply.');
  }
}

async function readCollections(client, ids) {
  return (await client.query(`
    select user_id, to_jsonb(figure) as data
    from public.minifiguras figure where user_id = any($1::uuid[]) order by user_id, id
  `, [ids])).rows;
}

function notificationPredicate(weekParameter) {
  return `type in ('gift_received', 'gift_thanks')
    or (type = 'weekly_ranking_available' and payload->>'weekStart' = ${weekParameter}::date::text)`;
}

async function readCleanupScope(client, baseline, weekStart) {
  return (await client.query(`
    select
      (select count(*)::integer from public.regalos_enviados) as regalos,
      (select count(*)::integer from public.agradecimientos_regalo) as agradecimientos,
      (select count(*)::integer from public.notificaciones where ${notificationPredicate('$2')}) as avisos,
      (select count(*)::integer from public.ranking_top10_membership where ranking_type = 'weekly') as puestos_semanales,
      (select count(*)::integer from public.user_daily_snapshots where snapshot_date >= $1::date) as capturas_desde_base,
      (select count(*)::integer from private.weekly_ranking_publications where week_start = $2::date) as publicaciones_semana
  `, [baseline, weekStart])).rows[0];
}

async function readPlan(client, categorias, projectRef) {
  const catalogHash = fingerprint(categorias);
  const { rows: [version] } = await client.query(`
    select fingerprint, (select exists (
      select 1 from private.gamificacion_v2_activation where singleton and version = 'v2'
    )) as active
    from public.gamificacion_categoria_version where singleton
  `);
  if (!version?.active || version.fingerprint !== catalogHash) {
    throw new Error('La gamificacion V2 o la huella del catalogo local no coincide con la base.');
  }

  const { rows: accounts } = await client.query(`
    select users.id, profile.username
    from auth.users users left join public.user_profiles profile on profile.user_id = users.id
    order by users.id
  `);
  const retained = accounts.filter(({ username }) => KEEP.includes(username?.toLowerCase()));
  if (retained.length !== KEEP.length || new Set(retained.map(({ username }) => username.toLowerCase())).size !== KEEP.length) {
    throw new Error('No se han encontrado exactamente las tres cuentas que se deben conservar.');
  }
  const ids = retained.map(({ id }) => id);
  const removed = accounts.filter(({ id }) => !ids.includes(id));
  const { rows: [{ baseline, week_start: weekStart }] } = await client.query(`
    select (week_start - 1)::text as baseline, week_start::text
    from (select date_trunc('week', clock_timestamp() at time zone 'Europe/Madrid')::date as week_start) week
  `);
  const collections = await readCollections(client, ids);
  const { rows: sources } = await client.query(`
    with friendships as (
      select * from public.friendships where user_low_id = any($1::uuid[]) and user_high_id = any($1::uuid[])
    ), requests as (
      select * from public.friend_requests request
      where sender_id = any($1::uuid[]) and recipient_id = any($1::uuid[])
        and (status = 'pending' or (status = 'accepted' and exists (
          select 1 from friendships where user_low_id = least(request.sender_id, request.recipient_id)
            and user_high_id = greatest(request.sender_id, request.recipient_id)
        )))
    )
    select users.id, g.bricks, g.nivel, g.logros,
      (select count(*)::integer from friendships where users.id in (user_low_id, user_high_id)) as friends,
      (select count(*)::integer from requests where sender_id = users.id and status = 'pending') as sent_pending,
      (select count(*)::integer from requests where sender_id = users.id and status = 'accepted') as accepted_sent,
      (select count(*)::integer from requests where recipient_id = users.id and status = 'accepted') as accepted_received
    from auth.users users left join public.gamificacion g on g.user_id = users.id
    where users.id = any($1::uuid[]) order by users.id
  `, [ids]);
  const states = sources.map(({ id, bricks, nivel, logros, ...social }) => {
    const figures = collections.filter(({ user_id }) => user_id === id).map(({ data }) => ({
      id: data.id, nombre: data.nombre, nombreCompleto: data.nombre_completo,
      categoria: data.categoria, subcategoria: data.subcategoria, anio: data.anio,
      estadoColeccion: data.estado_coleccion, precio: data.precio, precioCompra: data.precio_compra,
    }));
    return {
      id,
      previous: { bricks, nivel, logros },
      next: calcularGamificacion(figures, categorias, 0, 0, 0, social),
    };
  });
  const scope = await readCleanupScope(client, baseline, weekStart);
  const { rows: [{ count: retainedSnapshots }] } = await client.query(`
    select count(*)::integer as count from public.user_daily_snapshots
    where user_id = any($1::uuid[]) and snapshot_date >= $2::date
  `, [ids, baseline]);
  const collectionHash = hash(collections);
  const summary = {
    proyecto: projectRef,
    conservar: retained.map((account, index) => {
      const { previous, next } = states[index];
      return {
        ...account,
        bricks_antes: previous.bricks, bricks_despues: next.bricks,
        nivel_antes: previous.nivel?.id ?? null, nivel_despues: next.nivel.id,
        logros_antes: (previous.logros ?? []).map(({ id, cantidad }) => ({ id, cantidad })),
        logros_despues: next.logros.map(({ id, cantidad }) => ({ id, cantidad })),
      };
    }),
    eliminar: removed,
    semanal: { lunes: weekStart, borrar_desde_inclusive: baseline, capturas_de_cuentas_conservadas: retainedSnapshots },
    registros_a_retirar: scope,
  };
  return { ids, removed, states, baseline, weekStart, collectionHash, summary, planHash: hash({ summary, states, catalogHash, collectionHash }) };
}

export async function cleanupLaunchUsers({ client, categorias, projectRef, apply = false, confirmPlan, confirmBackup, confirmMaintenance }) {
  validateConfirmations({ projectRef, apply, confirmPlan, confirmBackup, confirmMaintenance });
  if (!Array.isArray(categorias)) throw new Error('El catalogo de categorias debe ser un array.');
  await client.query(apply ? 'begin' : 'begin isolation level repeatable read read only');
  try {
    await client.query("set local lock_timeout = '5s'");
    await client.query("set local statement_timeout = '60s'");
    await client.query('set local row_security = off');
    const { rows: [{ allowed }] } = await client.query(`
      select (role.rolsuper or pg_get_userbyid(db.datdba) = current_user) as allowed
      from pg_database db join pg_roles role on role.rolname = current_user
      where db.datname = current_database()
    `);
    if (!allowed) throw new Error('Se requiere el propietario de la base de datos.');

    if (apply) {
      await client.query(`lock table ${LOCKED_TABLES.join(', ')} in share row exclusive mode`);
    }
    const plan = await readPlan(client, categorias, projectRef);
    const result = { ...plan.summary, huella: plan.planHash, aplicado: apply };
    if (!apply) {
      await client.query('rollback');
      return result;
    }
    if (plan.planHash !== confirmPlan) {
      throw new Error('El plan ha cambiado. Ejecuta y revisa una nueva simulacion; no se ha borrado nada.');
    }
    const { rows: jobs } = await client.query("select 1 from private.daily_sync_runs where status in ('pending', 'running') limit 1");
    if (jobs.length) throw new Error('Hay un trabajo de analitica pendiente o en ejecucion. Espera a que termine.');

    await client.query('delete from public.agradecimientos_regalo');
    await client.query('delete from public.regalos_enviados');
    const removedIds = plan.removed.map(({ id }) => id);
    if (removedIds.length) {
      // Auth deletion can rebuild friends' gamification before all ranking cascades finish.
      await client.query('delete from public.friendships where user_low_id = any($1::uuid[]) or user_high_id = any($1::uuid[])', [removedIds]);
      await client.query('delete from public.friend_requests where sender_id = any($1::uuid[]) or recipient_id = any($1::uuid[])', [removedIds]);
      await client.query('delete from public.gamificacion where user_id = any($1::uuid[])', [removedIds]);
    }
    const deleted = await client.query('delete from auth.users where id = any($1::uuid[])', [removedIds]);
    if (deleted.rowCount !== plan.removed.length) throw new Error('No se ha eliminado la lista exacta de cuentas.');

    await client.query(`delete from public.notificaciones where ${notificationPredicate('$1')}`, [plan.weekStart]);
    await client.query('delete from public.user_daily_snapshots where user_id = any($1::uuid[]) and snapshot_date >= $2::date', [plan.ids, plan.baseline]);
    await client.query("delete from public.ranking_top10_membership where ranking_type = 'weekly'");
    await client.query('delete from private.weekly_ranking_publications where week_start = $1::date', [plan.weekStart]);

    const states = plan.states.map(({ id, next }) => ({
      user_id: id, bricks: next.bricks, nivel: next.nivel, siguiente_nivel: next.siguienteNivel,
      progreso: next.progreso, logros: next.logros,
    }));
    await client.query(`
      insert into public.gamificacion(user_id, bricks, nivel, siguiente_nivel, progreso, logros)
      select user_id, bricks, nivel, siguiente_nivel, progreso, logros
      from jsonb_to_recordset($1::jsonb) as next(user_id uuid, bricks integer, nivel jsonb, siguiente_nivel jsonb, progreso jsonb, logros jsonb)
      on conflict (user_id) do update set bricks = excluded.bricks, nivel = excluded.nivel,
        siguiente_nivel = excluded.siguiente_nivel, progreso = excluded.progreso, logros = excluded.logros,
        updated_at = clock_timestamp()
    `, [JSON.stringify(states)]);

    const { rows: remaining } = await client.query('select id from auth.users order by id');
    const { rows: [{ matches }] } = await client.query(`
      select count(*)::integer as matches
      from public.gamificacion g
      join jsonb_array_elements($1::jsonb) expected(state) on g.user_id = (expected.state->>'user_id')::uuid
      where to_jsonb(g) - array['created_at', 'updated_at'] = expected.state
    `, [JSON.stringify(states)]);
    const scope = await readCleanupScope(client, plan.baseline, plan.weekStart);
    if (JSON.stringify(remaining.map(({ id }) => id)) !== JSON.stringify(plan.ids)
      || matches !== plan.ids.length || hash(await readCollections(client, plan.ids)) !== plan.collectionHash
      || Object.values(scope).some((count) => count !== 0)) {
      throw new Error('La verificacion posterior no coincide con el plan. Se revierte la limpieza.');
    }
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

export async function cleanupDatabaseConfig(connectionString, projectRef) {
  if (projectRefFromDatabaseUrl(connectionString) !== projectRef) {
    throw new Error('SUPABASE_DB_URL no coincide con el proyecto confirmado.');
  }
  const url = new URL(connectionString);
  const sslModes = url.searchParams.getAll('sslmode');
  const caPaths = url.searchParams.getAll('sslrootcert');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.pathname !== '/postgres'
    || !/^(?:db\.[a-z0-9]{20}\.supabase\.co|[a-z0-9-]+\.pooler\.supabase\.com)$/.test(url.hostname)
    || [...url.searchParams.keys()].some((key) => key !== 'sslmode' && key !== 'sslrootcert')
    || sslModes.length > 1 || sslModes.some((mode) => mode !== 'verify-full')
    || caPaths.length > 1 || caPaths.some((path) => !path.trim())) {
    throw new Error('Usa la URL PostgreSQL del Dashboard, sin parametros salvo sslmode=verify-full y sslrootcert.');
  }
  const ssl = { rejectUnauthorized: true };
  if (caPaths.length) {
    try {
      ssl.ca = await readFile(caPaths[0], 'utf8');
    } catch (error) {
      throw new Error('No se pudo leer el certificado CA indicado por sslrootcert.', { cause: error });
    }
  }
  // Keep the TLS options in one place; URL TLS options override the pg Client options.
  url.search = '';
  return { connectionString: url.href, ssl, connectionTimeoutMillis: 10000 };
}

async function main() {
  const options = parseCleanupArgs(process.argv.slice(2));
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error('Falta SUPABASE_DB_URL en el entorno.');
  const config = await cleanupDatabaseConfig(connectionString, options.projectRef);
  const categorias = JSON.parse(await readFile(new URL('../data/categorias-brickset.json', import.meta.url), 'utf8'));
  const client = new Client(config);
  await client.connect();
  try {
    console.log(JSON.stringify(await cleanupLaunchUsers({ client, categorias, ...options }), null, 2));
  } finally {
    await client.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Limpieza no completada: ${error.message}`);
    process.exitCode = 1;
  });
}
