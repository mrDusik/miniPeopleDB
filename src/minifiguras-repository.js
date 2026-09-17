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
  return value !== null
    && typeof value === 'object'
    && typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.nombre === 'string'
    && value.nombre.length > 0
    && typeof value.descripcion === 'string'
    && value.descripcion.length > 0;
}

function validateCatalogo(value) {
  if (!Array.isArray(value) || !value.every(isMinifigura)) {
    throw new CatalogoInvalidoError();
  }
  return value;
}

export class MinifigurasRepository {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async list() {
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

    return validateCatalogo(catalogo);
  }
}