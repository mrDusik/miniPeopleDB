const PRIMARY_KEYS = {
  minifiguras: ['user_id', 'id'],
  gamificacion: ['user_id'],
};

const COLUMN_DEFAULTS = {
  minifiguras: () => ({ estado_coleccion: 'COLECCIÓN', observada: false, fecha_registro: new Date().toISOString() }),
  gamificacion: () => ({ bricks: 0, nivel: {}, siguiente_nivel: null, progreso: {}, logros: [] }),
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
  const tables = { minifiguras: [], gamificacion: [] };
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
    };
  }

  return {
    createClient,
    seed(table, userId, rows) {
      for (const row of rows) tables[table].push(withDefaults(table, { ...clone(row), user_id: userId }));
    },
    rows(table, userId) {
      return clone(tables[table].filter((row) => userId === undefined || row.user_id === userId));
    },
    failNext(table, error = { code: 'PGRST000', message: 'connection refused' }, operation = null) {
      failures.push({ table, error, operation });
    },
  };
}
