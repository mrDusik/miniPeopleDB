import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { calcularGamificacion, nivelesAlcanzados, nuevosLogros } from './gamificacion.js';

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
  constructor(filePath, { categoriasRepository, catalogReader } = {}) {
    this.filePath = filePath;
    this.categoriasRepository = categoriasRepository;
    this.catalogReader = catalogReader;
    this.initialization = null;
  }

  async read() {
    let content;
    try {
      content = await readFile(this.filePath, 'utf8');
    } catch {
      throw new GamificacionNoDisponibleError();
    }
    try {
      return validateState(JSON.parse(content));
    } catch (error) {
      if (error instanceof GamificacionInvalidaError) throw error;
      throw new GamificacionInvalidaError();
    }
  }

  async persist(state) {
    const directory = dirname(this.filePath);
    const tempPath = join(directory, `.${basename(this.filePath)}.${process.pid}.${Date.now()}.tmp`);
    try {
      await writeFile(tempPath, JSON.stringify(validateState(state)));
      await rename(tempPath, this.filePath);
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }
  }

  async calculate(catalogo) {
    const categorias = this.categoriasRepository ? await this.categoriasRepository.read() : [];
    return calcularGamificacion(catalogo, categorias);
  }

  async recalculate(catalogo) {
    let previous = null;
    try {
      previous = await this.read();
    } catch (error) {
      if (!(error instanceof GamificacionNoDisponibleError)) throw error;
    }
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
        try {
          return await this.read();
        } catch (error) {
          if (!(error instanceof GamificacionNoDisponibleError)) throw error;
          if (!catalogReader) throw error;
          return (await this.recalculate(await catalogReader())).state;
        }
      })().catch((error) => {
        this.initialization = null;
        throw error;
      });
    }
    return this.initialization;
  }
}
