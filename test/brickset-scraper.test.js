import assert from 'node:assert/strict';
import test from 'node:test';
import { BricksetPriceError, BricksetScraper, parseBricksetDetails, parseBricksetPrice } from '../src/brickset-scraper.js';

test('extrae Current Value - New en Euros y construye la URL publica', async () => {
  let requestedUrl;
  let requestedOptions;
  const scraper = new BricksetScraper({
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestedOptions = options;
      return new Response('<div>Current Value - New</div><span>€12,50</span>', { status: 200 });
    },
  });

  assert.equal(await scraper.getPrice('col079'), 12.5);
  assert.equal(requestedUrl, 'https://brickset.com/minifigs/col079');
  assert.match(requestedOptions.headers['user-agent'], /Chrome\/136/);
  assert.match(requestedOptions.headers['accept-language'], /es-ES/);
});

test('tolera HTML, saltos de linea y el prefijo ~€ alrededor del precio', () => {
  assert.equal(parseBricksetPrice(`
    <dt>Current<br> Value</dt>
    <dd> - New</dd>
    <span>~€\n 1.234,56</span>
  `), 1234.56);
  assert.equal(parseBricksetPrice('<p>Current Value - New</p><span>1.234 €</span>'), 1234);
  assert.equal(parseBricksetPrice('<p>Current Value - New</p><span>12.34 €</span>'), 12.34);
});

test('reintenta un timeout y devuelve un error controlado si no hay precio', async () => {
  let attempts = 0;
  const scraper = new BricksetScraper({
    retries: 1,
    fetchImpl: async () => {
      attempts += 1;
      const error = new Error('timeout');
      error.name = 'AbortError';
      throw error;
    },
  });

  await assert.rejects(() => scraper.getPrice('missing'), (error) => {
    assert.ok(error instanceof BricksetPriceError);
    assert.equal(error.code, 'BRICKSET_TIMEOUT');
    return true;
  });
  assert.equal(attempts, 2);
  assert.throws(() => parseBricksetPrice('<p>Current Value - New</p>'), (error) => error instanceof BricksetPriceError);
});

test('registra errores HTTP, de extracción y de red con contexto de Brickset', async () => {
  const originalError = console.error;
  const messages = [];
  console.error = (...args) => messages.push(args.join(' '));

  try {
    const httpScraper = new BricksetScraper({
      retries: 0,
      fetchImpl: async () => new Response('bloqueado', { status: 403 }),
    });
    await assert.rejects(() => httpScraper.getPrice('blocked'), BricksetPriceError);

    const extractionScraper = new BricksetScraper({
      retries: 0,
      fetchImpl: async () => new Response('<html>sin precio</html>', { status: 200 }),
    });
    await assert.rejects(() => extractionScraper.getPrice('without-price'), BricksetPriceError);

    const networkScraper = new BricksetScraper({
      retries: 0,
      fetchImpl: async () => { throw new Error('conexion rechazada'); },
    });
    await assert.rejects(() => networkScraper.getPrice('offline'), BricksetPriceError);
  } finally {
    console.error = originalError;
  }

  assert.ok(messages.some((message) => message.includes('HTTP 403') && message.includes('/blocked')));
  assert.ok(messages.some((message) => message.includes('No se extrajo') && message.includes('/without-price')));
  assert.ok(messages.some((message) => message.includes('Error de red') && message.includes('/offline')));
});

test('parseBricksetDetails extrae categoria, subcategoria, anio y precio', () => {
  const html = "<dl><dt>Minifig number</dt><dd>col079</dd><dt>Category</dt><dd><a href='/minifigs/category-Collectible-Minifigures'>Collectible Minifigures</a></dd><dt>Subcategory</dt><dd><a href='/minifigs/category-Collectible-Minifigures/subcategory-Team-GB'>Team GB</a></dd><dt>Year released</dt><dd><a href='/minifigs/year-2012'>2012</a></dd></dl><p>Current Value - New</p><span>€9.07</span>";
  assert.deepEqual(parseBricksetDetails(html), {
    categoria: 'Collectible Minifigures',
    subcategoria: 'Team GB',
    anio: 2012,
    precio: 9.07,
  });
});

test('parseBricksetDetails admite ausencia de subcategoria y rechaza HTML sin categoria o sin anio', () => {
  const sinSubcategoria = "<dl><dt>Minifig number</dt><dd>st999</dd><dt>Category</dt><dd><a href='/minifigs/category-Space'>Space</a></dd><dt>Year released</dt><dd><a href='/minifigs/year-2020'>2020</a></dd></dl><p>Current Value - New</p><span>€5</span>";
  assert.deepEqual(parseBricksetDetails(sinSubcategoria), {
    categoria: 'Space',
    subcategoria: undefined,
    anio: 2020,
    precio: 5,
  });

  assert.throws(() => parseBricksetDetails('<html>sin datos</html>'), (error) => error instanceof BricksetPriceError);
  assert.throws(
    () => parseBricksetDetails("<dl><dt>Category</dt><dd><a href='/minifigs/category-Space'>Space</a></dd></dl>"),
    (error) => error instanceof BricksetPriceError,
  );
});

test('parseBricksetDetails compacta espacios internos de los campos', () => {
  const html = "<dl><dt>Category</dt><dd><a href='/minifigs/category-Collectible-Minifigures'>Collectible  Minifigures</a></dd><dt>Subcategory</dt><dd><a href='/minifigs/category-Collectible-Minifigures/subcategory-Series-3-Minifigures'>Series  3 Minifigures</a></dd><dt>Year released</dt><dd>2011</dd></dl><p>Current Value - New</p><span>€6.28</span>";
  assert.deepEqual(parseBricksetDetails(html), {
    categoria: 'Collectible Minifigures',
    subcategoria: 'Series 3 Minifigures',
    anio: 2011,
    precio: 6.28,
  });
});

test('parseBricksetDetails omite un año Brickset igual a cero', () => {
  const html = "<dl><dt>Category</dt><dd>Space</dd><dt>Year released</dt><dd>0</dd></dl><p>Current Value - New</p><span>€1</span>";
  assert.deepEqual(parseBricksetDetails(html), {
    categoria: 'Space',
    subcategoria: undefined,
    anio: undefined,
    precio: 1,
  });
});

test('BricksetScraper.getDetails reutiliza la misma peticion que getPrice', async () => {
  let requestedUrl;
  const scraper = new BricksetScraper({
    fetchImpl: async (url) => {
      requestedUrl = url;
      return new Response(
        "<dl><dt>Minifig number</dt><dd>col079</dd><dt>Category</dt><dd><a href='/minifigs/category-Collectible-Minifigures'>Collectible Minifigures</a></dd><dt>Subcategory</dt><dd><a href='/minifigs/category-Collectible-Minifigures/subcategory-Team-GB'>Team GB</a></dd><dt>Year released</dt><dd><a href='/minifigs/year-2012'>2012</a></dd></dl><p>Current Value - New</p><span>€9.07</span>",
        { status: 200 },
      );
    },
  });

  assert.deepEqual(await scraper.getDetails('col079'), {
    categoria: 'Collectible Minifigures',
    subcategoria: 'Team GB',
    anio: 2012,
    precio: 9.07,
  });
  assert.equal(requestedUrl, 'https://brickset.com/minifigs/col079');
});

test('serializa peticiones y respeta el intervalo minimo', async () => {
  let clock = 0;
  const starts = [];
  const scraper = new BricksetScraper({
    minIntervalMs: 100,
    now: () => clock,
    sleep: async (duration) => { clock += duration; },
    fetchImpl: async () => {
      starts.push(clock);
      return new Response('<p>Current Value - New</p><span>€1</span>', { status: 200 });
    },
  });

  await Promise.all([scraper.getPrice('a'), scraper.getPrice('b'), scraper.getPrice('c')]);
  assert.deepEqual(starts, [0, 100, 200]);
});

test('reintenta 429 respetando Retry-After en segundos y fecha HTTP', async () => {
  let clock = 1_000;
  const waits = [];
  let attempts = 0;
  const scraper = new BricksetScraper({
    minIntervalMs: 0,
    now: () => clock,
    sleep: async (duration) => { waits.push(duration); clock += duration; },
    maxRateLimitRetries: 2,
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) return new Response('', { status: 429, headers: { 'Retry-After': '30' } });
      if (attempts === 2) return new Response('', { status: 429, headers: { 'Retry-After': new Date(clock + 45_000).toUTCString() } });
      return new Response('<p>Current Value - New</p><span>€2</span>', { status: 200 });
    },
  });

  assert.equal(await scraper.getPrice('a'), 2);
  assert.deepEqual(waits, [30_000, 45_000]);
});

test('usa la espera por defecto para 429 sin Retry-After y falla con BRICKSET_LIMITE', async () => {
  let clock = 0;
  let attempts = 0;
  const scraper = new BricksetScraper({
    minIntervalMs: 0,
    defaultRetryAfterMs: 500,
    maxRateLimitRetries: 2,
    now: () => clock,
    sleep: async (duration) => { clock += duration; },
    fetchImpl: async () => {
      attempts += 1;
      return new Response('', { status: 429 });
    },
  });

  await assert.rejects(() => scraper.getPrice('a'), (error) => error.code === 'BRICKSET_LIMITE');
  assert.equal(attempts, 3);
  assert.equal(clock, 1_000);
});

test('no reintenta errores HTTP distintos de 429', async () => {
  let attempts = 0;
  const scraper = new BricksetScraper({
    retries: 3,
    minIntervalMs: 0,
    fetchImpl: async () => {
      attempts += 1;
      return new Response('', { status: 503 });
    },
  });

  await assert.rejects(() => scraper.getPrice('a'), (error) => error.code === 'BRICKSET_NO_DISPONIBLE');
  assert.equal(attempts, 1);
});
