import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export class CategoriasNoDisponiblesError extends Error {
  constructor() {
    super('El catalogo de categorias no esta disponible');
    this.name = 'CategoriasNoDisponiblesError';
    this.code = 'CATEGORIAS_NO_DISPONIBLES';
  }
}

export class CategoriasInvalidosError extends Error {
  constructor() {
    super('El catalogo de categorias no es valido');
    this.name = 'CategoriasInvalidosError';
    this.code = 'CATEGORIAS_INVALIDOS';
  }
}

export class CategoriasPersistenciaError extends Error {
  constructor(cause) {
    super('No se pudo persistir el catalogo de categorias', { cause });
    this.name = 'CategoriasPersistenciaError';
    this.code = 'CATEGORIAS_PERSISTENCIA_ERROR';
  }
}

function isValidSubcategoriaTotal(value) {
  return value === undefined || (Number.isInteger(value) && value >= 0);
}

function isValidSubcategoria(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof value.subcategoria === 'string'
    && value.subcategoria === value.subcategoria.trim()
    && value.subcategoria.trim() !== ''
    && isValidSubcategoriaTotal(value.total)
    && Object.keys(value).every((key) => key === 'subcategoria' || key === 'total');
}

function isValidSubcategorias(value) {
  return Array.isArray(value) && value.every(isValidSubcategoria);
}

function isValidCategoria(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof value.categoria === 'string'
    && value.categoria === value.categoria.trim()
    && value.categoria.trim() !== ''
    && Number.isInteger(value.total)
    && value.total >= 0
    && isValidSubcategorias(value.subcategorias)
    && Object.keys(value).every((key) => key === 'categoria' || key === 'total' || key === 'subcategorias');
}

function normalizeName(value) {
  return value.trim().normalize('NFKC').toLocaleLowerCase();
}

export function validateCategorias(value) {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isValidCategoria)) {
    throw new CategoriasInvalidosError();
  }

  const names = new Set();
  for (const categoria of value) {
    const normalizedName = normalizeName(categoria.categoria);
    if (names.has(normalizedName)) {
      throw new CategoriasInvalidosError();
    }
    names.add(normalizedName);

    const subcategoryNames = new Set();
    for (const subcategoria of categoria.subcategorias) {
      const normalizedSubcategoria = normalizeName(subcategoria.subcategoria);
      if (subcategoryNames.has(normalizedSubcategoria)) {
        throw new CategoriasInvalidosError();
      }
      subcategoryNames.add(normalizedSubcategoria);
    }
  }
  return value;
}

export class CategoriasRepository {
  constructor(filePath, { writeFileImpl = writeFile, renameImpl = rename, rmImpl = rm } = {}) {
    this.filePath = filePath;
    this.writeFile = writeFileImpl;
    this.rename = renameImpl;
    this.rm = rmImpl;
  }

  async read() {
    let content;
    try {
      content = await readFile(this.filePath, 'utf8');
    } catch {
      throw new CategoriasNoDisponiblesError();
    }

    try {
      return validateCategorias(JSON.parse(content));
    } catch (error) {
      if (error instanceof CategoriasInvalidosError) {
        throw error;
      }
      throw new CategoriasInvalidosError();
    }
  }

  async replace(categorias) {
    validateCategorias(categorias);
    const temporaryPath = join(dirname(this.filePath), `.${basename(this.filePath)}.${process.pid}.${Date.now()}.tmp`);
    try {
      await this.writeFile(temporaryPath, JSON.stringify(categorias, null, 2));
      await this.rename(temporaryPath, this.filePath);
    } catch (error) {
      await this.rm(temporaryPath, { force: true }).catch(() => {});
      throw new CategoriasPersistenciaError(error);
    }
  }
}
