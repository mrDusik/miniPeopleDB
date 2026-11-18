import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { startTestServer } from '../test-support/server.js';
import { OBJETIVOS } from '../src/gamificacion.js';
import { withI18n } from '../test-support/browser-auth.js';

const execute = promisify(execFile);
const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('catalogos reales tienen paridad de claves y parametros y cubren todos los logros vigentes', async () => {
  const es = JSON.parse(await read('public/locales/es.json'));
  const en = JSON.parse(await read('public/locales/en.json'));
  const parameters = (text) => [...new Set([...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]))].sort();
  assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort());
  assert.doesNotMatch(Object.values(es).join('\n'), /\bminifiguras?\b/i);
  for (const key of Object.keys(es)) {
    assert.ok(typeof es[key] === 'string' && es[key].trim(), `ES: ${key}`);
    assert.ok(typeof en[key] === 'string' && en[key].trim(), `EN: ${key}`);
    assert.deepEqual(parameters(en[key]), parameters(es[key]), key);
  }
  const covered = (key) => Object.hasOwn(es, key)
    || ['one', 'other'].every((plural) => Object.hasOwn(es, `${key}_${plural}`));
  for (const script of ['app.js', 'email-confirmation.js', 'android-email-confirmation.js']) {
    for (const match of (await read(`public/${script}`)).matchAll(/\b(?:t|tr)\(\s*['"]([^'"]+)['"]/g)) {
      assert.ok(covered(match[1]), `${script}: ${match[1]}`);
    }
  }
  const dom = new JSDOM(await read('public/index.html'));
  try {
    for (const element of dom.window.document.querySelectorAll('*')) {
      for (const attribute of element.attributes) {
        if (attribute.name === 'data-i18n' || /^data-i18n-(?:title|aria-label|alt|placeholder)$/.test(attribute.name)) {
          assert.ok(covered(attribute.value), attribute.value);
        }
      }
    }
  } finally {
    dom.window.close();
  }
  for (const achievement of OBJETIVOS) {
    const key = `achievements.${achievement.id}.description`;
    assert.equal(es[key], achievement.descripcion, key);
    assert.ok(en[key] && en[key] !== es[key], key);
    assert.equal(Object.hasOwn(en, `achievements.${achievement.id}.name`), false);
  }
});

test('plurales reales de la interfaz resuelven cero, uno y varios en ES/EN', async () => {
  const dom = new JSDOM('', { url: 'http://localhost/', runScripts: 'outside-only' });
  try {
    dom.window.eval(withI18n(''));
    const i18n = dom.window.MiniPeopleI18n;
    await i18n.initialize();
    assert.equal(i18n.t('inventory.setCount', { count: 0 }), '0 Minipersonas en el set');
    assert.equal(i18n.t('inventory.setCount', { count: 1 }), '1 Minipersona en el set');
    assert.equal(i18n.t('inventory.setCount', { count: 2 }), '2 Minipersonas en el set');
    await i18n.setLanguage('en');
    assert.equal(i18n.t('inventory.setCount', { count: 0 }), '0 minipeople in set');
    assert.equal(i18n.t('inventory.setCount', { count: 1 }), '1 miniperson in set');
    assert.equal(i18n.t('inventory.setCount', { count: 2 }), '2 minipeople in set');
  } finally {
    dom.window.close();
  }
});

test('Express entrega los catalogos y adaptador con el mismo contenido que el paquete local', async () => {
  const server = await startTestServer();
  try {
    for (const asset of ['i18n.js', 'locales/es.json', 'locales/en.json']) {
      const response = await fetch(`${server.baseUrl}/${asset}`);
      assert.equal(response.status, 200, asset);
      assert.equal(await response.text(), await read(`public/${asset}`), asset);
    }
  } finally {
    await server.close();
  }
});

test('el paquete Android incluye traducciones ES/EN locales y carga el adaptador antes de sus consumidores', async () => {
  await execute(process.execPath, [fileURLToPath(new URL('scripts/build-android-web.js', root))], {
    cwd: fileURLToPath(root),
    timeout: 60000,
  });
  for (const asset of ['i18n.js', 'locales/es.json', 'locales/en.json']) {
    assert.equal(await read(`dist/android/${asset}`), await read(`public/${asset}`), asset);
  }
  assert.equal(await read('dist/android/vendor/i18next.js'),
    await read('node_modules/i18next/dist/umd/i18next.min.js'));
  for (const [file, consumer] of [
    ['index.html', '/app.js'],
    ['email-confirmation.html', '/email-confirmation.js'],
    ['android-email-confirmation.html', '/android-email-confirmation.js'],
  ]) {
    const dom = new JSDOM(await read(`dist/android/${file}`));
    try {
      const scripts = [...dom.window.document.scripts].map((element) => element.getAttribute('src')?.split('?')[0]);
      const engine = scripts.indexOf('/vendor/i18next.js');
      const adapter = scripts.indexOf('/i18n.js');
      assert.ok(engine >= 0, `${file}: local engine`);
      assert.ok(adapter > engine, `${file}: engine before adapter`);
      assert.ok(scripts.indexOf(consumer) > adapter, `${file}: adapter before consumer`);
    } finally {
      dom.window.close();
    }
  }
});
