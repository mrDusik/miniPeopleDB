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

function decodeMinifigEntities(value) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&eacute;/gi, 'é')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function matchDetailField(html, label) {
  const pattern = new RegExp(`<dt>\\s*${label}\\s*<\\/dt>\\s*<dd>(?:<a[^>]*>)?([^<]+)(?:<\\/a>)?<\\/dd>`, 'i');
  const match = html.match(pattern);
  return match ? match[1].trim() : null;
}

export function parseBricksetDetails(html) {
  const categoria = matchDetailField(html, 'Category');
  const subcategoria = matchDetailField(html, 'Subcategory');
  const anioText = matchDetailField(html, 'Year released');

  if (!categoria || !anioText || !/^\d+$/.test(anioText)) {
    throw new BricksetPriceError('BRICKSET_DETALLES_NO_DISPONIBLES');
  }

  return {
    categoria: decodeMinifigEntities(categoria),
    subcategoria: subcategoria ? decodeMinifigEntities(subcategoria) : undefined,
    anio: Number(anioText) || undefined,
    precio: parseBricksetPrice(html),
  };
}

export class BricksetScraper {
  constructor({
    fetchImpl = globalThis.fetch,
    timeoutMs = 8000,
    retries = 0,
    minIntervalMs = 9000,
    defaultRetryAfterMs = 60000,
    maxRateLimitRetries = 3,
    now = Date.now,
    sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration)),
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.retries = retries;
    this.minIntervalMs = minIntervalMs;
    this.defaultRetryAfterMs = defaultRetryAfterMs;
    this.maxRateLimitRetries = maxRateLimitRetries;
    this.now = now;
    this.sleep = sleep;
    this.setTimeoutImpl = setTimeoutImpl;
    this.clearTimeoutImpl = clearTimeoutImpl;
    this.queue = Promise.resolve();
    this.lastRequestAt = null;
    this.blockedUntil = 0;
  }

  async _fetchHtml(id, signal) {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new BricksetPriceError('BRICKSET_ID_INVALIDO');
    }

    const operation = this.queue.then(() => this._fetchHtmlQueued(id, signal));
    this.queue = operation.catch(() => {});
    return operation;
  }

  async _wait(duration, signal) {
    if (duration > 0) {
      if (!signal) {
        await this.sleep(duration);
        return;
      }
      await new Promise((resolve, reject) => {
        if (signal.aborted) {
          reject(new BricksetPriceError('BRICKSET_CANCELADO'));
          return;
        }
        const timeout = this.setTimeoutImpl(() => {
          signal.removeEventListener('abort', onAbort);
          resolve();
        }, duration);
        const onAbort = () => {
          this.clearTimeoutImpl(timeout);
          reject(new BricksetPriceError('BRICKSET_CANCELADO'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
      });
    }
  }

  parseRetryAfter(response) {
    const value = response.headers?.get('retry-after');
    if (!value) {
      return this.defaultRetryAfterMs;
    }
    if (/^\d+(?:\.\d+)?$/.test(value.trim())) {
      return Number(value) * 1000;
    }
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? Math.max(0, timestamp - this.now()) : this.defaultRetryAfterMs;
  }

  async _fetchHtmlQueued(id, signal) {
    const url = `${BRICKSET_BASE_URL}${encodeURIComponent(id)}`;
    let lastError;
    let rateLimitRetries = 0;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const waitUntil = this.lastRequestAt === null
        ? this.blockedUntil
        : Math.max(this.blockedUntil, this.lastRequestAt + this.minIntervalMs);
      await this._wait(waitUntil - this.now(), signal);
      if (signal?.aborted) throw new BricksetPriceError('BRICKSET_CANCELADO');
      this.lastRequestAt = this.now();
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      signal?.addEventListener('abort', onAbort, { once: true });
      const timeout = this.setTimeoutImpl(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          headers: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'accept-language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36',
          },
          signal: controller.signal,
        });
        if (response.status === 429) {
          if (rateLimitRetries >= this.maxRateLimitRetries) {
            throw new BricksetPriceError('BRICKSET_LIMITE');
          }
          const retryAfter = this.parseRetryAfter(response);
          this.blockedUntil = this.now() + retryAfter;
          rateLimitRetries += 1;
          attempt -= 1;
          continue;
        }
        if (!response.ok) {
          console.error(`[BricksetScraper] HTTP ${response.status} al consultar ${url}`);
          const error = new BricksetPriceError(response.status === 404 ? 'BRICKSET_NO_ENCONTRADO' : 'BRICKSET_NO_DISPONIBLE');
          error.noRetry = true;
          throw error;
        }
        return { html: await response.text(), url };
      } catch (error) {
        lastError = error instanceof BricksetPriceError
          ? error
          : new BricksetPriceError(error?.name === 'AbortError' ? 'BRICKSET_TIMEOUT' : 'BRICKSET_NO_DISPONIBLE');
        if (lastError.code === 'BRICKSET_LIMITE' || error?.noRetry || (error instanceof BricksetPriceError && !['BRICKSET_TIMEOUT', 'BRICKSET_NO_DISPONIBLE'].includes(error.code))) {
          throw lastError;
        }
        if (!(error instanceof BricksetPriceError)) {
          console.error(`[BricksetScraper] Error de red al consultar ${url}: ${error?.message ?? error}`);
        }
      } finally {
        this.clearTimeoutImpl(timeout);
        signal?.removeEventListener('abort', onAbort);
      }
    }
    throw lastError ?? new BricksetPriceError();
  }

  async getPrice(id, { signal } = {}) {
    const { html, url } = await this._fetchHtml(id, signal);
    try {
      return parseBricksetPrice(html);
    } catch (error) {
      console.error(`[BricksetScraper] No se extrajo 'Current Value - New' de ${url}. Respuesta: ${html.slice(0, 500)}`);
      throw error;
    }
  }

  async getDetails(id, { signal } = {}) {
    const { html, url } = await this._fetchHtml(id, signal);
    try {
      return parseBricksetDetails(html);
    } catch (error) {
      console.error(`[BricksetScraper] No se extrajeron los detalles de ${url}. Respuesta: ${html.slice(0, 500)}`);
      throw error;
    }
  }
}
