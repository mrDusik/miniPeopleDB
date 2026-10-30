const TABLE = 'android_push_installations';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PERMISSION_STATES = new Set(['unknown', 'granted', 'denied']);

export class AndroidPushRegistrationError extends Error {
  constructor() {
    super('ANDROID_PUSH_REGISTRATION_INVALID');
    this.name = 'AndroidPushRegistrationError';
    this.code = 'ANDROID_PUSH_REGISTRATION_INVALID';
  }
}

export class AndroidPushRepository {
  constructor({ client, userId }) {
    this.client = client;
    this.userId = userId;
  }

  validate({ installationId, token, permissionState }) {
    if (typeof installationId !== 'string' || !UUID_PATTERN.test(installationId)
      || !PERMISSION_STATES.has(permissionState)
      || (permissionState === 'granted' && (typeof token !== 'string' || token.length < 20 || token.length > 4096 || /[\r\n]/.test(token)))
      || (token !== null && token !== undefined
        && (typeof token !== 'string' || token.length > 4096 || /[\r\n]/.test(token)))) {
      throw new AndroidPushRegistrationError();
    }
    return {
      installation_id: installationId.toLowerCase(),
      user_id: this.userId,
      fcm_token: permissionState === 'granted' ? token : null,
      permission_state: permissionState,
      active: permissionState === 'granted',
      updated_at: new Date().toISOString(),
    };
  }

  async register(input) {
    const registration = this.validate(input);
    let result;
    try {
      result = await this.client.from(TABLE).insert(registration);
    } catch {
      throw new Error('ANDROID_PUSH_REGISTRATION_UNAVAILABLE');
    }
    if (result.error?.code !== '23505') {
      if (result.error) throw new Error('ANDROID_PUSH_REGISTRATION_UNAVAILABLE');
      return { ok: true };
    }

    let updateResult;
    try {
      updateResult = await this.client.from(TABLE)
        .update({
          fcm_token: registration.fcm_token,
          permission_state: registration.permission_state,
          active: registration.active,
          updated_at: registration.updated_at,
        })
        .eq('installation_id', registration.installation_id)
        .select('installation_id')
        .maybeSingle();
    } catch {
      throw new Error('ANDROID_PUSH_REGISTRATION_UNAVAILABLE');
    }
    if (updateResult.error || !updateResult.data) throw new Error('ANDROID_PUSH_REGISTRATION_UNAVAILABLE');
    return { ok: true };
  }

  async revoke(installationId) {
    if (typeof installationId !== 'string' || !UUID_PATTERN.test(installationId)) {
      throw new AndroidPushRegistrationError();
    }
    let result;
    try {
      result = await this.client.from(TABLE).delete().eq('installation_id', installationId.toLowerCase());
    } catch {
      throw new Error('ANDROID_PUSH_REGISTRATION_UNAVAILABLE');
    }
    if (result.error) throw new Error('ANDROID_PUSH_REGISTRATION_UNAVAILABLE');
    return { ok: true };
  }
}
