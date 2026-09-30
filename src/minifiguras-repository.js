import { CategoriasNoDisponiblesError } from './categorias-repository.js';

const TABLE = 'minifiguras';
const FIELD_COLUMNS = [
  ['id', 'id'],
  ['nombre', 'nombre'],
  ['descripcion', 'descripcion'],
  ['categoria', 'categoria'],
  ['subcategoria', 'subcategoria'],
  ['anio', 'anio'],
  ['estadoColeccion', 'estado_coleccion'],
  ['precioCompra', 'precio_compra'],
  ['fechaCompra', 'fecha_compra'],
  ['precio', 'precio'],
  ['FechaRegistro', 'fecha_registro'],
  ['observada', 'observada'],
];
const SELECT_COLUMNS = FIELD_COLUMNS.map(([, column]) => column).join(',');

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

export class LimiteObservadasError extends Error {
  constructor() {
    super('Se ha alcanzado el limite de minifiguras en observacion');
    this.name = 'LimiteObservadasError';
    this.code = 'LIMITE_OBSERVADAS';
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

function isValidOptionalRegistrationDate(value) {
  return value === undefined || (typeof value === 'string' && !Number.isNaN(Date.parse(value)));
}

const MINIFIGURA_FIELDS = new Set([
  'id',
  'nombre',
  'descripcion',
  'categoria',
  'subcategoria',
  'anio',
  'estadoColeccion',
  'precioCompra',
  'fechaCompra',
  'precio',
  'FechaRegistro',
  'observada',
]);

function isValidOptionalSubcategoria(value, categoria, officialCategorias) {
  if (value === undefined) {
    return true;
  }
  if (!isNonEmptyText(value)) {
    return false;
  }
  const subcategorias = officialCategorias.get(categoria);
  return subcategorias !== undefined && subcategorias.has(value);
}

function isMinifigura(value, officialCategorias) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).every((key) => MINIFIGURA_FIELDS.has(key))
    && isNonEmptyText(value.id)
    && isNonEmptyText(value.nombre)
    && (value.descripcion === undefined || typeof value.descripcion === 'string')
    && isNonEmptyText(value.categoria)
    && officialCategorias.has(value.categoria)
    && isValidOptionalSubcategoria(value.subcategoria, value.categoria, officialCategorias)
    && (value.anio === undefined || Number.isInteger(value.anio))
    && isValidEstado(value.estadoColeccion)
    && isValidOptionalPrice(value.precioCompra)
    && isValidOptionalPurchaseDate(value.fechaCompra)
    && isValidOptionalPrice(value.precio)
    && typeof value.observada === 'boolean'
    && isValidOptionalRegistrationDate(value.FechaRegistro);
}

function validateCatalogo(value, officialCategorias) {
  if (!Array.isArray(value) || !value.every((item) => isMinifigura(item, officialCategorias))) {
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

function fromRow(row) {
  const minifigura = {};
  for (const [field, column] of FIELD_COLUMNS) {
    if (row[column] !== null && row[column] !== undefined) {
      minifigura[field] = row[column];
    }
  }
  // Postgres returns timestamptz as "+00:00"; keep the API's ISO "Z" format.
  if (typeof minifigura.FechaRegistro === 'string' && !Number.isNaN(Date.parse(minifigura.FechaRegistro))) {
    minifigura.FechaRegistro = new Date(minifigura.FechaRegistro).toISOString();
  }
  return minifigura;
}

function toRow(minifigura) {
  return Object.fromEntries(FIELD_COLUMNS.map(([field, column]) => [column, minifigura[field] ?? null]));
}

function persistenceError(error) {
  return error?.code === '23505' ? new IdDuplicadoError() : new CatalogoNoDisponibleError();
}

function normalizeId(id) {
  return typeof id === 'string' ? id.trim().toUpperCase() : id;
}

function normalizeText(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    : value;
}

function matchesFilters(minifigura, filters) {
  const categoria = normalizeText(filters.categoria);
  const subcategoria = normalizeText(filters.subcategoria);
  const nombre = normalizeText(filters.nombre);
  const estadoColeccion = normalizeText(filters.estadoColeccion);

  if (categoria !== undefined && normalizeText(minifigura.categoria) !== categoria) {
    return false;
  }

  if (subcategoria !== undefined && normalizeText(minifigura.subcategoria) !== subcategoria) {
    return false;
  }

  if (nombre !== undefined && !normalizeText(minifigura.nombre).includes(nombre)) {
    return false;
  }

  if (filters.id !== undefined && !normalizeText(minifigura.id).includes(normalizeText(filters.id))) {
    return false;
  }

  if (filters.anio !== undefined && minifigura.anio !== filters.anio) {
    return false;
  }

  if (estadoColeccion !== undefined && normalizeText(minifigura.estadoColeccion) !== estadoColeccion) {
    return false;
  }

  if (filters.observada !== undefined && minifigura.observada !== filters.observada) {
    return false;
  }

  return true;
}

export class MinifigurasRepository {
  constructor({ client, userId, categoriasRepository, onCatalogPersisted } = {}) {
    this.client = client;
    this.userId = userId;
    this.categoriasRepository = categoriasRepository;
    this.onCatalogPersisted = onCatalogPersisted;
    this.lastGamification = null;
    this.observationMutation = Promise.resolve();
  }

  async officialCategorias() {
    if (!this.categoriasRepository) {
      throw new CategoriasNoDisponiblesError();
    }
    const categorias = await this.categoriasRepository.read();
    return new Map(categorias.map(({ categoria, subcategorias }) => [categoria, new Set(subcategorias.map(({ subcategoria }) => subcategoria))]));
  }

  async run(query) {
    let result;
    try {
      result = await query;
    } catch {
      throw new CatalogoNoDisponibleError();
    }
    if (result.error) {
      throw persistenceError(result.error);
    }
    return result.data;
  }

  async readCatalog() {
    const rows = await this.run(this.client.from(TABLE)
      .select(SELECT_COLUMNS)
      .order('fecha_registro', { ascending: true })
      .order('created_at', { ascending: true }));
    if (!Array.isArray(rows)) {
      throw new CatalogoNoDisponibleError();
    }
    return validateCatalogo(rows.map(fromRow), await this.officialCategorias());
  }

  async notifyPersisted() {
    this.lastGamification = this.onCatalogPersisted
      ? await this.onCatalogPersisted(await this.readCatalog()) ?? null
      : null;
  }

  async list(filters = {}) {
    const minifiguras = await this.readCatalog();
    const activeFilters = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );

    if (Object.keys(activeFilters).length === 0) {
      return minifiguras;
    }

    if (activeFilters.categoria !== undefined && this.categoriasRepository) {
      const officialCategorias = await this.officialCategorias();
      const normalizedCategoria = normalizeText(activeFilters.categoria);
      if (![...officialCategorias.keys()].some((categoria) => normalizeText(categoria) === normalizedCategoria)) {
        throw new MinifiguraInvalidaError();
      }
    }

    return minifiguras.filter((minifigura) => matchesFilters(minifigura, activeFilters));
  }

  async findById(id) {
    const catalogo = await this.readCatalog();
    const minifigura = catalogo.find((item) => item.id === normalizeId(id));
    if (!minifigura) {
      throw new MinifiguraNoEncontradaError();
    }
    return minifigura;
  }

  async updatePrices(priceUpdates) {
    const catalogo = await this.readCatalog();
    const normalizedUpdates = new Map([...priceUpdates.entries()].map(([id, price]) => [normalizeId(id), price]));
    const catalogIds = new Set(catalogo.map((minifigura) => minifigura.id));
    for (const id of normalizedUpdates.keys()) {
      if (!catalogIds.has(id)) {
        throw new MinifiguraNoEncontradaError();
      }
    }
    for (const price of normalizedUpdates.values()) {
      if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
        throw new MinifiguraInvalidaError();
      }
    }
    const nextCatalog = catalogo.map((minifigura) => {
      const nextPrice = normalizedUpdates.get(minifigura.id);
      return nextPrice === undefined ? minifigura : { ...minifigura, precio: nextPrice };
    });
    const changedRows = nextCatalog
      .filter((minifigura) => normalizedUpdates.has(minifigura.id))
      .map((minifigura) => ({ ...toRow(minifigura), user_id: this.userId }));
    await this.run(this.client.from(TABLE).upsert(changedRows, { onConflict: 'user_id,id' }));
    await this.notifyPersisted();
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
    }, { total: 0, enColeccion: 0, buscadas: 0, topCandidates: [], observadas: [] });

    for (const minifigura of catalogo) {
      if (minifigura.observada) {
        summary.observadas.push({
          id: minifigura.id,
          nombre: minifigura.nombre,
          estadoColeccion: minifigura.estadoColeccion,
          precioBrickset: minifigura.precio,
          precio: minifigura.precio,
        });
      }
    }
    summary.observadas.sort((left, right) => {
      const leftPrice = Number.isFinite(left.precioBrickset) ? left.precioBrickset : -Infinity;
      const rightPrice = Number.isFinite(right.precioBrickset) ? right.precioBrickset : -Infinity;
      return rightPrice - leftPrice;
    });

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
    const officialCategorias = await this.officialCategorias();
    const nextMinifigura = {
      ...minifigura,
      id: normalizeId(minifigura.id),
      observada: minifigura.observada ?? false,
      estadoColeccion: minifigura.estadoColeccion || 'COLECCIÓN',
      FechaRegistro: new Date().toISOString(),
    };
    if (!isMinifigura(nextMinifigura, officialCategorias)) {
      throw new MinifiguraInvalidaError();
    }

    await this.run(this.client.from(TABLE).insert(toRow(nextMinifigura)));
    await this.notifyPersisted();
    return nextMinifigura;
  }

  async replace(id, minifigura) {
    const catalogo = await this.readCatalog();
    const officialCategorias = await this.officialCategorias();
    const normalizedId = normalizeId(id);
    const existing = catalogo.find((item) => item.id === normalizedId);
    const nextMinifigura = {
      ...minifigura,
      id: normalizeId(minifigura.id),
      observada: minifigura.observada ?? existing?.observada ?? false,
      estadoColeccion: minifigura.estadoColeccion || 'COLECCIÓN',
      FechaRegistro: existing?.FechaRegistro,
    };
    if (!isMinifigura(nextMinifigura, officialCategorias) || nextMinifigura.id !== normalizedId) {
      throw new MinifiguraInvalidaError();
    }

    if (!existing) {
      throw new MinifiguraNoEncontradaError();
    }

    const { fecha_registro: _fechaRegistro, ...changes } = toRow(nextMinifigura);
    const updated = await this.run(this.client.from(TABLE).update(changes).eq('id', normalizedId).select('id'));
    if (!updated?.length) {
      throw new MinifiguraNoEncontradaError();
    }
    await this.notifyPersisted();
    return nextMinifigura;
  }

  async delete(id) {
    const deleted = await this.run(this.client.from(TABLE).delete().eq('id', normalizeId(id)).select('id'));
    if (!deleted?.length) {
      throw new MinifiguraNoEncontradaError();
    }
    await this.notifyPersisted();
  }

  async setObserved(id, observed) {
    const operation = async () => {
      const catalogo = await this.readCatalog();
      const normalizedId = normalizeId(id);
      const index = catalogo.findIndex((item) => item.id === normalizedId);
      if (index === -1) {
        throw new MinifiguraNoEncontradaError();
      }
      if (observed && !catalogo[index].observada && catalogo.filter((item) => item.observada).length >= 10) {
        throw new LimiteObservadasError();
      }

      const updated = await this.run(this.client.from(TABLE).update({ observada: observed }).eq('id', normalizedId).select('id'));
      if (!updated?.length) {
        throw new MinifiguraNoEncontradaError();
      }
      await this.notifyPersisted();
      return { ...catalogo[index], observada: observed };
    };
    this.observationMutation = this.observationMutation.then(operation, operation);
    return this.observationMutation;
  }
}