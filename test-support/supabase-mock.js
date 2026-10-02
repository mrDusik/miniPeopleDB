import { selectLevel } from '../src/gamificacion.js';
import { collectionHighlights } from '../src/collection-highlights.js';

const PRIMARY_KEYS = {
  minifiguras: ['user_id', 'id'],
  gamificacion: ['user_id'],
  perfiles_publicos: ['user_id'],
  regalos_enviados: ['donante_id', 'receptor_id'],
};

const COLUMN_DEFAULTS = {
  minifiguras: () => ({ estado_coleccion: 'COLECCIÓN', observada: false, fecha_registro: new Date().toISOString() }),
  gamificacion: () => ({ bricks: 0, nivel: {}, siguiente_nivel: null, progreso: {}, logros: [] }),
  perfiles_publicos: () => ({ avatar_url: null, updated_at: new Date().toISOString() }),
  regalos_enviados: () => ({ fecha: new Date().toISOString() }),
};

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

function rlsError() {
  return { code: '42501', message: 'new row violates row-level security policy' };
}

// In-memory subset of supabase-js; rows are scoped to the client's bearer user to mimic RLS.
export function createSupabaseMock({ users = {} } = {}) {
  const tables = { minifiguras: [], gamificacion: [], perfiles_publicos: [], regalos_enviados: [] };
  const failures = [];
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
    const visible = (row) => uid !== null && row.user_id === uid && state.filters.every(([column, value]) => row[column] === value);
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

    if (name === 'ranking_global') {
      const data = [...tables.gamificacion]
        .sort((left, right) => right.bricks - left.bricks || left.user_id.localeCompare(right.user_id))
        .slice(0, 10)
        .map((gamification) => {
          const profile = tables.perfiles_publicos.find(({ user_id }) => user_id === gamification.user_id);
          const collection = tables.minifiguras.filter(({ user_id, estado_coleccion }) => user_id === gamification.user_id && estado_coleccion === 'COLECCIÓN');
          const domainCollection = collection.map((row) => ({
            id: row.id, nombre: row.nombre, precio: row.precio, anio: row.anio,
            fechaCompra: row.fecha_compra, FechaRegistro: row.fecha_registro, estadoColeccion: row.estado_coleccion,
          }));
          const highlights = collectionHighlights(domainCollection);
          const levelId = gamification.nivel?.id ?? 0;
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
            top5_precio: highlights.top5Precio,
            top5_antiguedad: highlights.top5Antiguedad,
            regalo_enviado: tables.regalos_enviados.some(({ donante_id, receptor_id }) => donante_id === uid && receptor_id === gamification.user_id),
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

  function queryBuilder(table, uid) {
    const state = { operation: null, values: null, filters: [], orders: [], returning: false, single: false };
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
    seed(table, userId, rows) {
      for (const row of rows) {
        const identity = table === 'regalos_enviados' ? {} : { user_id: userId };
        tables[table].push(withDefaults(table, { ...identity, ...clone(row) }));
      }
    },
    rows(table, userId) {
      return clone(tables[table].filter((row) => userId === undefined || row.user_id === userId));
    },
    failNext(table, error = { code: 'PGRST000', message: 'connection refused' }, operation = null) {
      failures.push({ table, error, operation });
    },
  };
}
