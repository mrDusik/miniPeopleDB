const TABLE = 'notificaciones';
const PAGE_SIZE = 15;
const CURSOR_VERSION = 1;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATA_FIELDS = {
  gift_received: ['user', 'amount', 'message'],
  gift_thanks: ['user', 'amount', 'message'],
  ranking_entered: ['ranking', 'position', 'message'],
  ranking_exited: ['ranking', 'message'],
  daily_summary: ['snapshotDate', 'hasPrevious', 'deltas'],
};

export class NotificacionesNoDisponiblesError extends Error {
  constructor() {
    super('Las notificaciones no estan disponibles');
    this.name = 'NotificacionesNoDisponiblesError';
    this.code = 'NOTIFICACIONES_NO_DISPONIBLES';
  }
}

export class CursorNotificacionesInvalidoError extends Error {
  constructor() {
    super('El cursor de notificaciones no es valido');
    this.name = 'CursorNotificacionesInvalidoError';
    this.code = 'CURSOR_INVALIDO';
  }
}

export class RegaloNoAgradecibleError extends Error {
  constructor() {
    super('El regalo no se puede agradecer');
    this.name = 'RegaloNoAgradecibleError';
    this.code = 'REGALO_NO_ENCONTRADO';
  }
}

export class RegaloYaAgradecidoError extends Error {
  constructor() {
    super('El regalo ya fue agradecido');
    this.name = 'RegaloYaAgradecidoError';
    this.code = 'REGALO_YA_AGRADECIDO';
  }
}

function encodeCursor(row) {
  return Buffer.from(JSON.stringify({
    version: CURSOR_VERSION,
    createdAt: new Date(row.created_at).toISOString(),
    id: row.id,
  })).toString('base64url');
}

function decodeCursor(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new CursorNotificacionesInvalidoError();
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const createdAt = new Date(parsed?.createdAt);
    if (parsed?.version !== CURSOR_VERSION
      || Number.isNaN(createdAt.getTime())
      || createdAt.toISOString() !== parsed.createdAt
      || !UUID_PATTERN.test(parsed.id)) throw new Error('invalid cursor');
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new CursorNotificacionesInvalidoError();
  }
}

function publicData(type, payload) {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  return Object.fromEntries((DATA_FIELDS[type] ?? []).filter((field) => Object.hasOwn(source, field)
    && source[field] !== undefined).map((field) => [field, source[field]]));
}

export class NotificacionesRepository {
  constructor({ client } = {}) {
    this.client = client;
  }

  async run(query) {
    let result;
    try {
      result = await query;
    } catch {
      throw new NotificacionesNoDisponiblesError();
    }
    if (result.error) throw new NotificacionesNoDisponiblesError();
    return result;
  }

  async unreadCount() {
    const result = await this.run(this.client.from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false));
    if (!Number.isInteger(result.count) || result.count < 0) throw new NotificacionesNoDisponiblesError();
    return result.count;
  }

  async list({ cursor } = {}) {
    const decodedCursor = decodeCursor(cursor);
    let query = this.client.from(TABLE)
      .select('id,type,payload,is_read,created_at,gift_thanked_at')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE + 1);
    if (decodedCursor) {
      query = query.or(`created_at.lt.${decodedCursor.createdAt},and(created_at.eq.${decodedCursor.createdAt},id.lt.${decodedCursor.id})`);
    }
    const result = await this.run(query);
    if (!Array.isArray(result.data)) throw new NotificacionesNoDisponiblesError();
    const unreadCount = await this.unreadCount();
    const hasMore = result.data.length > PAGE_SIZE;
    const rows = result.data.slice(0, PAGE_SIZE);
    return {
      notifications: rows.map((row) => ({
        id: row.id,
        type: row.type,
        createdAt: new Date(row.created_at).toISOString(),
        isRead: row.is_read === true,
        data: publicData(row.type, row.payload),
        ...(row.type === 'gift_received' ? { canThank: row.gift_thanked_at == null } : {}),
      })),
      unreadCount,
      nextCursor: hasMore ? encodeCursor(rows.at(-1)) : null,
    };
  }

  async markAllRead() {
    await this.run(this.client.from(TABLE).update({ is_read: true }).eq('is_read', false));
    return { unreadCount: await this.unreadCount() };
  }

  async markRead(notificationId) {
    await this.run(this.client.from(TABLE)
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('is_read', false));
    return { unreadCount: await this.unreadCount() };
  }

  async thank(notificationId) {
    let result;
    try {
      result = await this.client.rpc('agradecer_regalo', { p_notification_id: notificationId });
    } catch {
      throw new NotificacionesNoDisponiblesError();
    }
    if (result.error?.message === 'REGALO_NO_ENCONTRADO') throw new RegaloNoAgradecibleError();
    if (result.error?.message === 'REGALO_YA_AGRADECIDO') throw new RegaloYaAgradecidoError();
    if (result.error) throw new NotificacionesNoDisponiblesError();
    return { ok: true };
  }
}