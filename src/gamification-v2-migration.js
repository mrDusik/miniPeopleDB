import { calcularGamificacion } from './gamificacion.js';
import { fingerprint } from './category-gamification-recalculator.js';

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const NO_BACKUP_TEST_PROJECT_REF = 'wvcnftjhvcdxmuqpjqda';
const MIGRATION_LOCK_NAME = 'minipeople-gamification-v2-migration';
const BRICKSET_SUBCATEGORY_ALIASES = new Map([
  ['Harry Potter / Harry Potter Series 1 Fantastic Beasts', 'Harry Potter / Harry Potter Series 1 / Fantastic Beasts'],
  ['Super Heroes / Marvel Studios Series 1 What If', 'Super Heroes / Marvel Studios Series 1 / What If...?'],
]);
const LOCKED_TABLES = [
  'auth.users',
  'public.agradecimientos_regalo',
  'public.friend_requests',
  'public.friendships',
  'public.gamificacion',
  'public.gamificacion_categoria_version',
  'public.minifiguras',
  'public.notificaciones',
  'public.ranking_top10_membership',
  'public.regalos_enviados',
  'public.user_daily_snapshots',
  'private.daily_sync_prices',
  'private.daily_sync_runs',
  'private.daily_sync_users',
  'private.gamificacion_v2_activation',
  'private.gamificacion_v2_migration',
  'private.ranking_top10_reconciliation_state',
];

export async function resolveBricksetFullNames({ client, brickset } = {}) {
  if (!client || typeof client.query !== 'function') throw new TypeError('Se requiere un cliente PostgreSQL');
  const { rows } = await client.query(`
    select distinct upper(btrim(id)) as id
    from public.minifiguras
    where nullif(btrim(nombre_completo), '') is null
    order by upper(btrim(id))
  `);
  if (rows.length === 0) return new Map();
  if (!brickset || typeof brickset.getFullName !== 'function') throw new TypeError('Se requiere Brickset para recuperar nombres');

  const names = new Map();
  const failedIds = [];
  for (const { id } of rows) {
    try {
      const fullName = await brickset.getFullName(id);
      if (typeof fullName !== 'string' || fullName.trim() === '') throw new Error('BRICKSET_NOMBRE_INVALIDO');
      names.set(id, fullName.trim());
    } catch {
      failedIds.push(id);
    }
  }
  if (failedIds.length > 0) {
    const error = new Error(`BRICKSET_NOMBRES_INCOMPLETOS: ${failedIds.length} IDs sin nombre completo valido`);
    error.code = 'BRICKSET_NOMBRES_INCOMPLETOS';
    error.failedIds = failedIds;
    throw error;
  }
  return names;
}

function buildInitialStates(users, figures, socialSources, categorias) {
  const figuresByUser = new Map();
  const socialByUser = new Map(socialSources.map((source) => [source.user_id, source]));
  const userIds = new Set(users.map(({ user_id }) => user_id));

  for (const figure of figures) {
    if (!userIds.has(figure.user_id)) throw new Error('Una minifigura no pertenece a una cuenta Auth vigente');
    if (!figuresByUser.has(figure.user_id)) figuresByUser.set(figure.user_id, []);
    figuresByUser.get(figure.user_id).push({
      id: figure.id,
      nombre: figure.nombre,
      nombreCompleto: figure.nombre_completo ?? undefined,
      categoria: figure.categoria,
      subcategoria: figure.subcategoria ?? undefined,
      anio: figure.anio ?? undefined,
      estadoColeccion: figure.estado_coleccion,
      precio: figure.precio ?? undefined,
      precioCompra: figure.precio_compra ?? undefined,
    });
  }

  return users.map(({ user_id }) => {
    const sources = socialByUser.get(user_id);
    if (!sources) throw new Error('Faltan fuentes sociales para una cuenta Auth');
    const state = calcularGamificacion(
      figuresByUser.get(user_id) ?? [], categorias,
      0, 0, 0,
      { ...sources, global_gifts_received: 0, weekly_gifts_received: 0, thanks_sent: 0, thanks_received: 0 },
    );
    return {
      user_id,
      bricks: state.bricks,
      nivel: state.nivel,
      siguiente_nivel: state.siguienteNivel,
      progreso: state.progreso,
      logros: state.logros,
    };
  });
}

async function readV2Sources(client, categorias) {
  const [users, figures, socialSources] = await Promise.all([
    client.query('select id::text as user_id from auth.users order by id'),
    client.query(`select user_id::text as user_id, id, nombre, nombre_completo, categoria, subcategoria,
      anio, estado_coleccion, precio, precio_compra
      from public.minifiguras order by user_id, id`),
    client.query(`select users.id::text as user_id,
      (select count(*)::integer from public.friendships friendship
        where users.id in (friendship.user_low_id, friendship.user_high_id)) as friends,
      (select count(*)::integer from public.friend_requests request
        where request.sender_id = users.id and request.status = 'pending') as sent_pending,
      (select count(*)::integer from public.friend_requests request
        where request.sender_id = users.id and request.status = 'accepted'
          and exists (select 1 from public.friendships friendship
            where friendship.user_low_id = least(request.sender_id, request.recipient_id)
              and friendship.user_high_id = greatest(request.sender_id, request.recipient_id))) as accepted_sent,
      (select count(*)::integer from public.friend_requests request
        where request.recipient_id = users.id and request.status = 'accepted'
          and exists (select 1 from public.friendships friendship
            where friendship.user_low_id = least(request.sender_id, request.recipient_id)
              and friendship.user_high_id = greatest(request.sender_id, request.recipient_id))) as accepted_received
      from auth.users users order by users.id`),
  ]);
  const states = buildInitialStates(users.rows, figures.rows, socialSources.rows, categorias);
  if (states.length !== users.rows.length) throw new Error('La cobertura de cuentas Auth no es completa');
  return states;
}

async function assertOwner(client) {
  const { rows } = await client.query(`
    select current_user as current_user,
      pg_get_userbyid(database.datdba) as database_owner,
      role.rolsuper as is_superuser
    from pg_database database
    join pg_roles role on role.rolname = current_user
    where database.datname = current_database()
  `);
  if (!rows[0] || (!rows[0].is_superuser && rows[0].current_user !== rows[0].database_owner)) {
    throw new Error('GAMIFICACION_V2_SOLO_PROPIETARIO');
  }
}

export async function migrateGamificationV2({
  client,
  projectRef,
  categorias,
  fullNamesById = new Map(),
  confirmBackup = false,
  allowNoBackupForTest = false,
  confirmMaintenance = false,
  confirmCatalogCoverage = false,
  beforeCommit,
} = {}) {
  if (!client || typeof client.query !== 'function') throw new TypeError('Se requiere un cliente PostgreSQL');
  if (typeof projectRef !== 'string' || !PROJECT_REF_PATTERN.test(projectRef)) {
    throw new Error('GAMIFICACION_V2_CONFIRMAR_PROYECTO');
  }
  if (!(fullNamesById instanceof Map)) throw new TypeError('Los nombres Brickset deben ser un mapa');

  let transactionOpen = false;
  let recoveredNames = 0;
  let migratedSubcategoryReferences = 0;
  try {
    await client.query('begin isolation level serializable');
    transactionOpen = true;
    await assertOwner(client);
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [MIGRATION_LOCK_NAME]);

    const { rows: markers } = await client.query(`
      select version, project_ref, fingerprint, status
      from private.gamificacion_v2_migration
      where singleton = true
      for update
    `);
    const marker = markers[0];
    if (!marker) throw new Error('GAMIFICACION_V2_MARCADOR_NO_ENCONTRADO');
    if (marker.project_ref !== projectRef || marker.version !== 'v2') {
      throw new Error('GAMIFICACION_V2_CONFIRMAR_PROYECTO');
    }
    if (marker.status === 'applied') {
      await client.query('commit');
      transactionOpen = false;
      return { applied: false, users: 0, recoveredNames: 0, migratedSubcategoryReferences: 0, fingerprint: marker.fingerprint };
    }
    if (marker.status !== 'prepared') throw new Error('GAMIFICACION_V2_MIGRACION_EN_CURSO');
    if (!confirmBackup && !(allowNoBackupForTest && projectRef === NO_BACKUP_TEST_PROJECT_REF)) {
      throw new Error('GAMIFICACION_V2_BACKUP_NO_CONFIRMADO');
    }
    if (!confirmMaintenance) throw new Error('GAMIFICACION_V2_MANTENIMIENTO_NO_CONFIRMADO');
    if (!confirmCatalogCoverage) throw new Error('GAMIFICACION_V2_COBERTURA_CATALOGO_NO_CONFIRMADA');
    if (!Array.isArray(categorias)) throw new TypeError('El catálogo de categorías no es válido');

    await client.query(`lock table ${LOCKED_TABLES.join(', ')} in access exclusive mode`);
    const { rows: activations } = await client.query('select 1 from private.gamificacion_v2_activation where singleton = true');
    if (activations.length) throw new Error('GAMIFICACION_V2_YA_ACTIVADA_SIN_MIGRACION');

    for (const [legacySubcategory, canonicalSubcategory] of BRICKSET_SUBCATEGORY_ALIASES) {
      const migrated = await client.query(`
        update public.minifiguras
        set subcategoria = $2
        where categoria = 'Collectible Minifigures' and subcategoria = $1
        returning user_id, id
      `, [legacySubcategory, canonicalSubcategory]);
      migratedSubcategoryReferences += migrated.rowCount;
    }

    const { rows: missingNames } = await client.query(`
      select distinct upper(btrim(id)) as id
      from public.minifiguras
      where nullif(btrim(nombre_completo), '') is null
      order by upper(btrim(id))
    `);
    for (const { id } of missingNames) {
      const fullName = fullNamesById.get(id);
      if (typeof fullName !== 'string' || fullName.trim() === '') {
        throw new Error('GAMIFICACION_V2_NOMBRES_COMPLETOS_INCOMPLETOS');
      }
      const updated = await client.query(`
        update public.minifiguras set nombre_completo = $2
        where upper(btrim(id)) = $1 and nullif(btrim(nombre_completo), '') is null
        returning user_id
      `, [id, fullName.trim()]);
      if (updated.rowCount === 0) throw new Error('GAMIFICACION_V2_NOMBRES_COMPLETOS_NO_GUARDADOS');
      recoveredNames += updated.rowCount;
    }

    const states = await readV2Sources(client, categorias);
    const currentFingerprint = fingerprint(categorias);
    await client.query(`
      update private.gamificacion_v2_migration
      set status = 'applying', fingerprint = $1
      where singleton = true
    `, [currentFingerprint]);

    await client.query(`
      update private.daily_sync_runs
      set status = 'failed', phase = 'completed', lease_owner = null, lease_expires_at = null,
        error_code = 'GAMIFICACION_V2_MIGRATION', completed_at = clock_timestamp(), updated_at = clock_timestamp()
      where status in ('pending', 'running')
    `);
    await client.query('delete from private.daily_sync_users');
    await client.query('delete from private.daily_sync_prices');
    await client.query('delete from public.agradecimientos_regalo');
    await client.query('delete from public.notificaciones');
    await client.query('delete from public.regalos_enviados');
    await client.query('delete from public.user_daily_snapshots');
    await client.query('delete from public.ranking_top10_membership');
    await client.query('update private.ranking_top10_reconciliation_state set initialized = false, updated_at = clock_timestamp() where singleton');

    await client.query(`
      insert into public.gamificacion(user_id, bricks, nivel, siguiente_nivel, progreso, logros, updated_at)
      select state.user_id, state.bricks, state.nivel, state.siguiente_nivel, state.progreso, state.logros, clock_timestamp()
      from jsonb_to_recordset($1::jsonb) as state(
        user_id uuid, bricks integer, nivel jsonb, siguiente_nivel jsonb, progreso jsonb, logros jsonb
      )
      on conflict (user_id) do update set
        bricks = excluded.bricks,
        nivel = excluded.nivel,
        siguiente_nivel = excluded.siguiente_nivel,
        progreso = excluded.progreso,
        logros = excluded.logros,
        updated_at = excluded.updated_at
    `, [JSON.stringify(states)]);

    const versionResult = await client.query(`
      update public.gamificacion_categoria_version
      set fingerprint = $1, updated_at = clock_timestamp()
      where singleton = true
      returning fingerprint
    `, [currentFingerprint]);
    if (versionResult.rowCount !== 1) throw new Error('GAMIFICACION_V2_HUELLA_NO_GUARDADA');

    await client.query(`
      with activation as (select clock_timestamp() as activated_at)
      insert into private.gamificacion_v2_activation(singleton, version, activated_at, available_from)
      select true, 'v2', activated_at,
        (date_trunc('week', activated_at at time zone 'Europe/Madrid')::date + 7)
      from activation
    `);

    const { rows: remaining } = await client.query(`
      select
        (select count(*)::integer from auth.users) as users,
        (select count(*)::integer from public.gamificacion) as gamification,
        (select count(*)::integer from public.regalos_enviados) as gifts,
        (select count(*)::integer from public.agradecimientos_regalo) as thanks,
        (select count(*)::integer from public.notificaciones) as notifications,
        (select count(*)::integer from public.user_daily_snapshots) as snapshots,
        (select count(*)::integer from public.ranking_top10_membership where ranking_type = 'weekly') as weekly_members
    `);
    const result = remaining[0];
    if (result.users !== result.gamification || result.gifts || result.thanks || result.notifications || result.snapshots || result.weekly_members) {
      throw new Error('GAMIFICACION_V2_INVARIANTES_NO_CUMPLIDAS');
    }

    await beforeCommit?.();
    const { rows: activationRows } = await client.query('select available_from::text as available_from from private.gamificacion_v2_activation where singleton');
    await client.query(`
      update private.gamificacion_v2_migration
      set status = 'applied', applied_at = clock_timestamp()
      where singleton = true
    `);
    await client.query('commit');
    transactionOpen = false;
    return {
      applied: true, users: states.length, recoveredNames, migratedSubcategoryReferences,
      fingerprint: currentFingerprint, availableFrom: activationRows[0].available_from,
    };
  } catch (error) {
    if (transactionOpen) await client.query('rollback').catch(() => {});
    throw error;
  }
}