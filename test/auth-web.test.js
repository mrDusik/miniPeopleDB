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
const completeProfile = {
  username: 'SpaceFan', avatarUrl: null, currency: 'EUR', language: 'es',
  onboardingCompleted: true, favoriteCategories: [],
};

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (predicate()) return;
    await tick();
  }
  assert.equal(predicate(), true);
}

function startApp({ session, fetchImpl, profileData = completeProfile, url = 'http://localhost/', ...authOptions } = {}) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  const { window } = dom;
  window.crypto.randomUUID ??= () => '00000000-0000-4000-8000-000000000001';
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  const requests = [];
  window.fetch = async (url, init = {}) => {
    requests.push({ url, init });
    if (fetchImpl) {
      const response = await fetchImpl(url, init);
      if (response !== undefined) return response;
    }
    if (url === '/api/auth/login') return {
      ok: !authOptions.passwordSignInError,
      status: authOptions.passwordSignInError ? 401 : 200,
      json: async () => ({ access_token: authOptions.passwordSession?.access_token ?? 'token-classic', refresh_token: 'refresh-classic' }),
    };
    if (url === '/api/profile') return { ok: true, status: 200, json: async () => profileData };
    if (url === '/categorias') return { ok: true, status: 200, json: async () => JSON.parse(categoriasMockRaw) };
    if (url === '/minifiguras') return { ok: true, status: 200, json: async () => catalog };
    if (url === '/valoracion') return { ok: true, status: 200, json: async () => ({ total: 0, enColeccion: 1, buscadas: 0, top5: [], top5Antiguas: [] }) };
    if (url === '/gamificacion') return { ok: true, status: 200, json: async () => ({ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, siguienteNivel: null, progreso: { porcentaje: 0 }, logros: [] }) };
    if (url === '/gamificacion/dna') return { ok: true, status: 200, json: async () => ({ principal: 'Newbie', porcentajes: { rarityHunter: 0, explorer: 0, collector: 0, fan: 0 } }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  window.eval(withSupabaseSession(appScript, { session, profileFallback: false, ...authOptions }));
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
  assert.equal($('#login-google').textContent, 'Inicia sesión con Google');
  assert.equal($('#login-google img').getAttribute('src'), '/logo_images/google-2.png');
  assert.equal($('#login-google img').alt, '');
  assert.equal($('#login-google img').getAttribute('width'), '20');
  assert.equal($('#login-google img').getAttribute('height'), '20');
  assert.ok((await readFile(new URL('../public/logo_images/google-2.png', import.meta.url))).length > 0);
  assert.equal($('#login-google').disabled, false);
  assert.equal($('#auth-username-field').hidden, false);
  assert.equal($('#auth-email-field').hidden, true);
  assert.equal($('#auth-email').disabled, true);
  assert.equal($('#auth-password-repeat').disabled, true);
  assert.deepEqual(requests, []);
  dom.window.close();
});

test('los textos y los ojos de contraseña reflejan el modo y restablecen su estado al cambiarlo', async () => {
  const { dom, $ } = startApp({ session: null });
  try {
    await tick();
    const style = dom.window.document.createElement('style');
    style.textContent = styles;
    dom.window.document.head.append(style);
    const passwordRule = [...style.sheet.cssRules].find((rule) => rule.selectorText === '.auth-password-control input');
    assert.equal(passwordRule.style.getPropertyValue('padding-left'), '48px');
    assert.equal(passwordRule.style.getPropertyValue('padding-right'), '48px');
    assert.equal(passwordRule.style.getPropertyValue('text-align'), 'center');
    const toggle = $('#auth-show-password');
    const repeatToggle = $('#auth-show-password-repeat');
    assert.equal(toggle.tagName, 'BUTTON');
    assert.equal(toggle.type, 'button');
    assert.equal(toggle.getAttribute('aria-label'), 'Mostrar contraseña');
    assert.equal(toggle.querySelector('use').getAttribute('href'), '#auth-eye-off-icon');
    assert.equal(toggle.parentElement, $('#auth-password').parentElement);
    assert.equal($('#auth-divider').textContent, 'o con tu usuario de MiniPeopleDB');
    toggle.click();
    assert.equal($('#auth-password').type, 'text');
    assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    assert.equal(toggle.title, 'Ocultar contraseña');
    $('#auth-mode-register').click();
    assert.equal($('#auth-password').type, 'password');
    assert.equal($('#auth-password-repeat').type, 'password');
    assert.equal($('#login-google').textContent, 'Usa tu cuenta de Google');
    assert.equal($('#login-google img').getAttribute('src'), '/logo_images/google-2.png');
    assert.equal($('#auth-divider').textContent, 'o crea una nueva cuenta en MiniPeopleDB');
    assert.equal(repeatToggle.parentElement, $('#auth-password-repeat').parentElement);
    repeatToggle.click();
    for (const button of [toggle, repeatToggle]) {
      assert.equal(button.getAttribute('aria-pressed'), 'true');
      assert.equal(button.getAttribute('aria-label'), 'Ocultar contraseñas');
      assert.equal(button.querySelector('use').getAttribute('href'), '#auth-eye-icon');
    }
    assert.equal($('#auth-password').type, 'text');
    assert.equal($('#auth-password-repeat').type, 'text');
    toggle.click();
    for (const button of [toggle, repeatToggle]) {
      assert.equal(button.getAttribute('aria-pressed'), 'false');
      assert.equal(button.title, 'Mostrar contraseñas');
      assert.equal(button.querySelector('use').getAttribute('href'), '#auth-eye-off-icon');
    }
    $('#auth-mode-login').click();
    assert.equal($('#login-google').textContent, 'Inicia sesión con Google');
    assert.equal($('#auth-divider').textContent, 'o con tu usuario de MiniPeopleDB');
    assert.equal(toggle.title, 'Mostrar contraseña');
    assert.equal($('#auth-password-repeat-field').hidden, true);
  } finally {
    dom.window.close();
  }
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

test('registro clásico valida username y delega email y contraseña en Supabase Auth', async () => {
  const { dom, window, requests, $ } = startApp({ session: null });
  await tick();
  $('#auth-mode-register').click();
  assert.equal($('#auth-username-field').hidden, false);
  assert.equal($('#auth-username').required, true);
  assert.equal($('#auth-email-field').hidden, false);
  assert.equal($('#auth-email').required, true);
  $('#auth-username').value = 'invalid username';
  $('#auth-email').value = 'new@example.com';
  $('#auth-password').value = 'Safe-password1';
  $('#auth-password-repeat').value = 'Safe-password1';
  $('#classic-auth-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  assert.equal(window.__supabaseStub.calls.signUp.length, 0);

  $('#auth-username').value = 'Space_Fan7';
  $('#classic-auth-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  assert.equal(JSON.stringify(window.__supabaseStub.calls.signUp), JSON.stringify([{
    email: 'new@example.com', password: 'Safe-password1', options: { data: { username: 'Space_Fan7' } },
  }]));
  assert.match($('#auth-message').textContent, /confirmar la cuenta/);
  assert.equal($('#auth-message').classList.contains('loading-message'), false);
  assert.equal($('#auth-message').getAttribute('aria-busy'), 'false');
  assert.deepEqual(requests, []);
  dom.window.close();
});

test('el registro comprueba reglas, coincidencia y visibilidad de ambas contraseñas', async () => {
  const { dom, window, $ } = startApp({ session: null });
  try {
    await tick();
    assert.equal($('#auth-password-repeat-field').hidden, true);
    $('#auth-mode-register').click();
    $('#auth-username').value = 'SpaceFan';
    $('#auth-email').value = 'new@example.com';
    assert.equal($('#auth-password-repeat').required, true);
    assert.equal($('#auth-password-rules').hidden, false);
    assert.equal(window.document.querySelectorAll('.auth-password-rules .is-met').length, 0);
    for (const [password, met] of [['a', 1], ['abcde', 2], ['Abcde', 3], ['Aa1', 3], ['ABCDE1', 3], ['Abcd1', 4]]) {
      $('#auth-password').value = password;
      $('#auth-password-repeat').value = met < 4 ? password : '';
      $('#auth-password').dispatchEvent(new window.Event('input'));
      assert.equal(window.document.querySelectorAll('.auth-password-rules .is-met').length, met);
      $('#classic-auth-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
      await tick();
      assert.equal(window.__supabaseStub.calls.signUp.length, 0);
    }
    $('#auth-password-repeat').value = 'different';
    $('#auth-password-repeat').dispatchEvent(new window.Event('input'));
    assert.equal($('#auth-password-repeat').validationMessage, 'Las contraseñas no coinciden.');
    $('#auth-show-password').click();
    assert.equal($('#auth-password').type, 'text');
    assert.equal($('#auth-password-repeat').type, 'text');
    $('#auth-show-password').click();
    assert.equal($('#auth-password').type, 'password');
    assert.equal($('#auth-password-repeat').type, 'password');
    $('#auth-password-repeat').value = 'Abcd1';
    $('#classic-auth-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    await tick();
    assert.equal(window.__supabaseStub.calls.signUp.length, 1);
    assert.equal(window.document.querySelectorAll('.auth-password-rules .is-met').length, 0);
    $('#auth-mode-login').click();
    assert.equal($('#auth-password-rules').hidden, true);
    assert.equal($('#auth-password-repeat').disabled, true);
    assert.equal($('#auth-password').validity.customError, false);
  } finally {
    dom.window.close();
  }
});

test('repetir contraseña se resalta tras perder el foco y recuperar contraseña solo aparece en login', async () => {
  const { dom, window, $ } = startApp({ session: null });
  try {
    await tick();
    assert.equal($('#open-password-recovery').hidden, false);
    $('#auth-mode-register').click();
    assert.equal($('#open-password-recovery').hidden, true);
    const repeat = $('#auth-password-repeat');
    $('#auth-password').value = 'Abcd1';
    repeat.value = 'Abcd2';
    repeat.dispatchEvent(new window.Event('input'));
    assert.equal(repeat.getAttribute('aria-invalid'), 'false');
    repeat.dispatchEvent(new window.Event('blur'));
    assert.equal(repeat.getAttribute('aria-invalid'), 'true');
    const style = window.document.createElement('style');
    style.textContent = styles;
    window.document.head.append(style);
    assert.equal(window.getComputedStyle(repeat).borderTopColor, 'rgb(180, 35, 24)');
    repeat.value = 'Abcd1';
    repeat.dispatchEvent(new window.Event('input'));
    assert.equal(repeat.getAttribute('aria-invalid'), 'false');
    $('#auth-password').value = 'Abcd3';
    $('#auth-password').dispatchEvent(new window.Event('input'));
    assert.equal(repeat.getAttribute('aria-invalid'), 'true');
    $('#auth-mode-login').click();
    assert.equal($('#open-password-recovery').hidden, false);
    assert.equal(repeat.getAttribute('aria-invalid'), 'false');
    $('#auth-mode-register').click();
    assert.equal(repeat.getAttribute('aria-invalid'), 'false');
    assert.equal($('#open-password-recovery').hidden, true);
  } finally {
    dom.window.close();
  }
});

test('el acceso pendiente comparte el indicador de carga y lo limpia ante un error', async () => {
  let resolveLogin;
  const { dom, window, $ } = startApp({ session: null, fetchImpl: (url) => url === '/api/auth/login'
    ? new Promise((resolve) => { resolveLogin = resolve; }) : undefined });
  try {
    await tick();
    $('#auth-username').value = 'SpaceFan';
    $('#auth-password').value = 'Abcd1';
    $('#classic-auth-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    await waitFor(() => typeof resolveLogin === 'function');
    assert.equal($('#auth-message').textContent, 'Iniciando sesión...');
    assert.equal($('#auth-message').className, 'status loading-message');
    assert.equal($('#auth-message').getAttribute('aria-busy'), 'true');
    resolveLogin({ ok: false, status: 401 });
    await waitFor(() => $('#classic-auth-submit').disabled === false);
    assert.equal($('#auth-message').className, 'status error');
    assert.equal($('#auth-message').getAttribute('aria-busy'), 'false');
    $('#auth-mode-register').click();
    assert.equal($('#auth-message').textContent, '');
    assert.equal($('#auth-message').className, 'status');
  } finally {
    dom.window.close();
  }
});

test('inicio de sesión clásico y recuperación usan Supabase Auth con errores genéricos', async () => {
  const { dom, window, requests, $ } = startApp({ session: null, passwordSignInError: 'invalid credentials', recoveryError: 'private provider detail' });
  await tick();
  $('#auth-username').value = 'SpaceFan';
  $('#auth-password').value = 'wrong-password';
  $('#classic-auth-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  assert.deepEqual(JSON.parse(requests[0].init.body), { username: 'SpaceFan', password: 'wrong-password' });
  assert.equal(window.__supabaseStub.calls.signInWithPassword.length, 0);
  assert.equal(window.__supabaseStub.calls.setSession.length, 0);
  assert.equal($('#auth-message').textContent, 'No se pudo iniciar sesión. Revisa el username y la contraseña.');

  $('#open-password-recovery').click();
  assert.equal($('#password-recovery-form').hidden, false);
  $('#recovery-email').value = 'person@example.com';
  $('#password-recovery-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  assert.equal(JSON.stringify(window.__supabaseStub.calls.resetPasswordForEmail), JSON.stringify([{
    email: 'person@example.com', options: { redirectTo: 'http://localhost/' },
  }]));
  assert.equal($('#auth-message').textContent, 'No se pudo solicitar la recuperación. Inténtalo de nuevo.');
  assert.equal($('#auth-message').textContent.includes('private provider detail'), false);
  assert.deepEqual(requests.map(({ url }) => url), ['/api/auth/login']);
  dom.window.close();
});

test('un inicio de sesión clásico entrega el mismo estado de sesión que OAuth', async () => {
  const session = { access_token: 'token-classic', user: { id: 'classic-user', email: 'classic@example.com', user_metadata: {} } };
  const { dom, window, requests, $ } = startApp({ session: null, passwordSession: session });
  await tick();
  $('#auth-username').value = 'SpaceFan';
  $('#auth-password').value = 'valid-password';
  $('#classic-auth-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  assert.equal($('#auth-screen').hidden, true);
  assert.equal($('.page-shell').hidden, false);
  assert.deepEqual(JSON.parse(requests[0].init.body), { username: 'SpaceFan', password: 'valid-password' });
  assert.equal(JSON.stringify(window.__supabaseStub.calls.setSession), JSON.stringify([{ access_token: 'token-classic', refresh_token: 'refresh-classic' }]));
  assert.ok(requests.some(({ url }) => url === '/minifiguras'));
  assert.equal(requests.filter(({ url }) => !['/categorias', '/api/auth/login'].includes(url)).every(({ init }) => init.headers.Authorization === 'Bearer token-classic'), true);
  dom.window.close();
});

test('PASSWORD_RECOVERY muestra cambio de contraseña y solo abre la app tras actualizarla', async () => {
  const recoverySession = { access_token: 'token-recovery', user: { id: 'recovery-user', email: 'recovery@example.com', user_metadata: {} } };
  const { dom, window, requests, $ } = startApp({ session: null, recoverySession });
  await tick();
  $('#open-password-recovery').click();
  $('#recovery-email').value = 'recovery@example.com';
  $('#password-recovery-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  assert.equal($('#password-update-form').hidden, false);
  assert.equal($('#auth-access-panel').hidden, true);
  assert.equal($('.page-shell').hidden, true);
  assert.deepEqual(requests, []);

  $('#new-password').value = 'new-valid-password';
  $('#password-update-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  assert.equal(JSON.stringify(window.__supabaseStub.calls.updateUser), JSON.stringify([{ password: 'new-valid-password' }]));
  assert.equal($('#auth-screen').hidden, true);
  assert.ok(requests.some(({ url }) => url === '/minifiguras'));
  dom.window.close();
});

test('cambio de contraseña envía el nuevo secreto solo a Supabase Auth', async () => {
  const { dom, window, $ } = startApp({ session: null, updatePasswordError: 'recovery token invalid' });
  await tick();
  $('#password-update-form').hidden = false;
  $('#new-password').value = 'new-safe-password';
  $('#password-update-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await tick();
  assert.equal(JSON.stringify(window.__supabaseStub.calls.updateUser), JSON.stringify([{ password: 'new-safe-password' }]));
  assert.equal($('#auth-message').textContent, 'No se pudo cambiar la contraseña. Inténtalo de nuevo.');
  assert.equal($('#auth-message').textContent.includes('recovery token invalid'), false);
  dom.window.close();
});

test('sin foto la sesion muestra el nombre y envia el token a la API', async () => {
  const { dom, requests, $ } = startApp();
  await tick();
  assert.equal($('#auth-screen').hidden, true);
  assert.equal($('.page-shell').hidden, false);
  assert.equal($('#user-name').textContent, 'SpaceFan');
  assert.equal($('#user-name').hidden, false);
  assert.equal($('#user-avatar').hidden, true);
  assert.equal($('#user-profile').hidden, true);
  assert.equal($('.notifications-entry-row').firstElementChild, $('.user-session'));
  assert.equal($('.user-session').nextElementSibling, $('#open-notifications'));
  assert.equal($('.gamification-summary #user-menu-toggle'), null);
  assert.equal($('#open-user-settings').className, $('#open-achievements').className);
  assert.equal($('#open-user-settings').textContent.trim(), '⚙️ Preferencias');
  assert.equal($('#logout').className, 'logout-link');
  $('#user-menu-toggle').click();
  assert.equal($('#user-menu-toggle').getAttribute('aria-expanded'), 'true');
  assert.equal($('#user-profile').hidden, false);
  assert.equal($('#logout').textContent, 'Cerrar sesión');
  $('#user-menu-toggle').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal($('#user-profile').hidden, true);
  assert.equal(dom.window.document.activeElement, $('#user-menu-toggle'));
  $('#user-menu-toggle').click();
  $('#auth-title').click();
  assert.equal($('#user-menu-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal($('#user-profile').hidden, true);
  assert.equal($('#catalog-body').children.length, 1);

  const dataRequests = requests.filter(({ url }) => url !== '/categorias');
  assert.deepEqual(dataRequests.map(({ url }) => url), ['/api/profile', '/api/notificaciones', '/minifiguras', '/valoracion', '/gamificacion', '/api/ranking', '/gamificacion/dna', '/sincronizacion/brickset']);
  for (const { init } of dataRequests) {
    assert.equal(init.headers.Authorization, 'Bearer token-navegador');
  }
  assert.equal(requests.find(({ url }) => url === '/categorias').init.headers, undefined);
  dom.window.close();
});

test('perfil incompleto conserva la sesión pero no solicita datos de la colección', async () => {
  const { dom, requests, $ } = startApp({
    profileData: { ...completeProfile, username: null, onboardingCompleted: false },
  });
  await waitFor(() => requests.some(({ url }) => url === '/api/profile'));
  await waitFor(() => $('#auth-message').textContent.includes('Completa tu perfil'));
  assert.equal($('#auth-screen').hidden, false);
  assert.equal($('.page-shell').hidden, true);
  assert.deepEqual(requests.map(({ url }) => url), ['/api/profile', '/categorias']);
  dom.window.close();
});

test('onboarding guarda perfil y favoritos antes de iniciar la colección', async () => {
  let submittedProfile;
  const { dom, window, requests, $ } = startApp({
    profileData: { ...completeProfile, username: null, onboardingCompleted: false },
    fetchImpl: async (url, init = {}) => {
      if (url === '/api/profile' && init.method === 'PUT') {
        submittedProfile = JSON.parse(init.body);
        return { ok: true, status: 200, json: async () => ({ ...submittedProfile, onboardingCompleted: true }) };
      }
      return undefined;
    },
  });
  await waitFor(() => $('#user-profile-dialog').open);
  assert.equal($('#user-profile-dialog-title').textContent, 'Completa tu perfil');
  assert.equal($('#profile-username').disabled, false);
  assert.equal($('#profile-favorite-categories').querySelectorAll('input').length, 10);
  assert.equal($('#profile-currency').querySelector('[value="USD"]').disabled, true);
  assert.equal($('#profile-language').querySelector('[value="en"]').disabled, true);

  $('#profile-username').value = 'Space_Fan7';
  $('#profile-avatar-url').value = 'https://example.com/profile.png';
  $('#profile-favorite-search').value = 'space';
  $('#profile-favorite-search').dispatchEvent(new window.Event('input', { bubbles: true }));
  const favorite = $('#profile-favorite-categories input');
  assert.equal(favorite.value, 'Space');
  favorite.checked = true;
  favorite.dispatchEvent(new window.Event('change', { bubbles: true }));
  $('#user-profile-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

  await waitFor(() => requests.some(({ url }) => url === '/minifiguras'));
  assert.deepEqual(submittedProfile, {
    username: 'Space_Fan7',
    avatarUrl: 'https://example.com/profile.png',
    currency: 'EUR',
    language: 'es',
    favoriteCategories: ['Space'],
  });
  assert.equal($('#user-profile-dialog').open, false);
  assert.equal($('.page-shell').hidden, false);
  assert.equal(requests.filter(({ url }) => url === '/api/profile').length, 2);
  dom.window.close();
});

test('fallo al guardar conserva onboarding y valores para reintentar sin abrir la colección', async () => {
  let saveAttempts = 0;
  const { dom, window, requests, $ } = startApp({
    profileData: { ...completeProfile, username: null, onboardingCompleted: false },
    fetchImpl: async (url, init = {}) => {
      if (url === '/api/profile' && init.method === 'PUT') {
        saveAttempts += 1;
        return saveAttempts === 1
          ? { ok: false, status: 500, json: async () => ({ error: 'PERFIL_NO_DISPONIBLE' }) }
          : { ok: true, status: 200, json: async () => ({ ...JSON.parse(init.body), onboardingCompleted: true }) };
      }
      return undefined;
    },
  });
  await waitFor(() => $('#user-profile-dialog').open);
  $('#profile-username').value = 'Retry_User';
  $('#profile-avatar-url').value = 'https://example.com/retry.png';
  $('#profile-favorite-search').value = 'castle';
  $('#profile-favorite-search').dispatchEvent(new window.Event('input', { bubbles: true }));
  const favorite = $('#profile-favorite-categories input');
  favorite.checked = true;
  favorite.dispatchEvent(new window.Event('change', { bubbles: true }));

  $('#user-profile-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => $('#profile-form-message').textContent.includes('No se pudo guardar'));
  assert.equal($('#user-profile-dialog').open, true);
  assert.equal($('#profile-username').value, 'Retry_User');
  assert.equal($('#profile-avatar-url').value, 'https://example.com/retry.png');
  assert.equal($('#profile-favorite-categories input').checked, true);
  assert.equal($('.page-shell').hidden, true);
  assert.equal(requests.some(({ url }) => url === '/minifiguras'), false);

  $('#user-profile-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await waitFor(() => requests.some(({ url }) => url === '/minifiguras'));
  assert.equal(saveAttempts, 2);
  assert.equal($('#user-profile-dialog').open, false);
  dom.window.close();
});

test('el alta con Google muestra su avatar en onboarding y lo conserva sin cargar imagen propia', async () => {
  let savedProfile;
  const { dom, window, $ } = startApp({
    session: { access_token: 'google-token', user: { id: 'google-user', user_metadata: { picture: 'https://google.example/avatar.png' } } },
    profileData: { ...completeProfile, username: null, onboardingCompleted: false },
    fetchImpl: async (url, init) => {
      if (url !== '/api/profile' || init.method !== 'PUT') return undefined;
      savedProfile = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ ...savedProfile, onboardingCompleted: true }) };
    },
  });
  try {
    await waitFor(() => $('#user-profile-dialog').open);
    assert.equal($('#profile-avatar-preview').src, 'https://google.example/avatar.png');
    assert.equal($('#profile-avatar-preview').hidden, false);
    $('#profile-username').value = 'GoogleFan';
    $('#user-profile-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    await waitFor(() => $('.page-shell').hidden === false);
    assert.equal(savedProfile.avatarUrl, null);
    assert.equal($('#user-avatar').src, 'https://google.example/avatar.png');
    assert.equal(window.__supabaseStub.calls.avatarUploads.length, 0);
  } finally {
    dom.window.close();
  }
});

test('el avatar propio tiene prioridad y quitarlo recupera el de Google en la vista previa', async () => {
  let savedProfile;
  const { dom, window, $ } = startApp({
    session: { access_token: 'google-token', user: { id: 'google-user', user_metadata: { picture: 'https://google.example/avatar.png' } } },
    profileData: { ...completeProfile, avatarUrl: 'https://custom.example/avatar.png' },
    fetchImpl: async (url, init) => {
      if (url !== '/api/profile' || init.method !== 'PUT') return undefined;
      savedProfile = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => ({ ...savedProfile, onboardingCompleted: true }) };
    },
  });
  try {
    await waitFor(() => $('.page-shell').hidden === false);
    assert.equal($('#user-avatar').src, 'https://custom.example/avatar.png');
    $('#user-menu-toggle').click();
    $('#open-user-settings').click();
    await waitFor(() => $('#user-profile-dialog').open);
    assert.equal($('#profile-avatar-preview').src, 'https://custom.example/avatar.png');
    assert.match(styles, /\.profile-avatar-preview \{[^}]*border: 2px solid var\(--blue\);/);
    $('#profile-avatar-remove').click();
    assert.equal($('#profile-avatar-preview').src, 'https://google.example/avatar.png');
    $('#user-profile-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    await waitFor(() => $('#user-profile-dialog').open === false);
    assert.equal(savedProfile.avatarUrl, null);
    assert.equal($('#user-avatar').src, 'https://google.example/avatar.png');
  } finally {
    dom.window.close();
  }
});

for (const [source, user] of [
  ['avatar_url', { user_metadata: { avatar_url: 'https://google.example/avatar.png' } }],
  ['picture', { user_metadata: { picture: 'https://google.example/avatar.png' } }],
  ['identidad Google', { user_metadata: {}, identities: [{ provider: 'google', identity_data: { picture: 'https://google.example/avatar.png' } }] }],
]) {
  test(`el avatar de Google (${source}) aparece en la sesión y vista previa sin cargar un archivo`, async () => {
    let savedProfile;
    const { dom, window, $ } = startApp({
      session: { access_token: 'google-token', user: { id: 'google-user', ...user } },
      fetchImpl: async (url, init) => {
        if (url !== '/api/profile' || init.method !== 'PUT') return undefined;
        savedProfile = JSON.parse(init.body);
        return { ok: true, status: 200, json: async () => ({ ...savedProfile, onboardingCompleted: true }) };
      },
    });
    try {
      await waitFor(() => $('.page-shell').hidden === false);
      assert.equal($('#user-avatar').src, 'https://google.example/avatar.png');
      assert.equal($('#user-avatar').hidden, false);
      $('#user-menu-toggle').click();
      $('#open-user-settings').click();
      await waitFor(() => $('#user-profile-dialog').open);
      assert.equal($('#profile-avatar-preview').src, 'https://google.example/avatar.png');
      assert.equal($('#profile-avatar-preview').hidden, false);
      $('#user-profile-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
      await waitFor(() => $('#user-profile-dialog').open === false);
      assert.equal(savedProfile.avatarUrl, null);
      assert.equal(window.__supabaseStub.calls.avatarUploads.length, 0);
      assert.equal($('#user-avatar').src, 'https://google.example/avatar.png');
      $('#user-menu-toggle').click();
      $('#open-user-settings').click();
      await waitFor(() => $('#user-profile-dialog').open);
      assert.equal($('#profile-avatar-preview').src, 'https://google.example/avatar.png');
    } finally {
      dom.window.close();
    }
  });
}

test('Preferencias agrupa tres filas y mantiene visibles hasta tres categorías seleccionadas', async () => {
  const { dom, window, $ } = startApp();
  try {
    await tick();
    $('#user-menu-toggle').click();
    $('#open-user-settings').click();
    await waitFor(() => $('#user-profile-dialog').open);
    const rows = window.document.querySelectorAll('.profile-two-column-row');
    assert.equal(rows.length, 2);
    assert.ok(rows[0].querySelector('#profile-username'));
    assert.ok(rows[0].querySelector('#profile-avatar-file'));
    assert.equal(rows[1].querySelector('select').id, 'profile-language');
    assert.equal(rows[1].querySelectorAll('select')[1].id, 'profile-currency');
    assert.equal($('#profile-favorites-count').textContent, '0/3');
    const names = [...window.document.querySelectorAll('#profile-favorite-categories input')].slice(0, 4).map(input => input.value);
    for (const [index, name] of names.slice(0, 3).entries()) {
      const checkbox = [...window.document.querySelectorAll('#profile-favorite-categories input')].find(input => input.value === name);
      checkbox.checked = true;
      checkbox.dispatchEvent(new window.Event('change'));
      assert.equal($('#profile-favorites-count').textContent, `${index + 1}/3`);
    }
    const fourth = [...window.document.querySelectorAll('#profile-favorite-categories input')].find(input => input.value === names[3]);
    assert.equal(fourth.disabled, true);
    fourth.checked = true;
    fourth.dispatchEvent(new window.Event('change'));
    assert.equal($('#profile-favorites-count').textContent, '3/3');
    $('#profile-favorite-search').value = 'no category matches';
    $('#profile-favorite-search').dispatchEvent(new window.Event('input'));
    assert.equal($('#profile-favorite-categories').children.length, 0);
    assert.equal($('#profile-selected-categories').children.length, 3);
    $('#profile-selected-categories button').click();
    assert.equal($('#profile-favorites-count').textContent, '2/3');
    assert.equal($('#profile-selected-categories').children.length, 2);
  } finally {
    dom.window.close();
  }
});

for (const result of ['success', 'upload-error', 'save-error']) {
  test(`avatar local: vista previa y guardado ${result}`, async () => {
    let savedProfile;
    const { dom, window, requests, $ } = startApp({
      avatarUploadError: result === 'upload-error' ? 'storage error' : null,
      fetchImpl: async (url, init) => {
        if (url !== '/api/profile' || init.method !== 'PUT') return undefined;
        savedProfile = JSON.parse(init.body);
        return { ok: result !== 'save-error', status: result === 'save-error' ? 500 : 200,
          json: async () => result === 'save-error' ? { error: 'PERFIL_NO_DISPONIBLE' } : { ...savedProfile, onboardingCompleted: true } };
      },
    });
    try {
      await tick();
      $('#user-menu-toggle').click();
      $('#open-user-settings').click();
      await waitFor(() => $('#user-profile-dialog').open);
      const file = new window.File(['image content'], 'avatar.png', { type: 'image/png' });
      Object.defineProperty($('#profile-avatar-file'), 'files', { configurable: true, value: [file] });
      $('#profile-avatar-file').dispatchEvent(new window.Event('change'));
      await waitFor(() => $('#profile-avatar-preview').src.startsWith('data:image/png;base64,'));
      assert.equal($('#profile-avatar-preview').hidden, false);
      assert.equal(window.__supabaseStub.calls.avatarUploads.length, 0);
      $('#user-profile-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
      await waitFor(() => $('#user-profile-save').disabled === false);
      const upload = window.__supabaseStub.calls.avatarUploads[0];
      assert.equal(upload.bucket, 'profile-avatars');
      assert.match(upload.path, /^user-a\/[0-9a-f-]+\.png$/);
      assert.equal(upload.options.upsert, false);
      if (result === 'success') {
        assert.match(savedProfile.avatarUrl, /^https:\/\/proyecto\.supabase\.test\/storage\/v1\/object\/public\/profile-avatars\/user-a\//);
        assert.equal($('#user-avatar').src, savedProfile.avatarUrl);
        assert.equal($('#user-profile-dialog').open, false);
      } else {
        assert.equal($('#user-profile-dialog').open, true);
        assert.match($('#profile-form-message').textContent, /No se pudo guardar/);
        assert.equal(window.__supabaseStub.calls.avatarRemovals.length, result === 'save-error' ? 1 : 0);
        if (result === 'upload-error') assert.equal(requests.some(({ init }) => init.method === 'PUT'), false);
      }
    } finally {
      dom.window.close();
    }
  });
}

test('el selector de avatar rechaza formatos y tamaños inválidos y cerrar no sube archivos', async () => {
  const { dom, window, $ } = startApp();
  try {
    await tick();
    $('#user-menu-toggle').click();
    $('#open-user-settings').click();
    await waitFor(() => $('#user-profile-dialog').open);
    assert.equal($('#profile-avatar-load').className, $('#logout').className);
    assert.match(styles, /#profile-avatar-load \{ font: 0\.85rem Arial, sans-serif; \}/);
    let filePickerOpened = false;
    $('#profile-avatar-file').addEventListener('click', (event) => {
      event.preventDefault();
      filePickerOpened = true;
    });
    $('#profile-avatar-load').click();
    assert.equal(filePickerOpened, true);
    for (const file of [
      new window.File(['<svg/>'], 'avatar.svg', { type: 'image/svg+xml' }),
      new window.File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }),
    ]) {
      Object.defineProperty($('#profile-avatar-file'), 'files', { configurable: true, value: [file] });
      $('#profile-avatar-file').dispatchEvent(new window.Event('change'));
      assert.match($('#profile-form-message').textContent, /hasta 2 MB/);
      assert.equal($('#profile-avatar-preview').hidden, true);
    }
    const file = new window.File(['image content'], 'avatar.png', { type: 'image/png' });
    Object.defineProperty($('#profile-avatar-file'), 'files', { configurable: true, value: [file] });
    $('#profile-avatar-file').dispatchEvent(new window.Event('change'));
    await waitFor(() => $('#profile-avatar-preview').hidden === false);
    $('#user-profile-close').click();
    assert.equal(window.__supabaseStub.calls.avatarUploads.length, 0);
    $('#user-menu-toggle').click();
    $('#open-user-settings').click();
    await waitFor(() => $('#user-profile-dialog').open);
    assert.equal($('#profile-avatar-preview').hidden, true);
  } finally {
    dom.window.close();
  }
});

test('eliminar cuenta pide confirmación, permite cancelar y solo cierra sesión después del borrado', async () => {
  const { dom, window, requests, $ } = startApp({
    fetchImpl: async (url, init) => url === '/api/profile' && init.method === 'DELETE'
      ? { ok: true, status: 204 } : undefined,
  });
  try {
    await tick();
    $('#user-menu-toggle').click();
    $('#open-user-settings').click();
    await waitFor(() => $('#user-profile-dialog').open);
    assert.equal($('#open-delete-account').hidden, false);
    assert.equal($('#open-delete-account').className, $('#logout').className);
    assert.match(styles, /#open-delete-account \{ font-size: 0\.75rem; \}/);
    assert.match(styles, /#delete-account-dialog \{ width: min\(400px, calc\(100% - 32px\)\); \}/);
    assert.equal($('#delete-account-message').textContent.includes('\n\nEsta acción no se puede deshacer.'), true);
    assert.match(styles, /#delete-account-message \{ white-space: pre-line; \}/);
    assert.match(styles, /#delete-account-error:empty \{ display: none; \}/);
    assert.equal($('#user-profile-dialog').lastElementChild.contains($('#open-delete-account')), true);
    $('#open-delete-account').click();
    assert.equal($('#delete-account-dialog').open, true);
    assert.equal(window.document.activeElement, $('#delete-account-cancel'));
    assert.equal(requests.some(({ init }) => init.method === 'DELETE'), false);
    $('#delete-account-cancel').click();
    assert.equal($('#delete-account-dialog').open, false);
    assert.equal($('#user-profile-dialog').open, true);
    assert.equal(window.document.activeElement, $('#open-delete-account'));
    assert.equal(window.__supabaseStub.calls.signOut.length, 0);
    $('#open-delete-account').click();
    $('#delete-account-cancel').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal($('#delete-account-dialog').open, false);
    assert.equal($('#user-profile-dialog').open, true);
    assert.equal(requests.some(({ init }) => init.method === 'DELETE'), false);
    $('#open-delete-account').click();
    $('#delete-account-confirm').click();
    $('#delete-account-confirm').click();
    await waitFor(() => $('#auth-message').textContent.includes('cuenta se ha eliminado'));
    const deletions = requests.filter(({ init }) => init.method === 'DELETE');
    assert.equal(deletions.length, 1);
    assert.equal(deletions[0].url, '/api/profile');
    assert.equal(deletions[0].init.body, undefined);
    assert.equal(deletions[0].init.headers.Authorization, 'Bearer token-navegador');
    assert.equal($('#auth-screen').hidden, false);
    assert.equal($('.page-shell').hidden, true);
    assert.equal($('#delete-account-dialog').open, false);
    assert.equal($('#user-profile-dialog').open, false);
    assert.equal($('#catalog-body').children.length, 0);
    assert.equal(window.__supabaseStub.calls.signOut.length, 1);
  } finally {
    dom.window.close();
  }
});

test('un fallo al eliminar cuenta conserva sesión y preferencias y permite reintentar', async () => {
  let rejectDeletion = true;
  const { dom, window, $ } = startApp({
    fetchImpl: async (url, init) => url === '/api/profile' && init.method === 'DELETE'
      ? { ok: !rejectDeletion, status: rejectDeletion ? 500 : 204 } : undefined,
  });
  try {
    await tick();
    $('#user-menu-toggle').click();
    $('#open-user-settings').click();
    await waitFor(() => $('#user-profile-dialog').open);
    $('#profile-avatar-url').value = 'https://example.invalid/unsaved.png';
    $('#open-delete-account').click();
    $('#delete-account-confirm').click();
    await waitFor(() => $('#delete-account-error').textContent !== '');
    assert.equal($('#delete-account-dialog').open, true);
    assert.equal($('#profile-avatar-url').value, 'https://example.invalid/unsaved.png');
    assert.equal($('#delete-account-confirm').disabled, false);
    assert.equal(window.__supabaseStub.calls.signOut.length, 0);
    assert.equal($('.page-shell').hidden, false);
    rejectDeletion = false;
    $('#delete-account-confirm').click();
    await waitFor(() => $('#auth-message').textContent.includes('cuenta se ha eliminado'));
  } finally {
    dom.window.close();
  }
});

test('un 401 del borrado pendiente de otra sesión no cierra la cuenta activa', async () => {
  let resolveDeletion;
  const { dom, window, $ } = startApp({
    fetchImpl: async (url, init) => url === '/api/profile' && init.method === 'DELETE'
      ? new Promise((resolve) => { resolveDeletion = resolve; }) : undefined,
  });
  try {
    await tick();
    $('#user-menu-toggle').click();
    $('#open-user-settings').click();
    await waitFor(() => $('#user-profile-dialog').open);
    $('#open-delete-account').click();
    $('#delete-account-confirm').click();
    await waitFor(() => typeof resolveDeletion === 'function');
    $('#delete-account-cancel').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal($('#delete-account-dialog').open, true);
    window.__supabaseStub.setSession('SIGNED_IN', {
      access_token: 'other-token', user: { id: 'other-user', user_metadata: {} },
    });
    await tick();
    resolveDeletion({ ok: false, status: 401 });
    await tick();
    assert.equal($('.page-shell').hidden, false);
    assert.equal(window.__supabaseStub.calls.signOut.length, 0);
    assert.equal($('#delete-account-dialog').open, false);
  } finally {
    dom.window.close();
  }
});

test('Preferencias solo ofrece Cerrar para descartar cambios y restaura el foco', async () => {
  const { dom, $ } = startApp();
  await waitFor(() => $('.page-shell').hidden === false);
  $('#user-menu-toggle').click();
  const settingsButton = $('#open-user-settings');
  settingsButton.focus();
  settingsButton.click();
  await waitFor(() => $('#user-profile-dialog').open);
  assert.equal($('#user-profile-dialog-title').textContent, 'Preferencias');
  assert.equal($('#profile-username').value, 'SpaceFan');
  assert.equal($('#profile-username').disabled, true);
  assert.equal($('#user-profile-cancel'), null);
  assert.equal($('#user-profile-close').hidden, false);
  $('#user-profile-close').click();
  assert.equal($('#user-profile-dialog').open, false);
  assert.equal(dom.window.document.activeElement, settingsButton);
  dom.window.close();
});

test('la espera del perfil reutiliza el indicador de los modales y lo retira al fallar', async () => {
  let resolveProfile;
  const { dom, $ } = startApp({ fetchImpl: (url) => url === '/api/profile'
    ? new Promise((resolve) => { resolveProfile = resolve; }) : undefined });
  try {
    await waitFor(() => typeof resolveProfile === 'function');
    const message = $('#auth-message');
    assert.equal(message.textContent, 'Comprobando tu perfil…');
    assert.equal(message.className, 'status loading-message');
    assert.equal(message.getAttribute('role'), 'status');
    assert.equal(message.getAttribute('aria-live'), 'polite');
    assert.equal(message.getAttribute('aria-busy'), 'true');
    resolveProfile({ ok: false, status: 503 });
    await waitFor(() => $('#profile-check-retry').hidden === false);
    assert.equal(message.classList.contains('loading-message'), false);
    assert.equal(message.classList.contains('error'), true);
    assert.equal(message.getAttribute('aria-busy'), 'false');
  } finally {
    dom.window.close();
  }
});

test('fallo al leer el perfil permite reintentar y solo después carga la colección', async () => {
  let profileRequests = 0;
  const { dom, requests, $ } = startApp({ fetchImpl: async (url) => {
    if (url !== '/api/profile') return undefined;
    profileRequests += 1;
    return profileRequests === 1
      ? { ok: false, status: 503, json: async () => ({ error: 'PERFIL_NO_DISPONIBLE' }) }
      : { ok: true, status: 200, json: async () => completeProfile };
  } });
  await waitFor(() => $('#profile-check-retry').hidden === false);
  assert.equal($('.page-shell').hidden, true);
  assert.deepEqual(requests.map(({ url }) => url), ['/api/profile']);
  $('#profile-check-retry').click();
  await waitFor(() => requests.some(({ url }) => url === '/minifiguras'));
  assert.equal(profileRequests, 2);
  assert.equal($('#auth-screen').hidden, true);
  dom.window.close();
});

test('una respuesta tardía del perfil de otra sesión no desbloquea el inventario', async () => {
  const sessionA = { access_token: 'token-a', user: { id: 'user-a', email: 'a@example.com' } };
  const sessionB = { access_token: 'token-b', user: { id: 'user-b', email: 'b@example.com' } };
  const pendingProfiles = new Map();
  const { dom, window, requests, $ } = startApp({
    session: sessionA,
    fetchImpl: (url, init) => url === '/api/profile'
      ? new Promise((resolve) => pendingProfiles.set(init.headers.Authorization, resolve))
      : undefined,
  });
  await waitFor(() => pendingProfiles.has('Bearer token-a'));
  window.__supabaseStub.setSession('SIGNED_IN', sessionB);
  await waitFor(() => pendingProfiles.has('Bearer token-b'));
  pendingProfiles.get('Bearer token-a')({ ok: true, status: 200, json: async () => completeProfile });
  await tick();
  assert.equal($('.page-shell').hidden, true);
  assert.equal(requests.some(({ url }) => url === '/minifiguras'), false);
  pendingProfiles.get('Bearer token-b')({
    ok: true, status: 200, json: async () => ({ ...completeProfile, username: null, onboardingCompleted: false }),
  });
  await waitFor(() => $('#auth-message').textContent.includes('Completa tu perfil'));
  assert.equal($('.page-shell').hidden, true);
  assert.equal(requests.some(({ url }) => url === '/minifiguras'), false);
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
  assert.equal($('#user-profile').title, 'SpaceFan');
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
    if (url === '/api/profile') return { ok: true, status: 200, json: async () => completeProfile };
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
  for (let attempt = 0; attempt < 5 && typeof resolveOldDna !== 'function'; attempt += 1) await tick();
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
