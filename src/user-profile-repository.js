const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const PROFILE_FIELDS = ['username', 'avatarUrl', 'currency', 'language', 'favoriteCategories'];

export class PerfilNoDisponibleError extends Error {
  constructor() {
    super('El perfil no esta disponible');
    this.name = 'PerfilNoDisponibleError';
    this.code = 'PERFIL_NO_DISPONIBLE';
  }
}

export class PerfilInvalidoError extends Error {
  constructor() {
    super('El perfil no es valido');
    this.name = 'PerfilInvalidoError';
    this.code = 'PERFIL_INVALIDO';
  }
}

export class UsernameOcupadoError extends Error {
  constructor() {
    super('El username no esta disponible');
    this.name = 'UsernameOcupadoError';
    this.code = 'USERNAME_OCUPADO';
  }
}

export class UsernameInmutableError extends Error {
  constructor() {
    super('El username no se puede modificar');
    this.name = 'UsernameInmutableError';
    this.code = 'USERNAME_INMUTABLE';
  }
}

export class CategoriaFavoritaInvalidaError extends Error {
  constructor() {
    super('Una categoria favorita no es valida');
    this.name = 'CategoriaFavoritaInvalidaError';
    this.code = 'CATEGORIA_FAVORITA_INVALIDA';
  }
}

function isValidAvatarUrl(value) {
  if (value === null || value === '') return true;
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidProfile(profile) {
  return profile !== null
    && typeof profile === 'object'
    && !Array.isArray(profile)
    && Object.keys(profile).length === PROFILE_FIELDS.length
    && PROFILE_FIELDS.every((field) => Object.hasOwn(profile, field))
    && typeof profile.username === 'string'
    && USERNAME_PATTERN.test(profile.username)
    && isValidAvatarUrl(profile.avatarUrl)
    && (profile.avatarUrl === null || typeof profile.avatarUrl === 'string')
    && profile.currency === 'EUR'
    && profile.language === 'es'
    && Array.isArray(profile.favoriteCategories)
    && profile.favoriteCategories.length <= 3
    && profile.favoriteCategories.every((category) => typeof category === 'string' && category.trim() === category && category.length > 0)
    && new Set(profile.favoriteCategories).size === profile.favoriteCategories.length;
}

export class UserProfileRepository {
  constructor({ client, userId, categoriasRepository } = {}) {
    this.client = client;
    this.userId = userId;
    this.categoriasRepository = categoriasRepository;
  }

  async run(query) {
    let result;
    try {
      result = await query;
    } catch {
      throw new PerfilNoDisponibleError();
    }
    if (result.error) throw new PerfilNoDisponibleError();
    return result.data;
  }

  async read() {
    const row = await this.run(this.client.from('user_profiles')
      .select('username, avatar_url, currency, language, onboarding_completed')
      .eq('user_id', this.userId)
      .maybeSingle());
    if (!row) {
      return {
        username: null,
        avatarUrl: null,
        currency: 'EUR',
        language: 'es',
        onboardingCompleted: false,
        favoriteCategories: [],
      };
    }

    const favoriteRows = await this.run(this.client.from('user_profile_favorite_categories')
      .select('category_name')
      .eq('user_id', this.userId)
      .order('category_name', { ascending: true }));
    return {
      username: row.username,
      avatarUrl: row.avatar_url,
      currency: row.currency,
      language: row.language,
      onboardingCompleted: row.onboarding_completed === true,
      favoriteCategories: favoriteRows.map(({ category_name }) => category_name),
    };
  }

  async save(profile) {
    if (!isValidProfile(profile)) throw new PerfilInvalidoError();

    const categories = await this.categoriasRepository.read();
    const availableCategories = new Set(categories.map(({ categoria }) => categoria));
    if (profile.favoriteCategories.some((category) => !availableCategories.has(category))) {
      throw new CategoriaFavoritaInvalidaError();
    }

    const result = await this.client.rpc('guardar_perfil_usuario', {
      p_username: profile.username,
      p_avatar_url: profile.avatarUrl || null,
      p_currency: profile.currency,
      p_language: profile.language,
      p_favorite_categories: profile.favoriteCategories,
    });
    if (result.error?.code === '23505' || result.error?.message === 'USERNAME_OCUPADO') {
      throw new UsernameOcupadoError();
    }
    if (result.error?.message === 'USERNAME_INMUTABLE') {
      throw new UsernameInmutableError();
    }
    if (result.error) throw new PerfilNoDisponibleError();
    return this.read();
  }

  async deleteAccount() {
    const bucket = this.client.storage.from('profile-avatars');
    for (;;) {
      const result = await bucket.list(this.userId, { limit: 100 });
      if (String(result.error?.statusCode ?? result.error?.status) === '404') break;
      if (result.error || !Array.isArray(result.data)) throw new PerfilNoDisponibleError();
      if (result.data.length === 0) break;
      const files = result.data.filter((file) => typeof file.name === 'string' && !file.name.includes('/') && file.id !== null);
      if (files.length !== result.data.length) throw new PerfilNoDisponibleError();
      await this.run(bucket.remove(files.map((file) => `${this.userId}/${file.name}`)));
      if (files.length < 100) break;
    }
    await this.run(this.client.rpc('eliminar_cuenta_usuario'));
  }
}