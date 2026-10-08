import { createHash } from 'node:crypto';
import { DNA_PONDERACIONES, selectLevel } from '../src/gamificacion.js';
import { collectionHighlights } from '../src/collection-highlights.js';

const PRIMARY_KEYS = {
  minifiguras: ['user_id', 'id'],
  gamificacion: ['user_id'],
  perfiles_publicos: ['user_id'],
  regalos_enviados: ['donante_id', 'receptor_id'],
  user_daily_snapshots: ['user_id', 'snapshot_date'],
};

const COLUMN_DEFAULTS = {
  minifiguras: () => ({ estado_coleccion: 'COLECCIÓN', observada: false, fecha_registro: new Date().toISOString() }),
  gamificacion: () => ({ bricks: 0, nivel: {}, siguiente_nivel: null, progreso: {}, logros: [] }),
  perfiles_publicos: () => ({ avatar_url: null, updated_at: new Date().toISOString() }),
  regalos_enviados: () => ({ fecha: new Date().toISOString() }),
  user_daily_snapshots: () => ({ created_at: new Date().toISOString() }),
};

const DNA_WEIGHTS = Object.fromEntries(DNA_PONDERACIONES);
const DAILY_PRICE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const MINIFIGURA_COLUMNS = [
  ['id', 'id'],
  ['nombre', 'nombre'],
  ['descripcion', 'descripcion'],
  ['categoria', 'categoria'],
  ['subcategoria', 'subcategoria'],
  ['anio', 'anio'],
  ['estadoColeccion', 'estado_coleccion'],
  ['precioCompra', 'precio_compra'],
  ['fechaCompra', 'fecha_compra'],
  ['precio', 'precio'],
  ['FechaRegistro', 'fecha_registro'],
  ['observada', 'observada'],
];

export function minifiguraToRow(minifigura) {
  const row = {};
  for (const [field, column] of MINIFIGURA_COLUMNS) {
    if (minifigura[field] !== undefined) row[column] = minifigura[field];
  }
  return row;
}

const clone = (value) => structuredClone(value);

function calculateDna(logros, additionalWeights = {}) {
  const scores = { rarityHunter: 0, collector: 0, explorer: 0, fan: 0 };
  for (const logro of logros || []) {
    const weights = additionalWeights[logro.id] ?? DNA_WEIGHTS[logro.id];
    const cantidad = Number(logro.cantidad);
    if (!weights || logro.id === 'someone-liked-your-collection' || !Number.isFinite(cantidad) || cantidad <= 0) continue;
    scores.rarityHunter += cantidad * weights[0];
    scores.collector += cantidad * weights[1];
    scores.explorer += cantidad * weights[2];
    scores.fan += cantidad * weights[3];
  }
  const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
  const principal = total === 0
    ? 'Newbie'
    : scores.explorer >= scores.collector && scores.explorer >= scores.fan && scores.explorer >= scores.rarityHunter ? 'Explorer'
      : scores.collector >= scores.fan && scores.collector >= scores.rarityHunter ? 'Collector'
        : scores.fan >= scores.rarityHunter ? 'Fan' : 'Rarity Hunter';
  return {
    principal,
    porcentajes: Object.fromEntries(Object.entries(scores).map(([name, score]) => [name, total === 0 ? 0 : (score / total) * 100])),
  };
}

function rlsError() {
  return { code: '42501', message: 'new row violates row-level security policy' };
}

// In-memory subset of supabase-js; rows are scoped to the client's bearer user to mimic RLS.
export function createSupabaseMock({ users = {} } = {}) {
  const tables = { minifiguras: [], gamificacion: [], perfiles_publicos: [], regalos_enviados: [], user_daily_snapshots: [] };
  const failures = [];
  const dailySync = {
    runs: [], users: [], prices: [], snapshots: [], priceCache: new Map(),
    authUsers: new Set(Object.values(users).map(({ id }) => id)),
  };
  const adminCalls = [];
  let sequence = 0;

  function userForToken(token) {
    return token && Object.hasOwn(users, token) ? users[token] : null;
  }

  function withDefaults(table, row) {
    sequence += 1;
    return { ...COLUMN_DEFAULTS[table](), created_at: sequence, ...row };
  }

  function samePrimaryKey(table, left, right) {
    return PRIMARY_KEYS[table].every((key) => left[key] === right[key]);
  }

  function takeFailure(table, operation) {
    const index = failures.findIndex((failure) => failure.table === table && (!failure.operation || failure.operation === operation));
    if (index === -1) return null;
    return failures.splice(index, 1)[0].error;
  }

  function execute(table, state, uid) {
    const failure = takeFailure(table, state.operation);
    if (failure) return { data: null, error: failure };
    if (!tables[table]) return { data: null, error: { code: '42P01', message: 'relation does not exist' } };
    if (table === 'regalos_enviados') return { data: null, error: rlsError() };

    const rows = tables[table];
    const visible = (row) => uid !== null && row.user_id === uid
      && state.filters.every(([column, value]) => row[column] === value)
      && state.comparisons.every(([column, operator, value]) => {
        if (operator === 'gte') return row[column] >= value;
        if (operator === 'lte') return row[column] <= value;
        if (operator === 'lt') return row[column] < value;
        if (operator === 'gt') return row[column] > value;
        return false;
      });
    let result = [];

    if (state.operation === 'select') {
      result = rows.filter(visible);
    } else if (state.operation === 'insert' || state.operation === 'upsert') {
      if (uid === null) return { data: null, error: rlsError() };
      const values = Array.isArray(state.values) ? state.values : [state.values];
      const prepared = [];
      for (const value of values) {
        const row = { user_id: uid, ...clone(value) };
        if (row.user_id !== uid) return { data: null, error: rlsError() };
        const existing = rows.find((candidate) => samePrimaryKey(table, candidate, row));
        if (existing && state.operation === 'insert') {
          return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        }
        prepared.push({ row, existing });
      }
      for (const { row, existing } of prepared) {
        if (existing) {
          Object.assign(existing, row);
          result.push(existing);
        } else {
          const inserted = withDefaults(table, row);
          rows.push(inserted);
          result.push(inserted);
        }
      }
    } else if (state.operation === 'update') {
      if ('user_id' in state.values && state.values.user_id !== uid) return { data: null, error: rlsError() };
      result = rows.filter(visible);
      for (const row of result) Object.assign(row, clone(state.values));
    } else if (state.operation === 'delete') {
      result = rows.filter(visible);
      tables[table] = rows.filter((row) => !result.includes(row));
    }

    for (const [column, ascending] of [...state.orders].reverse()) {
      result = [...result].sort((left, right) => {
        if (left[column] === right[column]) return 0;
        return (left[column] < right[column] ? -1 : 1) * (ascending ? 1 : -1);
      });
    }
    if (state.limit !== null) result = result.slice(0, state.limit);

    const returnsRows = state.operation === 'select' || state.returning;
    const data = returnsRows ? clone(result) : null;
    if (state.single) {
      if (data.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } };
      return { data: data[0] ?? null, error: null };
    }
    return { data, error: null };
  }

  function rpc(name, parameters, uid) {
    const failure = takeFailure(name, 'rpc');
    if (failure) return { data: null, error: failure };
    if (!uid) return { data: null, error: { code: '42501', message: 'NO_AUTENTICADO' } };

    if (name === 'regalos_recibidos_count') {
      return { data: tables.regalos_enviados.filter(({ receptor_id }) => receptor_id === uid).length, error: null };
    }

    if (name === 'gamificacion_dna') {
      const gamification = tables.gamificacion.find(({ user_id }) => user_id === uid);
      return { data: calculateDna(gamification?.logros ?? []), error: null };
    }

    if (name === 'ranking_logros') {
      const target = [...tables.gamificacion]
        .sort((left, right) => right.bricks - left.bricks || left.user_id.localeCompare(right.user_id))
        .slice(0, 10).find(({ user_id }) => user_id === parameters.p_usuario_id);
      if (!target) return { data: null, error: null };
      const profile = tables.perfiles_publicos.find(({ user_id }) => user_id === target.user_id);
      const fields = ['id', 'type', 'nombre', 'descripcion', 'bricks', 'repetible', 'cantidad', 'total'];
      return { data: clone({
        userId: target.user_id, displayName: profile?.display_name ?? 'Coleccionista', bricks: target.bricks,
        nivel: { id: target.nivel?.id ?? 0, nombre: target.nivel?.nombre ?? 'Duplo' },
        logros: target.logros.map((item) => Object.fromEntries(fields.filter((field) => item[field] != null).map((field) => [field, item[field]]))),
      }), error: null };
    }

    if (name === 'ranking_global') {
      const criterio = parameters?.p_criterio ?? 'nivel';
      const selectedTraitName = { rarityHunter: 'Rarity Hunter', collector: 'Collector', explorer: 'Explorer', fan: 'Fan' }[criterio];
      const value = (row) => criterio === 'nivel' ? row.nivel?.id ?? 0
        : criterio === 'coleccion'
          ? tables.minifiguras.filter(({ user_id, estado_coleccion }) => user_id === row.user_id && estado_coleccion === 'COLECCIÓN').length
          : calculateDna(row.logros ?? []).porcentajes[criterio] ?? 0;
      const data = [...tables.gamificacion]
        .sort((left, right) => value(right) - value(left) || (right.nivel?.id ?? 0) - (left.nivel?.id ?? 0)
          || right.bricks - left.bricks || left.user_id.localeCompare(right.user_id))
        .slice(0, 10)
        .map((gamification) => {
          const profile = tables.perfiles_publicos.find(({ user_id }) => user_id === gamification.user_id);
          const collection = tables.minifiguras.filter(({ user_id, estado_coleccion }) => user_id === gamification.user_id && estado_coleccion === 'COLECCIÓN');
          const domainCollection = collection.map((row) => ({
            id: row.id, nombre: row.nombre, precio: row.precio, anio: row.anio,
            fechaCompra: row.fecha_compra, FechaRegistro: row.fecha_registro, estadoColeccion: row.estado_coleccion,
          }));
          const highlights = collectionHighlights(domainCollection);
          const withMetadata = (items) => items.map((item) => {
            const row = collection.find(({ id }) => id === item.id);
            return Object.fromEntries(Object.entries({ ...item, categoria: row.categoria, subcategoria: row.subcategoria, anio: row.anio }).filter(([, value]) => value != null));
          });
          const levelId = gamification.nivel?.id ?? 0;
          const dna = calculateDna(gamification.logros ?? []);
          const dnaTraits = [
            ['rarityHunter', 'Rarity Hunter'], ['explorer', 'Explorer'], ['collector', 'Collector'], ['fan', 'Fan'],
          ].map(([key, nombre], ordinal) => ({ nombre, porcentaje: dna.porcentajes[key], ordinal }));
          dnaTraits.sort((left, right) => Number(right.nombre === dna.principal) - Number(left.nombre === dna.principal)
            || right.porcentaje - left.porcentaje || left.ordinal - right.ordinal);
          return {
            user_id: gamification.user_id,
            avatar_url: profile?.avatar_url ?? null,
            display_name: profile?.display_name ?? 'Coleccionista',
            bricks: gamification.bricks,
            nivel: levelId,
            nombre_nivel: gamification.nivel?.nombre ?? 'Duplo',
            imagen_nivel: ({
              3: '/level_images/3_threesevenfive.png',
              4: '/level_images/4_citizen.png',
              5: '/level_images/5_skeleton.png',
              6: '/level_images/6_pirate.png',
              7: '/level_images/7_captain.png',
              8: '/level_images/8_redbearb.png',
              9: '/level_images/9_forestman.png',
              10: '/level_images/10_wolfpack.png',
              11: '/level_images/11_wolfpackmaster.png',
              12: '/level_images/12_ninja.png',
              13: '/level_images/13_rx.png',
              14: '/level_images/14_dragonform.png',
              15: '/level_images/15_spacebaby.jpg',
              16: '/level_images/16_spaceman.jpg',
              17: '/level_images/17_blacktron.png',
            })[levelId] ?? '/level_images/9_forestman.png',
            total_coleccion: collection.length,
            top5_precio: withMetadata(highlights.top5Precio),
            top5_antiguedad: withMetadata(highlights.top5Antiguedad),
            regalo_enviado: tables.regalos_enviados.some(({ donante_id, receptor_id }) => donante_id === uid && receptor_id === gamification.user_id),
            dna_principal: dna.principal,
            dna_rasgos: selectedTraitName ? [{ nombre: selectedTraitName, porcentaje: dna.porcentajes[criterio] }]
              : dna.principal === 'Newbie' ? [] : dnaTraits.slice(0, 2).map(({ nombre, porcentaje }) => ({ nombre, porcentaje })),
          };
        });
      return { data: clone(data), error: null };
    }

    if (name === 'regalar_bricks') {
      const receiverId = parameters?.p_receptor_id;
      if (receiverId === uid) return { data: null, error: { code: 'P0001', message: 'AUTORREGALO_NO_PERMITIDO' } };
      const receiver = tables.gamificacion.find(({ user_id }) => user_id === receiverId);
      if (!receiver) return { data: null, error: { code: 'P0001', message: 'RECEPTOR_NO_ENCONTRADO' } };
      if (tables.regalos_enviados.some(({ donante_id, receptor_id }) => donante_id === uid && receptor_id === receiverId)) {
        return { data: null, error: { code: 'P0001', message: 'REGALO_YA_ENVIADO' } };
      }
      const giftFailure = takeFailure('regalos_enviados', 'insert');
      if (giftFailure) return { data: null, error: giftFailure };
      const snapshot = clone(receiver);
      const giftsSnapshot = clone(tables.regalos_enviados);
      try {
        tables.regalos_enviados.push(withDefaults('regalos_enviados', { donante_id: uid, receptor_id: receiverId }));
        const updateFailure = takeFailure('gamificacion', 'update');
        if (updateFailure) throw updateFailure;
        const count = tables.regalos_enviados.filter(({ receptor_id }) => receptor_id === receiverId).length;
        receiver.bricks += 50;
        const { nivel, siguienteNivel, progreso } = selectLevel(receiver.bricks);
        receiver.nivel = nivel;
        receiver.siguiente_nivel = siguienteNivel;
        receiver.progreso = progreso;
        receiver.logros = receiver.logros.filter(({ id }) => id !== 'someone-liked-your-collection');
        receiver.logros.push({
          id: 'someone-liked-your-collection', type: 'regalo', nombre: 'Someone liked your collection',
          descripcion: 'Has aparecido en el ranking global y te han hecho un regalo.', bricks: 50,
          repetible: true, cantidad: count, total: count * 50,
        });
        return { data: { ok: true }, error: null };
      } catch (error) {
        Object.assign(receiver, snapshot);
        tables.regalos_enviados = giftsSnapshot;
        return { data: null, error };
      }
    }
    return { data: null, error: { code: '42883', message: 'function does not exist' } };
  }

  function dailyStatus(run) {
    const workUsers = dailySync.users.filter((entry) => entry.run_id === run.id);
    const workPrices = dailySync.prices.filter((entry) => entry.run_id === run.id);
    return {
      jobId: run.id,
      status: run.status,
      snapshotDate: run.snapshot_date,
      processedUsers: workUsers.filter(({ status }) => status === 'completed').length,
      totalUsers: workUsers.length,
      failedPrices: workPrices.filter(({ status }) => status === 'failed').length,
      result: clone(run.result),
      errorCode: run.error_code,
    };
  }

  function sourceRevision(userId) {
    const figures = tables.minifiguras.filter(({ user_id }) => user_id === userId)
      .sort((left, right) => left.id.localeCompare(right.id));
    const gifts = tables.regalos_enviados.filter(({ receptor_id }) => receptor_id === userId)
      .sort((left, right) => left.donante_id.localeCompare(right.donante_id));
    return createHash('sha256').update(JSON.stringify({ figures, gifts, fingerprint: dailySync.fingerprint ?? '' })).digest('hex');
  }

  function adminRpc(name, parameters) {
    adminCalls.push({ name, parameters: clone(parameters) });
    const failure = takeFailure(name, 'rpc');
    if (failure) return { data: null, error: failure };
    const now = new Date();
    const findRun = () => dailySync.runs.find(({ id }) => id === parameters.p_run_id);
    const ownedRun = () => {
      const run = findRun();
      if (!run || run.status !== 'running' || run.lease_owner !== parameters.p_lease_owner || run.lease_expires_at <= now.getTime()) {
        return null;
      }
      return run;
    };

    if (name === 'iniciar_daily_sync') {
      const active = dailySync.runs.find(({ status }) => ['pending', 'running'].includes(status));
      if (active) return { data: { jobId: active.id, status: active.status, snapshotDate: active.snapshot_date }, error: null };
      sequence += 1;
      const run = {
        id: `90000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
        snapshot_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(now),
        status: 'pending', lease_owner: null, lease_expires_at: 0, result: null, error_code: null,
      };
      dailySync.runs.push(run);
      const userIds = [...new Set([...dailySync.authUsers, ...tables.minifiguras.map(({ user_id }) => user_id)])].sort();
      for (const userId of userIds) dailySync.users.push({ run_id: run.id, user_id: userId, status: 'pending', attempts: 0 });
      const figureIds = [...new Set(tables.minifiguras.filter(({ user_id }) => userIds.includes(user_id)).map(({ id }) => id))].sort();
      for (const figureId of figureIds) {
        const cached = dailySync.priceCache.get(figureId);
        const isFresh = cached && now.getTime() - cached.fetched_at.getTime() <= DAILY_PRICE_CACHE_TTL_MS;
        dailySync.prices.push({
          run_id: run.id,
          figure_id: figureId,
          status: isFresh ? 'completed' : 'pending',
          attempts: 0,
          price: isFresh ? cached.price : null,
          checkpoint_at: isFresh ? cached.fetched_at.toISOString() : null,
        });
        if (isFresh) {
          for (const figure of tables.minifiguras) {
            if (figure.id === figureId && userIds.includes(figure.user_id)) figure.precio = cached.price;
          }
        }
      }
      return { data: { jobId: run.id, status: run.status, snapshotDate: run.snapshot_date }, error: null };
    }
    if (name === 'recuperar_daily_sync') {
      const active = dailySync.runs.find(({ status }) => ['pending', 'running'].includes(status));
      return { data: active ? dailyStatus(active) : null, error: null };
    }
    if (name === 'consultar_daily_sync') {
      const run = findRun();
      return { data: run ? dailyStatus(run) : null, error: null };
    }
    if (name === 'reclamar_daily_sync') {
      const run = findRun();
      if (!run || !['pending', 'running'].includes(run.status)) return { data: false, error: null };
      if (run.lease_expires_at > now.getTime() && run.lease_owner !== parameters.p_lease_owner) return { data: false, error: null };
      run.status = 'running';
      run.lease_owner = parameters.p_lease_owner;
      run.lease_expires_at = now.getTime() + (parameters.p_lease_seconds ?? 120) * 1000;
      return { data: true, error: null };
    }
    if (name === 'renovar_daily_sync') {
      const run = ownedRun();
      if (!run) return { data: false, error: null };
      run.lease_expires_at = now.getTime() + (parameters.p_lease_seconds ?? 120) * 1000;
      return { data: true, error: null };
    }
    if (name === 'leer_daily_sync_usuarios' || name === 'leer_daily_sync_precios') {
      if (!ownedRun()) return { data: null, error: { code: '42501', message: 'DAILY_SYNC_LEASE_CADUCADO' } };
      const isUsers = name === 'leer_daily_sync_usuarios';
      const entries = (isUsers ? dailySync.users : dailySync.prices)
        .filter((entry) => entry.run_id === parameters.p_run_id && ['pending', 'processing'].includes(entry.status))
        .filter((entry) => !parameters[isUsers ? 'p_after_user_id' : 'p_after_figure_id']
          || (isUsers ? entry.user_id : entry.figure_id) > parameters[isUsers ? 'p_after_user_id' : 'p_after_figure_id'])
        .sort((left, right) => (isUsers ? left.user_id : left.figure_id).localeCompare(isUsers ? right.user_id : right.figure_id))
        .slice(0, parameters.p_limit ?? 1000);
      return { data: clone(entries.map(({ user_id, figure_id, status, attempts }) => ({ user_id, figure_id, status, attempts }))), error: null };
    }
    if (name === 'aplicar_daily_sync_precio') {
      const run = ownedRun();
      const work = dailySync.prices.find(({ run_id, figure_id }) => run_id === parameters.p_run_id && figure_id === parameters.p_figure_id);
      if (!run || !work) return { data: null, error: { code: '42501', message: 'DAILY_SYNC_LEASE_CADUCADO' } };
      if (work.status !== 'completed') {
        work.attempts += 1;
        work.status = parameters.p_success ? 'completed' : 'failed';
        work.price = parameters.p_success ? parameters.p_price : null;
        work.failure_code = parameters.p_success ? null : parameters.p_failure_code;
        if (parameters.p_success) {
          dailySync.priceCache.set(parameters.p_figure_id, {
            price: parameters.p_price,
            fetched_at: new Date(now),
          });
          for (const figure of tables.minifiguras) {
            if (figure.id === parameters.p_figure_id && dailySync.users.some(({ run_id, user_id }) => run_id === run.id && user_id === figure.user_id)) {
              figure.precio = parameters.p_price;
            }
          }
        }
      }
      return { data: true, error: null };
    }
    if (name === 'leer_daily_sync_fuentes') {
      const run = ownedRun();
      const included = dailySync.users.some(({ run_id, user_id }) => run_id === parameters.p_run_id && user_id === parameters.p_user_id);
      if (!run || !included) return { data: null, error: { code: '42501', message: 'DAILY_SYNC_LEASE_CADUCADO' } };
      const figures = tables.minifiguras.filter(({ user_id }) => user_id === parameters.p_user_id).map((figure) => ({
        id: figure.id, categoria: figure.categoria, subcategoria: figure.subcategoria, anio: figure.anio,
        estadoColeccion: figure.estado_coleccion, precio: figure.precio, precioCompra: figure.precio_compra,
      }));
      return { data: { revision: sourceRevision(parameters.p_user_id), figures, giftsReceived: tables.regalos_enviados.filter(({ receptor_id }) => receptor_id === parameters.p_user_id).length, fingerprint: dailySync.fingerprint ?? '' }, error: null };
    }
    if (name === 'capturar_daily_sync_usuario') {
      const run = ownedRun();
      const work = dailySync.users.find(({ run_id, user_id }) => run_id === parameters.p_run_id && user_id === parameters.p_user_id);
      if (!run || !work) return { data: false, error: null };
      if (work.status === 'completed') return { data: true, error: null };
      if (sourceRevision(parameters.p_user_id) !== parameters.p_expected_revision) return { data: false, error: null };
      const figures = tables.minifiguras.filter(({ user_id, estado_coleccion }) => user_id === parameters.p_user_id && estado_coleccion === 'COLECCIÓN');
      const state = parameters.p_state;
      const totalValue = figures.reduce((total, figure) => total + (figure.precio ?? figure.precio_compra ?? 0), 0);
      const dna = calculateDna(state.logros ?? []);
      const snapshot = {
        id: `snapshot-${sequence + 1}`,
        user_id: parameters.p_user_id, snapshot_date: run.snapshot_date,
        total_figures: figures.length, total_value: Math.round(totalValue * 100) / 100,
        bricks: state.bricks, level: state.nivel?.id ?? 0,
        pct_collector: Math.round(dna.porcentajes.collector * 100) / 100,
        pct_explorer: Math.round(dna.porcentajes.explorer * 100) / 100,
        pct_rarity_hunter: Math.round(dna.porcentajes.rarityHunter * 100) / 100,
        pct_fan: Math.round(dna.porcentajes.fan * 100) / 100,
      };
      const existingSnapshot = dailySync.snapshots.find(({ user_id, snapshot_date }) => user_id === snapshot.user_id && snapshot_date === snapshot.snapshot_date);
      if (existingSnapshot) {
        Object.assign(existingSnapshot, snapshot);
      } else {
        sequence += 1;
        const savedSnapshot = { ...snapshot, id: `snapshot-${sequence}`, created_at: now.toISOString() };
        dailySync.snapshots.push(savedSnapshot);
        tables.user_daily_snapshots.push(savedSnapshot);
      }
      const gamification = tables.gamificacion.find(({ user_id }) => user_id === parameters.p_user_id);
      if (gamification) Object.assign(gamification, { bricks: state.bricks, nivel: clone(state.nivel), siguiente_nivel: clone(state.siguiente_nivel), progreso: clone(state.progreso), logros: clone(state.logros) });
      else tables.gamificacion.push(withDefaults('gamificacion', { user_id: parameters.p_user_id, bricks: state.bricks, nivel: clone(state.nivel), siguiente_nivel: clone(state.siguiente_nivel), progreso: clone(state.progreso), logros: clone(state.logros) }));
      work.status = 'completed';
      work.attempts += 1;
      return { data: true, error: null };
    }
    if (name === 'fallar_daily_sync_usuario') {
      const run = ownedRun();
      const work = dailySync.users.find(({ run_id, user_id }) => run_id === parameters.p_run_id && user_id === parameters.p_user_id);
      if (!run || !work) return { data: false, error: null };
      work.status = 'failed';
      work.error_code = parameters.p_error_code;
      work.attempts += 1;
      return { data: true, error: null };
    }
    if (name === 'finalizar_daily_sync') {
      const run = ownedRun();
      if (!run) return { data: null, error: { code: '42501', message: 'DAILY_SYNC_LEASE_CADUCADO' } };
      const status = dailyStatus(run);
      const hasOpenWork = dailySync.users.some(({ run_id, status }) => run_id === run.id && ['pending', 'processing'].includes(status))
        || dailySync.prices.some(({ run_id, status }) => run_id === run.id && ['pending', 'processing'].includes(status));
      if (hasOpenWork) return { data: null, error: { code: 'P0001', message: 'DAILY_SYNC_TRABAJO_INCOMPLETO' } };
      if (dailySync.users.some(({ run_id, status }) => run_id === run.id && status === 'failed')) {
        run.status = 'failed';
        run.error_code = 'USERS_FAILED';
      } else {
        run.status = 'completed';
        run.result = { success: true, processedUsers: status.processedUsers, timestamp: now.toISOString() };
      }
      run.lease_owner = null;
      run.lease_expires_at = 0;
      return { data: dailyStatus(run), error: null };
    }
    if (name === 'fallar_daily_sync') {
      const run = ownedRun();
      if (!run) return { data: null, error: { code: '42501', message: 'DAILY_SYNC_LEASE_CADUCADO' } };
      run.status = 'failed';
      run.error_code = parameters.p_error_code;
      run.result = null;
      run.lease_owner = null;
      run.lease_expires_at = 0;
      return { data: dailyStatus(run), error: null };
    }
    return { data: null, error: { code: '42883', message: 'function does not exist' } };
  }

  function queryBuilder(table, uid) {
    const state = { operation: null, values: null, filters: [], comparisons: [], orders: [], limit: null, returning: false, single: false };
    const builder = {
      select() {
        if (state.operation === null) state.operation = 'select';
        else state.returning = true;
        return builder;
      },
      insert(values) { state.operation = 'insert'; state.values = values; return builder; },
      upsert(values) { state.operation = 'upsert'; state.values = values; return builder; },
      update(values) { state.operation = 'update'; state.values = values; return builder; },
      delete() { state.operation = 'delete'; return builder; },
      eq(column, value) { state.filters.push([column, value]); return builder; },
      gte(column, value) { state.comparisons.push([column, 'gte', value]); return builder; },
      lte(column, value) { state.comparisons.push([column, 'lte', value]); return builder; },
      lt(column, value) { state.comparisons.push([column, 'lt', value]); return builder; },
      gt(column, value) { state.comparisons.push([column, 'gt', value]); return builder; },
      limit(value) { state.limit = value; return builder; },
      order(column, { ascending = true } = {}) { state.orders.push([column, ascending]); return builder; },
      maybeSingle() { state.single = true; return builder; },
      then(resolve, reject) {
        return Promise.resolve().then(() => execute(table, state, uid)).then(resolve, reject);
      },
    };
    return builder;
  }

  function createClient(_url, _key, options = {}) {
    const authorization = options.global?.headers?.Authorization ?? '';
    const token = authorization.replace(/^Bearer\s+/i, '');
    const uid = userForToken(token)?.id ?? null;
    return {
      auth: {
        async getUser(jwt = token) {
          const user = userForToken(jwt);
          return user
            ? { data: { user: clone(user) }, error: null }
            : { data: { user: null }, error: { status: 401, message: 'invalid JWT' } };
        },
      },
      from(table) {
        return queryBuilder(table, uid);
      },
      rpc(name, parameters = {}) {
        return Promise.resolve().then(() => rpc(name, parameters, uid));
      },
    };
  }

  return {
    createClient,
    createAdminClient() {
      return {
        from() {
          throw new Error('El cliente administrativo solo puede ejecutar RPC allowlisted');
        },
        rpc(name, parameters = {}) {
          return Promise.resolve().then(() => adminRpc(name, parameters));
        },
      };
    },
    calculateDna(logros, additionalWeights) {
      return clone(calculateDna(logros, additionalWeights));
    },
    seed(table, userId, rows) {
      for (const row of rows) {
        const identity = table === 'regalos_enviados' ? {} : { user_id: userId };
        tables[table].push(withDefaults(table, { ...identity, ...clone(row) }));
      }
    },
    rows(table, userId) {
      return clone(tables[table].filter((row) => userId === undefined || row.user_id === userId));
    },
    analyticsRows(table, runId) {
      if (table === 'cache') {
        return clone([...dailySync.priceCache.entries()].map(([figure_id, entry]) => ({ figure_id, ...entry })));
      }
      const rows = dailySync[table];
      if (!rows) throw new Error(`Tabla analitica desconocida: ${table}`);
      return clone(rows.filter((row) => runId === undefined || row.run_id === runId));
    },
    adminCalls() {
      return clone(adminCalls);
    },
    expireDailySyncLease(runId) {
      const run = dailySync.runs.find(({ id }) => id === runId);
      if (run) run.lease_expires_at = 0;
    },
    setPriceCacheFetchedAt(figureId, fetchedAt) {
      const entry = dailySync.priceCache.get(figureId);
      if (entry) entry.fetched_at = new Date(fetchedAt);
    },
    failNext(table, error = { code: 'PGRST000', message: 'connection refused' }, operation = null) {
      failures.push({ table, error, operation });
    },
  };
}
