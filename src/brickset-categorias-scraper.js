import { validateCategorias, CategoriasInvalidosError } from './categorias-repository.js';

const BRICKSET_CATEGORIES_URL = 'https://brickset.com/browse/minifigs';
const BRICKSET_COLLECTIBLE_MINIFIGURES_URL = 'https://brickset.com/minifigs/category-Collectible-Minifigures';

export class BricksetCategoriasError extends Error {
  constructor(code = 'BRICKSET_CATEGORIAS_NO_DISPONIBLES') {
    super('No se pudieron obtener las categorias de Brickset');
    this.name = 'BricksetCategoriasError';
    this.code = code;
  }
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&eacute;/gi, 'é')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function cleanText(value) {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function parseListingRecordTags(tags) {
  const subcategoryMatch = tags.match(/<a\b[^>]*href=["']\/minifigs\/category-Collectible-Minifigures\/subcategory-[^"']+["'][^>]*>([\s\S]*?)<\/a>/i);
  const yearMatch = tags.match(/<a\b[^>]*href=["']\/minifigs\/category-Collectible-Minifigures\/year-(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
  const year = yearMatch ? Number(cleanText(yearMatch[2])) : null;
  return {
    subcategoria: subcategoryMatch ? cleanText(subcategoryMatch[1]) : null,
    anio: Number.isInteger(year) && year > 0 ? year : null,
  };
}

function parseBricksetDetailYear(html) {
  const match = html.match(/<dt>\s*Year released\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i);
  const year = match ? Number(cleanText(match[1])) : NaN;
  return Number.isInteger(year) && year > 0 ? year : null;
}

export function parseBricksetCollectibleMinifiguresPage(html, expectedPage = 1, expectedPageSize = null) {
  if (typeof html !== 'string' || html.trim() === '' || !Number.isInteger(expectedPage) || expectedPage < 1
    || (expectedPageSize !== null && (!Number.isInteger(expectedPageSize) || expectedPageSize < 1))) {
    throw new BricksetCategoriasError('BRICKSET_SERIES_COBERTURA_INCOMPLETA');
  }

  const text = cleanText(html);
  const summaryMatch = text.match(/([\d,]+)\s+to\s+([\d,]+)\s+of\s+([\d,]+)\s+matches/i);
  if (!summaryMatch) throw new BricksetCategoriasError('BRICKSET_SERIES_COBERTURA_INCOMPLETA');

  const [, startText, endText, totalText] = summaryMatch;
  const start = Number(startText.replace(/,/g, ''));
  const end = Number(endText.replace(/,/g, ''));
  const totalResults = Number(totalText.replace(/,/g, ''));
  const observedPageSize = end - start + 1;
  const pageSize = expectedPageSize ?? observedPageSize;
  const totalPages = Math.ceil(totalResults / pageSize);
  if (!Number.isInteger(pageSize) || pageSize < 1 || start !== ((expectedPage - 1) * pageSize) + 1
    || end !== Math.min(expectedPage * pageSize, totalResults) || observedPageSize !== end - start + 1
    || expectedPage > totalPages) {
    throw new BricksetCategoriasError('BRICKSET_SERIES_COBERTURA_INCOMPLETA');
  }

  const recordsById = new Map();
  const recordPattern = /<h1>\s*<a\b[^>]*href=["']\/minifigs\/([^/'"]+)(?:\/[^'"]*)?["'][^>]*>[\s\S]*?<\/a>\s*<\/h1>\s*<div class=["']tags floatleft["'][^>]*>([\s\S]*?)<\/div>/gi;
  for (const match of html.matchAll(recordPattern)) {
    const id = decodeHtmlEntities(match[1]).toUpperCase();
    if (!recordsById.has(id)) recordsById.set(id, { id, ...parseListingRecordTags(match[2]) });
  }

  if (recordsById.size !== end - start + 1) {
    throw new BricksetCategoriasError('BRICKSET_SERIES_COBERTURA_INCOMPLETA');
  }

  const lastPageLink = Math.max(0, ...[...html.matchAll(/\/minifigs\/category-Collectible-Minifigures\/page-(\d+)/gi)].map((match) => Number(match[1])));
  if (expectedPage === 1 && lastPageLink !== totalPages) {
    throw new BricksetCategoriasError('BRICKSET_SERIES_COBERTURA_INCOMPLETA');
  }

  return { page: expectedPage, pageSize, totalPages, totalResults, records: [...recordsById.values()] };
}

export function summarizeBricksetCollectibleMinifiguresYears(pages, expectedSubcategories) {
  const expectedNames = [...new Set(expectedSubcategories)];
  const firstPage = pages[0];
  const records = pages.flatMap(({ records: pageRecords }) => pageRecords);
  const ids = records.map(({ id }) => id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const recordsBySubcategory = new Map();
  for (const record of records) {
    if (!record.subcategoria) continue;
    const subcategoryRecords = recordsBySubcategory.get(record.subcategoria) ?? [];
    subcategoryRecords.push(record);
    recordsBySubcategory.set(record.subcategoria, subcategoryRecords);
  }

  const missingSubcategories = expectedNames.filter((name) => !recordsBySubcategory.has(name));
  const unexpectedSubcategories = [...recordsBySubcategory.keys()].filter((name) => !expectedNames.includes(name));
  const pagesComplete = Boolean(firstPage)
    && pages.length === firstPage.totalPages
    && pages.every((page, index) => page.page === index + 1
      && page.totalPages === firstPage.totalPages
      && page.totalResults === firstPage.totalResults
      && page.pageSize === firstPage.pageSize)
    && records.length === firstPage.totalResults
    && duplicateIds.length === 0;
  const allSeriesHaveEvidence = missingSubcategories.length === 0
    && unexpectedSubcategories.length === 0
    && expectedNames.every((name) => {
      const seriesRecords = recordsBySubcategory.get(name) ?? [];
      return seriesRecords.length > 0 && seriesRecords.every(({ anio }) => Number.isInteger(anio) && anio > 0);
    });
  const complete = pagesComplete && allSeriesHaveEvidence;

  const reportNames = [...expectedNames, ...[...recordsBySubcategory.keys()].filter((name) => !expectedNames.includes(name))];
  const series = reportNames.map((subcategoria) => {
    const seriesRecords = recordsBySubcategory.get(subcategoria) ?? [];
    const years = seriesRecords.map(({ anio }) => anio).filter((anio) => Number.isInteger(anio) && anio > 0);
    const seriesComplete = pagesComplete && seriesRecords.length > 0 && years.length === seriesRecords.length;
    const hasObservedMinimum = pagesComplete && seriesRecords.length > 0 && years.length > 0;
    return {
      subcategoria,
      anioInicio: hasObservedMinimum ? Math.min(...years) : null,
      anioInicioEstimado: hasObservedMinimum && !seriesComplete,
      registrosObservados: seriesRecords.length,
      registrosSinAnio: seriesRecords.length - years.length,
      idsSinAnio: seriesRecords.filter(({ anio }) => !Number.isInteger(anio) || anio < 1).map(({ id }) => id),
      coberturaCompleta: seriesComplete,
      fuente: BRICKSET_COLLECTIBLE_MINIFIGURES_URL,
    };
  });

  return {
    estado: complete ? 'complete' : 'incomplete',
    totalEsperado: firstPage?.totalResults ?? null,
    registrosObservados: records.length,
    paginasEsperadas: firstPage?.totalPages ?? null,
    paginasObservadas: pages.length,
    subcategoriasAusentes: missingSubcategories,
    subcategoriasNoCatalogadas: unexpectedSubcategories,
    idsDuplicados: [...new Set(duplicateIds)],
    fuentes: pages.map(({ page }) => ({
      pagina: page,
      url: page === 1 ? BRICKSET_COLLECTIBLE_MINIFIGURES_URL : `${BRICKSET_COLLECTIBLE_MINIFIGURES_URL}/page-${page}`,
    })),
    series,
  };
}

export function parseBricksetCategorias(html) {
  if (typeof html !== 'string' || html.trim() === '') {
    throw new BricksetCategoriasError('BRICKSET_CATEGORIAS_INVALIDAS');
  }

  const categorias = [];
  const pattern = /<a\b[^>]*href=["']\/minifigs\/category-[^"']+["'][^>]*>([\s\S]*?)<\/a>\s*\(([\d,]+)\)/gi;
  for (const match of html.matchAll(pattern)) {
    categorias.push({ categoria: cleanText(match[1]), total: Number(match[2].replace(/,/g, '')), subcategorias: [] });
  }

  try {
    return validateCategorias(categorias.length > 0 ? categorias : null);
  } catch (error) {
    if (error instanceof CategoriasInvalidosError) {
      throw new BricksetCategoriasError('BRICKSET_CATEGORIAS_INVALIDAS');
    }
    throw error;
  }
}

export class BricksetCategoriasScraper {
  constructor({
    fetchImpl = globalThis.fetch,
    timeoutMs = 8000,
    minIntervalMs = 9000,
    now = Date.now,
    sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration)),
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.minIntervalMs = minIntervalMs;
    this.now = now;
    this.sleep = sleep;
    this.lastRequestAt = null;
  }

  async waitForRequest() {
    if (this.lastRequestAt !== null) {
      const delay = this.lastRequestAt + this.minIntervalMs - this.now();
      if (delay > 0) await this.sleep(delay);
    }
    this.lastRequestAt = this.now();
  }

  async fetchCategorias() {
    await this.waitForRequest();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(BRICKSET_CATEGORIES_URL, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'Mozilla/5.0 LEGO Minifigures Catalog',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new BricksetCategoriasError('BRICKSET_CATEGORIAS_HTTP');
      }
      return parseBricksetCategorias(await response.text());
    } catch (error) {
      if (error instanceof BricksetCategoriasError) {
        throw error;
      }
      throw new BricksetCategoriasError(error?.name === 'AbortError' ? 'BRICKSET_CATEGORIAS_TIMEOUT' : 'BRICKSET_CATEGORIAS_NO_DISPONIBLES');
    } finally {
      clearTimeout(timeout);
    }
  }

  async fetchYearReleased(id) {
    const url = `https://brickset.com/minifigs/${encodeURIComponent(id)}`;
    await this.waitForRequest();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'Mozilla/5.0 LEGO Minifigures Catalog',
        },
        signal: controller.signal,
      });
      if (!response.ok) return { id, url, year: null, error: 'BRICKSET_SERIES_DETAIL_HTTP', status: response.status };
      const year = parseBricksetDetailYear(await response.text());
      return year === null
        ? { id, url, year: null, error: 'BRICKSET_SERIES_DETAIL_YEAR_MISSING' }
        : { id, url, year };
    } catch (error) {
      return {
        id, url, year: null,
        error: error?.name === 'AbortError' ? 'BRICKSET_SERIES_DETAIL_TIMEOUT' : 'BRICKSET_SERIES_DETAIL_NO_DISPONIBLES',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async fetchCollectibleMinifigureSeriesYears(expectedSubcategories) {
    const pages = [];
    let totalPages = 0;
    let failedPage = null;

    for (let page = 1; page <= (totalPages || 1); page += 1) {
      const url = page === 1
        ? BRICKSET_COLLECTIBLE_MINIFIGURES_URL
        : `${BRICKSET_COLLECTIBLE_MINIFIGURES_URL}/page-${page}`;
      await this.waitForRequest();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          headers: {
            accept: 'text/html,application/xhtml+xml',
            'user-agent': 'Mozilla/5.0 LEGO Minifigures Catalog',
          },
          signal: controller.signal,
        });
        if (!response.ok) throw new BricksetCategoriasError('BRICKSET_SERIES_HTTP');
        const parsedPage = parseBricksetCollectibleMinifiguresPage(await response.text(), page, pages[0]?.pageSize ?? null);
        pages.push(parsedPage);
        totalPages = parsedPage.totalPages;
      } catch (error) {
        failedPage = { page, code: error instanceof BricksetCategoriasError
          ? error.code
          : error?.name === 'AbortError' ? 'BRICKSET_SERIES_TIMEOUT' : 'BRICKSET_SERIES_NO_DISPONIBLES' };
        break;
      } finally {
        clearTimeout(timeout);
      }
    }

    const records = pages.flatMap(({ records: pageRecords }) => pageRecords);
    const recordsMissingYear = records.filter(({ anio }) => !Number.isInteger(anio) || anio < 1);
    const detailEvidence = [];
    for (const record of recordsMissingYear) {
      const detail = await this.fetchYearReleased(record.id);
      detailEvidence.push(detail);
      if (detail.year !== null) record.anio = detail.year;
    }

    const report = summarizeBricksetCollectibleMinifiguresYears(pages, expectedSubcategories);
    return {
      ...report,
      detallesConsultados: detailEvidence.filter(({ year }) => year !== null),
      detallesSinAnio: detailEvidence.filter(({ year }) => year === null),
      ...(failedPage ? { estado: 'incomplete', paginaFallida: failedPage } : {}),
    };
  }
}
