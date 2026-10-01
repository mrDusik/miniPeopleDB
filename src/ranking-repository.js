const PROFILE_TABLE = 'perfiles_publicos';

export class RankingNoDisponibleError extends Error {
  constructor() {
    super('El ranking global no esta disponible');
    this.name = 'RankingNoDisponibleError';
    this.code = 'RANKING_NO_DISPONIBLE';
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

  async list() {
    const rows = await this.run(this.client.rpc('ranking_global'));
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
    }));
  }

  async gift(receiverId) {
    await this.run(this.client.rpc('regalar_bricks', { p_receptor_id: receiverId }), giftError);
    return { ok: true };
  }
}