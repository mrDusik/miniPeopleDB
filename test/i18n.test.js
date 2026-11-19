import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { startTestServer } from '../test-support/server.js';

const engineScript = await readFile(new URL('../node_modules/i18next/dist/umd/i18next.min.js', import.meta.url), 'utf8');
const adapterScript = await readFile(new URL('../public/i18n.js', import.meta.url), 'utf8');
const catalogs = {
  es: {
    'test.greeting': 'Hola, {{username}}',
    'test.count_one': '{{count}} minipersona',
    'test.count_other': '{{count}} minipersonas',
    'test.fallback': 'Texto de respaldo',
  },
  en: {
    'test.greeting': 'Hello, {{username}}',
    'test.count_one': '{{count}} miniperson',
    'test.count_other': '{{count}} minipeople',
  },
  it: {
    'test.greeting': 'Ciao, {{username}}',
    'test.count_one': '{{count}} minipersona',
    'test.count_other': '{{count}} minipersone',
  },
  fr: {
    'test.greeting': 'Bonjour, {{username}}',
    'test.count_one': '{{count}} minipersonne',
    'test.count_other': '{{count}} minipeople',
  },
};

test('el catálogo español usa minipersona en el histórico y en los contadores', async () => {
  const spanish = JSON.parse(await readFile(new URL('../public/locales/es.json', import.meta.url), 'utf8'));
  assert.equal(spanish['common.figures'], 'Minipersonas');
  assert.equal(spanish['history.figureCount'], 'Minipersonas en colección: {{count}}');
  assert.equal(spanish['inventory.count_one'], '{{count}} minipersona');
  assert.equal(spanish['inventory.count_other'], '{{count}} minipersonas');
});

test('la descripción francesa de Collector usa una frase corta para el modal DNA', async () => {
  const french = JSON.parse(await readFile(new URL('../public/locales/fr.json', import.meta.url), 'utf8'));
  assert.equal(french['gamification.collectorDescription'], 'Collectionnez et complétez des séries.');
});

function createBrowser({ fetchCatalog, remembered, unavailableStorage = false } = {}) {
  const dom = new JSDOM(`<!doctype html><html lang="es"><body>
    <span data-i18n="test.fallback"></span>
    <button data-i18n-aria-label="test.fallback"><img alt=""><span>Untouched</span></button>
    <p id="external">Nombre de Brickset</p><input value="edited">
  </body></html>`, { url: 'https://app.example.invalid/', runScripts: 'outside-only' });
  const { window } = dom;
  const requests = [];
  const warnings = [];
  window.console.warn = (...args) => warnings.push(args);
  if (remembered !== undefined) window.localStorage.setItem('minipeople.language', remembered);
  if (unavailableStorage) {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage disabled'); } });
  }
  window.fetch = async (url) => {
    const language = /\/(es|en|it|fr)\.json$/.exec(url)?.[1];
    requests.push(language);
    if (fetchCatalog) return fetchCatalog(language);
    return { ok: true, json: async () => catalogs[language] };
  };
  window.eval(engineScript);
  window.eval(adapterScript);
  return { dom, window, i18n: window.MiniPeopleI18n, requests, warnings };
}

test('la interfaz no muestra Brickset en etiquetas o mensajes del formulario', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const document = new JSDOM(html).window.document;
  assert.equal(document.querySelector('#form-brickset-price-label').textContent, 'Precio de mercado');
  assert.equal(document.querySelector('#individual-create-preview').getAttribute('aria-label'), 'Vista previa');

  for (const language of ['es', 'en', 'fr', 'it']) {
    const catalog = JSON.parse(await readFile(new URL(`../public/locales/${language}.json`, import.meta.url), 'utf8'));
    for (const key of ['inventory.bricksetPrice', 'inventory.bricksetPreview', 'inventory.priceInvalid', 'inventory.categoryInvalid']) {
      assert.doesNotMatch(catalog[key], /brickset/i, `${language}:${key}`);
    }
  }
});

test('los botones de cierre conservan la X y traducen su nombre accesible', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = new JSDOM(html);
  const realCatalogs = Object.fromEntries(await Promise.all(['es', 'en', 'it', 'fr'].map(async (language) => [
    language, JSON.parse(await readFile(new URL(`../public/locales/${language}.json`, import.meta.url), 'utf8')),
  ])));
  const { dom, window, i18n } = createBrowser({
    fetchCatalog: async (language) => ({ ok: true, json: async () => realCatalogs[language] }),
  });
  try {
    const buttons = [...source.window.document.querySelectorAll('[data-i18n-aria-label="common.close"]')];
    assert.equal(buttons.length, 13);
    for (const button of buttons) window.document.body.append(button.cloneNode(true));
    for (const language of ['es', 'en', 'it', 'fr']) {
      await i18n.setLanguage(language);
      for (const button of window.document.querySelectorAll('.modal-close')) {
        assert.equal(button.textContent, '×', button.id);
        assert.equal(button.getAttribute('aria-label'), realCatalogs[language]['common.close'], button.id);
      }
    }
  } finally {
    source.window.close();
    dom.window.close();
  }
});

test('idioma inicial, plurales, respaldo diagnosticado y parametros seguros sin traducir datos externos', async () => {
  const { dom, window, i18n, requests, warnings } = createBrowser();
  try {
    Object.defineProperty(window.navigator, 'language', { value: 'en-GB' });
    await i18n.initialize();
    assert.equal(i18n.language, 'es');
    assert.equal(window.document.documentElement.lang, 'es');
    const input = window.document.querySelector('input');
    input.focus();
    await i18n.setLanguage('en', { remember: true });
    assert.equal(i18n.locale, 'en-GB');
    assert.equal(window.localStorage.getItem('minipeople.language'), 'en');
    assert.deepEqual([0, 1, 2].map((count) => i18n.t('test.count', { count })), [
      '0 minipeople', '1 miniperson', '2 minipeople',
    ]);
    assert.equal(i18n.t('test.fallback'), 'Texto de respaldo');
    assert.equal(warnings.filter((args) => args.includes('test.fallback')).length, 1);
    assert.equal(i18n.t('unknown.key'), 'This text is unavailable.');
    const external = '<img src=x onerror="alert(1)">';
    const message = window.document.createElement('p');
    message.textContent = i18n.t('test.greeting', { username: external });
    assert.equal(message.textContent, `Hello, ${external}`);
    assert.equal(message.querySelector('img'), null);
    assert.equal(warnings.flat().includes(external), false);
    assert.equal(window.document.querySelector('#external').textContent, 'Nombre de Brickset');
    assert.equal(window.document.querySelector('button').getAttribute('aria-label'), 'Texto de respaldo');
    assert.equal(window.document.querySelector('button span').textContent, 'Untouched');
    assert.equal(window.document.querySelector('button img').getAttribute('alt'), '');
    assert.equal(window.document.activeElement, input);
    assert.equal(input.value, 'edited');
    await i18n.setLanguage('es');
    assert.equal(i18n.t('test.count', { count: 1 }), '1 minipersona');
    assert.equal(i18n.t('test.count', { count: 2 }), '2 minipersonas');
    await i18n.setLanguage('fr');
    assert.equal(i18n.locale, 'fr-FR');
    assert.equal(window.document.documentElement.lang, 'fr');
    assert.equal(i18n.formatNumber(12345.6), '12\u202f345,6');
    assert.equal(i18n.t('test.greeting', { username: 'Collectionneur' }), 'Bonjour, Collectionneur');
    assert.equal(i18n.t('missing.key'), 'Impossible d’afficher ce texte.');
    await i18n.setLanguage('it');
    assert.equal(i18n.locale, 'it-IT');
    assert.equal(window.document.documentElement.lang, 'it');
    assert.equal(i18n.formatNumber(12345.6), '12.345,6');
    assert.equal(i18n.t('test.greeting', { username: 'Collezionista' }), 'Ciao, Collezionista');
    assert.equal(i18n.t('missing.key'), 'Impossibile visualizzare questo testo.');
    assert.deepEqual(requests, ['es', 'en', 'fr', 'it']);
  } finally {
    dom.window.close();
  }
});

test('un fallo de recursos no aplica ni recuerda ingles y permite reintentar sin recargar espanol', async () => {
  let failure = 'http';
  const { dom, i18n, window, requests } = createBrowser({
    fetchCatalog: async (language) => {
      if (language === 'en' && failure === 'http') return { ok: false };
      if (language === 'en' && failure === 'json') return { ok: true, json: async () => { throw new SyntaxError('invalid JSON'); } };
      if (language === 'en' && failure === 'shape') return { ok: true, json: async () => ({ invalid: {} }) };
      return { ok: true, json: async () => catalogs[language] };
    },
  });
  try {
    await i18n.initialize();
    for (failure of ['http', 'json', 'shape']) {
      await assert.rejects(i18n.setLanguage('en', { remember: true }));
      assert.equal(i18n.language, 'es');
      assert.equal(window.document.documentElement.lang, 'es');
      assert.equal(window.localStorage.getItem('minipeople.language'), null);
    }
    failure = null;
    await i18n.setLanguage('en', { remember: true });
    assert.equal(i18n.language, 'en');
    assert.equal(requests.filter((language) => language === 'es').length, 1);
    await assert.rejects(i18n.setLanguage('de'), /IDIOMA_NO_SOPORTADO/);
    assert.equal(i18n.language, 'en');
  } finally {
    dom.window.close();
  }
});

test('preparacion no cambia idioma y una carga antigua no sustituye la cuenta actual', async () => {
  let resolveEnglish;
  let current = true;
  const { dom, i18n, window } = createBrowser({
    fetchCatalog: (language) => language === 'en'
      ? new Promise((resolve) => { resolveEnglish = resolve; })
      : Promise.resolve({ ok: true, json: async () => catalogs.es }),
  });
  try {
    await i18n.initialize();
    let changes = 0;
    window.addEventListener('minipeople:languagechange', () => { changes += 1; });
    const pending = i18n.setLanguage('en', { remember: true, isCurrent: () => current });
    while (!resolveEnglish) await new Promise((resolve) => setTimeout(resolve, 0));
    current = false;
    await i18n.setLanguage('es', { remember: true });
    resolveEnglish({ ok: true, json: async () => catalogs.en });
    assert.equal(await pending, false);
    assert.equal(i18n.language, 'es');
    assert.equal(window.localStorage.getItem('minipeople.language'), 'es');
    assert.equal(changes, 0);
    await i18n.prepare('en');
    assert.equal(i18n.language, 'es');
    await i18n.setLanguage('en');
    assert.equal(changes, 1);
    assert.equal(i18n.formatNumber(1234.5, { style: 'currency', currency: 'EUR' }), '€1,234.50');
    assert.equal(i18n.formatDate(new Date('2026-11-17T12:00:00Z'), {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }), '17 November 2026');
  } finally {
    dom.window.close();
  }
});

test('preferencia recordada valida y storage bloqueado no impiden usar el perfil', async () => {
  const remembered = createBrowser({ remembered: 'en' });
  const blocked = createBrowser({ unavailableStorage: true });
  const invalid = createBrowser({ remembered: 'de' });
  try {
    await remembered.i18n.initialize();
    assert.equal(remembered.i18n.language, 'en');
    await blocked.i18n.initialize();
    assert.equal(await blocked.i18n.setLanguage('en', { remember: true }), true);
    assert.equal(blocked.i18n.language, 'en');
    assert.ok(blocked.warnings.some((args) => args.includes('ALMACENAMIENTO_IDIOMA_NO_DISPONIBLE')));
    await invalid.i18n.initialize();
    assert.equal(invalid.i18n.language, 'es');
    assert.ok(invalid.warnings.some((args) => args.includes('PREFERENCIA_IDIOMA_INVALIDA')));
  } finally {
    remembered.dom.window.close();
    blocked.dom.window.close();
    invalid.dom.window.close();
  }
});

test('cargas concurrentes comparten recursos y un fallo de transporte se puede reintentar', async () => {
  let online = false;
  const { dom, i18n, requests } = createBrowser({
    fetchCatalog: async (language) => {
      if (!online) throw new TypeError('Network unavailable');
      return { ok: true, json: async () => catalogs[language] };
    },
  });
  try {
    await assert.rejects(i18n.initialize(), /Network unavailable/);
    online = true;
    await Promise.all([i18n.prepare('en'), i18n.prepare('en'), i18n.prepare('es')]);
    assert.deepEqual(requests, ['es', 'es', 'en']);
    assert.equal(i18n.language, 'es');
    await i18n.setLanguage('en');
    assert.equal(i18n.t('test.greeting', { username: 'Collector' }), 'Hello, Collector');
    assert.deepEqual(requests, ['es', 'es', 'en']);
  } finally {
    dom.window.close();
  }
});

test('Express sirve el motor de traduccion local sin autenticacion ni CDN', async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/vendor/i18next.js`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /javascript/);
    const library = await response.text();
    assert.match(library, /i18next/);
    assert.equal(library, engineScript);
  } finally {
    await server.close();
  }
});
