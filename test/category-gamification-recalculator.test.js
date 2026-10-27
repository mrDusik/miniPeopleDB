import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CategoryGamificationRecalculator } from '../src/category-gamification-recalculator.js';
import { CategoriasRepository } from '../src/categorias-repository.js';
import { DailyAnalyticsRepository } from '../src/daily-analytics-repository.js';
import { createDailyAnalyticsJobs } from '../src/daily-analytics-jobs.js';
import { calcularPorcentajesDna, DNA_PONDERACIONES, OBJETIVOS } from '../src/gamificacion.js';
import { GamificacionRepository } from '../src/gamificacion-repository.js';
import { MinifigurasRepository } from '../src/minifiguras-repository.js';
import { createSupabaseMock } from '../test-support/supabase-mock.js';

function categoryFingerprint(categorias) {
  const pesosDna = [...DNA_PONDERACIONES].sort(([left], [right]) => left.localeCompare(right));
  return createHash('sha256').update(JSON.stringify({ version: 'v2', categorias, objetivos: OBJETIVOS, pesosDna })).digest('hex');
}

function createAdminClient({
  version = null, users = [], gamificacion = [], minifiguras = [], regalos = [], agradecimientos = [],
  friendRequests = [], friendships = [],
} = {}) {
  const tables = { gamificacion, minifiguras, regalos_enviados: regalos };
  const applications = [];
  const authUserIds = [...new Set([
    ...users,
    ...gamificacion.map(({ user_id }) => user_id),
    ...minifiguras.map(({ user_id }) => user_id),
    ...regalos.map(({ receptor_id }) => receptor_id),
    ...agradecimientos.flatMap(({ thanker_id, donor_id }) => [thanker_id, donor_id]),
    ...friendRequests.flatMap(({ sender_id, recipient_id }) => [sender_id, recipient_id]),
    ...friendships.flatMap(({ user_low_id, user_high_id }) => [user_low_id, user_high_id]),
  ])].filter((userId) => typeof userId === 'string').sort();
  const canonicalPair = (left, right) => [left, right].sort();
  const socialSourcesFor = (userId) => {
    const actorRequests = friendRequests.filter(({ sender_id, recipient_id }) => [sender_id, recipient_id].includes(userId));
    const accepted = actorRequests.filter((request) => request.status === 'accepted' && friendships.some((friendship) => {
      const [low, high] = canonicalPair(request.sender_id, request.recipient_id);
      return friendship.user_low_id === low && friendship.user_high_id === high;
    }));
    return {
      user_id: userId,
      friends: friendships.filter(({ user_low_id, user_high_id }) => [user_low_id, user_high_id].includes(userId)).length,
      sent_pending: actorRequests.filter(({ sender_id, status }) => sender_id === userId && status === 'pending').length,
      accepted_sent: accepted.filter(({ sender_id }) => sender_id === userId).length,
      accepted_received: accepted.filter(({ recipient_id }) => recipient_id === userId).length,
      global_gifts_received: regalos.filter(({ receptor_id, semana }) => receptor_id === userId && (!semana || semana === '0001-01-01')).length,
      weekly_gifts_received: regalos.filter(({ receptor_id, semana }) => receptor_id === userId && semana && semana !== '0001-01-01').length,
      thanks_sent: agradecimientos.filter(({ thanker_id }) => thanker_id === userId).length,
      thanks_received: agradecimientos.filter(({ donor_id }) => donor_id === userId).length,
    };
  };
  const client = {
    async rpc(name, parameters) {
      if (name === 'leer_recalculo_gamificacion_categorias') {
        const remaining = authUserIds.filter((userId) => !parameters.p_after_user_id || userId > parameters.p_after_user_id);
        const pageUsers = remaining.slice(0, parameters.p_limit);
        const hasMore = remaining.length > pageUsers.length;
        const pageUserIds = new Set(pageUsers);
        return { data: {
          version: 'v2', fingerprint: version ?? '',
          users: pageUsers,
          next_cursor: hasMore ? pageUsers.at(-1) : null,
          has_more: hasMore,
          figures: minifiguras.filter(({ user_id }) => pageUserIds.has(user_id)).map(({ nombre_completo, ...figure }) => ({
            ...figure, nombreCompleto: nombre_completo,
          })),
          social_sources: pageUsers.map(socialSourcesFor),
        }, error: null };
      }
      applications.push({ name, parameters });
      version = parameters.p_fingerprint;
      return { data: true, error: null };
    },
  };
  return { client, applications };
}

test('el recalculo de categorias conserva regalos globales y semanales separados', async () => {
  const { client, applications } = createAdminClient({
    regalos: [{ receptor_id: 'user-a' }, { receptor_id: 'user-a', semana: '2026-10-12' }],
  });
  const recalculator = new CategoryGamificationRecalculator({ client, categoriasRepository: { read: async () => [] } });
  await recalculator.reconcile();
  const state = applications[0].parameters.p_estados[0];
  assert.equal(state.bricks, 75);
  assert.equal(state.logros.find(({ id }) => id === 'oh-you-shouldnt-have').total, 20);
  assert.equal(state.logros.some(({ id }) => id === 'youre-on-fire-this-week'), false);
});

test('recalcula todos los usuarios existentes, conservando regalos y usando el total de subcategoría', async () => {
  const { client, applications } = createAdminClient({
    gamificacion: [{ user_id: 'user-a' }, { user_id: 'user-b' }],
    minifiguras: [
      { user_id: 'user-a', id: 'COL1', categoria: 'Collectible Minifigures', subcategoria: 'Series 26', anio: 1999, estado_coleccion: 'COLECCIÓN' },
      { user_id: 'user-b', id: 'COL2', categoria: 'Collectible Minifigures', subcategoria: 'Series 26', anio: 2024, estado_coleccion: 'COLECCIÓN' },
    ],
    regalos: [{ receptor_id: 'user-b' }, { receptor_id: 'user-b' }],
  });
  const recalculator = new CategoryGamificationRecalculator({
    client,
    categoriasRepository: {
      filePath: 'categories.json',
      read: async () => [{
        categoria: 'Collectible Minifigures',
        total: 845,
        subcategorias: [{ subcategoria: 'Series 26', total: 1 }],
      }],
    },
  });

  const result = await recalculator.reconcile();

  assert.equal(result.recalculated, true);
  assert.equal(result.users, 2);
  assert.equal(applications.length, 1);
  assert.equal(applications[0].name, 'aplicar_recalculo_gamificacion_categorias');
  assert.equal(applications[0].parameters.p_version, 'v2');
  const states = applications[0].parameters.p_estados;
  const userA = states.find(({ user_id }) => user_id === 'user-a');
  const userB = states.find(({ user_id }) => user_id === 'user-b');
  assert.equal(userA.logros.find(({ id }) => id === 'the-cornerstone')?.cantidad, 1);
  assert.equal(userA.logros.find(({ id }) => id === 'block-by-block')?.cantidad, 1);
  assert.equal(userB.logros.find(({ id }) => id === 'block-by-block')?.cantidad, 1);
  assert.equal(userB.logros.find(({ id }) => id === 'oh-you-shouldnt-have')?.total, 20);
  assert.equal(userB.logros.some(({ id }) => id === 'someone-liked-your-collection'), false);
  assert.deepEqual(userB.logros.map(({ id, total }) => [id, total]), [
    ['block-by-block', 1], ['curiosity-driven', 100], ['oh-you-shouldnt-have', 20], ['the-cornerstone', 5],
  ]);
  assert.equal(userB.bricks, 226);
});

test('incluye usuarios solo sociales derivados de Auth aunque no tengan estado ni figuras', async () => {
  const { client, applications } = createAdminClient({
    users: ['social-only-user', 'friend-user'],
    friendRequests: [{ id: 'pending', sender_id: 'social-only-user', recipient_id: 'friend-user', status: 'pending' }],
  });
  const recalculator = new CategoryGamificationRecalculator({
    client,
    categoriasRepository: { filePath: 'categories.json', read: async () => [] },
  });

  const result = await recalculator.reconcile();

  assert.equal(result.users, 2);
  const state = applications[0].parameters.p_estados.find(({ user_id }) => user_id === 'social-only-user');
  assert.equal(state.logros.find(({ id }) => id === 'first-contact')?.cantidad, 1);
  assert.equal(state.bricks, 2);
});

test('calculo personal, recálculo global y daily-sync producen el mismo estado V2', async () => {
  const userA = '00000000-0000-4000-8000-0000000000a1';
  const userB = '00000000-0000-4000-8000-0000000000b1';
  const userC = '00000000-0000-4000-8000-0000000000c1';
  const categories = [{ categoria: 'Space', total: 100, subcategorias: [] }];
  const figures = [{
    user_id: userA, id: 'FIG-A', nombre: 'Exclusive', nombre_completo: 'Exclusive, Comic-Con 2026',
    categoria: 'Space', anio: 2020, estado_coleccion: 'COLECCIÓN', precio: 20,
  }];
  const friendRequests = [
    { id: 'pending-out', sender_id: userA, recipient_id: userC, status: 'pending' },
    { id: 'accepted-in', sender_id: userB, recipient_id: userA, status: 'accepted' },
  ];
  const [friendLow, friendHigh] = [userA, userB].sort();
  const friendships = [{ user_low_id: friendLow, user_high_id: friendHigh }];
  const gifts = [
    { donante_id: userB, receptor_id: userA, semana: '0001-01-01' },
    { donante_id: userC, receptor_id: userA, semana: '2026-10-26' },
  ];
  const thanks = [
    { gift_notification_id: 'thanks-sent', thanker_id: userA, donor_id: userB },
    { gift_notification_id: 'thanks-received', thanker_id: userC, donor_id: userA },
  ];
  const profileCategories = [{ categoria: 'Space', total: 100, subcategorias: [] }];
  const socialSummary = (state) => ({
    logros: state.logros,
    bricks: state.bricks,
    nivel: state.nivel,
    siguienteNivel: state.siguienteNivel,
    progreso: state.progreso,
    dna: calcularPorcentajesDna(state.logros),
  });

  const tokens = { tokenA: { id: userA }, tokenB: { id: userB }, tokenC: { id: userC } };
  const mock = createSupabaseMock({ users: tokens, now: () => new Date('2026-10-26T12:00:00Z') });
  for (const userId of [userA, userB, userC]) {
    mock.seed('gamificacion', userId, [{ bricks: 0, nivel: { id: 0, nombre: 'Duplo' }, logros: [] }]);
  }
  mock.seed('minifiguras', userA, figures);
  mock.seed('friend_requests', undefined, friendRequests);
  mock.seed('friendships', undefined, friendships);
  mock.seed('regalos_enviados', undefined, gifts);
  mock.seed('agradecimientos_regalo', undefined, thanks);

  const personalClient = mock.createClient('url', 'key', { global: { headers: { Authorization: 'Bearer tokenA' } } });
  const personalCatalog = new MinifigurasRepository({
    client: personalClient, userId: userA, categoriasRepository: { read: async () => profileCategories },
  });
  const personalRepository = new GamificacionRepository({
    client: personalClient, userId: userA, categoriasRepository: { read: async () => profileCategories },
  });
  const personal = await personalRepository.calculate(await personalCatalog.readGamificationCatalog());

  const { client: categoryClient, applications } = createAdminClient({
    users: [userA, userB, userC], minifiguras: figures, regalos: gifts, agradecimientos: thanks,
    friendRequests, friendships,
  });
  const recalculator = new CategoryGamificationRecalculator({
    client: categoryClient, categoriasRepository: { filePath: 'categories.json', read: async () => profileCategories },
  });
  await recalculator.reconcile();
  const globalState = applications[0].parameters.p_estados.find(({ user_id }) => user_id === userA);
  const global = {
    bricks: globalState.bricks, nivel: globalState.nivel, siguienteNivel: globalState.siguiente_nivel,
    progreso: globalState.progreso, logros: globalState.logros,
  };

  const jobs = createDailyAnalyticsJobs({
    repository: new DailyAnalyticsRepository({ client: mock.createAdminClient() }),
    brickset: { async getPrice() { return 20; } },
    categoriasRepository: { read: async () => profileCategories },
  });
  await jobs.start();
  await jobs.waitForIdle();
  const daily = mock.rows('gamificacion', userA)[0];
  const personalSummary = socialSummary(personal);
  const globalSummary = socialSummary({ ...global, siguienteNivel: global.siguienteNivel });
  const dailySummary = socialSummary({
    bricks: daily.bricks, nivel: daily.nivel, siguienteNivel: daily.siguiente_nivel,
    progreso: daily.progreso, logros: daily.logros,
  });

  assert.deepEqual(globalSummary, personalSummary);
  assert.deepEqual(dailySummary, personalSummary);
  assert.equal(personalSummary.logros.find(({ id }) => id === 'pop-culture-fan')?.cantidad, 1);
  assert.equal(personalSummary.logros.find(({ id }) => id === 'first-contact')?.cantidad, 1);
  assert.equal(personalSummary.logros.find(({ id }) => id === 'handshake')?.cantidad, 1);
});

test('no recalcula cuando el fingerprint de categorías y objetivos ya está aplicado', async () => {
  const categories = [{ categoria: 'Space', total: 230, subcategorias: [] }];
  const fingerprint = categoryFingerprint(categories);
  const { client, applications } = createAdminClient({ version: fingerprint, gamificacion: [{ user_id: 'user-a' }] });
  const recalculator = new CategoryGamificationRecalculator({
    client,
    categoriasRepository: { filePath: 'categories.json', read: async () => categories },
  });

  const result = await recalculator.reconcile();

  assert.equal(result.recalculated, false);
  assert.equal(result.users, 0);
  assert.equal(applications.length, 0);
});

test('una huella anterior recalcula los nuevos logros de usuarios actuales aunque no cambien las categorías', async () => {
  const categories = [{ categoria: 'The Legend of Zelda', total: 1, subcategorias: [] }];
  const oldFingerprint = await import('node:crypto').then(({ createHash }) => createHash('sha256').update(JSON.stringify(categories)).digest('hex'));
  const { client, applications } = createAdminClient({
    version: oldFingerprint,
    gamificacion: [{ user_id: 'user-a' }, { user_id: 'user-empty' }],
    minifiguras: [{ user_id: 'user-a', id: 'ZELDA1', categoria: 'The Legend of Zelda', estado_coleccion: 'COLECCIÓN' }],
    regalos: [{ receptor_id: 'user-a' }],
  });
  const recalculator = new CategoryGamificationRecalculator({
    client, categoriasRepository: { filePath: 'categories.json', read: async () => categories },
  });
  const result = await recalculator.reconcile();
  assert.equal(result.users, 2);
  assert.notEqual(result.fingerprint, oldFingerprint);
  const state = applications[0].parameters.p_estados.find(({ user_id }) => user_id === 'user-a');
  assert.equal(state.bricks, 206);
  assert.equal(state.progreso.actual, state.bricks);
  assert.equal(state.nivel.nombre, 'Citizen');
  for (const id of ['block-by-block', 'the-cornerstone', 'its-dangerous-to-go-alone-take-this', 'oh-you-shouldnt-have']) {
    assert.equal(state.logros.find((logro) => logro.id === id).cantidad, 1);
  }
  assert.equal(applications[0].parameters.p_estados.find(({ user_id }) => user_id === 'user-empty').bricks, 0);
});

test('subir los totales retira hitos y bajarlos los recupera automáticamente conservando regalos', async () => {
  let categories = [{ categoria: 'Space', total: 100, subcategorias: [] }];
  const { client, applications } = createAdminClient({
    gamificacion: [{ user_id: 'user-a' }],
    minifiguras: Array.from({ length: 51 }, (_, index) => ({ user_id: 'user-a', id: `SPACE-${index}`, categoria: 'Space', estado_coleccion: 'COLECCIÓN' })),
    regalos: [{ receptor_id: 'user-a' }],
  });
  const recalculator = new CategoryGamificationRecalculator({
    client, categoriasRepository: { filePath: 'categories.json', read: async () => categories },
  });
  await recalculator.reconcile();
  const initial = applications[0].parameters.p_estados[0];
  assert.equal(initial.bricks, 441);
  assert.equal(initial.logros.find(({ id }) => id === 'category-halfway')?.cantidad, 1);
  categories = [{ categoria: 'Space', total: 101, subcategorias: [] }];
  await recalculator.reconcile();
  const lost = applications[1].parameters.p_estados[0];
  assert.equal(lost.bricks, 741);
  assert.equal(lost.logros.find(({ id }) => id === 'major-milestone')?.cantidad, 1);
  assert.equal(lost.logros.some(({ id }) => id === 'category-halfway'), false);
  assert.equal(lost.logros.find(({ id }) => id === 'oh-you-shouldnt-have')?.total, 20);
  categories = [{ categoria: 'Space', total: 100, subcategorias: [] }];
  await recalculator.reconcile();
  assert.deepEqual(applications[2].parameters.p_estados[0], initial);
  assert.equal((await recalculator.reconcile()).recalculated, false);
  assert.equal(applications.length, 3);
});

test('el watcher detecta cambios de archivo y vuelve a reconciliar', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'category-recalculator-'));
  const filePath = join(directory, 'categorias.json');
  const initial = [{ categoria: 'Space', total: 230, subcategorias: [] }];
  await writeFile(filePath, JSON.stringify(initial));
  let notifyChange;
  const watcher = { on() { return this; }, close() {} };
  const { client, applications } = createAdminClient({ gamificacion: [{ user_id: 'user-a' }] });
  const recalculator = new CategoryGamificationRecalculator({
    client,
    categoriasRepository: new CategoriasRepository(filePath),
    watchImpl: (_directory, callback) => {
      notifyChange = callback;
      return watcher;
    },
    debounceMs: 5,
    logger: { error() {} },
  });

  try {
    await recalculator.start();
    assert.equal(applications.length, 1);
    await writeFile(filePath, JSON.stringify([{ categoria: 'Space', total: 231, subcategorias: [] }]));
    notifyChange('change', 'categorias.json');
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(applications.length, 2);
    recalculator.close();
  } finally {
    recalculator.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('el recálculo global conserva los agradecimientos enviados y recibidos', async () => {
  const { client, applications } = createAdminClient({
    gamificacion: [{ user_id: 'user-a' }, { user_id: 'user-b' }],
    agradecimientos: [
      { thanker_id: 'user-a', donor_id: 'user-b' },
      { thanker_id: 'user-a', donor_id: 'user-b' },
    ],
  });
  const recalculator = new CategoryGamificationRecalculator({
    client,
    categoriasRepository: { filePath: 'categories.json', read: async () => [] },
  });

  await recalculator.reconcile();

  const states = applications.at(-1).parameters.p_estados;
  assert.equal(states.find(({ user_id }) => user_id === 'user-a').logros.find(({ id }) => id === 'gratitude-is-the-sign-of-noble-souls')?.total, 5);
  assert.equal(states.find(({ user_id }) => user_id === 'user-a').bricks, 5);
  assert.equal(states.find(({ user_id }) => user_id === 'user-b').logros.some(({ id }) => id === 'gratitude-is-the-sign-of-noble-souls'), false);
  assert.equal(states.find(({ user_id }) => user_id === 'user-b').bricks, 10);
});