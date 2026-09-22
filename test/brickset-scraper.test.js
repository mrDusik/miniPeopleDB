import assert from 'node:assert/strict';
import test from 'node:test';
import { BricksetPriceError, BricksetScraper, parseBricksetPrice } from '../src/brickset-scraper.js';

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
