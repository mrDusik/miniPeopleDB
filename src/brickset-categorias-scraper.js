import { validateCategorias, CategoriasInvalidosError } from './categorias-repository.js';

const BRICKSET_CATEGORIES_URL = 'https://brickset.com/browse/minifigs';

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
  constructor({ fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async fetchCategorias() {
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
}
