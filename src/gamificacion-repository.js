import { calcularGamificacion, nivelesAlcanzados, nuevosLogros } from './gamificacion.js';

const TABLE = 'gamificacion';

export class GamificacionNoDisponibleError extends Error {
  constructor() {
    super('El estado de gamificacion no esta disponible');
    this.name = 'GamificacionNoDisponibleError';
    this.code = 'GAMIFICACION_NO_DISPONIBLE';
  }
}

export class GamificacionInvalidaError extends Error {
  constructor() {
    super('El estado de gamificacion no es valido');
    this.name = 'GamificacionInvalidaError';
    this.code = 'GAMIFICACION_INVALIDA';
  }
}

function isValidLogro(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value.id === 'string'
    && typeof value.nombre === 'string'
    && Number.isInteger(value.bricks)
    && value.bricks >= 0
    && Number.isInteger(value.cantidad)
    && value.cantidad > 0
    && (value.type === undefined || value.type === 'regalo')
    && value.total === value.bricks * value.cantidad;
}

function validateState(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new GamificacionInvalidaError();
  }
  if (!Number.isInteger(value.bricks) || value.bricks < 0 || !Array.isArray(value.logros) || !value.logros.every(isValidLogro)) {
    throw new GamificacionInvalidaError();
  }
  if (value.nivel === null || typeof value.nivel !== 'object' || !Number.isInteger(value.nivel.id) || typeof value.nivel.nombre !== 'string') {
    throw new GamificacionInvalidaError();
  }
  if (value.siguienteNivel !== null && (typeof value.siguienteNivel !== 'object' || !Number.isInteger(value.siguienteNivel.id))) {
    throw new GamificacionInvalidaError();
  }
  if (value.progreso === null || typeof value.progreso !== 'object' || typeof value.progreso.porcentaje !== 'number') {
    throw new GamificacionInvalidaError();
  }
  return value;
}

export class GamificacionRepository {
  constructor({ client, userId, categoriasRepository, catalogReader } = {}) {
    this.client = client;
    this.userId = userId;
    this.categoriasRepository = categoriasRepository;
    this.catalogReader = catalogReader;
    this.initialization = null;
  }

  async run(query) {
    let result;
    try {
      result = await query;
    } catch {
      throw new GamificacionNoDisponibleError();
    }
    if (result.error) {
      throw new GamificacionNoDisponibleError();
    }
    return result.data;
  }

  // Returns null when the user has no stored state yet.
  async read() {
    const row = await this.run(this.client.from(TABLE).select('bricks,nivel,siguiente_nivel,progreso,logros').maybeSingle());
    if (!row) {
      return null;
    }
    return validateState({
      bricks: row.bricks,
      nivel: row.nivel,
      siguienteNivel: row.siguiente_nivel ?? null,
      progreso: row.progreso,
      logros: row.logros,
    });
  }

  async persist(state) {
    const { bricks, nivel, siguienteNivel, progreso, logros } = validateState(state);
    await this.run(this.client.from(TABLE).upsert({
      user_id: this.userId,
      bricks,
      nivel,
      siguiente_nivel: siguienteNivel,
      progreso,
      logros,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }));
  }

  async calculate(catalogo) {
    const categorias = this.categoriasRepository ? await this.categoriasRepository.read() : [];
    const regalos = await this.run(this.client.rpc('regalos_recibidos_count'));
    return calcularGamificacion(catalogo, categorias, regalos ?? 0);
  }

  async recalculate(catalogo) {
    const previous = await this.read();
    const state = await this.calculate(catalogo);
    await this.persist(state);
    this.initialization = Promise.resolve(state);
    return {
      state,
      logrosNuevos: nuevosLogros(previous, state),
      nivelesAlcanzados: nivelesAlcanzados(previous, state),
    };
  }

  async ensure(catalogReader = this.catalogReader) {
    if (!this.initialization) {
      this.initialization = (async () => {
        const stored = await this.read();
        if (stored) return stored;
        if (!catalogReader) throw new GamificacionNoDisponibleError();
        return (await this.recalculate(await catalogReader())).state;
      })().catch((error) => {
        this.initialization = null;
        throw error;
      });
    }
    return this.initialization;
  }
}
