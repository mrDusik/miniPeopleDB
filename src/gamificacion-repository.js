import { calcularGamificacion, nivelesAlcanzados, nuevosLogros } from './gamificacion.js';

const TABLE = 'gamificacion';

export class LogrosDestacadosError extends Error {
  constructor(code = 'LOGROS_DESTACADOS_NO_DISPONIBLES') {
    super(code);
    this.code = code;
    this.status = code === 'LOGRO_INVALIDO' ? 400 : code === 'LIMITE_LOGROS_DESTACADOS' ? 409 : 500;
  }
}

function validateFeatured(value) {
  if (!Array.isArray(value) || value.length > 5 || new Set(value).size !== value.length
    || value.some((id) => typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(id))) {
    throw new LogrosDestacadosError();
  }
  return [...value];
}

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
const SOCIAL_SOURCE_FIELDS = [
  'friends', 'sent_pending', 'accepted_sent', 'accepted_received',
  'global_gifts_received', 'weekly_gifts_received', 'thanks_sent', 'thanks_received',
];

function validateSocialSources(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || SOCIAL_SOURCE_FIELDS.some((field) => !Number.isInteger(value[field]) || value[field] < 0)
    || typeof value.source_revision !== 'string' || !/^[\da-f]{32}$/.test(value.source_revision)) {
    throw new GamificacionNoDisponibleError();
  }
  return {
    ...Object.fromEntries(SOCIAL_SOURCE_FIELDS.map((field) => [field, value[field]])),
    source_revision: value.source_revision,
  };
}

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

  async featured() {
    const data = await this.run(this.client.rpc('gamificacion_con_destacados'));
    const state = validateState(data);
    const logrosDestacados = validateFeatured(data.logrosDestacados);
    if (logrosDestacados.some((id) => !state.logros.some((logro) => logro.id === id))) throw new LogrosDestacadosError();
    return { ...state, logrosDestacados };
  }

  async setFeatured(id, destacado) {
    if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(id) || typeof destacado !== 'boolean') {
      throw new LogrosDestacadosError('LOGRO_INVALIDO');
    }
    try {
      const { data, error } = await this.client.rpc('establecer_logro_destacado', { p_logro_id: id, p_destacado: destacado });
      if (error) {
        throw new LogrosDestacadosError(['LOGRO_INVALIDO', 'LIMITE_LOGROS_DESTACADOS'].includes(error.message)
          ? error.message : undefined);
      }
      return { logrosDestacados: validateFeatured(data?.logrosDestacados) };
    } catch (error) {
      throw error instanceof LogrosDestacadosError ? error : new LogrosDestacadosError();
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

  async readSocialSources() {
    return validateSocialSources(await this.run(this.client.rpc('gamificacion_social_fuentes')));
  }

  async calculateWithSources(catalogo) {
    const [categorias, socialSources] = await Promise.all([
      this.categoriasRepository ? this.categoriasRepository.read() : Promise.resolve([]),
      this.readSocialSources(),
    ]);
    return {
      state: calcularGamificacion(
        catalogo,
        categorias,
        socialSources.global_gifts_received,
        socialSources.thanks_received,
        socialSources.weekly_gifts_received,
        socialSources,
      ),
      sourceRevision: socialSources.source_revision,
    };
  }

  async calculate(catalogo) {
    return (await this.calculateWithSources(catalogo)).state;
  }

  async recalculate(catalogo) {
    const previous = await this.read();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { state, sourceRevision } = await this.calculateWithSources(catalogo);
      const currentSources = await this.readSocialSources();
      if (sourceRevision !== currentSources.source_revision) continue;
      await this.persist(state);
      this.initialization = Promise.resolve(state);
      return {
        state,
        logrosNuevos: nuevosLogros(previous, state),
        nivelesAlcanzados: nivelesAlcanzados(previous, state),
      };
    }
    throw new GamificacionNoDisponibleError();
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
