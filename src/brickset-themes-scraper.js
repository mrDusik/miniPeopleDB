import { validateTemas, TemasInvalidosError } from './temas-repository.js';

const BRICKSET_THEMES_URL = 'https://brickset.com/browse/minifigs';

export class BricksetThemesError extends Error {
  constructor(code = 'BRICKSET_TEMAS_NO_DISPONIBLES') {
    super('No se pudieron obtener los temas de Brickset');
    this.name = 'BricksetThemesError';
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

export function parseBricksetThemes(html) {
  if (typeof html !== 'string' || html.trim() === '') {
    throw new BricksetThemesError('BRICKSET_TEMAS_INVALIDOS');
  }

  const themes = [];
  const pattern = /<a\b[^>]*href=["']\/minifigs\/category-[^"']+["'][^>]*>([\s\S]*?)<\/a>\s*\(([\d,]+)\)/gi;
  for (const match of html.matchAll(pattern)) {
    themes.push({ tema: cleanText(match[1]), total: Number(match[2].replace(/,/g, '')) });
  }

  try {
    return validateTemas(themes.length > 0 ? themes : null);
  } catch (error) {
    if (error instanceof TemasInvalidosError) {
      throw new BricksetThemesError('BRICKSET_TEMAS_INVALIDOS');
    }
    throw error;
  }
}

export class BricksetThemesScraper {
  constructor({ fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async fetchThemes() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(BRICKSET_THEMES_URL, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'Mozilla/5.0 LEGO Minifigures Catalog',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new BricksetThemesError('BRICKSET_TEMAS_HTTP');
      }
      return parseBricksetThemes(await response.text());
    } catch (error) {
      if (error instanceof BricksetThemesError) {
        throw error;
      }
      throw new BricksetThemesError(error?.name === 'AbortError' ? 'BRICKSET_TEMAS_TIMEOUT' : 'BRICKSET_TEMAS_NO_DISPONIBLES');
    } finally {
      clearTimeout(timeout);
    }
  }
}