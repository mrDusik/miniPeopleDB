import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { categoriasMockRaw } from '../test-support/fixtures.js';
import { withSupabaseSession } from '../test-support/browser-auth.js';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');

const friendRows = {
  friends: [{ userId: 'friend-a', username: 'BrickFan', avatarUrl: 'https://avatar.example/a.png', bricks: 240, level: { id: 4, name: 'Citizen' }, globalPosition: 3, status: 'accepted' }],
  sent: [
    { userId: 'friend-b', username: 'CastleFan', avatarUrl: null, bricks: 50, level: { id: 2, name: 'Level' }, globalPosition: null, status: 'rejected' },
    { userId: 'friend-d', username: 'CityFan', avatarUrl: null, bricks: 20, level: { id: 1, name: 'Level' }, globalPosition: null, status: 'pending' },
  ],
  received: [{ userId: 'friend-c', username: 'SpaceFan', avatarUrl: null, bricks: 120, level: { id: 3, name: 'Level' }, globalPosition: 7, relationshipId: 'request-c', status: 'pending' }],
};

function createApp({ failLists = false, failSearch = false, failActions = false, failProfile = false, searchFriend = false, profileOverrides = {}, catalog = [], minifiguraError = null } = {}) {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLCanvasElement.prototype.getContext = () => ({});
  window.__profileCharts = [];
  window.Chart = class ChartMock {
    constructor(context, configuration) {
      this.configuration = configuration;
      this.destroyed = false;
      window.__profileCharts.push(this);
    }
    destroy() { this.destroyed = true; }
  };
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  window.HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  const requests = [];
  const storedCatalog = structuredClone(catalog);
  let removed = false;
  window.fetch = async (url, init = {}) => {
    requests.push({ url, init });
    if (url === '/categorias') return { ok: true, json: async () => JSON.parse(categoriasMockRaw) };
    if (url === '/minifiguras' && init.method === 'POST') {
      if (minifiguraError) return { ok: false, status: 500, json: async () => ({ error: minifiguraError }) };
      const figure = JSON.parse(init.body);
      storedCatalog.push(figure);
      return { ok: true, status: 201, json: async () => figure };
    }
    if (url === '/minifiguras' || url.startsWith('/minifiguras?')) return { ok: true, json: async () => structuredClone(storedCatalog) };
    if (url === '/valoracion') return { ok: true, json: async () => ({ total: 0, enColeccion: 0, buscadas: 0, top5: [], top5Antiguas: [] }) };
    if (url === '/gamificacion') return { ok: true, json: async () => ({ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, progreso: { porcentaje: 0 }, logros: [] }) };
    if (url === '/gamificacion/dna') return { ok: true, json: async () => ({ principal: 'Newbie', porcentajes: { rarityHunter: 0, collector: 0, explorer: 0, fan: 0 } }) };
    if (url === '/sincronizacion/brickset') return { ok: true, json: async () => ({ estado: 'idle' }) };
    if (url === '/api/profile') return { ok: true, json: async () => ({ username: 'Viewer', onboardingCompleted: true, favoriteCategories: [], currency: 'EUR', language: 'es', avatarUrl: null }) };
    if (url.startsWith('/api/notificaciones')) return { ok: true, json: async () => ({ notifications: [], unreadCount: 0, nextCursor: null }) };
    if (url === '/api/amigos/contadores') return { ok: true, json: async () => ({ friends: removed ? 0 : 1, sent: 2, received: 3 }) };
    if (init.method === 'DELETE' && url.startsWith('/api/amigos/')) {
      if (!failActions) removed = true;
      return { ok: !failActions, json: async () => ({ ok: !failActions, removed: !failActions }) };
    }
    if (url.startsWith('/api/amigos?tipo=')) {
      const type = new URL(url, 'http://localhost').searchParams.get('tipo');
      return { ok: !failLists, json: async () => failLists ? { error: 'AMIGOS_NO_DISPONIBLES' } : { users: structuredClone(friendRows[type] ?? []) } };
    }
    if (url.startsWith('/api/amigos/buscar?')) {
      return { ok: !failSearch, json: async () => failSearch ? { error: 'AMIGOS_NO_DISPONIBLES' } : { users: [
        { userId: 'search-user', username: 'SpaceFan', avatarUrl: null, bricks: 35, level: { id: 1, name: 'Level' }, globalPosition: 8, relationshipStatus: searchFriend && !removed ? 'friend' : 'none' },
      ] } };
    }
    if (url === '/api/amigos/solicitudes' || url.startsWith('/api/amigos/solicitudes/')) {
      return { ok: !failActions, status: failActions ? 500 : 200, json: async () => failActions ? { error: 'AMIGOS_NO_DISPONIBLES' } : { ok: true, requestId: '00000000-0000-4000-8000-000000000001', status: 'accepted' } };
    }
    if (url.startsWith('/api/amigos/') && url.endsWith('/perfil')) {
      const userId = url.split('/')[3];
      return { ok: !failProfile, json: async () => failProfile ? { error: 'AMIGOS_NO_DISPONIBLES' } : ({
        userId, username: userId === 'search-user' ? 'SearchFan' : 'BrickFan', avatarUrl: null, bricks: 240, level: { id: 4, name: 'Citizen' },
        dna: { rarityHunter: 10, explorer: 20, collector: 60, fan: 10 },
        top5Price: [{ id: 'A-1', name: 'High', price: 50, year: 2020, category: 'Space' }],
        top5Age: [{ id: 'A-2', name: 'Old', year: 1980, price: 20, category: 'Space' }],
        collection: { total: 8, latest: [{ id: 'A-3', name: 'Recent', year: 2024, price: 12, category: 'Space' }] },
        wanted: { total: 2, latest: [{ id: 'B-1', name: 'Wanted', year: 2023, price: 14, category: 'Space' }] },
        achievements: [{ id: 'collector', name: 'Collector', description: 'Complete a collection.', quantity: 5, total: 25 }],
        ...profileOverrides,
      }) };
    }
    if (url === '/api/ranking' || url.startsWith('/api/ranking?')) return { ok: true, json: async () => [] };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  window.eval(withSupabaseSession(script, { session: {
    access_token: 'token-a', user: { id: 'viewer-a', email: 'viewer@example.invalid' },
  } }));
  return { dom, window, requests };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('las solicitudes enviadas y recibidas abren el perfil y devuelven el foco a la fila', async () => {
  for (const type of ['sent', 'received']) {
    const { dom, window, requests } = createApp();
    try {
      await tick();
      await tick();
      const document = window.document;
      document.querySelector('#open-friends').click();
      document.querySelector(`#friends-tab-${type}`).click();
      await tick();
      const trigger = document.querySelector(`#friends-list-${type} .friends-user-button`);
      trigger.querySelector('.ranking-name').click();
      await tick();
      assert.equal(document.querySelector('#public-profile-dialog').open, true);
      assert.ok(requests.some(({ url }) => url === `/api/amigos/${trigger.dataset.profileUser}/perfil`));
      assert.equal(requests.some(({ init }) => init.method === 'POST'), false);
      document.querySelector('#public-profile-close').click();
      assert.equal(document.activeElement, trigger);
      assert.equal(document.querySelector('#friends-dialog').open, true);
    } finally {
      dom.window.close();
    }
  }
});

test('el buscador no muestra instrucciones de longitud pero mantiene el umbral de búsqueda', async () => {
  const { dom, window, requests } = createApp();
  try {
    await tick();
    await tick();
    const document = window.document;
    document.querySelector('#open-friends').click();
    document.querySelector('#friends-tab-search').click();
    const search = document.querySelector('#friends-search');
    assert.doesNotMatch(search.placeholder, /al menos/i);
    assert.equal(document.querySelector('#friends-status-search').textContent, '');
    search.value = 'Sp';
    search.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(document.querySelector('#friends-status-search').textContent, '');
    assert.equal(requests.some(({ url }) => url.includes('/api/amigos/buscar')), false);
    assert.equal(search.minLength, 3);
    await tick();
  } finally {
    dom.window.close();
  }
});

test('los ajustes de anchura y tarjetas se limitan al monitor con ratón', () => {
  const dom = new JSDOM(`<style>${styles}</style>`);
  try {
    const rules = [...dom.window.document.styleSheets[0].cssRules];
    const monitorRules = rules.filter((rule) => rule.conditionText === '(min-width: 761px) and (hover: hover) and (pointer: fine)')
      .flatMap((rule) => [...rule.cssRules]);
    const declaration = (selector) => monitorRules.find((rule) => rule.selectorText === selector)?.style;
    assert.equal(declaration('.modal-friends').getPropertyValue('width'), 'min(759px, calc(100% - 24px))');
    assert.equal(declaration('.modal-public-profile').getPropertyValue('width'), 'min(1280px, calc(100% - 24px))');
    assert.equal(declaration('.modal-public-profile .public-profile-tops').getPropertyValue('grid-template-columns'), 'repeat(auto-fit, minmax(min(100%, 584px), 1fr))');
    assert.equal(declaration('.public-profile-figures > li').getPropertyValue('flex-basis'), '112px');
    assert.equal(declaration('.modal-ranking .ranking-highlight-group .ranking-card-static').getPropertyValue('flex-basis'), '112px');
    assert.equal(declaration('.public-profile-figures .ranking-caption, .ranking-highlight-group .ranking-caption').getPropertyValue('white-space'), 'normal');
  } finally {
    dom.window.close();
  }
});

test('las tarjetas de modales amplian la imagen y superponen la lupa sin reservar una franja superior', () => {
  const dom = new JSDOM(`<style>${styles}</style>`);
  try {
    const rules = [...dom.window.document.styleSheets[0].cssRules];
    const declaration = (selector) => rules.find((rule) => rule.selectorText === selector)?.style;
    const cards = declaration('.modal-public-profile .ranking-card-static, .modal-ranking .ranking-card-static');
    assert.equal(cards.getPropertyValue('grid-template-rows'), '96px auto');
    assert.equal(cards.getPropertyValue('padding'), '6px 4px');
    const images = declaration('.modal-public-profile .ranking-card-static .ranking-img, .modal-ranking .ranking-card-static .ranking-img');
    assert.equal(images.getPropertyValue('width'), '96px');
    assert.equal(images.getPropertyValue('height'), '96px');
    const action = declaration('.ranking-add-wanted');
    assert.equal(action.getPropertyValue('position'), 'absolute');
    assert.equal(action.getPropertyValue('top'), '3px');
    assert.equal(action.getPropertyValue('right'), '3px');
    assert.equal(action.getPropertyValue('border'), '0');
    assert.equal(action.getPropertyValue('background'), 'transparent');
    assert.equal(action.getPropertyValue('min-height'), '36px');
    assert.equal(declaration('.ranking-card').getPropertyValue('grid-template-rows'), '48px auto');
    for (const rule of rules.filter((entry) => entry.cssRules)) {
      for (const nested of rule.cssRules) {
        if (nested.selectorText?.includes('.ranking-card')) {
          assert.equal(nested.style.getPropertyValue('padding-top'), '');
        }
      }
    }
  } finally {
    dom.window.close();
  }
});

test('elimina amigos desde lista y buscador sin abrir perfil, actualiza contador y evita doble envío', async () => {
  for (const type of ['friends', 'search']) {
    const { dom, window, requests } = createApp({ searchFriend: true });
    try {
      await tick();
      await tick();
      const document = window.document;
      document.querySelector('#open-friends').click();
      if (type === 'search') {
        document.querySelector('#friends-tab-search').click();
        const input = document.querySelector('#friends-search');
        input.value = 'Spa';
        input.dispatchEvent(new window.Event('input', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      await tick();
      const remove = document.querySelector(`#friends-list-${type} .friends-remove`);
      assert.ok(remove);
      remove.click();
      document.querySelector(`#friends-list-${type} .friends-remove`).click();
      await tick();
      await tick();
      assert.equal(requests.filter(({ init }) => init.method === 'DELETE').length, 1);
      assert.equal(document.querySelector('#public-profile-dialog').open, false);
      assert.equal(document.querySelector('#friends-count').textContent, '0');
      assert.equal(document.querySelector('#friends-tab-friends').textContent, 'Amigos (0)');
      if (type === 'friends') assert.equal(document.querySelectorAll('#friends-list-friends .friends-row').length, 0);
      else assert.ok(document.querySelector('#friends-list-search .friends-send-request'));
    } finally {
      dom.window.close();
    }
  }
});

test('un borrado fallido conserva fila y contador y muestra error recuperable', async () => {
  const { dom, window } = createApp({ failActions: true });
  try {
    await tick();
    await tick();
    window.document.querySelector('#open-friends').click();
    await tick();
    window.document.querySelector('.friends-remove').click();
    await tick();
    assert.equal(window.document.querySelector('.friends-action-error').textContent, 'No se pudo eliminar la amistad.');
    assert.equal(window.document.querySelector('.friends-remove').disabled, false);
    assert.equal(window.document.querySelector('#friends-count').textContent, '1');
  } finally {
    dom.window.close();
  }
});

test('un fallo de contadores oculta el número y no inventa cero', async () => {
  const { dom, window } = createApp();
  try {
    await tick();
    await tick();
    const originalFetch = window.fetch;
    window.fetch = (url, init) => url === '/api/amigos/contadores'
      ? Promise.resolve({ ok: false, json: async () => ({ error: 'AMIGOS_NO_DISPONIBLES' }) }) : originalFetch(url, init);
    window.document.querySelector('#open-friends').click();
    await tick();
    assert.equal(window.document.querySelector('#friends-count').hidden, true);
    assert.equal(window.document.querySelector('#friends-tab-friends').textContent, 'Amigos (?)');
  } finally {
    dom.window.close();
  }
});

test('contadores tardíos no conservan números de otra sesión', async () => {
  const { dom, window } = createApp();
  try {
    await tick();
    await tick();
    const originalFetch = window.fetch;
    let resolveCounts;
    window.fetch = (url, init) => url === '/api/amigos/contadores'
      ? new Promise((resolve) => { resolveCounts = resolve; }) : originalFetch(url, init);
    window.document.querySelector('#open-friends').click();
    window.__supabaseStub.setSession('SIGNED_OUT', null);
    await tick();
    resolveCounts({ ok: true, json: async () => ({ friends: 999, sent: 999, received: 999 }) });
    await tick();
    assert.equal(window.document.querySelector('#friends-count').hidden, true);
    assert.equal(window.document.querySelector('#friends-count').textContent, '');
    assert.equal(window.document.querySelector('#friends-tab-friends').textContent, 'Amigos (?)');
  } finally {
    dom.window.close();
  }
});

test('el launcher abre el modal accesible de cuatro pestañas y la lista muestra estados resumidos', async () => {
  const { dom, window, requests } = createApp();
  try {
    await tick();
    await tick();
    const document = window.document;
    const launcher = document.querySelector('#open-friends');
    const dialog = document.querySelector('#friends-dialog');
    const tabs = [...dialog.querySelectorAll('[role="tab"]')];
    assert.equal(launcher.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(launcher.getAttribute('aria-controls'), 'friends-dialog');
    assert.equal(dialog.getAttribute('aria-labelledby'), 'friends-dialog-title');
    assert.deepEqual(tabs.map((tab) => tab.getAttribute('aria-label') ?? tab.textContent.trim()), [
      'Amigos (1)', 'Buscador', 'Solicitudes Enviadas (2)', 'Solicitudes Recibidas (3)',
    ]);
    assert.equal(tabs[2].querySelector('.friends-tab-label-full').textContent, 'Solicitudes Enviadas (2)');
    assert.equal(tabs[2].querySelector('.friends-tab-label-short').textContent, 'Sol. Enviadas (2)');
    assert.equal(tabs[3].querySelector('.friends-tab-label-short').textContent, 'Sol. Recibidas (3)');
    assert.equal(tabs[3].querySelector('.friends-tab-label-short').getAttribute('aria-hidden'), 'true');
    assert.equal(launcher.getAttribute('aria-label'), 'Amigos: 1');
    assert.equal(document.querySelector('#friends-count').textContent, '1');
    assert.equal(tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true').length, 1);

    launcher.click();
    await tick();
    assert.equal(dialog.open, true);
    assert.equal(document.activeElement.id, 'friends-tab-friends');
    assert.equal(document.querySelector('#friends-list-friends .friends-row').dataset.userId, 'friend-a');
    const friendRow = document.querySelector('#friends-list-friends .friends-row');
    assert.equal(friendRow.querySelector('.friends-username').textContent, 'BrickFan');
    assert.equal(friendRow.querySelector('.ranking-level-number').textContent, '4');
    assert.equal(friendRow.querySelector('.ranking-bricks strong').textContent, '240');
    assert.equal(friendRow.querySelector('.ranking-position').textContent, '#3');
    assert.ok(friendRow.querySelector('.gamification-level-image'));
    assert.ok(friendRow.querySelector('.ranking-collection-count img'));
    assert.ok(friendRow.querySelector('.friends-remove'));
    assert.equal(requests.some(({ url }) => url === '/api/amigos?tipo=friends'), true);

    tabs[2].click();
    await tick();
    assert.equal(document.querySelectorAll('#friends-list-sent .friends-row').length, 2);
    assert.equal(document.querySelector('#friends-list-sent .friends-request-state'), null);
    assert.doesNotMatch(document.querySelector('#friends-list-sent').textContent, /Pendiente|Rechazada|Enviada|Aceptada/);

    tabs[2].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await tick();
    assert.equal(tabs[3].getAttribute('aria-selected'), 'true');
    assert.equal(document.querySelector('#friends-list-received .friends-request-state'), null);
    const accept = document.querySelector('#friends-list-received .friends-accept-request');
    const reject = document.querySelector('#friends-list-received .friends-reject-request');
    assert.equal(accept.textContent, '+');
    assert.equal(reject.textContent, 'Rechazar');
    assert.equal(reject.classList.contains('logout-link'), true);
    assert.equal(accept.getAttribute('aria-label'), 'Aceptar solicitud de amistad de SpaceFan');
    assert.equal(reject.getAttribute('aria-label'), 'Rechazar solicitud de amistad de SpaceFan');
    assert.equal(accept.title, accept.getAttribute('aria-label'));
    assert.equal(reject.title, reject.getAttribute('aria-label'));
    assert.equal(accept.querySelector('img').getAttribute('src'), '/status_images/friends.png');
    assert.equal(reject.querySelector('img'), null);
    assert.equal(accept.parentElement.classList.contains('friends-request-controls'), true);
    assert.match(styles, /\.friends-request-controls \{[^}]*grid-template-columns: 64px 76px/);
    assert.match(styles, /\.friends-request-actions \{[^}]*flex-wrap: nowrap/);
    assert.match(styles, /\.friends-list \.friends-row \{[^}]*grid-template-columns: minmax\(0, 1fr\) max-content/);
    assert.equal(document.querySelector('#friends-list-received .friends-username').textContent, 'SpaceFan');
    tabs[3].click();
    await tick();
    assert.equal(document.querySelector('#friends-list-received .friends-request-state'), null);

    tabs[1].click();
    assert.equal(document.activeElement.id, 'friends-search');
    assert.equal(document.querySelector('#friends-panel-search').hidden, false);
    assert.equal(document.querySelector('#friends-search').minLength, 3);
    assert.equal(requests.some(({ url }) => url.includes('/api/amigos/buscar')), false);

    document.querySelector('#friends-close').click();
    assert.equal(dialog.open, false);
    assert.equal(document.activeElement, launcher);
    assert.match(styles, /\.friends-tabs \.button\[aria-selected="true"\]/);
    assert.match(styles, /\.friends-row\s*\{/);
  } finally {
    dom.window.close();
  }
});

test('las listas anuncian errores controlados y las cuatro pestañas consultan su tipo', async () => {
  const { dom, window, requests } = createApp({ failLists: true });
  try {
    await tick();
    await tick();
    const document = window.document;
    document.querySelector('#open-friends').click();
    await tick();
    assert.equal(document.querySelector('#friends-status-friends').textContent, 'No se pudo cargar esta lista.');
    assert.equal(document.querySelector('#friends-status-friends').className, 'status error');
    document.querySelector('#friends-tab-sent').click();
    await tick();
    document.querySelector('#friends-tab-received').click();
    await tick();
    assert.deepEqual(requests.filter(({ url }) => url.startsWith('/api/amigos?tipo=')).map(({ url }) => url), [
      '/api/amigos?tipo=friends', '/api/amigos?tipo=sent', '/api/amigos?tipo=received',
    ]);
  } finally {
    dom.window.close();
  }
});

test('busca solo desde tres caracteres, envía una vez y conserva acciones de rechazo y aceptación', async () => {
  const { dom, window, requests } = createApp();
  try {
    await tick();
    await tick();
    const document = window.document;
    document.querySelector('#open-friends').click();
    document.querySelector('#friends-tab-search').click();
    const search = document.querySelector('#friends-search');
    search.value = 'Sp';
    search.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(requests.some(({ url }) => url.startsWith('/api/amigos/buscar?')), false);
    assert.equal(document.querySelector('#friends-status-search').textContent, '');

    search.value = 'Spa';
    search.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(requests.some(({ url }) => url === '/api/amigos/buscar?q=Spa'), true);
    assert.equal(document.querySelector('#friends-list-search .friends-username').textContent, 'SpaceFan');
    const send = document.querySelector('.friends-send-request');
    assert.equal(send.getAttribute('aria-label'), 'Solicitar amistad a SpaceFan');
    assert.equal(send.title, 'Solicitar amistad a SpaceFan');
    assert.equal(send.querySelector('.notification-friend-plus').textContent, '+');
    assert.equal(send.querySelector('.notification-friend-icon').getAttribute('src'), '/status_images/friends.png');
    assert.equal(send.textContent, '+');
    send.click();
    await tick();
    assert.equal(document.querySelector('#friends-list-search .friends-request-state').textContent, 'Enviada');
    assert.equal(document.querySelector('.friends-send-request'), null);
    const sendRequest = requests.find(({ url }) => url === '/api/amigos/solicitudes');
    assert.equal(sendRequest.init.method, 'POST');
    assert.deepEqual(JSON.parse(sendRequest.init.body), { receptorId: 'search-user' });

    document.querySelector('#friends-tab-received').click();
    await tick();
    const reject = document.querySelector('.friends-reject-request');
    const requestId = reject.dataset.requestId;
    reject.click();
    await tick();
    assert.equal(document.querySelector('#friends-list-received .friends-request-state').textContent, 'Rechazada');
    assert.equal(document.querySelector('.friends-reject-request'), null);
    assert.ok(document.querySelector('.friends-accept-request'));
    document.querySelector('.friends-accept-request').click();
    await tick();
    const accepted = document.querySelector('.friends-accepted-button');
    assert.equal(accepted.textContent, 'Aceptada');
    assert.equal(accepted.disabled, true);
    assert.equal(requests.some(({ url }) => url.endsWith(`/${requestId}/rechazar`)), true);
    assert.equal(requests.some(({ url }) => url.endsWith(`/${requestId}/aceptar`)), true);

    document.querySelector('#friends-tab-friends').click();
    await tick();
    assert.equal(document.querySelector('#friends-list-friends .friends-username').textContent, 'BrickFan');
  } finally {
    dom.window.close();
  }
});

test('los fallos de búsqueda y envío muestran errores y permiten reintentar', async () => {
  const { dom, window } = createApp({ failSearch: true, failActions: true });
  try {
    await tick();
    await tick();
    const document = window.document;
    document.querySelector('#open-friends').click();
    document.querySelector('#friends-tab-search').click();
    const search = document.querySelector('#friends-search');
    search.value = 'Space';
    search.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(document.querySelector('#friends-status-search').textContent, 'No se pudo realizar la búsqueda.');
    assert.equal(document.querySelector('#friends-status-search').className, 'status error');
  } finally {
    dom.window.close();
  }
});

test('descarta una respuesta de búsqueda pendiente al cerrar la sesión', async () => {
  const { dom, window } = createApp();
  try {
    await tick();
    await tick();
    const originalFetch = window.fetch;
    let resolveSearch;
    window.fetch = (url, init) => url.startsWith('/api/amigos/buscar?')
      ? new Promise((resolve) => { resolveSearch = resolve; })
      : originalFetch(url, init);
    const document = window.document;
    document.querySelector('#open-friends').click();
    document.querySelector('#friends-tab-search').click();
    const search = document.querySelector('#friends-search');
    search.value = 'Space';
    search.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    window.__supabaseStub.setSession('SIGNED_OUT', null);
    await tick();
    resolveSearch({ ok: true, json: async () => ({ users: [
      { userId: 'stale-user', username: 'OldSession', avatarUrl: null, bricks: 0, level: {}, relationshipStatus: 'none' },
    ] }) });
    await tick();
    assert.equal(document.querySelector('#friends-dialog').open, false);
    assert.equal(document.querySelectorAll('#friends-list-search .friends-row').length, 0);
    assert.equal(document.querySelector('#friends-search').value, '');
  } finally {
    dom.window.close();
  }
});

test('abre el perfil reutilizable desde amigos y buscador, muestra el resumen y restaura foco', async () => {
  const { dom, window, requests } = createApp();
  try {
    await tick();
    await tick();
    const document = window.document;
    document.querySelector('#open-friends').click();
    await tick();
    const profileTrigger = document.querySelector('#friends-list-friends .friends-user-button');
    profileTrigger.click();
    await tick();
    const dialog = document.querySelector('#public-profile-dialog');
    assert.equal(dialog.open, true);
    assert.equal(document.activeElement.id, 'public-profile-close');
    assert.equal(document.querySelector('#public-profile-title').textContent, 'BrickFan');
    assert.equal(document.querySelector('#public-profile-bricks').textContent, '240');
    assert.equal(document.querySelector('#public-profile-collection-count').textContent, '8');
    assert.equal(document.querySelector('#public-profile-wanted-count').textContent, '2');
    assert.equal(document.querySelector('#public-profile-top-price .public-profile-figure-name'), null);
    assert.equal(document.querySelector('#public-profile-top-price .ranking-img').alt, 'High');
    assert.match(document.querySelector('#public-profile-top-price .ranking-caption').textContent, /50,00/);
    assert.equal(document.querySelector('#public-profile-latest-wanted .ranking-img').alt, 'Wanted');
    assert.equal(document.querySelector('#public-profile-achievements .achievement-name').textContent, 'Collector');
    assert.equal(document.querySelector('#public-profile-achievements .achievement-bricks strong').textContent, '25');
    assert.equal(document.querySelector('#public-profile-content').hidden, false);
    assert.equal(requests.filter(({ url }) => url === '/api/amigos/friend-a/perfil').length, 1);

    document.querySelector('#public-profile-close').click();
    assert.equal(dialog.open, false);
    assert.equal(document.activeElement, profileTrigger);
    assert.equal(document.querySelector('#public-profile-content').hidden, true);

    document.querySelector('#friends-tab-search').click();
    const search = document.querySelector('#friends-search');
    search.value = 'Space';
    search.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    document.querySelector('#friends-list-search .friends-user-button').click();
    await tick();
    assert.equal(dialog.open, true);
    assert.equal(document.querySelector('#public-profile-title').textContent, 'SearchFan');
    document.querySelector('#public-profile-close').click();
  } finally {
    dom.window.close();
  }
});

test('el perfil reutiliza gráfico, iconos y tarjetas y destruye el gráfico al cerrar o cambiar sesión', async () => {
  const { dom, window } = createApp();
  try {
    await tick();
    await tick();
    const document = window.document;
    document.querySelector('#open-friends').click();
    await tick();
    const trigger = document.querySelector('#friends-list-friends .friends-user-button');
    const ownBricks = document.querySelector('#gamification-bricks').textContent;
    trigger.click();
    await tick();
    const instance = window.__profileCharts.at(-1);
    assert.equal(instance.configuration.type, 'doughnut');
    assert.deepEqual(Array.from(instance.configuration.data.datasets[0].data), [10, 20, 60, 10]);
    assert.equal(instance.configuration.options.cutout, '70%');
    assert.equal(document.querySelector('#public-profile-dna-trait').textContent, 'Collector');
    assert.equal(document.querySelector('#public-profile-dna-percentage').textContent, '60%');
    const centerLabel = document.querySelector('#public-profile-dna-chart .dna-chart-label');
    instance.configuration.options.plugins.tooltip.external({ tooltip: { opacity: 1 } });
    assert.equal(centerLabel.hidden, true);
    instance.configuration.options.plugins.tooltip.external({ tooltip: { opacity: 0 } });
    assert.equal(centerLabel.hidden, false);
    assert.equal(document.querySelectorAll('.public-profile-stats > div > span').length, 0);
    assert.equal(document.querySelectorAll('#public-profile-dialog .dna-legend-item').length, 0);
    assert.equal(instance.configuration.options.plugins.tooltip.callbacks.label({ label: 'Collector', raw: 60 }), 'Collector: 60%');
    assert.equal(document.querySelectorAll('.public-profile-stat-icon').length, 4);
    assert.equal(document.querySelector('#public-profile-level-image').getAttribute('src'), '/level_images/4_citizen.png');
    assert.equal(document.querySelectorAll('#public-profile-content .ranking-card').length, 4);
    assert.equal(document.querySelectorAll('#public-profile-content [data-action], #public-profile-content [data-gift-user]').length, 0);
    assert.equal(document.querySelectorAll('#public-profile-content .ranking-add-wanted').length, 4);
    assert.equal(document.querySelector('#public-profile-content .ranking-add-wanted img').getAttribute('src'), '/status_images/lupa.png');
    assert.equal(document.querySelector('#public-profile-content .ranking-add-wanted').textContent, '');
    assert.equal(document.querySelector('#public-profile-content .ranking-add-wanted').getAttribute('aria-label'), 'Añadir a buscadas');
    assert.equal(document.querySelector('#public-profile-achievements .achievement-icon').getAttribute('src'), '/toast_images/75206.png');
    assert.equal(document.querySelector('#public-profile-achievements .achievement-count').textContent, 'x5');
    const overview = document.querySelector('.public-profile-overview');
    assert.deepEqual([...overview.children].map((section) => section.className), [
      'public-profile-section public-profile-dna-section', 'public-profile-section public-profile-awards',
    ]);
    assert.equal(overview.previousElementSibling.className, 'public-profile-stats');
    assert.equal(document.querySelector('#public-profile-achievements-title').textContent, 'Logros más importantes');
    assert.equal(document.querySelector('#public-profile-level').title, '4 Citizen');
    assert.equal(overview.nextElementSibling.className, 'public-profile-tops');
    assert.match(styles, /#public-profile-level \{[^}]*white-space: nowrap/);
    assert.match(styles, /\.public-profile-figures \.ranking-img \{[^}]*width: 64px/);
    assert.equal(document.querySelector('#gamification-bricks').textContent, ownBricks);
    const figureImage = document.querySelector('#public-profile-top-price .ranking-img');
    figureImage.dispatchEvent(new window.Event('error'));
    assert.equal(figureImage.getAttribute('src'), '/logo_images/image_fallback.png');
    assert.equal(figureImage.style.display, '');
    document.querySelector('#public-profile-close').click();
    assert.equal(instance.destroyed, true);
    assert.equal(document.querySelector('#public-profile-dna-chart').hidden, true);
    assert.equal(document.activeElement, trigger);
    trigger.click();
    await tick();
    const second = window.__profileCharts.at(-1);
    assert.notEqual(second, instance);
    window.__supabaseStub.setSession('SIGNED_OUT', null);
    await tick();
    assert.equal(second.destroyed, true);
    assert.equal(document.querySelector('#public-profile-dialog').open, false);
  } finally {
    dom.window.close();
  }
});

test('un perfil vacío conserva DNA Newbie y no inventa tarjetas ni logros', async () => {
  const { dom, window } = createApp({ profileOverrides: {
    dna: { rarityHunter: 0, explorer: 0, collector: 0, fan: 0 }, top5Price: [], top5Age: [],
    collection: { total: 0, latest: [] }, wanted: { total: 0, latest: [] }, achievements: [],
  } });
  try {
    await tick();
    await tick();
    const document = window.document;
    document.querySelector('#open-friends').click();
    await tick();
    document.querySelector('#friends-list-friends .friends-user-button').click();
    await tick();
    assert.equal(document.querySelector('#public-profile-dna-trait').textContent, 'Newbie');
    assert.equal(document.querySelector('#public-profile-dna-chart').classList.contains('dna-chart-empty'), true);
    assert.equal(window.__profileCharts.length, 0);
    assert.equal(document.querySelectorAll('#public-profile-content .ranking-card').length, 0);
    assert.equal(document.querySelectorAll('#public-profile-content .achievement-item').length, 0);
    assert.equal(document.querySelector('#public-profile-achievements').textContent, 'No hay logros.');
  } finally {
    dom.window.close();
  }
});

test('la lupa del perfil añade solo a la colección propia en BUSCADA y oculta duplicados', async () => {
  const shared = { id: 'SHARED-1', name: 'Shared', category: 'Space', year: 2020, price: 20 };
  const { dom, window, requests } = createApp({
    catalog: [{ id: 'OWN-1', nombre: 'Own', categoria: 'Space', anio: 2020, estadoColeccion: 'COLECCIÓN' }],
    profileOverrides: {
      top5Price: [{ ...shared, id: 'OWN-1' }, shared], top5Age: [shared],
      collection: { total: 5, latest: [shared] },
    },
  });
  try {
    await tick();
    await tick();
    const document = window.document;
    document.querySelector('#open-friends').click();
    await tick();
    document.querySelector('#friends-list-friends .friends-user-button').click();
    await tick();
    assert.equal(document.querySelector('#public-profile-content [data-ranking-id="OWN-1"] .ranking-add-wanted'), null);
    assert.equal(document.querySelectorAll('#public-profile-content [data-wanted-id="SHARED-1"]').length, 3);
    const trigger = document.querySelector('#public-profile-top-age .ranking-add-wanted');
    trigger.click();
    assert.equal(document.querySelector('#form-dialog').open, true);
    assert.equal(document.querySelector('#public-profile-dialog').open, true);
    assert.equal(document.querySelector('#form-id').value, 'SHARED-1');
    assert.equal(document.querySelector('#form-estadoColeccion').value, 'BUSCADA');
    assert.equal(document.querySelector('#form-estadoColeccion').disabled, true);
    assert.equal(document.querySelector('#form-categoria').value, 'Space');
    document.querySelector('#form-cancel').click();
    assert.equal(document.activeElement, trigger);
    trigger.click();
    document.querySelector('#form-nombre').value = 'My searched figure';
    document.querySelector('#minifigura-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await tick();
    await tick();
    const posts = requests.filter(({ url, init }) => url === '/minifiguras' && init.method === 'POST');
    assert.equal(posts.length, 1);
    const payload = JSON.parse(posts[0].init.body);
    assert.equal(payload.estadoColeccion, 'BUSCADA');
    assert.equal('user_id' in payload, false);
    assert.equal(document.querySelector('#form-dialog').open, false);
    assert.equal(document.querySelector('#public-profile-dialog').open, true);
    assert.equal(document.querySelectorAll('#public-profile-content [data-wanted-id="SHARED-1"]').length, 0);
    assert.equal(document.querySelector('#public-profile-bricks').textContent, '240');
    assert.equal(document.querySelector('#public-profile-collection-count').textContent, '5');
    assert.equal(document.activeElement.id, 'public-profile-close');
  } finally {
    dom.window.close();
  }
});

test('un fallo al añadir desde el perfil conserva formulario, perfil y lupa', async () => {
  const { dom, window } = createApp({ minifiguraError: 'CATALOGO_NO_DISPONIBLE' });
  try {
    await tick();
    await tick();
    const document = window.document;
    document.querySelector('#open-friends').click();
    await tick();
    document.querySelector('#friends-list-friends .friends-user-button').click();
    await tick();
    document.querySelector('#public-profile-top-price .ranking-add-wanted').click();
    document.querySelector('#form-nombre').value = 'Figure';
    document.querySelector('#minifigura-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await tick();
    assert.equal(document.querySelector('#form-dialog').open, true);
    assert.equal(document.querySelector('#public-profile-dialog').open, true);
    assert.notEqual(document.querySelector('#form-error').textContent, '');
    assert.ok(document.querySelector('#public-profile-top-price .ranking-add-wanted'));
    assert.equal(document.querySelector('#form-submit').disabled, false);
  } finally {
    dom.window.close();
  }
});

test('el error de perfil elimina el resumen anterior y ofrece reintento', async () => {
  const { dom, window } = createApp({ failProfile: true });
  try {
    await tick();
    await tick();
    const document = window.document;
    document.querySelector('#open-friends').click();
    await tick();
    document.querySelector('#friends-list-friends .friends-user-button').click();
    await tick();
    assert.equal(document.querySelector('#public-profile-content').hidden, true);
    assert.equal(document.querySelector('#public-profile-title').textContent, '');
    assert.equal(document.querySelector('#public-profile-status').textContent, 'No se pudo cargar el perfil.');
    assert.equal(document.querySelector('#public-profile-status').className, 'status error');
    assert.equal(document.querySelector('#public-profile-retry').hidden, false);
  } finally {
    dom.window.close();
  }
});

test('ignora una respuesta de perfil anterior después de seleccionar otro usuario', async () => {
  const { dom, window } = createApp();
  try {
    await tick();
    await tick();
    const originalFetch = window.fetch;
    let resolveFirstProfile;
    window.fetch = (url, init) => url === '/api/amigos/friend-a/perfil'
      ? new Promise((resolve) => { resolveFirstProfile = resolve; })
      : originalFetch(url, init);
    const document = window.document;
    document.querySelector('#open-friends').click();
    await tick();
    document.querySelector('#friends-list-friends .friends-user-button').click();
    await tick();
    assert.equal(document.querySelector('#public-profile-status').textContent, 'Cargando perfil...');
    document.querySelector('#public-profile-close').click();

    document.querySelector('#friends-tab-search').click();
    const search = document.querySelector('#friends-search');
    search.value = 'Space';
    search.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    document.querySelector('#friends-list-search .friends-user-button').click();
    await tick();
    assert.equal(document.querySelector('#public-profile-title').textContent, 'SearchFan');
    resolveFirstProfile({ ok: true, json: async () => ({
      userId: 'friend-a', username: 'StaleFan', avatarUrl: null, bricks: 1, level: { id: 0, name: 'Duplo' },
      dna: { rarityHunter: 0, explorer: 0, collector: 0, fan: 0 },
      top5Price: [], top5Age: [], collection: { total: 0, latest: [] }, wanted: { total: 0, latest: [] }, achievements: [],
    }) });
    await tick();
    assert.equal(document.querySelector('#public-profile-title').textContent, 'SearchFan');
    assert.equal(document.querySelector('#public-profile-bricks').textContent, '240');
  } finally {
    dom.window.close();
  }
});