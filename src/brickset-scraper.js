const BRICKSET_BASE_URL = 'https://brickset.com/minifigs/';
const BRICKSET_SETS_BASE_URL = 'https://brickset.com/sets/';
const BRICKSET_AJAX_BASE_URL = 'https://brickset.com';
const ECB_USD_EUR_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
const EXCHANGE_RATE_CACHE_MS = 24 * 60 * 60 * 1000;
const EXCHANGE_RATE_RETRY_MS = 5 * 60 * 1000;
const DETAILS_CACHE_MS = 5 * 60 * 1000;
const DETAILS_CACHE_MAX_ENTRIES = 500;

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

function bricksetPriceContext(html) {
  const text = normalizeHtmlText(html);
  const priceStart = text.search(/Current\s*Value/i);
  return priceStart < 0 ? 'Current Value not found' : text.slice(priceStart, priceStart + 240);
}

function parseBricksetPriceQuote(html) {
  const text = normalizeHtmlText(html);
  if (/Current\s*Value\s*[-–—]?\s*New\s*[:\-–—]?\s*Not\s+known/i.test(text)) {
    return null;
  }
  const amount = '[0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?';
  const priceMatch = text.match(new RegExp(
    `Current\\s*Value\\s*[-–—]?\\s*New\\s*[:\\-–—]?\\s*(?:[~≈]\\s*)?(?:([€$])\\s*(${amount})|(${amount})\\s*([€$]))`,
    'i',
  ));
  const value = priceMatch ? parseAmount(priceMatch[2] ?? priceMatch[3]) : null;
  if (value === null) {
    throw new BricksetPriceError();
  }
  const currencySymbol = priceMatch[1] ?? priceMatch[4];
  return { amount: value, currency: currencySymbol === '$' ? 'USD' : 'EUR' };
}

export function parseBricksetPrice(html) {
  const quote = parseBricksetPriceQuote(html);
  if (quote === null) return null;
  if (quote.currency !== 'EUR') throw new BricksetPriceError('BRICKSET_MONEDA_NO_SOPORTADA');
  return quote.amount;
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

function parseBricksetDetailFields(html) {
  const name = matchDetailField(html, 'Name');
  const categoria = matchDetailField(html, 'Category');
  const subcategoria = matchDetailField(html, 'Subcategory');
  const anioText = matchDetailField(html, 'Year released');

  if (!categoria || !anioText || !/^\d+$/.test(anioText)) {
    throw new BricksetPriceError('BRICKSET_DETALLES_NO_DISPONIBLES');
  }

  const nombreCompleto = name ? decodeMinifigEntities(name) : null;
  return {
    ...(nombreCompleto ? { nombreCompleto, ...parseBricksetName(nombreCompleto) } : {}),
    categoria: decodeMinifigEntities(categoria),
    subcategoria: subcategoria ? decodeMinifigEntities(subcategoria) : undefined,
    anio: Number(anioText) || undefined,
  };
}

function parseBricksetName(name) {
  const separator = name.indexOf(' - ');
  return separator >= 0
    ? { nombre: name.slice(0, separator).trim(), descripcion: name.slice(separator + 3).trim() || null }
    : { nombre: name.split(',')[0].trim(), descripcion: null };
}

function normalizeBricksetSetNumber(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BricksetPriceError('BRICKSET_SET_INVALIDO');
  }
  const match = value.trim().toUpperCase().match(/^([A-Z0-9]+)(?:-(\d+))?$/);
  if (!match) throw new BricksetPriceError('BRICKSET_SET_INVALIDO');
  return `${match[1]}-${match[2] ?? '1'}`;
}

function parseBricksetSetSearch(html, baseNumber) {
  const resultsText = html.match(/<div\b[^>]*class=['"][^'"]*\bresults\b[^'"]*['"][^>]*>([\s\S]*?)<\/div>/i)?.[1];
  const range = resultsText && normalizeHtmlText(resultsText).match(/^(\d+) to (\d+) of (\d+) matches$/i);
  const headings = [...html.matchAll(/<h1\b[^>]*>\s*<a\b[^>]*href=['"]\/sets\/([a-z0-9]+-\d+)(?:\/[^'"]*)?['"][^>]*>([\s\S]*?)<\/a>\s*<\/h1>/gi)];
  if (!range || (Number(range[3]) > 0 && headings.length === 0)) {
    throw new BricksetPriceError('BRICKSET_SET_DETALLES_NO_DISPONIBLES');
  }
  const lastResult = Number(range[2]);
  const total = Number(range[3]);
  if (!Number.isSafeInteger(lastResult) || !Number.isSafeInteger(total) || lastResult > total) {
    throw new BricksetPriceError('BRICKSET_SET_DETALLES_NO_DISPONIBLES');
  }
  const complete = headings.find(([, number, name]) => (
    number.toUpperCase().split('-')[0] === baseNumber && /\bComplete\b/i.test(normalizeHtmlText(name))
  ));
  return { completeSetNumber: complete?.[1].toUpperCase(), lastResult, total };
}

function parseBricksetSetMinifigureIds(html) {
  const articles = [...html.matchAll(/<article\b[^>]*class=['"][^'"]*\bset\b[^'"]*['"][^>]*>[\s\S]*?<\/article>/gi)];
  if (articles.length === 0) {
    throw new BricksetPriceError('BRICKSET_SET_DETALLES_NO_DISPONIBLES');
  }

  const ids = [];
  for (const [article] of articles) {
    const match = article.match(/<h1\b[^>]*>[\s\S]*?<a\b[^>]*href=['"]\/minifigs\/([a-z0-9_-]+)(?:\/[^'"]*)?['"]/i);
    if (!match) throw new BricksetPriceError('BRICKSET_SET_DETALLES_NO_DISPONIBLES');
    const id = match[1].toUpperCase();
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function parseBricksetDetails(html) {
  return { ...parseBricksetDetailFields(html), precio: parseBricksetPrice(html) };
}

export class BricksetScraper {
  constructor({
    fetchImpl = globalThis.fetch,
    exchangeRateFetchImpl = globalThis.fetch,
    exchangeRateCacheMs = EXCHANGE_RATE_CACHE_MS,
    exchangeRateRetryMs = EXCHANGE_RATE_RETRY_MS,
    detailsCacheMs = DETAILS_CACHE_MS,
    detailsCacheMaxEntries = DETAILS_CACHE_MAX_ENTRIES,
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
    this.exchangeRateFetchImpl = exchangeRateFetchImpl;
    this.exchangeRateCacheMs = exchangeRateCacheMs;
    this.exchangeRateRetryMs = exchangeRateRetryMs;
    this.detailsCacheMs = detailsCacheMs;
    this.detailsCacheMaxEntries = detailsCacheMaxEntries;
    this.detailsCache = new Map();
    this.detailsRequests = new Map();
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
    this.usdToEurRate = null;
    this.usdToEurRetryAfter = 0;
    this.usdToEurPromise = null;
  }

  async _fetchUsdToEurRate(signal) {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timeout = this.setTimeoutImpl(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.exchangeRateFetchImpl(ECB_USD_EUR_URL, {
        headers: { accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('ECB exchange-rate request failed');
      const xml = await response.text();
      const rateMatch = xml.match(/<Cube\b(?=[^>]*\bcurrency=["']USD["'])(?=[^>]*\brate=["']([0-9]+(?:\.[0-9]+)?)["'])[^>]*\/?\s*>/i);
      const rate = rateMatch ? Number(rateMatch[1]) : NaN;
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('ECB USD rate missing');
      this.usdToEurRate = { rate, fetchedAt: this.now() };
      this.usdToEurRetryAfter = 0;
      return rate;
    } catch {
      this.usdToEurRetryAfter = this.now() + this.exchangeRateRetryMs;
      throw new BricksetPriceError('BRICKSET_TIPO_CAMBIO_NO_DISPONIBLE');
    } finally {
      this.clearTimeoutImpl(timeout);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async _getUsdToEurRate(signal) {
    if (this.usdToEurRate && this.now() - this.usdToEurRate.fetchedAt < this.exchangeRateCacheMs) {
      return this.usdToEurRate.rate;
    }
    if (this.now() < this.usdToEurRetryAfter) {
      throw new BricksetPriceError('BRICKSET_TIPO_CAMBIO_NO_DISPONIBLE');
    }
    if (!this.usdToEurPromise) {
      this.usdToEurPromise = this._fetchUsdToEurRate(signal);
    }
    const request = this.usdToEurPromise;
    try {
      return await request;
    } finally {
      if (this.usdToEurPromise === request) this.usdToEurPromise = null;
    }
  }

  async _priceInEur(quote, signal) {
    if (quote.currency === 'EUR') return quote.amount;
    const usdPerEur = await this._getUsdToEurRate(signal);
    return Math.round((quote.amount / usdPerEur) * 100) / 100;
  }

  async _fetchHtml(id, signal) {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new BricksetPriceError('BRICKSET_ID_INVALIDO');
    }

    return this._fetchUrl(`${BRICKSET_BASE_URL}${encodeURIComponent(id.trim())}`, signal);
  }

  async _fetchUrl(url, signal, additionalHeaders = {}) {
    const operation = this.queue.then(() => this._fetchHtmlQueued(url, signal, additionalHeaders));
    this.queue = operation.catch(() => {});
    return operation;
  }

  async getSetMinifigures(input, { signal } = {}) {
    let setNumber = normalizeBricksetSetNumber(input);
    if (!input.trim().includes('-')) {
      const baseNumber = input.trim().toUpperCase();
      let lastResult = -1;
      for (let page = 1; ; page += 1) {
        const searchUrl = `https://brickset.com/sets${page === 1 ? '' : `/page-${page}`}?query=${encodeURIComponent(baseNumber)}`;
        const { html: searchHtml } = await this._fetchUrl(searchUrl, signal);
        const result = parseBricksetSetSearch(searchHtml, baseNumber);
        if (result.lastResult <= lastResult) {
          throw new BricksetPriceError('BRICKSET_SET_DETALLES_NO_DISPONIBLES');
        }
        if (result.completeSetNumber) {
          setNumber = result.completeSetNumber;
          break;
        }
        if (result.lastResult === result.total) break;
        lastResult = result.lastResult;
      }
    }
    const setUrl = `${BRICKSET_SETS_BASE_URL}${encodeURIComponent(setNumber)}`;
    const { html } = await this._fetchUrl(setUrl, signal);
    if (/href=['"]\/ajax\/sets\/nominifigs(?:['"?])/i.test(html)) {
      return { setNumber, minifigures: [] };
    }

    const inventoryPath = html.match(/href=['"](\/ajax\/sets\/minifigs\?setID=\d+)['"]/i)?.[1];
    if (!inventoryPath) {
      throw new BricksetPriceError('BRICKSET_SET_DETALLES_NO_DISPONIBLES');
    }
    const inventoryUrl = `${BRICKSET_AJAX_BASE_URL}${inventoryPath.replace(/&amp;/gi, '&')}`;
    const { html: inventoryHtml } = await this._fetchUrl(inventoryUrl, signal, {
      accept: 'text/html, */*; q=0.01',
      referer: setUrl,
      'x-requested-with': 'XMLHttpRequest',
    });
    return {
      setNumber,
      minifigures: parseBricksetSetMinifigureIds(inventoryHtml),
    };
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

  async _fetchHtmlQueued(url, signal, additionalHeaders = {}) {
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
            ...additionalHeaders,
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

  async getNames(id, { signal } = {}) {
    const nombreCompleto = await this.getFullName(id, { signal });
    const fields = nombreCompleto ? parseBricksetName(nombreCompleto) : null;
    if (!fields?.nombre) throw new BricksetPriceError('BRICKSET_NOMBRE_NO_DISPONIBLE');
    return { nombre: fields.nombre, descripcion: fields.descripcion };
  }

  async getFullName(id, { signal } = {}) {
    const { html } = await this._fetchHtml(id, signal);
    const name = matchDetailField(html, 'Name');
    const nombreCompleto = name ? decodeMinifigEntities(name) : null;
    if (!nombreCompleto) throw new BricksetPriceError('BRICKSET_NOMBRE_NO_DISPONIBLE');
    return nombreCompleto;
  }

  async getPrice(id, { signal } = {}) {
    const { html, url } = await this._fetchHtml(id, signal);
    let quote;
    try {
      quote = parseBricksetPriceQuote(html);
    } catch {
      console.error(`[BricksetScraper] No se extrajo 'Current Value - New' de ${url}. Current Value: ${bricksetPriceContext(html)}`);
      throw new BricksetPriceError();
    }
    if (quote === null) {
      console.warn(`[BricksetScraper] Brickset indica 'Not known' para ${url}; se reintentará en futuras sincronizaciones.`);
      return null;
    }
    return this._priceInEur(quote, signal);
  }

  async getDetails(id, { signal } = {}) {
    if (typeof id !== 'string' || !id.trim()) throw new BricksetPriceError('BRICKSET_ID_INVALIDO');
    if (signal?.aborted) throw new BricksetPriceError('BRICKSET_CANCELADO');
    const key = id.trim().toLowerCase();
    const cached = this.detailsCache.get(key);
    if (cached && cached.expiresAt > this.now()) {
      this.detailsCache.delete(key);
      this.detailsCache.set(key, cached);
      return { ...cached.details };
    }
    this.detailsCache.delete(key);
    const pending = !signal && this.detailsRequests.get(key);
    if (pending) return { ...await pending };
    const operation = this._getDetailsUncached(id.trim(), { signal }).then((details) => {
      if (signal?.aborted) throw new BricksetPriceError('BRICKSET_CANCELADO');
      if (this.detailsCacheMs > 0 && this.detailsCacheMaxEntries > 0 && details.nombre?.trim()) {
        while (this.detailsCache.size >= this.detailsCacheMaxEntries) {
          this.detailsCache.delete(this.detailsCache.keys().next().value);
        }
        this.detailsCache.set(key, { details: { ...details }, expiresAt: this.now() + this.detailsCacheMs });
      }
      return details;
    });
    if (!signal) this.detailsRequests.set(key, operation);
    try {
      return { ...await operation };
    } finally {
      if (this.detailsRequests.get(key) === operation) this.detailsRequests.delete(key);
    }
  }

  async _getDetailsUncached(id, { signal } = {}) {
    const { html, url } = await this._fetchHtml(id, signal);
    let details;
    let quote;
    try {
      details = parseBricksetDetailFields(html);
      quote = parseBricksetPriceQuote(html);
    } catch {
      console.error(`[BricksetScraper] No se extrajeron los detalles de ${url}. Current Value: ${bricksetPriceContext(html)}`);
      throw new BricksetPriceError('BRICKSET_DETALLES_NO_DISPONIBLES');
    }
    if (quote === null) {
      console.warn(`[BricksetScraper] Brickset indica 'Not known' para ${url}; se reintentará en futuras sincronizaciones.`);
    }
    return { ...details, precio: quote === null ? null : await this._priceInEur(quote, signal) };
  }
}
