import { readFile } from 'node:fs/promises';

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

function isMinifigura(value) {
  const hasValidOptionalMetadata =
    (value.tema === undefined || (typeof value.tema === 'string' && value.tema.trim().length > 0))
    && (value.anio === undefined || (typeof value.anio === 'number' && Number.isInteger(value.anio)))
    && (value.estadoColeccion === undefined || (typeof value.estadoColeccion === 'string' && value.estadoColeccion.trim().length > 0));

  return value !== null
    && typeof value === 'object'
    && typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.nombre === 'string'
    && value.nombre.length > 0
    && typeof value.descripcion === 'string'
    && value.descripcion.length > 0
    && hasValidOptionalMetadata;
}

function validateCatalogo(value) {
  if (!Array.isArray(value) || !value.every(isMinifigura)) {
    throw new CatalogoInvalidoError();
  }
  return value;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function matchesFilters(minifigura, filters) {
  const tema = normalizeText(filters.tema);
  const estadoColeccion = normalizeText(filters.estadoColeccion);

  if (tema !== undefined && normalizeText(minifigura.tema) !== tema) {
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

  async list(filters = {}) {
    let content;
    try {
      content = await readFile(this.filePath, 'utf8');
    } catch {
      throw new CatalogoNoDisponibleError();
    }

    let catalogo;
    try {
      catalogo = JSON.parse(content);
    } catch {
      throw new CatalogoInvalidoError();
    }

    const minifiguras = validateCatalogo(catalogo);
    const activeFilters = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );

    if (Object.keys(activeFilters).length === 0) {
      return minifiguras;
    }

    return minifiguras.filter((minifigura) => matchesFilters(minifigura, activeFilters));
  }
}