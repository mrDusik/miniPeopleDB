import { createHash } from 'node:crypto';
import { DNA_PONDERACIONES, selectLevel } from '../src/gamificacion.js';
import { collectionHighlights } from '../src/collection-highlights.js';

const PRIMARY_KEYS = {
  minifiguras: ['user_id', 'id'],
  gamificacion: ['user_id'],
  perfiles_publicos: ['user_id'],
  user_profiles: ['user_id'],
  user_profile_favorite_categories: ['user_id', 'category_name'],
  regalos_enviados: ['donante_id', 'receptor_id', 'semana'],
  user_daily_snapshots: ['user_id', 'snapshot_date'],
  notificaciones: ['id'],
  friend_requests: ['id'],
  friendships: ['user_low_id', 'user_high_id'],
  agradecimientos_regalo: ['gift_notification_id'],
  ranking_top10_membership: ['user_id', 'ranking_type'],
};

const COLUMN_DEFAULTS = {
  minifiguras: () => ({ estado_coleccion: 'COLECCIÓN', observada: false, fecha_registro: new Date().toISOString() }),
  gamificacion: () => ({ bricks: 0, nivel: {}, siguiente_nivel: null, progreso: {}, logros: [] }),
  perfiles_publicos: () => ({ avatar_url: null, updated_at: new Date().toISOString() }),
  user_profiles: () => ({ avatar_url: null, currency: 'EUR', language: 'es', onboarding_completed: false, updated_at: new Date().toISOString() }),
  user_profile_favorite_categories: () => ({ created_at: new Date().toISOString() }),
  regalos_enviados: () => ({ fecha: new Date().toISOString(), semana: '0001-01-01' }),
  user_daily_snapshots: () => ({ created_at: new Date().toISOString() }),
  notificaciones: () => ({ is_read: false, created_at: new Date().toISOString(), payload: {}, gift_thanked_at: null, social_request_id: null, social_request_accepted: false }),
  friend_requests: () => ({ status: 'pending', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  friendships: () => ({ created_at: new Date().toISOString() }),
  agradecimientos_regalo: () => ({ created_at: new Date().toISOString() }),
  ranking_top10_membership: () => ({ updated_at: new Date().toISOString() }),
};

const DNA_WEIGHTS = Object.fromEntries(DNA_PONDERACIONES);
const DEFAULT_DAILY_PRICE_CACHE_TTL_HOURS = 24;

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
export function createSupabaseMock({ users = {}, passwords = {}, passwordSignInError = null, now = () => new Date() } = {}) {
  const tables = {
    minifiguras: [], gamificacion: [], perfiles_publicos: [], user_profiles: [], user_profile_favorite_categories: [],
    regalos_enviados: [], user_daily_snapshots: [],
    notificaciones: [], friend_requests: [], friendships: [], agradecimientos_regalo: [], ranking_top10_membership: [],
  };
  const failures = [];
  const dailySync = {
    runs: [], users: [], prices: [], snapshots: [], priceCache: new Map(),
    authUsers: new Set(Object.values(users).map(({ id }) => id)),
  };
  const adminCalls = [];
  const avatarObjects = new Map();
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

  function timestamp() {
    return new Date(typeof now === 'function' ? now() : now).toISOString();
  }

  function insertNotification(row) {
    sequence += 1;
    const notification = {
      id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
      is_read: false,
      created_at: timestamp(),
      payload: {},
      gift_thanked_at: null,
      social_request_id: null,
      social_request_accepted: false,
      ...clone(row),
    };
    tables.notificaciones.push(notification);
    return notification;
  }

  function saveUserProfile(parameters, uid) {
    const username = parameters?.p_username;
    const avatarUrl = typeof parameters?.p_avatar_url === 'string' && parameters.p_avatar_url.trim()
      ? parameters.p_avatar_url.trim() : null;
    const currency = parameters?.p_currency;
    const language = parameters?.p_language;
    const favorites = parameters?.p_favorite_categories ?? [];
    const existing = tables.user_profiles.find(({ user_id }) => user_id === uid);

    if (typeof username !== 'string' || !/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      return { data: null, error: { code: '23514', message: 'USERNAME_INVALIDO' } };
    }
    if (tables.user_profiles.some((profile) => profile.user_id !== uid && profile.username.toLowerCase() === username.toLowerCase())) {
      return { data: null, error: { code: '23505', message: 'USERNAME_OCUPADO' } };
    }
    if (existing?.onboarding_completed && existing.username !== username) {
      return { data: null, error: { code: '23514', message: 'USERNAME_INMUTABLE' } };
    }
    if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
      return { data: null, error: { code: '23514', message: 'AVATAR_URL_INVALIDA' } };
    }
    if (currency !== 'EUR' || language !== 'es' || !Array.isArray(favorites) || favorites.length > 3) {
      return { data: null, error: { code: '23514', message: 'PERFIL_INVALIDO' } };
    }

    const normalizedFavorites = [...new Set(favorites.map((name) => typeof name === 'string' ? name.trim() : ''))];
    if (normalizedFavorites.some((name) => !name)) {
      return { data: null, error: { code: '22023', message: 'CATEGORIA_INVALIDA' } };
    }

    const profileSnapshot = clone(tables.user_profiles);
    const favoritesSnapshot = clone(tables.user_profile_favorite_categories);
    const publicProfilesSnapshot = clone(tables.perfiles_publicos);
    try {
      const profileFailure = takeFailure('user_profiles', 'upsert');
      if (profileFailure) throw profileFailure;
      const updatedAt = timestamp();
      const row = {
        user_id: uid, username, avatar_url: avatarUrl, currency, language,
        onboarding_completed: true, updated_at: updatedAt,
      };
      if (existing) Object.assign(existing, row);
      else tables.user_profiles.push(withDefaults('user_profiles', row));

      const categoryFailure = takeFailure('user_profile_favorite_categories', 'replace');
      if (categoryFailure) throw categoryFailure;
      tables.user_profile_favorite_categories = tables.user_profile_favorite_categories
        .filter(({ user_id }) => user_id !== uid);
      for (const categoryName of normalizedFavorites) {
        tables.user_profile_favorite_categories.push(withDefaults('user_profile_favorite_categories', {
          user_id: uid, category_name: categoryName,
        }));
      }

      const publicProfileFailure = takeFailure('perfiles_publicos', 'upsert');
      if (publicProfileFailure) throw publicProfileFailure;
      const publicProfile = tables.perfiles_publicos.find(({ user_id }) => user_id === uid);
      if (publicProfile) Object.assign(publicProfile, { display_name: username, avatar_url: avatarUrl, updated_at: updatedAt });
      else tables.perfiles_publicos.push(withDefaults('perfiles_publicos', {
        user_id: uid, display_name: username, avatar_url: avatarUrl, updated_at: updatedAt,
      }));
      return { data: null, error: null };
    } catch (error) {
      tables.user_profiles = profileSnapshot;
      tables.user_profile_favorite_categories = favoritesSnapshot;
      tables.perfiles_publicos = publicProfilesSnapshot;
      return { data: null, error };
    }
  }

  function addBricks(gamification, amount) {
    gamification.bricks += amount;
    const { nivel, siguienteNivel, progreso } = selectLevel(gamification.bricks);
    gamification.nivel = nivel;
    gamification.siguiente_nivel = siguienteNivel;
    gamification.progreso = progreso;
  }

  function publishDailySummaries(run) {
    const completedUserIds = new Set(dailySync.users
      .filter(({ run_id, status }) => run_id === run.id && status === 'completed')
      .map(({ user_id }) => user_id));
    for (const snapshot of dailySync.snapshots.filter(({ snapshot_date, user_id }) =>
      snapshot_date === run.snapshot_date && completedUserIds.has(user_id))) {
      const previous = tables.user_daily_snapshots
        .filter(({ user_id, snapshot_date }) => user_id === snapshot.user_id && snapshot_date < snapshot.snapshot_date)
        .sort((left, right) => right.snapshot_date.localeCompare(left.snapshot_date))[0];
      const payload = {
        snapshotDate: snapshot.snapshot_date,
        hasPrevious: Boolean(previous),
      };
      if (previous) {
        payload.deltas = {
          figures: snapshot.total_figures - previous.total_figures,
          valueEur: Number((snapshot.total_value - previous.total_value).toFixed(2)),
          bricks: snapshot.bricks - previous.bricks,
          level: snapshot.level - previous.level,
          dna: {
            collector: Number((snapshot.pct_collector - previous.pct_collector).toFixed(2)),
            explorer: Number((snapshot.pct_explorer - previous.pct_explorer).toFixed(2)),
            rarityHunter: Number((snapshot.pct_rarity_hunter - previous.pct_rarity_hunter).toFixed(2)),
            fan: Number((snapshot.pct_fan - previous.pct_fan).toFixed(2)),
          },
        };
      }
      const existing = tables.notificaciones.find(({ user_id, type, snapshot_date }) =>
        user_id === snapshot.user_id && type === 'daily_summary' && snapshot_date === snapshot.snapshot_date);
      if (existing) existing.payload = payload;
      else insertNotification({ user_id: snapshot.user_id, type: 'daily_summary', payload, snapshot_date: snapshot.snapshot_date });
    }
  }

  function execute(table, state, uid) {
    const failure = takeFailure(table, state.operation);
    if (failure) return { data: null, error: failure };
    if (!tables[table]) return { data: null, error: { code: '42P01', message: 'relation does not exist' } };
    if (table === 'regalos_enviados') return { data: null, error: rlsError() };
    if (['friend_requests', 'friendships'].includes(table) && state.operation !== 'select') return { data: null, error: rlsError() };
    if (['agradecimientos_regalo', 'ranking_top10_membership'].includes(table)) return { data: null, error: rlsError() };
    if (table === 'notificaciones'
      && (state.operation === 'insert' || state.operation === 'upsert' || state.operation === 'delete'
        || (state.operation === 'update' && Object.keys(state.values ?? {}).some((column) => column !== 'is_read')))) {
      return { data: null, error: rlsError() };
    }

    const rows = tables[table];
    const visible = (row) => uid !== null && (table === 'friend_requests'
      ? row.recipient_id === uid
      : table === 'friendships'
        ? row.user_low_id === uid || row.user_high_id === uid
        : row.user_id === uid)
      && state.filters.every(([column, value]) => row[column] === value)
      && state.comparisons.every(([column, operator, value]) => {
        if (operator === 'gte') return row[column] >= value;
        if (operator === 'lte') return row[column] <= value;
        if (operator === 'lt') return row[column] < value;
        if (operator === 'gt') return row[column] > value;
        return false;
      })
      && (!state.or || (() => {
        const match = /^created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.lt\.([^)]+)\)$/.exec(state.or);
        return match && (row.created_at < match[1] || (row.created_at === match[2] && row.id < match[3]));
      })());
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

    const totalCount = result.length;
    for (const [column, ascending] of [...state.orders].reverse()) {
      result = [...result].sort((left, right) => {
        if (left[column] === right[column]) return 0;
        return (left[column] < right[column] ? -1 : 1) * (ascending ? 1 : -1);
      });
    }
    if (state.limit !== null) result = result.slice(0, state.limit);

    const returnsRows = state.operation === 'select' || state.returning;
    const data = state.head ? [] : returnsRows ? clone(result) : null;
    if (state.single) {
      if (data.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } };
      return { data: data[0] ?? null, error: null };
    }
    return state.count === 'exact' ? { data, error: null, count: totalCount } : { data, error: null };
  }

  function rpc(name, parameters, uid) {
    const failure = takeFailure(name, 'rpc');
    if (failure) return { data: null, error: failure };
    if (!uid) return { data: null, error: { code: '42501', message: 'NO_AUTENTICADO' } };

    if (name === 'guardar_perfil_usuario') return saveUserProfile(parameters, uid);

    const canonicalPair = (left, right) => [left, right].sort();
    const requestForPair = (left, right) => {
      const [low, high] = canonicalPair(left, right);
      return tables.friend_requests.find(({ sender_id, recipient_id }) => {
        const [requestLow, requestHigh] = canonicalPair(sender_id, recipient_id);
        return requestLow === low && requestHigh === high;
      });
    };
    const globalPositions = new Map([...tables.gamificacion]
      .sort((left, right) => (right.nivel?.id ?? 0) - (left.nivel?.id ?? 0)
        || right.bricks - left.bricks || left.user_id.localeCompare(right.user_id))
      .map(({ user_id }, index) => [user_id, index + 1]));
    const personSummary = (userId) => {
      const profile = tables.user_profiles.find(({ user_id }) => user_id === userId);
      if (!profile) return null;
      const publicProfile = tables.perfiles_publicos.find(({ user_id }) => user_id === userId);
      const gamification = tables.gamificacion.find(({ user_id }) => user_id === userId);
      const dna = calculateDna(gamification?.logros ?? []);
      const traits = [['rarityHunter', 'Rarity Hunter'], ['explorer', 'Explorer'], ['collector', 'Collector'], ['fan', 'Fan']]
        .map(([key, nombre], ordinal) => ({ nombre, porcentaje: dna.porcentajes[key], ordinal }))
        .sort((left, right) => Number(right.nombre === dna.principal) - Number(left.nombre === dna.principal)
          || right.porcentaje - left.porcentaje || left.ordinal - right.ordinal);
      return {
        user_id: userId,
        username: profile.username,
        avatar_url: profile.avatar_url ?? publicProfile?.avatar_url ?? null,
        bricks: gamification?.bricks ?? 0,
        nivel: clone(gamification?.nivel ?? {}),
        posicion_global: globalPositions.get(userId) ?? null,
        total_coleccion: tables.minifiguras.filter((figure) => figure.user_id === userId && figure.estado_coleccion === 'COLECCIÓN').length,
        dna_principal: dna.principal,
        dna_rasgos: dna.principal === 'Newbie' ? [] : traits.slice(0, 2).map(({ nombre, porcentaje }) => ({ nombre, porcentaje })),
      };
    };

    if (name === 'amigos_resumen') {
      return rpc(parameters?.p_tipo === 'search' ? 'amigos_buscar' : 'amigos_listar', parameters, uid);
    }

    if (name === 'amigos_eliminar') {
      const friendId = parameters?.p_amigo_id;
      if (!friendId || friendId === uid) return { data: null, error: { code: '22023', message: 'AUTORRELACION_NO_PERMITIDA' } };
      const [low, high] = canonicalPair(uid, friendId);
      const friendship = tables.friendships.find((row) => row.user_low_id === low && row.user_high_id === high);
      if (!friendship) return { data: { ok: true, removed: false }, error: null };
      const request = requestForPair(uid, friendId);
      const failure = takeFailure('friendships', 'delete') ?? takeFailure('friend_requests', 'delete') ?? takeFailure('notificaciones', 'delete');
      if (failure) return { data: null, error: failure };
      tables.friendships = tables.friendships.filter((row) => row !== friendship);
      if (request?.status === 'accepted') {
        tables.friend_requests = tables.friend_requests.filter((row) => row !== request);
        tables.notificaciones = tables.notificaciones.filter((row) => row.social_request_id !== request.id);
      }
      return { data: { ok: true, removed: true }, error: null };
    }

    if (name === 'amigos_contadores') {
      return { data: {
        friends: tables.friendships.filter((row) => [row.user_low_id, row.user_high_id].includes(uid)).length,
        sent: tables.friend_requests.filter((row) => row.sender_id === uid && ['pending', 'rejected'].includes(row.status)).length,
        received: tables.friend_requests.filter((row) => row.recipient_id === uid && ['pending', 'rejected'].includes(row.status)).length,
      }, error: null };
    }

    if (name === 'amigos_buscar') {
      const query = typeof parameters?.p_query === 'string' ? parameters.p_query.trim() : '';
      if (query.length < 3) return { data: null, error: { code: '22023', message: 'CONSULTA_DEMASIADO_CORTA' } };
      const data = tables.user_profiles.filter(({ user_id, username }) => user_id !== uid
        && username.toLowerCase().includes(query.toLowerCase()))
        .sort((left, right) => left.username.localeCompare(right.username) || left.user_id.localeCompare(right.user_id))
        .slice(0, 50)
        .map(({ user_id }) => {
          const summary = personSummary(user_id);
          const [low, high] = canonicalPair(uid, user_id);
          const friendship = tables.friendships.find(({ user_low_id, user_high_id }) => user_low_id === low && user_high_id === high);
          const request = requestForPair(uid, user_id);
          const relationshipStatus = friendship ? 'friend'
            : !request ? 'none'
              : request.sender_id === uid ? 'request_sent'
                : request.status === 'rejected' ? 'request_rejected' : 'request_received';
          return { ...summary, relationship_status: relationshipStatus };
        });
      return { data, error: null };
    }

    if (name === 'amigos_listar') {
      const type = parameters?.p_tipo;
      if (!['friends', 'sent', 'received'].includes(type)) {
        return { data: null, error: { code: '22023', message: 'TIPO_DE_LISTA_INVALIDO' } };
      }
      let relations = [];
      if (type === 'friends') {
        relations = tables.friendships.filter(({ user_low_id, user_high_id }) => uid === user_low_id || uid === user_high_id)
          .map((friendship) => ({
            relationship_id: null,
            user_id: friendship.user_low_id === uid ? friendship.user_high_id : friendship.user_low_id,
            status: 'accepted',
            created_at: friendship.created_at,
          }));
      } else {
        relations = tables.friend_requests.filter((request) => request.status !== 'accepted'
          && (type === 'sent' ? request.sender_id === uid : request.recipient_id === uid))
          .map((request) => ({
            relationship_id: request.id,
            user_id: type === 'sent' ? request.recipient_id : request.sender_id,
            status: type === 'sent' ? 'pending' : request.status,
            created_at: request.created_at,
          }));
      }
      const data = relations.map((relation) => ({ ...personSummary(relation.user_id), ...relation }))
        .filter(({ username }) => username)
        .sort((left, right) => right.created_at.localeCompare(left.created_at) || left.user_id.localeCompare(right.user_id));
      return { data, error: null };
    }

    if (name === 'amigos_perfil') {
      const targetId = parameters?.p_usuario_id;
      if (!targetId || targetId === uid) return { data: null, error: { code: '22023', message: 'PERFIL_NO_PERMITIDO' } };
      const summary = personSummary(targetId);
      if (!summary) return { data: null, error: null };
      const figures = tables.minifiguras.filter(({ user_id }) => user_id === targetId);
      const collection = figures.filter(({ estado_coleccion }) => estado_coleccion === 'COLECCIÓN');
      const wanted = figures.filter(({ estado_coleccion }) => estado_coleccion === 'BUSCADA');
      const latest = (rows) => rows.toSorted((left, right) => right.fecha_registro.localeCompare(left.fecha_registro)
        || left.id.localeCompare(right.id)).slice(0, 5).map(({ id, nombre, anio, precio, categoria, subcategoria }) => ({
        id, name: nombre, year: anio, price: precio, category: categoria, subcategory: subcategoria,
      }));
      const priceTop = collection.toSorted((left, right) => {
        if (left.precio == null && right.precio != null) return 1;
        if (right.precio == null && left.precio != null) return -1;
        return (right.precio ?? 0) - (left.precio ?? 0)
          || (left.fecha_compra ?? '9999').localeCompare(right.fecha_compra ?? '9999')
          || right.fecha_registro.localeCompare(left.fecha_registro);
      }).slice(0, 5);
      const ageTop = collection.toSorted((left, right) => {
        if (left.anio == null && right.anio != null) return 1;
        if (right.anio == null && left.anio != null) return -1;
        return (left.anio ?? 9999) - (right.anio ?? 9999)
          || (right.precio ?? 0) - (left.precio ?? 0)
          || right.fecha_registro.localeCompare(left.fecha_registro);
      }).slice(0, 5);
      const publicFigure = ({ id, nombre, anio, precio, categoria, subcategoria }) => ({
        id, name: nombre, year: anio, price: precio, category: categoria, subcategory: subcategoria,
      });
      const gamification = tables.gamificacion.find(({ user_id }) => user_id === targetId);
      const achievementFields = ['id', 'type', 'nombre', 'descripcion', 'bricks', 'repetible', 'cantidad', 'total'];
      const achievements = [...(gamification?.logros ?? [])].map((achievement, index) => ({ achievement, index }))
        .sort((left, right) => Number(left.achievement.type === 'regalo') - Number(right.achievement.type === 'regalo')
          || (left.achievement.type === 'regalo' ? 0 : (right.achievement.total ?? 0) - (left.achievement.total ?? 0))
          || left.index - right.index)
        .slice(0, 5)
        .map(({ achievement }) => Object.fromEntries(achievementFields.filter((field) => achievement[field] != null)
          .map((field) => [({ nombre: 'name', descripcion: 'description', repetible: 'repeatable', cantidad: 'quantity' }[field] ?? field), achievement[field]])));
      return { data: {
        userId: targetId,
        username: summary.username,
        avatarUrl: summary.avatar_url,
        bricks: summary.bricks,
        level: { id: gamification?.nivel?.id ?? 0, name: gamification?.nivel?.nombre ?? 'Duplo' },
        dna: calculateDna(gamification?.logros ?? []).porcentajes,
        top5Price: priceTop.map(publicFigure),
        top5Age: ageTop.map(publicFigure),
        collection: { total: collection.length, latest: latest(collection) },
        wanted: { total: wanted.length, latest: latest(wanted) },
        achievements,
      }, error: null };
    }

    if (name === 'amigos_enviar') {
      const receiverId = parameters?.p_receptor_id;
      if (!receiverId || receiverId === uid) return { data: null, error: { code: '22023', message: 'AUTORRELACION_NO_PERMITIDA' } };
      if (!tables.user_profiles.some(({ user_id }) => user_id === receiverId)) {
        return { data: null, error: { code: 'P0002', message: 'USUARIO_NO_ENCONTRADO' } };
      }
      if (requestForPair(uid, receiverId) || tables.friendships.some(({ user_low_id, user_high_id }) => {
        const [low, high] = canonicalPair(user_low_id, user_high_id);
        const [targetLow, targetHigh] = canonicalPair(uid, receiverId);
        return low === targetLow && high === targetHigh;
      })) return { data: null, error: { code: '23505', message: 'SOLICITUD_EXISTENTE' } };
      const requestFailure = takeFailure('friend_requests', 'insert');
      if (requestFailure) return { data: null, error: requestFailure };
      const requestSnapshot = clone(tables.friend_requests);
      const notificationSnapshot = clone(tables.notificaciones);
      sequence += 1;
      const requestId = `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
      tables.friend_requests.push(withDefaults('friend_requests', {
        id: requestId, sender_id: uid, recipient_id: receiverId,
      }));
      const notificationFailure = takeFailure('notificaciones', 'insert');
      if (notificationFailure) {
        tables.friend_requests = requestSnapshot;
        tables.notificaciones = notificationSnapshot;
        return { data: null, error: notificationFailure };
      }
      const senderName = tables.user_profiles.find(({ user_id }) => user_id === uid)?.username ?? 'Coleccionista';
      insertNotification({ user_id: receiverId, type: 'friend_request', payload: { user: senderName }, social_request_id: requestId });
      return { data: { ok: true, requestId, status: 'pending' }, error: null };
    }

    if (name === 'amigos_rechazar' || name === 'amigos_aceptar') {
      const request = tables.friend_requests.find(({ id, recipient_id }) => id === parameters?.p_solicitud_id && recipient_id === uid);
      if (!request) return { data: null, error: { code: 'P0002', message: 'SOLICITUD_NO_ENCONTRADA' } };
      if (name === 'amigos_rechazar') {
        if (request.status === 'accepted') return { data: null, error: { code: '23514', message: 'SOLICITUD_YA_ACEPTADA' } };
        request.status = 'rejected';
        request.updated_at = timestamp();
        return { data: { ok: true, status: 'rejected' }, error: null };
      }
      if (request.status === 'accepted') {
        const incomingNotification = tables.notificaciones.find(({ user_id, type, social_request_id }) =>
          user_id === uid && type === 'friend_request' && social_request_id === request.id);
        if (incomingNotification) incomingNotification.social_request_accepted = true;
        return { data: { ok: true, status: 'accepted', alreadyAccepted: true }, error: null };
      }
      const requestSnapshot = clone(tables.friend_requests);
      const friendshipSnapshot = clone(tables.friendships);
      const notificationSnapshot = clone(tables.notificaciones);
      request.status = 'accepted';
      request.updated_at = timestamp();
      const [low, high] = canonicalPair(request.sender_id, request.recipient_id);
      if (!tables.friendships.some(({ user_low_id, user_high_id }) => user_low_id === low && user_high_id === high)) {
        tables.friendships.push(withDefaults('friendships', { user_low_id: low, user_high_id: high }));
      }
      const notificationFailure = takeFailure('notificaciones', 'insert');
      if (notificationFailure) {
        tables.friend_requests = requestSnapshot;
        tables.friendships = friendshipSnapshot;
        tables.notificaciones = notificationSnapshot;
        return { data: null, error: notificationFailure };
      }
      const accepterName = tables.user_profiles.find(({ user_id }) => user_id === uid)?.username ?? 'Coleccionista';
      const incomingNotification = tables.notificaciones.find(({ user_id, type, social_request_id }) =>
        user_id === uid && type === 'friend_request' && social_request_id === request.id);
      if (incomingNotification) incomingNotification.social_request_accepted = true;
      if (!tables.notificaciones.some(({ user_id, type, social_request_id }) => user_id === request.sender_id
        && type === 'friend_request_accepted' && social_request_id === request.id)) {
        insertNotification({ user_id: request.sender_id, type: 'friend_request_accepted',
          payload: { user: accepterName }, social_request_id: request.id });
      }
      return { data: { ok: true, status: 'accepted', alreadyAccepted: false }, error: null };
    }

    if (name === 'eliminar_cuenta_usuario') {
      for (const table of Object.keys(tables)) {
        tables[table] = tables[table].filter((row) => row.user_id !== uid
          && row.donante_id !== uid && row.receptor_id !== uid
          && row.thanker_id !== uid && row.donor_id !== uid);
      }
      for (const [token, user] of Object.entries(users)) {
        if (user.id === uid) delete users[token];
      }
      dailySync.authUsers.delete(uid);
      return { data: null, error: null };
    }

    if (name === 'regalos_recibidos_count') {
      return { data: tables.regalos_enviados.filter(({ receptor_id, semana }) => receptor_id === uid && semana === '0001-01-01').length, error: null };
    }
    if (name === 'regalos_semanales_recibidos_count') {
      return { data: tables.regalos_enviados.filter(({ receptor_id, semana }) => receptor_id === uid && semana !== '0001-01-01').length, error: null };
    }

    if (name === 'agradecimientos_regalo_count') {
      return { data: {
        sent: tables.agradecimientos_regalo.filter(({ thanker_id }) => thanker_id === uid).length,
        received: tables.agradecimientos_regalo.filter(({ donor_id }) => donor_id === uid).length,
      }, error: null };
    }

    if (name === 'gamificacion_dna') {
      const gamification = tables.gamificacion.find(({ user_id }) => user_id === uid);
      return { data: calculateDna(gamification?.logros ?? []), error: null };
    }

    if (name === 'ranking_logros') {
      const globalUsers = [...tables.gamificacion]
        .sort((left, right) => right.bricks - left.bricks || left.user_id.localeCompare(right.user_id))
        .slice(0, 10);
      const weeklyUsers = rpc('ranking_semanal', {}, uid).data?.entries ?? [];
      const eligible = globalUsers.some(({ user_id }) => user_id === parameters.p_usuario_id)
        || weeklyUsers.some(({ userId }) => userId === parameters.p_usuario_id);
      const target = eligible ? tables.gamificacion.find(({ user_id }) => user_id === parameters.p_usuario_id) : null;
      if (!target) return { data: null, error: null };
      const profile = tables.user_profiles.find(({ user_id }) => user_id === target.user_id);
      const fields = ['id', 'type', 'nombre', 'descripcion', 'bricks', 'repetible', 'cantidad', 'total'];
      return { data: clone({
        userId: target.user_id, displayName: profile?.username ?? 'Coleccionista', bricks: target.bricks,
        nivel: { id: target.nivel?.id ?? 0, nombre: target.nivel?.nombre ?? 'Duplo' },
        logros: target.logros.map((item) => Object.fromEntries(fields.filter((field) => item[field] != null).map((field) => [field, item[field]]))),
      }), error: null };
    }

    if (name === 'ranking_semanal') {
      const instant = new Date(typeof now === 'function' ? now() : now);
      const dateParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
      }).formatToParts(instant).map(({ type, value }) => [type, value]));
      const referenceDate = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
      const shiftDate = (date, amount) => new Date(Date.parse(`${date}T00:00:00Z`) + amount * 86400000).toISOString().slice(0, 10);
      const weekday = (new Date(`${referenceDate}T00:00:00Z`).getUTCDay() + 6) % 7;
      const weekStart = shiftDate(referenceDate, -weekday);
      const weekEnd = shiftDate(weekStart, 6);
      const availableFrom = '2026-10-12';
      const active = referenceDate >= availableFrom;
      const baselines = new Map(tables.user_daily_snapshots
        .filter(({ snapshot_date }) => snapshot_date === shiftDate(weekStart, -1))
        .map(({ user_id, bricks }) => [user_id, bricks]));
      const latest = new Map();
      for (const snapshot of tables.user_daily_snapshots) {
        if (snapshot.snapshot_date < weekStart || snapshot.snapshot_date > weekEnd || snapshot.snapshot_date > referenceDate) continue;
        const current = latest.get(snapshot.user_id);
        if (!current || snapshot.snapshot_date > current.snapshot_date) latest.set(snapshot.user_id, snapshot);
      }
      const candidates = active ? [...latest.values()]
        .filter(({ user_id }) => baselines.has(user_id))
        .map((snapshot) => ({
          snapshot,
          gamification: tables.gamificacion.find(({ user_id }) => user_id === snapshot.user_id),
          delta: snapshot.bricks - baselines.get(snapshot.user_id),
        }))
        .filter(({ gamification }) => gamification)
        .sort((left, right) => right.delta - left.delta || left.snapshot.user_id.localeCompare(right.snapshot.user_id))
        .slice(0, 10) : [];
      const entries = candidates.map(({ snapshot, gamification, delta }) => {
        const profile = tables.perfiles_publicos.find(({ user_id }) => user_id === gamification.user_id);
        const collection = tables.minifiguras.filter(({ user_id, estado_coleccion }) => user_id === gamification.user_id && estado_coleccion === 'COLECCIÓN');
        const domainCollection = collection.map((row) => ({
          id: row.id, nombre: row.nombre, precio: row.precio, anio: row.anio,
          fechaCompra: row.fecha_compra, FechaRegistro: row.fecha_registro,
        }));
        const highlights = collectionHighlights(domainCollection);
        const withMetadata = (items) => items.map((item) => {
          const row = collection.find(({ id }) => id === item.id);
          return Object.fromEntries(Object.entries({ ...item, categoria: row.categoria, subcategoria: row.subcategoria, anio: row.anio })
            .filter(([, value]) => value != null));
        });
        const levelId = gamification.nivel?.id ?? 0;
        const dna = calculateDna(gamification.logros ?? []);
        const dnaTraits = [
          ['rarityHunter', 'Rarity Hunter'], ['explorer', 'Explorer'], ['collector', 'Collector'], ['fan', 'Fan'],
        ].map(([key, nombre], ordinal) => ({ nombre, porcentaje: dna.porcentajes[key], ordinal }));
        dnaTraits.sort((left, right) => Number(right.nombre === dna.principal) - Number(left.nombre === dna.principal)
          || right.porcentaje - left.porcentaje || left.ordinal - right.ordinal);
        return {
          userId: gamification.user_id,
          avatarUrl: profile?.avatar_url ?? null,
          displayName: tables.user_profiles.find(({ user_id }) => user_id === gamification.user_id)?.username ?? 'Coleccionista',
          bricks: gamification.bricks,
          nivel: levelId,
          nombreNivel: gamification.nivel?.nombre ?? 'Duplo',
          imagenNivel: ({
            3: '/level_images/3_threesevenfive.png', 4: '/level_images/4_citizen.png',
            5: '/level_images/5_skeleton.png', 6: '/level_images/6_pirate.png',
            7: '/level_images/7_captain.png', 8: '/level_images/8_redbearb.png',
            9: '/level_images/9_forestman.png', 10: '/level_images/10_wolfpack.png',
            11: '/level_images/11_wolfpackmaster.png', 12: '/level_images/12_ninja.png',
            13: '/level_images/13_rx.png', 14: '/level_images/14_dragonform.png',
            15: '/level_images/15_spacebaby.jpg', 16: '/level_images/16_spaceman.jpg',
            17: '/level_images/17_blacktron.png',
          })[levelId] ?? '/level_images/9_forestman.png',
          totalColeccion: collection.length,
          top5Precio: withMetadata(highlights.top5Precio),
          top5Antiguedad: withMetadata(highlights.top5Antiguedad),
          regaloEnviado: tables.regalos_enviados.some(({ donante_id, receptor_id, semana }) => donante_id === uid && receptor_id === gamification.user_id && semana === weekStart),
          dnaPrincipal: dna.principal,
          dnaRasgos: dna.principal === 'Newbie' ? [] : dnaTraits.slice(0, 2).map(({ nombre, porcentaje }) => ({ nombre, porcentaje })),
          bricksSemanales: delta,
          snapshotDate: snapshot.snapshot_date,
        };
      });
      return { data: {
        available: active && entries.length > 0,
        availableFrom,
        weekStart,
        weekEnd,
        entries,
      }, error: null };
    }

    if (name === 'ranking_global') {
      const criterio = parameters?.p_criterio ?? 'nivel';
      const selectedTraitName = { rarityHunter: 'Rarity Hunter', collector: 'Collector', explorer: 'Explorer', fan: 'Fan' }[criterio];
      const value = (row) => criterio === 'nivel' ? row.nivel?.id ?? 0
        : criterio === 'coleccion'
          ? tables.minifiguras.filter(({ user_id, estado_coleccion }) => user_id === row.user_id && estado_coleccion === 'COLECCIÓN').length
          : calculateDna(row.logros ?? []).porcentajes[criterio] ?? 0;
      const levelCandidates = [...tables.gamificacion]
        .sort((left, right) => (right.nivel?.id ?? 0) - (left.nivel?.id ?? 0)
          || right.bricks - left.bricks || left.user_id.localeCompare(right.user_id))
        .slice(0, 10);
      const data = levelCandidates
        .sort((left, right) => value(right) - value(left) || (right.nivel?.id ?? 0) - (left.nivel?.id ?? 0)
          || right.bricks - left.bricks || left.user_id.localeCompare(right.user_id))
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
            display_name: tables.user_profiles.find(({ user_id }) => user_id === gamification.user_id)?.username ?? 'Coleccionista',
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
            regalo_enviado: tables.regalos_enviados.some(({ donante_id, receptor_id, semana }) => donante_id === uid && receptor_id === gamification.user_id && semana === '0001-01-01'),
            dna_principal: dna.principal,
            dna_rasgos: selectedTraitName ? [{ nombre: selectedTraitName, porcentaje: dna.porcentajes[criterio] }]
              : dna.principal === 'Newbie' ? [] : dnaTraits.slice(0, 2).map(({ nombre, porcentaje }) => ({ nombre, porcentaje })),
          };
        });
      return { data: clone(data), error: null };
    }

    if (name === 'regalar_bricks' || name === 'regalar_bricks_semanal') {
      const weekly = name === 'regalar_bricks_semanal';
      const ranking = weekly ? rpc('ranking_semanal', {}, uid).data : null;
      const week = weekly ? ranking?.weekStart : '0001-01-01';
      const amount = weekly ? 5 : 50;
      const achievementId = weekly ? 'youre-on-fire-this-week' : 'someone-liked-your-collection';
      const receiverId = parameters?.p_receptor_id;
      if (receiverId === uid) return { data: null, error: { code: 'P0001', message: 'AUTORREGALO_NO_PERMITIDO' } };
      if (weekly && !ranking?.entries.some(({ userId }) => userId === receiverId)) {
        return { data: null, error: { code: 'P0001', message: 'RECEPTOR_NO_ENCONTRADO' } };
      }
      const receiver = tables.gamificacion.find(({ user_id }) => user_id === receiverId);
      if (!receiver) return { data: null, error: { code: 'P0001', message: 'RECEPTOR_NO_ENCONTRADO' } };
      if (tables.regalos_enviados.some(({ donante_id, receptor_id, semana }) => donante_id === uid && receptor_id === receiverId && semana === week)) {
        return { data: null, error: { code: 'P0001', message: 'REGALO_YA_ENVIADO' } };
      }
      const giftFailure = takeFailure('regalos_enviados', 'insert');
      if (giftFailure) return { data: null, error: giftFailure };
      const snapshot = clone(receiver);
      const giftsSnapshot = clone(tables.regalos_enviados);
      const notificationsSnapshot = clone(tables.notificaciones);
      try {
        tables.regalos_enviados.push(withDefaults('regalos_enviados', { donante_id: uid, receptor_id: receiverId, semana: week }));
        const updateFailure = takeFailure('gamificacion', 'update');
        if (updateFailure) throw updateFailure;
        const count = tables.regalos_enviados.filter(({ receptor_id, semana }) => receptor_id === receiverId && (semana !== '0001-01-01') === weekly).length;
        receiver.bricks += amount;
        const { nivel, siguienteNivel, progreso } = selectLevel(receiver.bricks);
        receiver.nivel = nivel;
        receiver.siguiente_nivel = siguienteNivel;
        receiver.progreso = progreso;
        receiver.logros = receiver.logros.filter(({ id }) => id !== achievementId);
        receiver.logros.push({
          id: achievementId, type: 'regalo', nombre: weekly ? "You're on fire this week!" : 'Your collection is top!',
          descripcion: `Has aparecido en el ranking ${weekly ? 'semanal' : 'global'} y te han hecho un regalo.`, bricks: amount,
          repetible: true, cantidad: count, total: count * amount,
        });
        const notificationFailure = takeFailure('notificaciones', 'insert');
        if (notificationFailure) throw notificationFailure;
        const donorName = tables.user_profiles.find(({ user_id }) => user_id === uid)?.username ?? 'Coleccionista';
        insertNotification({
          user_id: receiverId,
          type: 'gift_received',
          gift_donante_id: uid,
          gift_semana: week,
          payload: {
            user: donorName,
            actorUserId: uid,
            amount,
            message: `El usuario ${donorName} vio tus tops en el Ranking ${weekly ? 'Semanal' : 'Global'} y te regaló ${amount} Bricks 🧱`,
          },
        });
        return { data: { ok: true }, error: null };
      } catch (error) {
        Object.assign(receiver, snapshot);
        tables.regalos_enviados = giftsSnapshot;
        tables.notificaciones = notificationsSnapshot;
        return { data: null, error };
      }
    }

    if (name === 'agradecer_regalo') {
      const giftNotification = tables.notificaciones.find(({ id, user_id, type }) =>
        id === parameters?.p_notification_id && user_id === uid && type === 'gift_received');
      if (!giftNotification) return { data: null, error: { code: 'P0001', message: 'REGALO_NO_ENCONTRADO' } };
      if (tables.agradecimientos_regalo.some(({ gift_notification_id }) => gift_notification_id === giftNotification.id)) {
        return { data: null, error: { code: 'P0001', message: 'REGALO_YA_AGRADECIDO' } };
      }
      const donor = tables.gamificacion.find(({ user_id }) => user_id === giftNotification.gift_donante_id);
      const thanker = tables.gamificacion.find(({ user_id }) => user_id === uid);
      if (!donor || !thanker) return { data: null, error: { code: 'P0001', message: 'USUARIO_NO_ENCONTRADO' } };
      const donorSnapshot = clone(donor);
      const thankerSnapshot = clone(thanker);
      const thanksSnapshot = clone(tables.agradecimientos_regalo);
      const notificationsSnapshot = clone(tables.notificaciones);
      try {
        const ledgerFailure = takeFailure('agradecimientos_regalo', 'insert');
        if (ledgerFailure) throw ledgerFailure;
        tables.agradecimientos_regalo.push(withDefaults('agradecimientos_regalo', {
          gift_notification_id: giftNotification.id, thanker_id: uid, donor_id: donor.user_id,
        }));
        giftNotification.gift_thanked_at = timestamp();
        const updateFailure = takeFailure('gamificacion', 'update');
        if (updateFailure) throw updateFailure;
        addBricks(donor, 10);
        const count = tables.agradecimientos_regalo.filter(({ donor_id }) => donor_id === donor.user_id).length;
        donor.logros = donor.logros.filter(({ id }) => id !== 'thanks-for-the-gift');
        donor.logros.push({
          id: 'thanks-for-the-gift', type: 'regalo', nombre: 'Gratitude is the sign of noble souls',
          descripcion: 'Un coleccionista te dio las gracias por tu regalo.', bricks: 5,
          repetible: true, cantidad: count, total: count * 5,
        });
        const notificationFailure = takeFailure('notificaciones', 'insert');
        if (notificationFailure) throw notificationFailure;
        const thankerName = tables.user_profiles.find(({ user_id }) => user_id === uid)?.username ?? 'Coleccionista';
        insertNotification({
          user_id: donor.user_id,
          type: 'gift_thanks',
          payload: { user: thankerName, actorUserId: uid, amount: 5, message: `${thankerName} te dio las gracias por tu regalo.` },
        });
        return { data: { ok: true }, error: null };
      } catch (error) {
        Object.assign(donor, donorSnapshot);
        Object.assign(thanker, thankerSnapshot);
        tables.agradecimientos_regalo = thanksSnapshot;
        tables.notificaciones = notificationsSnapshot;
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
    const thanks = tables.agradecimientos_regalo.filter(({ thanker_id, donor_id }) => thanker_id === userId || donor_id === userId)
      .sort((left, right) => left.gift_notification_id.localeCompare(right.gift_notification_id));
    return createHash('sha256').update(JSON.stringify({ figures, gifts, thanks, fingerprint: dailySync.fingerprint ?? '' })).digest('hex');
  }

  function adminRpc(name, parameters) {
    adminCalls.push({ name, parameters: clone(parameters) });
    const failure = takeFailure(name, 'rpc');
    if (failure) return { data: null, error: failure };
    if (name === 'recalcular_agradecimientos_regalo_count') {
      const userIds = [...new Set(parameters.p_user_ids ?? [])];
      return { data: userIds.map((user_id) => ({
        user_id,
        sent_count: tables.agradecimientos_regalo.filter(({ thanker_id }) => thanker_id === user_id).length,
        received_count: tables.agradecimientos_regalo.filter(({ donor_id }) => donor_id === user_id).length,
      })), error: null };
    }
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
      const cacheTtlHours = parameters.p_price_cache_ttl_hours ?? DEFAULT_DAILY_PRICE_CACHE_TTL_HOURS;
      if (!Number.isInteger(cacheTtlHours) || cacheTtlHours < 0 || cacheTtlHours > 8760) {
        return { data: null, error: { code: '22023', message: 'DAILY_SYNC_TTL_INVALIDO' } };
      }
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
        const isFresh = cacheTtlHours > 0
          && cached
          && now.getTime() - cached.fetched_at.getTime() <= cacheTtlHours * 60 * 60 * 1000;
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
      const thankRows = tables.agradecimientos_regalo.filter(({ thanker_id, donor_id }) =>
        thanker_id === parameters.p_user_id || donor_id === parameters.p_user_id);
      return { data: {
        revision: sourceRevision(parameters.p_user_id), figures,
        giftsReceived: tables.regalos_enviados.filter(({ receptor_id, semana }) => receptor_id === parameters.p_user_id && semana === '0001-01-01').length,
        weeklyGiftsReceived: tables.regalos_enviados.filter(({ receptor_id, semana }) => receptor_id === parameters.p_user_id && semana !== '0001-01-01').length,
        thanksSent: thankRows.filter(({ thanker_id }) => thanker_id === parameters.p_user_id).length,
        thanksReceived: thankRows.filter(({ donor_id }) => donor_id === parameters.p_user_id).length,
        fingerprint: dailySync.fingerprint ?? '',
      }, error: null };
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
        publishDailySummaries(run);
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
    const state = { operation: null, values: null, filters: [], comparisons: [], orders: [], limit: null, returning: false, single: false, head: false, count: null, or: null };
    const builder = {
      select(_columns, options = {}) {
        if (state.operation === null) state.operation = 'select';
        else state.returning = true;
        state.head = options.head === true;
        state.count = options.count ?? null;
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
      or(expression) { state.or = expression; return builder; },
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
      storage: {
        from(bucket) {
          return {
            async list(prefix, { limit = 100 } = {}) {
              if (!uid || prefix !== uid || bucket !== 'profile-avatars') return { data: null, error: rlsError() };
              const error = takeFailure(bucket, 'list');
              const data = [...avatarObjects.keys()].filter((path) => path.startsWith(`${uid}/`)).slice(0, limit)
                .map((path) => ({ id: path, name: path.slice(uid.length + 1) }));
              return { data: error ? null : data, error };
            },
            async remove(paths) {
              if (!uid || bucket !== 'profile-avatars' || paths.some((path) => !path.startsWith(`${uid}/`))) {
                return { data: null, error: rlsError() };
              }
              const error = takeFailure(bucket, 'remove');
              if (error) return { data: null, error };
              for (const path of paths) avatarObjects.delete(path);
              return { data: [], error: null };
            },
          };
        },
      },
      auth: {
        async signInWithPassword({ email, password }) {
          const entry = Object.entries(users).find(([, user]) => user.email === email && passwords[user.id] === password);
          return entry && !passwordSignInError
            ? { data: { session: { access_token: entry[0], refresh_token: `refresh-${entry[0]}` } }, error: null }
            : { data: null, error: { message: 'invalid credentials' } };
        },
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
        if (name === 'resolver_acceso_username') {
          const failure = takeFailure(name, 'rpc');
          const profile = tables.user_profiles.find(({ username }) => username.toLowerCase() === parameters.p_username?.toLowerCase());
          const user = Object.values(users).find(({ id }) => id === profile?.user_id);
          return Promise.resolve({
            data: !failure && user && passwords[user.id] === parameters.p_password ? user.email : null,
            error: failure,
          });
        }
        return Promise.resolve().then(() => rpc(name, parameters, uid));
      },
    };
  }

  return {
    createClient,
    seedAvatar(userId, filename) {
      avatarObjects.set(`${userId}/${filename}`, true);
    },
    avatarPaths() {
      return [...avatarObjects.keys()];
    },
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
        const identity = ['regalos_enviados', 'friend_requests', 'friendships'].includes(table) ? {} : { user_id: userId };
        tables[table].push(withDefaults(table, { ...identity, ...clone(row) }));
      }
    },
    rows(table, userId) {
      return clone(tables[table].filter((row) => userId === undefined || row.user_id === userId
        || (table === 'friend_requests' && (row.sender_id === userId || row.recipient_id === userId))
        || (table === 'friendships' && (row.user_low_id === userId || row.user_high_id === userId))));
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
