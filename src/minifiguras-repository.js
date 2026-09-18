import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export class CatalogoNoDisponibleError extends Error {
  constructor() {
    super('El catalogo de minifiguras no esta disponible');
    this.name = 'CatalogoNoDisponibleError';
    this.code = 'CATALOGO_NO_DISPONIBLE';
  }
}

export class CatalogoInvalidoError extends Error {
  constructor() {
    super('El catalogo de minifiguras no es valido');
    this.name = 'CatalogoInvalidoError';
    this.code = 'CATALOGO_INVALIDO';
  }
}

export class MinifiguraInvalidaError extends Error {
  constructor() {
    super('La minifigura es invalida');
    this.name = 'MinifiguraInvalidaError';
    this.code = 'MINIFIGURA_INVALIDA';
  }
}

export class IdDuplicadoError extends Error {
  constructor() {
    super('El id de la minifigura ya existe');
    this.name = 'IdDuplicadoError';
    this.code = 'ID_DUPLICADO';
  }
}

export class MinifiguraNoEncontradaError extends Error {
  constructor() {
    super('La minifigura no existe');
    this.name = 'MinifiguraNoEncontradaError';
    this.code = 'MINIFIGURA_NO_ENCONTRADA';
  }
}

function isNonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isMinifigura(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && isNonEmptyText(value.id)
    && isNonEmptyText(value.nombre)
    && isNonEmptyText(value.descripcion)
    && isNonEmptyText(value.tematica)
    && Number.isInteger(value.anio)
    && (value.estadoColeccion === undefined || isNonEmptyText(value.estadoColeccion));
}

function validateCatalogo(value) {
  if (!Array.isArray(value) || !value.every(isMinifigura)) {
    throw new CatalogoInvalidoError();
  }

  const ids = new Set();
  for (const minifigura of value) {
    if (ids.has(minifigura.id)) {
      throw new CatalogoInvalidoError();
    }
    ids.add(minifigura.id);
  }

  return value;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function matchesFilters(minifigura, filters) {
  const tema = normalizeText(filters.tema);
  const estadoColeccion = normalizeText(filters.estadoColeccion);

  if (tema !== undefined && normalizeText(minifigura.tematica) !== tema) {
    return false;
  }

  if (filters.anio !== undefined && minifigura.anio !== filters.anio) {
    return false;
  }

  if (estadoColeccion !== undefined && normalizeText(minifigura.estadoColeccion) !== estadoColeccion) {
    return false;
  }

  return true;
}

export class MinifigurasRepository {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async readCatalog() {
    let content;
    try {
      content = await readFile(this.filePath, 'utf8');
    } catch {
      throw new CatalogoNoDisponibleError();
    }

    try {
      return validateCatalogo(JSON.parse(content));
    } catch {
      throw new CatalogoInvalidoError();
    }
  }

  async persist(catalogo) {
    const directory = dirname(this.filePath);
    const tempPath = join(directory, `.${basename(this.filePath)}.${process.pid}.${Date.now()}.tmp`);

    try {
      await writeFile(tempPath, JSON.stringify(catalogo));
      await rename(tempPath, this.filePath);
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }
  }

  async list(filters = {}) {
    const minifiguras = await this.readCatalog();
    const activeFilters = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );

    if (Object.keys(activeFilters).length === 0) {
      return minifiguras;
    }

    return minifiguras.filter((minifigura) => matchesFilters(minifigura, activeFilters));
  }

  async create(minifigura) {
    const catalogo = await this.readCatalog();
    if (!isMinifigura(minifigura)) {
      throw new MinifiguraInvalidaError();
    }
    if (catalogo.some((item) => item.id === minifigura.id)) {
      throw new IdDuplicadoError();
    }

    const nextCatalog = [...catalogo, minifigura];
    await this.persist(nextCatalog);
    return minifigura;
  }

  async replace(id, minifigura) {
    const catalogo = await this.readCatalog();
    if (!isMinifigura(minifigura) || minifigura.id !== id) {
      throw new MinifiguraInvalidaError();
    }

    const index = catalogo.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new MinifiguraNoEncontradaError();
    }

    const nextCatalog = [...catalogo];
    nextCatalog[index] = minifigura;
    await this.persist(nextCatalog);
    return minifigura;
  }

  async delete(id) {
    const catalogo = await this.readCatalog();
    const index = catalogo.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new MinifiguraNoEncontradaError();
    }

    const nextCatalog = catalogo.filter((item) => item.id !== id);
    await this.persist(nextCatalog);
  }
}