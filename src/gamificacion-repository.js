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

export class GamificacionDnaNoDisponibleError extends Error {
  constructor() {
    super('El DNA no esta disponible');
    this.name = 'GamificacionDnaNoDisponibleError';
    this.code = 'DNA_NO_DISPONIBLE';
  }
}

const DNA_PERCENTAGE_KEYS = ['rarityHunter', 'explorer', 'collector', 'fan'];
const DNA_PRINCIPALS = new Set(['Newbie', 'Rarity Hunter', 'Explorer', 'Collector', 'Fan']);
const LOGRO_FIELDS = ['id', 'type', 'nombre', 'descripcion', 'bricks', 'repetible', 'cantidad', 'total'];

function validateDna(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !DNA_PRINCIPALS.has(value.principal)
    || !value.porcentajes || typeof value.porcentajes !== 'object' || Array.isArray(value.porcentajes)) {
    throw new GamificacionDnaNoDisponibleError();
  }
  const porcentajes = Object.fromEntries(DNA_PERCENTAGE_KEYS.map((key) => [key, value.porcentajes[key]]));
  if (DNA_PERCENTAGE_KEYS.some((key) => !Number.isFinite(porcentajes[key]) || porcentajes[key] < 0 || porcentajes[key] > 100)) {
    throw new GamificacionDnaNoDisponibleError();
  }
  const total = Object.values(porcentajes).reduce((sum, percentage) => sum + percentage, 0);
  if (value.principal === 'Newbie' ? total !== 0 : Math.abs(total - 100) > 0.01) {
    throw new GamificacionDnaNoDisponibleError();
  }
  return { principal: value.principal, porcentajes };
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
  return {
    bricks: value.bricks,
    nivel: value.nivel,
    siguienteNivel: value.siguienteNivel ?? null,
    progreso: value.progreso,
    logros: value.logros.map((logro) => Object.fromEntries(
      LOGRO_FIELDS.filter((field) => Object.hasOwn(logro, field)).map((field) => [field, logro[field]]),
    )),
  };
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

  async dna() {
    try {
      const { data, error } = await this.client.rpc('gamificacion_dna');
      if (error) throw error;
      return validateDna(data);
    } catch {
      throw new GamificacionDnaNoDisponibleError();
    }
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
    const [regalos, agradecimientos] = await Promise.all([
      this.run(this.client.rpc('regalos_recibidos_count')),
      this.run(this.client.rpc('agradecimientos_regalo_count')),
    ]);
    return calcularGamificacion(catalogo, categorias, regalos ?? 0, agradecimientos?.received ?? 0);
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
