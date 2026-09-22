const BRICKSET_BASE_URL = 'https://brickset.com/minifigs/';

export class BricksetPriceError extends Error {
  constructor(code = 'BRICKSET_PRECIO_NO_DISPONIBLE') {
    super('No se pudo obtener el precio de Brickset');
    this.name = 'BricksetPriceError';
    this.code = code;
  }
}

function parseAmount(text) {
  const normalized = text.replace(/\s/g, '').replace(/[~≈€]/g, '');
  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  let numeric = normalized;

  if (lastComma > lastDot) {
    numeric = normalized.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && normalized.match(/\.\d{3}$/) && !normalized.includes(',')) {
    numeric = normalized.replace('.', '');
  } else {
    numeric = normalized.replace(/,/g, '');
  }

  const value = Number(numeric);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizeHtmlText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&euro;|&#8364;/gi, '€')
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseBricksetPrice(html) {
  const text = normalizeHtmlText(html);
  const priceMatch = text.match(/Current\s*Value\s*[-–—]?\s*New[\s\S]{0,250}?[~≈]?\s*(?:€\s*)?([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)\s*€?/i);
  const value = priceMatch ? parseAmount(priceMatch[1]) : null;
  if (value === null) {
    throw new BricksetPriceError();
  }
  return value;
}

export class BricksetScraper {
  constructor({ fetchImpl = globalThis.fetch, timeoutMs = 8000, retries = 1 } = {}) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.retries = retries;
  }

  async getPrice(id) {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new BricksetPriceError('BRICKSET_ID_INVALIDO');
    }

    const url = `${BRICKSET_BASE_URL}${encodeURIComponent(id)}`;
    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          headers: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'accept-language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36',
          },
          signal: controller.signal,
        });
        if (!response.ok) {
          console.error(`[BricksetScraper] HTTP ${response.status} al consultar ${url}`);
          throw new BricksetPriceError(response.status === 404 ? 'BRICKSET_NO_ENCONTRADO' : 'BRICKSET_NO_DISPONIBLE');
        }
        const html = await response.text();
        try {
          return parseBricksetPrice(html);
        } catch (error) {
          console.error(`[BricksetScraper] No se extrajo 'Current Value - New' de ${url}. Respuesta: ${html.slice(0, 500)}`);
          throw error;
        }
      } catch (error) {
        lastError = error instanceof BricksetPriceError
          ? error
          : new BricksetPriceError(error?.name === 'AbortError' ? 'BRICKSET_TIMEOUT' : 'BRICKSET_NO_DISPONIBLE');
        if (!(error instanceof BricksetPriceError)) {
          console.error(`[BricksetScraper] Error de red al consultar ${url}: ${error?.message ?? error}`);
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError ?? new BricksetPriceError();
  }
}
