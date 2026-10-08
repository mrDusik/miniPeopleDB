const PROFILE_TABLE = 'perfiles_publicos';

export class LogrosNoDisponiblesError extends Error {
  constructor() {
    super('Los logros no estan disponibles');
    this.code = 'LOGROS_NO_DISPONIBLES';
  }
}

export class UsuarioNoEncontradoError extends Error {
  constructor() {
    super('El usuario no esta en el ranking');
    this.code = 'USUARIO_NO_ENCONTRADO';
  }
}

export class RankingNoDisponibleError extends Error {
  constructor() {
    super('El ranking global no esta disponible');
    this.name = 'RankingNoDisponibleError';
    this.code = 'RANKING_NO_DISPONIBLE';
  }
}

export class RankingSemanalNoDisponibleError extends Error {
  constructor() {
    super('El ranking semanal no esta disponible');
    this.name = 'RankingSemanalNoDisponibleError';
    this.code = 'RANKING_SEMANAL_NO_DISPONIBLE';
  }
}

export class AutorregaloNoPermitidoError extends Error {
  constructor() {
    super('No se puede regalar al usuario autenticado');
    this.name = 'AutorregaloNoPermitidoError';
    this.code = 'AUTORREGALO_NO_PERMITIDO';
  }
}

export class RegaloYaEnviadoError extends Error {
  constructor() {
    super('El regalo ya fue enviado');
    this.name = 'RegaloYaEnviadoError';
    this.code = 'REGALO_YA_ENVIADO';
  }
}

export class ReceptorNoEncontradoError extends Error {
  constructor() {
    super('El receptor no existe');
    this.name = 'ReceptorNoEncontradoError';
    this.code = 'RECEPTOR_NO_ENCONTRADO';
  }
}

function giftError(error) {
  if (error?.message === 'AUTORREGALO_NO_PERMITIDO') return new AutorregaloNoPermitidoError();
  if (error?.message === 'REGALO_YA_ENVIADO') return new RegaloYaEnviadoError();
  if (error?.message === 'RECEPTOR_NO_ENCONTRADO') return new ReceptorNoEncontradoError();
  return new RankingNoDisponibleError();
}

function publicName(user) {
  const metadata = user?.user_metadata ?? {};
  const name = metadata.full_name || metadata.name;
  return typeof name === 'string' && name.trim() ? name.trim() : 'Coleccionista';
}

function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function finiteNumber(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || value.trim() === '')) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export class RankingRepository {
  constructor({ client, userId } = {}) {
    this.client = client;
    this.userId = userId;
  }

  async run(query, mapError = () => new RankingNoDisponibleError()) {
    let result;
    try {
      result = await query;
    } catch (error) {
      throw mapError(error);
    }
    if (result.error) throw mapError(result.error);
    return result.data;
  }

  async syncProfile(user) {
    const avatar = user?.user_metadata?.avatar_url;
    await this.run(this.client.from(PROFILE_TABLE).upsert({
      user_id: this.userId,
      display_name: publicName(user),
      avatar_url: typeof avatar === 'string' && avatar.trim() ? avatar.trim() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }));
  }

  async list(criterio = 'nivel') {
    const rows = await this.run(this.client.rpc('ranking_global', { p_criterio: criterio }));
    if (!Array.isArray(rows)) throw new RankingNoDisponibleError();
    return rows.map((row) => ({
      userId: row.user_id,
      avatarUrl: row.avatar_url ?? null,
      displayName: row.display_name,
      bricks: row.bricks,
      nivel: row.nivel,
      nombreNivel: row.nombre_nivel,
      imagenNivel: row.imagen_nivel,
      totalColeccion: Number(row.total_coleccion),
      top5Precio: row.top5_precio ?? [],
      top5Antiguedad: row.top5_antiguedad ?? [],
      regaloEnviado: row.regalo_enviado === true,
      dnaPrincipal: row.dna_principal,
      dnaRasgos: (row.dna_rasgos ?? []).slice(0, 2).map(({ nombre, porcentaje }) => ({ nombre, porcentaje })),
    }));
  }

  async weekly() {
    const failure = () => new RankingSemanalNoDisponibleError();
    const data = await this.run(this.client.rpc('ranking_semanal'), failure);
    if (!data || typeof data !== 'object'
      || typeof data.available !== 'boolean'
      || data.availableFrom !== '2026-10-12'
      || !isCalendarDate(data.weekStart)
      || !isCalendarDate(data.weekEnd)
      || !Array.isArray(data.entries)
      || data.entries.length > 10
      || (!data.available && data.entries.length !== 0)
      || (data.available && data.entries.length === 0)) throw failure();

    const entries = data.entries.map((row) => {
      const bricks = finiteNumber(row?.bricks);
      const nivel = finiteNumber(row?.nivel);
      const totalColeccion = finiteNumber(row?.totalColeccion);
      const bricksSemanales = finiteNumber(row?.bricksSemanales);
      if (!row || typeof row.userId !== 'string' || !row.userId
        || !Number.isInteger(bricks) || bricks < 0
        || !Number.isInteger(nivel) || nivel < 0
        || !Number.isInteger(totalColeccion) || totalColeccion < 0
        || !Number.isInteger(bricksSemanales)
        || typeof row.displayName !== 'string'
        || typeof row.nombreNivel !== 'string'
        || typeof row.imagenNivel !== 'string'
        || !isCalendarDate(row.snapshotDate)
        || !Array.isArray(row.top5Precio) || !Array.isArray(row.top5Antiguedad)
        || !Array.isArray(row.dnaRasgos) || row.dnaRasgos.length > 2
        || row.dnaRasgos.some((trait) => typeof trait?.nombre !== 'string' || finiteNumber(trait.porcentaje) === null)) {
        throw failure();
      }
      return {
        userId: row.userId,
        avatarUrl: typeof row.avatarUrl === 'string' ? row.avatarUrl : null,
        displayName: row.displayName,
        bricks,
        nivel,
        nombreNivel: row.nombreNivel,
        imagenNivel: row.imagenNivel,
        totalColeccion,
        top5Precio: row.top5Precio,
        top5Antiguedad: row.top5Antiguedad,
        regaloEnviado: row.regaloEnviado === true,
        dnaPrincipal: typeof row.dnaPrincipal === 'string' ? row.dnaPrincipal : 'Newbie',
        dnaRasgos: row.dnaRasgos.map(({ nombre, porcentaje }) => ({ nombre, porcentaje: finiteNumber(porcentaje) })),
        bricksSemanales,
        snapshotDate: row.snapshotDate,
      };
    });

    return {
      available: data.available,
      availableFrom: data.availableFrom,
      weekStart: data.weekStart,
      weekEnd: data.weekEnd,
      entries,
    };
  }

  async achievements(targetId) {
    const data = await this.run(this.client.rpc('ranking_logros', { p_usuario_id: targetId }), () => new LogrosNoDisponiblesError());
    if (data === null) throw new UsuarioNoEncontradoError();
    if (!data || !Array.isArray(data.logros) || !data.nivel) throw new LogrosNoDisponiblesError();
    const fields = ['id', 'type', 'nombre', 'descripcion', 'bricks', 'repetible', 'cantidad', 'total'];
    return {
      userId: data.userId, displayName: data.displayName, bricks: data.bricks,
      nivel: { id: data.nivel.id, nombre: data.nivel.nombre },
      logros: data.logros.map((item) => Object.fromEntries(fields.filter((field) => item[field] != null).map((field) => [field, item[field]]))),
    };
  }

  async gift(receiverId) {
    await this.run(this.client.rpc('regalar_bricks', { p_receptor_id: receiverId }), giftError);
    return { ok: true };
  }
}