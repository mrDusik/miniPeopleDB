import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { TemasNoDisponiblesError } from './temas-repository.js';

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

function isValidOptionalPrice(value) {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function isValidOptionalPurchaseDate(value) {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function isValidEstado(value) {
  return value === 'COLECCIÓN' || value === 'BUSCADA';
}

const MINIFIGURA_FIELDS = new Set([
  'id',
  'nombre',
  'descripcion',
  'tematica',
  'anio',
  'estadoColeccion',
  'precioCompra',
  'fechaCompra',
  'precio',
]);

function isMinifigura(value, officialThemes) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).every((key) => MINIFIGURA_FIELDS.has(key))
    && isNonEmptyText(value.id)
    && isNonEmptyText(value.nombre)
    && isNonEmptyText(value.descripcion)
    && isNonEmptyText(value.tematica)
    && officialThemes.has(value.tematica)
    && Number.isInteger(value.anio)
    && isValidEstado(value.estadoColeccion)
    && isValidOptionalPrice(value.precioCompra)
    && isValidOptionalPurchaseDate(value.fechaCompra)
    && isValidOptionalPrice(value.precio);
}

function validateCatalogo(value, officialThemes) {
  if (!Array.isArray(value) || !value.every((item) => isMinifigura(item, officialThemes))) {
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
  return typeof value === 'string'
    ? value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    : value;
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
  constructor(filePath, { temasRepository } = {}) {
    this.filePath = filePath;
    this.temasRepository = temasRepository;
  }

  async officialThemes() {
    if (!this.temasRepository) {
      throw new TemasNoDisponiblesError();
    }
    const temas = await this.temasRepository.read();
    return new Set(temas.map(({ tema }) => tema));
  }

  async readCatalog() {
    let content;
    try {
      content = await readFile(this.filePath, 'utf8');
    } catch {
      throw new CatalogoNoDisponibleError();
    }

    let catalog;
    try {
      catalog = JSON.parse(content);
    } catch {
      throw new CatalogoInvalidoError();
    }

    return validateCatalogo(catalog, await this.officialThemes());
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

    if (activeFilters.tema !== undefined && this.temasRepository) {
      const officialThemes = await this.officialThemes();
      const normalizedTheme = normalizeText(activeFilters.tema);
      if (![...officialThemes].some((theme) => normalizeText(theme) === normalizedTheme)) {
        throw new MinifiguraInvalidaError();
      }
    }

    return minifiguras.filter((minifigura) => matchesFilters(minifigura, activeFilters));
  }

  async findById(id) {
    const catalogo = await this.readCatalog();
    const minifigura = catalogo.find((item) => item.id === id);
    if (!minifigura) {
      throw new MinifiguraNoEncontradaError();
    }
    return minifigura;
  }

  async updatePrices(priceUpdates) {
    const catalogo = await this.readCatalog();
    const catalogIds = new Set(catalogo.map((minifigura) => minifigura.id));
    for (const id of priceUpdates.keys()) {
      if (!catalogIds.has(id)) {
        throw new MinifiguraNoEncontradaError();
      }
    }
    for (const price of priceUpdates.values()) {
      if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
        throw new MinifiguraInvalidaError();
      }
    }
    const nextCatalog = catalogo.map((minifigura) => {
      const nextPrice = priceUpdates.get(minifigura.id);
      return nextPrice === undefined ? minifigura : { ...minifigura, precio: nextPrice };
    });
    await this.persist(nextCatalog);
    return nextCatalog;
  }

  async totalValue() {
    return (await this.valuationSummary()).total;
  }

  async collectionCounts() {
    const summary = await this.valuationSummary();
    return { enColeccion: summary.enColeccion, buscadas: summary.buscadas };
  }

  async valuationSummary() {
    const catalogo = await this.readCatalog();
    const summary = catalogo.reduce((result, minifigura, index) => {
      if (minifigura.estadoColeccion === 'BUSCADA') {
        result.buscadas += 1;
        return result;
      }

      if (minifigura.estadoColeccion !== 'COLECCIÓN') {
        return result;
      }

      result.enColeccion += 1;
      const value = Number.isFinite(minifigura.precio)
        ? minifigura.precio
        : Number.isFinite(minifigura.precioCompra) ? minifigura.precioCompra : 0;
      result.total += value;
      result.topCandidates.push({
        id: minifigura.id,
        nombre: minifigura.nombre,
        precio: minifigura.precio,
        fechaCompra: minifigura.fechaCompra,
        index,
      });
      return result;
    }, { total: 0, enColeccion: 0, buscadas: 0, topCandidates: [] });

    summary.top5 = summary.topCandidates
      .sort((left, right) => {
        const leftPrice = Number.isFinite(left.precio) ? left.precio : -Infinity;
        const rightPrice = Number.isFinite(right.precio) ? right.precio : -Infinity;
        if (rightPrice !== leftPrice) {
          return rightPrice - leftPrice;
        }
        if (left.fechaCompra !== right.fechaCompra) {
          if (left.fechaCompra === undefined) return 1;
          if (right.fechaCompra === undefined) return -1;
          return left.fechaCompra.localeCompare(right.fechaCompra);
        }
        return right.index - left.index;
      })
      .slice(0, 5)
      .map(({ id, nombre, precio }) => ({ id, nombre, precio }));
    delete summary.topCandidates;
    summary.top5Antiguas = catalogo
      .map((minifigura, index) => ({
        id: minifigura.id,
        nombre: minifigura.nombre,
        anio: minifigura.anio,
        precio: Number.isFinite(minifigura.precio) ? minifigura.precio : undefined,
        estadoColeccion: minifigura.estadoColeccion,
        index,
      }))
      .filter((minifigura) => minifigura.estadoColeccion === 'COLECCIÓN')
      .sort((left, right) => {
        if (left.anio !== right.anio) {
          return left.anio - right.anio;
        }
        const leftPrice = left.precio ?? -Infinity;
        const rightPrice = right.precio ?? -Infinity;
        if (leftPrice !== rightPrice) {
          return rightPrice - leftPrice;
        }
        return right.index - left.index;
      })
      .slice(0, 5)
      .map(({ id, nombre, anio, precio }) => ({ id, nombre, anio, precio }));
    return summary;
  }

  async create(minifigura) {
    const catalogo = await this.readCatalog();
    const officialThemes = await this.officialThemes();
    const nextMinifigura = {
      ...minifigura,
      estadoColeccion: minifigura.estadoColeccion || 'COLECCIÓN',
    };
    if (!isMinifigura(nextMinifigura, officialThemes)) {
      throw new MinifiguraInvalidaError();
    }
    if (catalogo.some((item) => item.id === nextMinifigura.id)) {
      throw new IdDuplicadoError();
    }

    const nextCatalog = [...catalogo, nextMinifigura];
    await this.persist(nextCatalog);
    return nextMinifigura;
  }

  async replace(id, minifigura) {
    const catalogo = await this.readCatalog();
    const officialThemes = await this.officialThemes();
    const nextMinifigura = {
      ...minifigura,
      estadoColeccion: minifigura.estadoColeccion || 'COLECCIÓN',
    };
    if (!isMinifigura(nextMinifigura, officialThemes) || nextMinifigura.id !== id) {
      throw new MinifiguraInvalidaError();
    }

    const index = catalogo.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new MinifiguraNoEncontradaError();
    }

    const nextCatalog = [...catalogo];
    nextCatalog[index] = nextMinifigura;
    await this.persist(nextCatalog);
    return nextMinifigura;
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