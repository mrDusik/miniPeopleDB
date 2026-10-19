const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIST_TYPES = new Set(['friends', 'sent', 'received']);
const RELATIONSHIP_STATES = new Set(['friend', 'none', 'request_sent', 'request_received', 'request_rejected']);

export class AmigosNoDisponiblesError extends Error {
  constructor() {
    super('Los amigos no estan disponibles');
    this.name = 'AmigosNoDisponiblesError';
    this.code = 'AMIGOS_NO_DISPONIBLES';
  }
}

export class ConsultaAmigosInvalidaError extends Error {
  constructor() {
    super('La consulta debe tener al menos tres caracteres');
    this.name = 'ConsultaAmigosInvalidaError';
    this.code = 'CONSULTA_DEMASIADO_CORTA';
  }
}

export class UsuarioAmigosNoEncontradoError extends Error {
  constructor() {
    super('El usuario no existe');
    this.name = 'UsuarioAmigosNoEncontradoError';
    this.code = 'USUARIO_NO_ENCONTRADO';
  }
}

export class SolicitudAmigosExistenteError extends Error {
  constructor() {
    super('La solicitud ya existe');
    this.name = 'SolicitudAmigosExistenteError';
    this.code = 'SOLICITUD_EXISTENTE';
  }
}

export class AutorrelacionNoPermitidaError extends Error {
  constructor() {
    super('No se puede solicitar amistad consigo mismo');
    this.name = 'AutorrelacionNoPermitidaError';
    this.code = 'AUTORRELACION_NO_PERMITIDA';
  }
}

export class SolicitudAmigosNoEncontradaError extends Error {
  constructor() {
    super('La solicitud no existe');
    this.name = 'SolicitudAmigosNoEncontradaError';
    this.code = 'SOLICITUD_NO_ENCONTRADA';
  }
}

export class SolicitudYaAceptadaError extends Error {
  constructor() {
    super('La solicitud ya fue aceptada');
    this.name = 'SolicitudYaAceptadaError';
    this.code = 'SOLICITUD_YA_ACEPTADA';
  }
}

export class PerfilAmigosNoPermitidoError extends Error {
  constructor() {
    super('No se puede consultar el perfil propio');
    this.name = 'PerfilAmigosNoPermitidoError';
    this.code = 'PERFIL_NO_PERMITIDO';
  }
}

function numberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function mapPerson(row) {
  if (!row || typeof row.user_id !== 'string' || typeof row.username !== 'string') {
    throw new AmigosNoDisponiblesError();
  }
  const level = row.nivel && typeof row.nivel === 'object' && !Array.isArray(row.nivel) ? row.nivel : {};
  return {
    userId: row.user_id,
    username: row.username,
    avatarUrl: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    bricks: numberOrNull(row.bricks) ?? 0,
    level: { id: numberOrNull(level.id) ?? 0, name: typeof level.nombre === 'string' ? level.nombre : 'Duplo' },
    globalPosition: numberOrNull(row.posicion_global),
    totalCollection: numberOrNull(row.total_coleccion) ?? 0,
    dnaPrincipal: typeof row.dna_principal === 'string' ? row.dna_principal : 'Newbie',
    dnaTraits: (Array.isArray(row.dna_rasgos) ? row.dna_rasgos : []).slice(0, 2)
      .map((trait) => ({ name: trait.nombre, percentage: numberOrNull(trait.porcentaje) ?? 0 })),
  };
}

function mapProfileFigure(figure) {
  if (!figure || typeof figure !== 'object' || Array.isArray(figure)) throw new AmigosNoDisponiblesError();
  const fields = ['id', 'name', 'year', 'price', 'category', 'subcategory'];
  return Object.fromEntries(fields.filter((field) => Object.hasOwn(figure, field)
    && (typeof figure[field] === 'string' || typeof figure[field] === 'number')
    && (typeof figure[field] !== 'number' || Number.isFinite(figure[field])))
    .map((field) => [field, figure[field]]));
}

function mapProfileAchievement(achievement) {
  if (!achievement || typeof achievement !== 'object' || Array.isArray(achievement)) throw new AmigosNoDisponiblesError();
  const fields = ['id', 'type', 'name', 'description', 'bricks', 'repeatable', 'quantity', 'total'];
  return Object.fromEntries(fields.filter((field) => Object.hasOwn(achievement, field)
    && (typeof achievement[field] === 'string' || typeof achievement[field] === 'number' || typeof achievement[field] === 'boolean'))
    .map((field) => [field, achievement[field]]));
}

function mapProfile(data) {
  if (data === null) throw new UsuarioAmigosNoEncontradoError();
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || typeof data.userId !== 'string' || typeof data.username !== 'string'
    || !Array.isArray(data.top5Price) || !Array.isArray(data.top5Age)
    || !Array.isArray(data.achievements)
    || !data.collection || !Number.isInteger(data.collection.total) || !Array.isArray(data.collection.latest)
    || !data.wanted || !Number.isInteger(data.wanted.total) || !Array.isArray(data.wanted.latest)
    || !data.dna || typeof data.dna !== 'object') throw new AmigosNoDisponiblesError();
  return {
    userId: data.userId,
    username: data.username,
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : null,
    bricks: numberOrNull(data.bricks) ?? 0,
    level: data.level && typeof data.level === 'object'
      ? { id: numberOrNull(data.level.id) ?? 0, name: typeof data.level.name === 'string' ? data.level.name : 'Duplo' }
      : { id: 0, name: 'Duplo' },
    dna: {
      rarityHunter: numberOrNull(data.dna.rarityHunter) ?? 0,
      explorer: numberOrNull(data.dna.explorer) ?? 0,
      collector: numberOrNull(data.dna.collector) ?? 0,
      fan: numberOrNull(data.dna.fan) ?? 0,
    },
    top5Price: data.top5Price.slice(0, 5).map(mapProfileFigure),
    top5Age: data.top5Age.slice(0, 5).map(mapProfileFigure),
    collection: { total: data.collection.total, latest: data.collection.latest.slice(0, 5).map(mapProfileFigure) },
    wanted: { total: data.wanted.total, latest: data.wanted.latest.slice(0, 5).map(mapProfileFigure) },
    achievements: data.achievements.slice(0, 5).map(mapProfileAchievement),
  };
}

export class AmigosRepository {
  constructor({ client, userId } = {}) {
    this.client = client;
    this.userId = userId;
  }

  async run(query, mapError = () => new AmigosNoDisponiblesError()) {
    let result;
    try {
      result = await query;
    } catch (error) {
      throw mapError(error);
    }
    if (result.error) throw mapError(result.error);
    return result.data;
  }

  async search(query) {
    const normalized = typeof query === 'string' ? query.trim() : '';
    if (normalized.length < 3) throw new ConsultaAmigosInvalidaError();
    const rows = await this.run(this.client.rpc('amigos_resumen', { p_tipo: 'search', p_query: normalized }), (error) => {
      if (error?.message === 'CONSULTA_DEMASIADO_CORTA') return new ConsultaAmigosInvalidaError();
      return new AmigosNoDisponiblesError();
    });
    if (!Array.isArray(rows)) throw new AmigosNoDisponiblesError();
    return rows.map((row) => {
      if (!RELATIONSHIP_STATES.has(row.relationship_status)) throw new AmigosNoDisponiblesError();
      return { ...mapPerson(row), relationshipStatus: row.relationship_status };
    });
  }

  async list(type) {
    if (!LIST_TYPES.has(type)) throw new AmigosNoDisponiblesError();
    const rows = await this.run(this.client.rpc('amigos_resumen', { p_tipo: type }));
    if (!Array.isArray(rows)) throw new AmigosNoDisponiblesError();
    return rows.map((row) => ({
      ...mapPerson(row),
      relationshipId: typeof row.relationship_id === 'string' ? row.relationship_id : null,
      status: type === 'sent' && row.status === 'rejected' ? 'pending' : row.status,
      createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    }));
  }

  async counts() {
    const data = await this.run(this.client.rpc('amigos_contadores'));
    if (!data || ['friends', 'sent', 'received'].some((key) => !Number.isInteger(data[key]) || data[key] < 0)) {
      throw new AmigosNoDisponiblesError();
    }
    return { friends: data.friends, sent: data.sent, received: data.received };
  }

  async remove(friendId) {
    if (friendId === this.userId) throw new AutorrelacionNoPermitidaError();
    const data = await this.run(this.client.rpc('amigos_eliminar', { p_amigo_id: friendId }));
    if (!data || data.ok !== true || typeof data.removed !== 'boolean') throw new AmigosNoDisponiblesError();
    return { ok: true, removed: data.removed };
  }

  async send(receiverId) {
    const result = await this.run(this.client.rpc('amigos_enviar', { p_receptor_id: receiverId }), (error) => {
      if (error?.message === 'AUTORRELACION_NO_PERMITIDA') return new AutorrelacionNoPermitidaError();
      if (error?.message === 'USUARIO_NO_ENCONTRADO') return new UsuarioAmigosNoEncontradoError();
      if (error?.message === 'SOLICITUD_EXISTENTE') return new SolicitudAmigosExistenteError();
      return new AmigosNoDisponiblesError();
    });
    if (!result || result.ok !== true || typeof result.requestId !== 'string' || result.status !== 'pending') {
      throw new AmigosNoDisponiblesError();
    }
    return { ok: true, requestId: result.requestId, status: 'pending' };
  }

  async reject(requestId) {
    return this.changeRequest('amigos_rechazar', requestId);
  }

  async accept(requestId) {
    return this.changeRequest('amigos_aceptar', requestId);
  }

  async changeRequest(rpcName, requestId) {
    const result = await this.run(this.client.rpc(rpcName, { p_solicitud_id: requestId }), (error) => {
      if (error?.message === 'SOLICITUD_NO_ENCONTRADA') return new SolicitudAmigosNoEncontradaError();
      if (error?.message === 'SOLICITUD_YA_ACEPTADA') return new SolicitudYaAceptadaError();
      return new AmigosNoDisponiblesError();
    });
    if (!result || result.ok !== true || !['accepted', 'rejected'].includes(result.status)) {
      throw new AmigosNoDisponiblesError();
    }
    return { ok: true, status: result.status, alreadyAccepted: result.alreadyAccepted === true };
  }

  async profile(targetId) {
    if (!UUID_PATTERN.test(targetId) || targetId.toLowerCase() === this.userId.toLowerCase()) {
      throw new PerfilAmigosNoPermitidoError();
    }
    const data = await this.run(this.client.rpc('amigos_perfil', { p_usuario_id: targetId }), (error) => {
      if (error?.message === 'PERFIL_NO_PERMITIDO') return new PerfilAmigosNoPermitidoError();
      return new AmigosNoDisponiblesError();
    });
    return mapProfile(data);
  }
}