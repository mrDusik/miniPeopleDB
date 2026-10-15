import assert from 'node:assert/strict';
import test from 'node:test';
import { OTHER_USER, OTHER_TOKEN, TEST_USER, TEST_TOKEN, authFetch, startTestServer } from '../test-support/server.js';
import { createSupabaseMock } from '../test-support/supabase-mock.js';

const PROFILE = {
  username: 'SpaceFan',
  avatarUrl: 'https://example.invalid/avatar.png',
  currency: 'EUR',
  language: 'es',
  favoriteCategories: ['Castle', 'Space'],
};

test('eliminar cuenta exige JWT y borra solo la identidad propia sin aceptar IDs ni usar admin', async () => {
  const mock = createSupabaseMock({ users: { [TEST_TOKEN]: TEST_USER, [OTHER_TOKEN]: OTHER_USER } });
  for (const user of [TEST_USER, OTHER_USER]) {
    mock.seed('user_profiles', user.id, [{ username: user.id === TEST_USER.id ? 'SpaceFan' : 'OtherFan' }]);
    mock.seed('minifiguras', user.id, [{ id: 'A-1', nombre: 'Astronauta' }]);
    mock.seed('gamificacion', user.id, [{ bricks: 10 }]);
  }
  const context = await startTestServer({ supabase: mock });
  try {
    assert.equal((await fetch(`${context.baseUrl}/api/profile`, { method: 'DELETE' })).status, 401);
    for (const init of [
      { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: OTHER_USER.id }) },
      { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: '{}' },
    ]) {
      assert.equal((await authFetch()(`${context.baseUrl}/api/profile`, init)).status, 400);
    }
    assert.equal((await authFetch()(`${context.baseUrl}/api/profile?userId=${OTHER_USER.id}`, { method: 'DELETE' })).status, 400);
    mock.failNext('eliminar_cuenta_usuario', { message: 'private SQL detail' }, 'rpc');
    const failed = await authFetch()(`${context.baseUrl}/api/profile`, { method: 'DELETE' });
    assert.equal(failed.status, 500);
    assert.deepEqual(await failed.json(), { error: 'CUENTA_NO_ELIMINADA' });
    assert.equal(mock.rows('minifiguras', TEST_USER.id).length, 1);
    const deleted = await authFetch()(`${context.baseUrl}/api/profile`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);
    assert.equal(deleted.headers.get('cache-control'), 'no-store');
    for (const table of ['minifiguras', 'gamificacion', 'user_profiles', 'perfiles_publicos']) {
      assert.equal(mock.rows(table, TEST_USER.id).length, 0);
    }
    assert.equal(mock.rows('minifiguras', OTHER_USER.id).length, 1);
    assert.equal((await authFetch()(`${context.baseUrl}/api/profile`)).status, 401);
    assert.equal((await authFetch(OTHER_TOKEN)(`${context.baseUrl}/api/profile`)).status, 200);
    assert.deepEqual(mock.adminCalls(), []);
  } finally {
    await context.close();
  }
});

test('borrar cuenta limpia solo sus avatares y no borra la identidad si Storage falla', async () => {
  const mock = createSupabaseMock({ users: { [TEST_TOKEN]: TEST_USER, [OTHER_TOKEN]: OTHER_USER } });
  mock.seedAvatar(TEST_USER.id, 'own.png');
  mock.seedAvatar(OTHER_USER.id, 'other.png');
  const context = await startTestServer({ supabase: mock });
  try {
    mock.failNext('profile-avatars', { message: 'storage unavailable' }, 'remove');
    assert.equal((await authFetch()(`${context.baseUrl}/api/profile`, { method: 'DELETE' })).status, 500);
    assert.equal((await authFetch()(`${context.baseUrl}/api/profile`)).status, 200);
    assert.equal(mock.avatarPaths().length, 2);
    assert.equal((await authFetch()(`${context.baseUrl}/api/profile`, { method: 'DELETE' })).status, 204);
    assert.deepEqual(mock.avatarPaths(), [`${OTHER_USER.id}/other.png`]);
    assert.equal((await authFetch(OTHER_TOKEN)(`${context.baseUrl}/api/profile`)).status, 200);
  } finally {
    await context.close();
  }
});

test('acceso por username usa anon y devuelve solo tokens, con errores indistinguibles', async () => {
  const mock = createSupabaseMock({ users: { [TEST_TOKEN]: TEST_USER }, passwords: { [TEST_USER.id]: 'Abcd1' } });
  mock.seed('user_profiles', TEST_USER.id, [{ username: 'SpaceFan' }]);
  const context = await startTestServer({ supabase: mock });
  const login = (body) => fetch(`${context.baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  try {
    const accepted = await login({ username: 'spacefan', password: 'Abcd1' });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await accepted.json(), { access_token: TEST_TOKEN, refresh_token: `refresh-${TEST_TOKEN}` });
    for (const body of [
      { username: 'SpaceFan', password: 'wrong' },
      { username: 'Unknown', password: 'Abcd1' },
      { username: 'bad name', password: 'Abcd1' },
      { username: 'SpaceFan' },
    ]) {
      const rejected = await login(body);
      assert.equal(rejected.status, 401);
      assert.deepEqual(await rejected.json(), { error: 'CREDENCIALES_INVALIDAS' });
    }
    mock.failNext('resolver_acceso_username', { message: 'private database detail' }, 'rpc');
    assert.deepEqual(await (await login({ username: 'SpaceFan', password: 'Abcd1' })).json(), { error: 'CREDENCIALES_INVALIDAS' });
    const wrongMethod = await fetch(`${context.baseUrl}/api/auth/login`);
    assert.equal(wrongMethod.status, 405);
    assert.equal(wrongMethod.headers.get('allow'), 'POST');
    assert.deepEqual(mock.adminCalls(), []);
  } finally {
    await context.close();
  }
});

test('el login no emite sesión si Supabase Auth rechaza una contraseña resuelta', async () => {
  const mock = createSupabaseMock({
    users: { [TEST_TOKEN]: TEST_USER }, passwords: { [TEST_USER.id]: 'Abcd1' }, passwordSignInError: 'email not confirmed',
  });
  mock.seed('user_profiles', TEST_USER.id, [{ username: 'SpaceFan' }]);
  const context = await startTestServer({ supabase: mock });
  try {
    const response = await fetch(`${context.baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'SpaceFan', password: 'Abcd1' }),
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'CREDENCIALES_INVALIDAS' });
  } finally {
    await context.close();
  }
});

test('el perfil requiere sesión y devuelve valores pendientes sin exponer datos de otras cuentas', async () => {
  const mock = createSupabaseMock({ users: { [TEST_TOKEN]: TEST_USER, [OTHER_TOKEN]: OTHER_USER } });
  mock.seed('user_profiles', OTHER_USER.id, [{ username: 'OtherUser', onboarding_completed: true }]);
  const context = await startTestServer({ supabase: mock });
  try {
    const unauthenticated = await fetch(`${context.baseUrl}/api/profile`);
    assert.equal(unauthenticated.status, 401);
    assert.deepEqual(await unauthenticated.json(), { error: 'NO_AUTENTICADO' });

    const own = await authFetch()( `${context.baseUrl}/api/profile`);
    assert.equal(own.status, 200);
    assert.deepEqual(await own.json(), {
      username: null,
      avatarUrl: null,
      currency: 'EUR',
      language: 'es',
      onboardingCompleted: false,
      favoriteCategories: [],
    });

    const other = await authFetch(OTHER_TOKEN)(`${context.baseUrl}/api/profile`);
    assert.equal((await other.json()).username, 'OtherUser');
    assert.equal(mock.rows('user_profiles', OTHER_USER.id).length, 1);
  } finally {
    await context.close();
  }
});

test('guardar perfil valida categorías, normaliza conflictos y conserva la propiedad por JWT', async () => {
  const mock = createSupabaseMock({ users: { [TEST_TOKEN]: TEST_USER, [OTHER_TOKEN]: OTHER_USER } });
  mock.seed('user_profiles', OTHER_USER.id, [{ username: 'ExistingName', onboarding_completed: true }]);
  const context = await startTestServer({ supabase: mock });
  const ownFetch = authFetch();
  try {
    const saved = await ownFetch(`${context.baseUrl}/api/profile`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(PROFILE),
    });
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), {
      ...PROFILE,
      onboardingCompleted: true,
    });
    assert.equal(mock.rows('user_profiles', OTHER_USER.id)[0].username, 'ExistingName');
    assert.deepEqual(mock.rows('user_profile_favorite_categories', OTHER_USER.id), []);

    const duplicate = await ownFetch(`${context.baseUrl}/api/profile`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...PROFILE, username: 'existingname' }),
    });
    assert.equal(duplicate.status, 409);
    assert.deepEqual(await duplicate.json(), { error: 'USERNAME_OCUPADO' });

    const invalidCategory = await ownFetch(`${context.baseUrl}/api/profile`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...PROFILE, favoriteCategories: ['NotACategory'] }),
    });
    assert.equal(invalidCategory.status, 400);
    assert.deepEqual(await invalidCategory.json(), { error: 'CATEGORIA_FAVORITA_INVALIDA' });
    assert.deepEqual(mock.rows('user_profile_favorite_categories', TEST_USER.id).map(({ category_name }) => category_name), ['Castle', 'Space']);

    const tooManyFavorites = await ownFetch(`${context.baseUrl}/api/profile`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...PROFILE, favoriteCategories: ['Castle', 'Space', 'City', 'Star Wars'] }),
    });
    assert.equal(tooManyFavorites.status, 400);
    assert.deepEqual(await tooManyFavorites.json(), { error: 'PERFIL_INVALIDO' });

    const invalidUsername = await ownFetch(`${context.baseUrl}/api/profile`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...PROFILE, username: 'bad name' }),
    });
    assert.equal(invalidUsername.status, 400);
    assert.deepEqual(await invalidUsername.json(), { error: 'PERFIL_INVALIDO' });

    const wrongMethod = await ownFetch(`${context.baseUrl}/api/profile`, { method: 'POST' });
    assert.equal(wrongMethod.status, 405);
    assert.equal(wrongMethod.headers.get('allow'), 'GET, PUT, DELETE');
  } finally {
    await context.close();
  }
});

test('fallo al reemplazar favoritos no deja perfil ni preferencias parciales', async () => {
  const mock = createSupabaseMock({ users: { [TEST_TOKEN]: TEST_USER, [OTHER_TOKEN]: OTHER_USER } });
  mock.seed('user_profiles', TEST_USER.id, [{
    username: PROFILE.username, avatar_url: 'https://example.invalid/old.png',
    onboarding_completed: true,
  }]);
  mock.seed('user_profile_favorite_categories', TEST_USER.id, [{ category_name: 'Space' }]);
  const context = await startTestServer({ supabase: mock });
  try {
    mock.failNext('user_profile_favorite_categories', { code: 'PGRST000', message: 'private storage detail' }, 'replace');
    const failed = await authFetch()(`${context.baseUrl}/api/profile`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(PROFILE),
    });
    assert.equal(failed.status, 500);
    assert.deepEqual(await failed.json(), { error: 'PERFIL_NO_DISPONIBLE' });
    assert.equal(mock.rows('user_profiles', TEST_USER.id)[0].avatar_url, 'https://example.invalid/old.png');
    assert.deepEqual(mock.rows('user_profile_favorite_categories', TEST_USER.id).map(({ category_name }) => category_name), ['Space']);
    assert.equal(mock.rows('perfiles_publicos', TEST_USER.id)[0].avatar_url, 'https://example.invalid/old.png');
  } finally {
    await context.close();
  }
});