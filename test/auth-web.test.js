import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { categoriasMockRaw } from '../test-support/fixtures.js';
import { withSupabaseSession } from '../test-support/browser-auth.js';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const appScript = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const catalog = [{ id: 'A-1', nombre: 'Astronauta', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN' }];

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function startApp({ session, signInError, fetchImpl, url = 'http://localhost/' } = {}) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
  const requests = [];
  window.fetch = async (url, init = {}) => {
    requests.push({ url, init });
    if (fetchImpl) return fetchImpl(url, init);
    if (url === '/categorias') return { ok: true, status: 200, json: async () => JSON.parse(categoriasMockRaw) };
    if (url === '/minifiguras') return { ok: true, status: 200, json: async () => catalog };
    if (url === '/valoracion') return { ok: true, status: 200, json: async () => ({ total: 0, enColeccion: 1, buscadas: 0, top5: [], top5Antiguas: [] }) };
    if (url === '/gamificacion') return { ok: true, status: 200, json: async () => ({ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, siguienteNivel: null, progreso: { porcentaje: 0 }, logros: [] }) };
    if (url === '/gamificacion/dna') return { ok: true, status: 200, json: async () => ({ principal: 'Newbie', porcentajes: { rarityHunter: 0, explorer: 0, collector: 0, fan: 0 } }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  window.eval(withSupabaseSession(appScript, { session, signInError }));
  const $ = (selector) => window.document.querySelector(selector);
  return { dom, window, requests, $ };
}

test('sin sesion solo se muestra la pantalla de acceso y no se piden datos', async () => {
  const { dom, requests, $ } = startApp({ session: null });
  await tick();
  assert.equal($('#auth-screen').hidden, false);
  assert.equal($('.page-shell').hidden, true);
  assert.equal($('#auth-screen').getAttribute('aria-labelledby'), 'auth-title');
  assert.equal($('#auth-title img').getAttribute('src'), $('.brand-heading img').getAttribute('src'));
  assert.equal($('#auth-title img').alt, 'MiniPeopleDB');
  assert.equal($('#auth-title').textContent, '');
  assert.equal($('.auth-eyebrow'), null);
  assert.match(styles, /\.auth-card h1 \{ width: min\(280px, 100%\); margin: 0; \}/);
  assert.equal($('#login-google').textContent, 'Iniciar sesión con Google');
  assert.equal($('#login-google').disabled, false);
  assert.deepEqual(requests, []);
  dom.window.close();
});

test('iniciar sesion usa Google con PKCE y redirige al origen de la aplicacion', async () => {
  const { dom, window, $ } = startApp({ session: null });
  await tick();
  $('#login-google').click();
  await tick();
  const stub = window.__supabaseStub.calls;
  assert.equal(stub.createClient[0].url, 'https://proyecto.supabase.test');
  assert.equal(stub.createClient[0].clientOptions.auth.flowType, 'pkce');
  assert.equal(stub.signInWithOAuth.length, 1);
  assert.equal(stub.signInWithOAuth[0].provider, 'google');
  assert.equal(stub.signInWithOAuth[0].options.redirectTo, 'http://localhost/');
  assert.equal(stub.signInWithOAuth[0].options.queryParams.prompt, 'select_account');
  dom.window.close();
});

for (const url of ['http://localhost:3000/', 'http://127.0.0.1:3000/', 'http://localhost:3001/', 'https://minipeopledb.onrender.com/']) {
  test(`el login conserva el origen y puerto de ${url} sin incluir parametros OAuth`, async () => {
    const { dom, window, $ } = startApp({ session: null, url: `${url}?code=previous-code#previous-token` });
    try {
      await tick();
      $('#login-google').click();
      await tick();
      assert.equal(window.__supabaseStub.calls.signInWithOAuth[0].options.redirectTo, url);
    } finally {
      dom.window.close();
    }
  });
}

test('un error del proveedor OAuth mantiene la pantalla de acceso con un aviso', async () => {
  const { dom, $ } = startApp({ session: null, signInError: 'provider disabled' });
  await tick();
  $('#login-google').click();
  await tick();
  assert.equal($('#auth-screen').hidden, false);
  assert.equal($('#auth-message').textContent, 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.');
  assert.equal($('#login-google').disabled, false);
  dom.window.close();
});

test('sin foto la sesion muestra el nombre y envia el token a la API', async () => {
  const { dom, requests, $ } = startApp();
  await tick();
  assert.equal($('#auth-screen').hidden, true);
  assert.equal($('.page-shell').hidden, false);
  assert.equal($('#user-name').textContent, 'Usuaria A');
  assert.equal($('#user-name').hidden, false);
  assert.equal($('#user-avatar').hidden, true);
  assert.equal($('#user-profile').hidden, true);
  $('#user-menu-toggle').click();
  assert.equal($('#user-menu-toggle').getAttribute('aria-expanded'), 'true');
  assert.equal($('#user-profile').hidden, false);
  assert.equal($('#logout').textContent, 'Cerrar sesión');
  $('#auth-title').click();
  assert.equal($('#user-menu-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal($('#user-profile').hidden, true);
  assert.equal($('#catalog-body').children.length, 1);

  const dataRequests = requests.filter(({ url }) => url !== '/categorias');
  assert.deepEqual(dataRequests.map(({ url }) => url), ['/minifiguras', '/valoracion', '/gamificacion', '/api/ranking', '/gamificacion/dna', '/sincronizacion/brickset']);
  for (const { init } of dataRequests) {
    assert.equal(init.headers.Authorization, 'Bearer token-navegador');
  }
  assert.equal(requests.find(({ url }) => url === '/categorias').init.headers, undefined);
  dom.window.close();
});

test('muestra el avatar de Google y recupera el nombre si la imagen falla', async () => {
  const session = { access_token: 'token-foto', user: { email: 'a@example.com', user_metadata: { full_name: 'Usuaria A', avatar_url: 'https://example.com/avatar.jpg' } } };
  const { dom, window, $ } = startApp({ session });
  await tick();
  assert.equal($('#user-avatar').src, 'https://example.com/avatar.jpg');
  assert.equal($('#user-avatar').hidden, false);
  assert.equal($('#user-name').hidden, false);
  assert.equal($('#user-profile').hidden, true);
  assert.equal($('#user-profile').title, 'Usuaria A');
  $('#user-avatar').dispatchEvent(new window.Event('error'));
  assert.equal($('#user-avatar').hidden, true);
  assert.equal($('#user-name').hidden, false);
  $('#logout').click();
  await tick();
  assert.equal($('#user-avatar').hasAttribute('src'), false);
  assert.equal($('#user-profile').hasAttribute('title'), false);
  dom.window.close();
});

test('cuenta sin minifiguras muestra bienvenida, pliega paneles y abre la creacion al aceptar', async () => {
  const { dom, $ } = startApp({ fetchImpl: async (url) => {
    if (url === '/categorias') return { ok: true, status: 200, json: async () => JSON.parse(categoriasMockRaw) };
    if (url === '/minifiguras') return { ok: true, status: 200, json: async () => [] };
    if (url === '/valoracion') return { ok: true, status: 200, json: async () => ({ total: 0, enColeccion: 0, buscadas: 0, top5: [], top5Antiguas: [] }) };
    if (url === '/gamificacion') return { ok: true, status: 200, json: async () => ({ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, siguienteNivel: null, progreso: { porcentaje: 0 }, logros: [] }) };
  } });
  await tick();
  assert.equal($('#first-minifigura-dialog').open, true);
  assert.equal(dom.window.document.activeElement, $('#first-minifigura-title'));
  assert.equal($('#first-minifigura-dialog p').textContent, 'Añade tu primera minifigura para ganar unos Bricks');
  assert.equal($('#first-minifigura-accept').className, 'button button-primary');
  assert.doesNotMatch(styles, /\.first-minifigura-dialog\s*\{[^}]*border-color:/);
  assert.doesNotMatch(styles, /\.first-minifigura-dialog \.button\s*\{/);
  assert.match(styles, /\.button:focus-visible\s*\{\s*outline:\s*2px solid var\(--accent\)/);
  assert.match(styles, /\.first-minifigura-dialog h2:focus\s*\{\s*outline:\s*none;/);
  assert.equal($('#status').textContent, 'No hay ninguna minifigura registrada en tu cuenta.');
  for (const panel of ['rankings', 'watchlist']) {
    const button = $(`.${panel}-panel .panel-toggle`);
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.equal($(`#${button.getAttribute('aria-controls')}`).hidden, true);
  }
  $('#first-minifigura-accept').click();
  assert.equal($('#first-minifigura-dialog').open, false);
  assert.equal($('#form-dialog').open, true);
  dom.window.close();
});

test('una busqueda sin resultados no cambia el mensaje ni pliega los paneles si la cuenta tiene figuras', async () => {
  const { dom, window, $ } = startApp({ fetchImpl: async (url) => {
    if (url === '/categorias') return { ok: true, status: 200, json: async () => JSON.parse(categoriasMockRaw) };
    if (url.startsWith('/minifiguras')) return { ok: true, status: 200, json: async () => url === '/minifiguras' ? catalog : [] };
    if (url === '/valoracion') return { ok: true, status: 200, json: async () => ({ total: 0, enColeccion: 1, buscadas: 0, top5: [], top5Antiguas: [] }) };
    if (url === '/gamificacion') return { ok: true, status: 200, json: async () => ({ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, siguienteNivel: null, progreso: { porcentaje: 0 }, logros: [] }) };
  } });
  await tick();
  $('#nombre').value = 'Inexistente';
  $('#filters-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  assert.equal($('#status').textContent, 'No hay minifiguras que coincidan con la consulta.');
  assert.equal($('#first-minifigura-dialog').open, false);
  assert.equal($('.rankings-panel .panel-toggle').getAttribute('aria-expanded'), 'true');
  assert.equal($('.watchlist-panel .panel-toggle').getAttribute('aria-expanded'), 'true');
  dom.window.close();
});

test('al borrar la ultima figura con un filtro activo se pliegan los paneles y aparece el mensaje de cuenta vacia', async () => {
  let figures = [...catalog];
  const { dom, window, requests, $ } = startApp({ fetchImpl: async (url, init) => {
    if (url === '/categorias') return { ok: true, status: 200, json: async () => JSON.parse(categoriasMockRaw) };
    if (init.method === 'DELETE') { figures = []; return { ok: true, status: 204 }; }
    if (url.startsWith('/minifiguras')) return { ok: true, status: 200, json: async () => url === '/minifiguras' ? figures : [] };
    if (url === '/valoracion') return { ok: true, status: 200, json: async () => ({ total: 0, enColeccion: figures.length, buscadas: 0, top5: [], top5Antiguas: [] }) };
    if (url === '/gamificacion') return { ok: true, status: 200, json: async () => ({ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, siguienteNivel: null, progreso: { porcentaje: 0 }, logros: [] }) };
  } });
  await tick();
  $('#nombre').value = 'Inexistente';
  $('#filters-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  $('#show-all').click();
  await tick();
  $('#catalog-body [data-action="delete"]').click();
  $('#nombre').value = 'Inexistente';
  $('#filters-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  $('#delete-confirm').click();
  await tick();
  await tick();
  assert.equal($('#status').textContent, 'No hay ninguna minifigura registrada en tu cuenta.');
  assert.equal($('.rankings-panel .panel-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal($('.watchlist-panel .panel-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal($('#first-minifigura-dialog').open, false);
  assert.ok(requests.filter(({ url }) => url === '/minifiguras').length >= 2);
  dom.window.close();
});

test('al aparecer la primera figura se expanden los paneles sin repetir la bienvenida', async () => {
  let figures = [];
  const { dom, $ } = startApp({ fetchImpl: async (url) => {
    if (url === '/categorias') return { ok: true, status: 200, json: async () => JSON.parse(categoriasMockRaw) };
    if (url === '/minifiguras') return { ok: true, status: 200, json: async () => figures };
    if (url === '/valoracion') return { ok: true, status: 200, json: async () => ({ total: 0, enColeccion: figures.length, buscadas: 0, top5: [], top5Antiguas: [] }) };
    if (url === '/gamificacion') return { ok: true, status: 200, json: async () => ({ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, siguienteNivel: null, progreso: { porcentaje: 0 }, logros: [] }) };
    if (url === '/sincronizacion/brickset') return { ok: true, status: 200, json: async () => ({ estado: 'completada', procesados: figures.length, total: figures.length, actualizados: [], fallidos: [] }) };
  } });
  await tick();
  $('#first-minifigura-dialog').close();
  figures = catalog;
  $('#sync-prices').click();
  await tick();
  assert.equal($('#first-minifigura-dialog').open, false);
  assert.equal($('#catalog-body').children.length, 1);
  assert.equal($('.rankings-panel .panel-toggle').getAttribute('aria-expanded'), 'true');
  assert.equal($('.watchlist-panel .panel-toggle').getAttribute('aria-expanded'), 'true');
  dom.window.close();
});

test('cerrar sesion vacia los datos y vuelve a la pantalla de acceso', async () => {
  const { dom, window, $ } = startApp();
  await tick();
  assert.equal($('#catalog-body').children.length, 1);
  $('#open-dna-inline').click();
  await tick();
  assert.equal($('#dna-dialog').open, true);
  $('#logout').click();
  await tick();
  assert.equal(JSON.stringify(window.__supabaseStub.calls.signOut), '[null]');
  assert.equal($('#auth-screen').hidden, false);
  assert.equal($('.page-shell').hidden, true);
  assert.equal($('#catalog-body').children.length, 0);
  assert.equal($('#user-name').textContent, '');
  assert.equal($('#dna-dialog').open, false);
  assert.equal($('#gamification-dna-principal').textContent, 'DNA no disponible');
  dom.window.close();
});

test('una lectura DNA tardia de la cuenta anterior no reemplaza el principal tras cambiar de usuario', async () => {
  const sessionA = { access_token: 'token-a', user: { id: 'user-a', email: 'a@example.com' } };
  const sessionB = { access_token: 'token-b', user: { id: 'user-b', email: 'b@example.com' } };
  let resolveOldDna;
  let dnaRequests = 0;
  const { dom, window, $ } = startApp({ session: sessionA, fetchImpl: async (url) => {
    if (url === '/categorias') return { ok: true, status: 200, json: async () => JSON.parse(categoriasMockRaw) };
    if (url === '/minifiguras') return { ok: true, status: 200, json: async () => catalog };
    if (url === '/valoracion') return { ok: true, status: 200, json: async () => ({ total: 0, enColeccion: 1, buscadas: 0, top5: [], top5Antiguas: [] }) };
    if (url === '/gamificacion') return { ok: true, status: 200, json: async () => ({ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, siguienteNivel: null, progreso: { porcentaje: 0 }, logros: [] }) };
    if (url === '/api/ranking') return { ok: true, status: 200, json: async () => [] };
    if (url === '/sincronizacion/brickset') return { ok: true, status: 200, json: async () => ({ estado: 'inactiva' }) };
    if (url === '/gamificacion/dna') {
      dnaRequests += 1;
      if (dnaRequests === 1) return new Promise((resolve) => { resolveOldDna = resolve; });
      return { ok: true, status: 200, json: async () => ({ principal: 'Fan', porcentajes: { rarityHunter: 0, explorer: 0, collector: 0, fan: 100 } }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  } });
  await tick();
  assert.equal(typeof resolveOldDna, 'function');
  window.__supabaseStub.setSession('SIGNED_IN', sessionB);
  await tick();
  await tick();
  assert.equal($('#gamification-dna-principal').textContent, 'Fan');
  resolveOldDna({ ok: true, status: 200, json: async () => ({ principal: 'Explorer', porcentajes: { rarityHunter: 0, explorer: 100, collector: 0, fan: 0 } }) });
  await tick();
  assert.equal($('#gamification-dna-principal').textContent, 'Fan');
  dom.window.close();
});

test('una respuesta 401 de la API cierra la sesion local y avisa de la caducidad', async () => {
  const { dom, window, $ } = startApp({
    fetchImpl: async (url) => (url === '/categorias'
      ? { ok: true, status: 200, json: async () => JSON.parse(categoriasMockRaw) }
      : { ok: false, status: 401, json: async () => ({ error: 'NO_AUTENTICADO' }) }),
  });
  await tick();
  assert.equal(JSON.stringify(window.__supabaseStub.calls.signOut), '[{"scope":"local"}]');
  assert.equal($('#auth-screen').hidden, false);
  assert.equal($('.page-shell').hidden, true);
  assert.equal($('#auth-message').textContent, 'Tu sesión ha caducado. Inicia sesión de nuevo.');
  dom.window.close();
});

test('sin configuracion de Supabase se muestra un error y se deshabilita el acceso', async () => {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.fetch = async () => ({ ok: false, status: 500, json: async () => ({ error: 'CONFIGURACION_NO_DISPONIBLE' }) });
  window.eval(appScript);
  await tick();
  assert.equal(window.document.querySelector('#auth-screen').hidden, false);
  assert.equal(window.document.querySelector('#auth-message').textContent, 'No se pudo iniciar el servicio de autenticación.');
  assert.equal(window.document.querySelector('#login-google').disabled, true);
  dom.window.close();
});
