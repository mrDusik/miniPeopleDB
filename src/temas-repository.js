import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export class TemasNoDisponiblesError extends Error {
  constructor() {
    super('El catalogo de temas no esta disponible');
    this.name = 'TemasNoDisponiblesError';
    this.code = 'TEMAS_NO_DISPONIBLES';
  }
}

export class TemasInvalidosError extends Error {
  constructor() {
    super('El catalogo de temas no es valido');
    this.name = 'TemasInvalidosError';
    this.code = 'TEMAS_INVALIDOS';
  }
}

export class TemasPersistenciaError extends Error {
  constructor(cause) {
    super('No se pudo persistir el catalogo de temas', { cause });
    this.name = 'TemasPersistenciaError';
    this.code = 'TEMAS_PERSISTENCIA_ERROR';
  }
}

function isValidTema(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof value.tema === 'string'
    && value.tema === value.tema.trim()
    && value.tema.trim() !== ''
    && Number.isInteger(value.total)
    && value.total >= 0
    && Object.keys(value).every((key) => key === 'tema' || key === 'total');
}

export function validateTemas(value) {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isValidTema)) {
    throw new TemasInvalidosError();
  }

  const names = new Set();
  for (const tema of value) {
    const normalizedName = tema.tema.trim().normalize('NFKC').toLocaleLowerCase();
    if (names.has(normalizedName)) {
      throw new TemasInvalidosError();
    }
    names.add(normalizedName);
  }
  return value;
}

export class TemasRepository {
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
      throw new TemasNoDisponiblesError();
    }

    try {
      return validateTemas(JSON.parse(content));
    } catch (error) {
      if (error instanceof TemasInvalidosError) {
        throw error;
      }
      throw new TemasInvalidosError();
    }
  }

  async replace(temas) {
    validateTemas(temas);
    const temporaryPath = join(dirname(this.filePath), `.${basename(this.filePath)}.${process.pid}.${Date.now()}.tmp`);
    try {
      await this.writeFile(temporaryPath, JSON.stringify(temas, null, 2));
      await this.rename(temporaryPath, this.filePath);
    } catch (error) {
      await this.rm(temporaryPath, { force: true }).catch(() => {});
      throw new TemasPersistenciaError(error);
    }
  }
}