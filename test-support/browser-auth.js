export const DEFAULT_SESSION = {
  access_token: 'token-navegador',
  user: { id: 'user-a', email: 'a@example.com', user_metadata: { full_name: 'Usuaria A' } },
};
export const DEFAULT_PROFILE = {
  username: 'SpaceFan', avatarUrl: null, currency: 'EUR', language: 'es',
  onboardingCompleted: true, favoriteCategories: [],
};

// Returns browser-side JS that fakes window.supabase and answers /config/supabase before app.js runs.
export function supabaseStubScript({
  session = DEFAULT_SESSION,
  signInError = null,
  passwordSignInError = null,
  signUpError = null,
  recoveryError = null,
  updatePasswordError = null,
  avatarUploadError = null,
  passwordSession = null,
  oauthSession = null,
  oauthCallbackError = null,
  configError = false,
  recoverySession = null,
  profileData = DEFAULT_PROFILE,
  profileFallback = true,
} = {}) {
  return `(() => {
  const options = ${JSON.stringify({ session, signInError, passwordSignInError, signUpError, recoveryError, updatePasswordError, avatarUploadError, passwordSession, oauthSession, oauthCallbackError, configError, recoverySession, profileData, profileFallback })};
  let session = options.session;
  let configError = options.configError;
  const listeners = [];
  const calls = {
    createClient: [], signInWithOAuth: [], signInWithPassword: [], setSession: [], signUp: [],
    resetPasswordForEmail: [], updateUser: [],     signOut: [], exchangeCodeForSession: [], channel: [], removeChannel: [],
    avatarUploads: [], avatarRemovals: [],
  };
  const channels = [];
  const appFetch = window.fetch;
  window.fetch = async (url, init) => {
    const requestPath = new URL(url, window.location.href).pathname;
    if (requestPath === '/config/supabase') {
      if (configError) return { ok: false, status: 500, json: async () => ({ error: 'CONFIGURACION_NO_DISPONIBLE' }) };
      return { ok: true, status: 200, json: async () => ({ url: 'https://proyecto.supabase.test', anonKey: 'anon-key-publica' }) };
    }
    if (requestPath === '/api/profile' && options.profileFallback) {
      return { ok: true, status: 200, json: async () => options.profileData };
    }
    const response = await appFetch(url, init);
    return response;
  };
  const emit = (event) => listeners.forEach((listener) => listener(event, session));
  window.__supabaseStub = {
    calls,
    channels,
    setConfigError(value) { configError = value; },
    setSession(event, next) { session = next; emit(event); },
  };
  window.supabase = {
    createClient(url, key, clientOptions) {
      calls.createClient.push({ url, key, clientOptions });
      return {
        storage: {
          from(bucket) {
            return {
              async upload(path, file, uploadOptions) {
                calls.avatarUploads.push({ bucket, path, type: file.type, size: file.size, options: uploadOptions });
                return options.avatarUploadError
                  ? { data: null, error: { message: 'Upload failed' } }
                  : { data: { path }, error: null };
              },
              getPublicUrl(path) { return { data: { publicUrl: 'https://proyecto.supabase.test/storage/v1/object/public/' + bucket + '/' + path } }; },
              async remove(paths) { calls.avatarRemovals.push({ bucket, paths }); return { data: [], error: null }; },
            };
          },
        },
        channel(name) {
          const channel = {
            name,
            handlers: [],
            statusHandler: null,
            on(_event, filter, callback) { this.handlers.push({ filter, callback }); return this; },
            subscribe(callback) { this.statusHandler = callback; callback?.('SUBSCRIBED'); return this; },
            emit(payload) { this.handlers.forEach(({ callback }) => callback(payload)); },
            setStatus(status) { this.statusHandler?.(status); },
            unsubscribe() { this.unsubscribed = true; return Promise.resolve('ok'); },
          };
          channels.push(channel);
          calls.channel.push(name);
          return channel;
        },
        removeChannel(channel) {
          calls.removeChannel.push(channel.name);
          return channel.unsubscribe();
        },
        auth: {
          async setSession(tokens) {
            calls.setSession.push(tokens);
            session = options.passwordSession ?? {
              ...tokens, user: { id: 'classic-user', email: 'classic@example.com', user_metadata: {} },
            };
            emit('SIGNED_IN');
            return { data: { session }, error: null };
          },
          async getSession() { return { data: { session }, error: null }; },
          onAuthStateChange(listener) {
            listeners.push(listener);
            return { data: { subscription: { unsubscribe() {} } } };
          },
          async signInWithOAuth(args) {
            calls.signInWithOAuth.push(args);
            return options.signInError
              ? { data: null, error: { message: options.signInError } }
              : { data: { url: 'https://accounts.google.test/oauth' }, error: null };
          },
          async exchangeCodeForSession(code) {
            calls.exchangeCodeForSession.push(code);
            if (options.oauthCallbackError) return { data: null, error: { message: options.oauthCallbackError } };
            session = options.oauthSession ?? {
              access_token: 'token-oauth',
              user: { id: 'oauth-user', email: 'oauth@example.com', user_metadata: {} },
            };
            emit('SIGNED_IN');
            return { data: { session }, error: null };
          },
          async signInWithPassword(args) {
            calls.signInWithPassword.push(args);
            if (options.passwordSignInError) return { data: null, error: { message: options.passwordSignInError } };
            session = options.passwordSession ?? {
              access_token: 'token-classic',
              user: { id: 'classic-user', email: args.email, user_metadata: {} },
            };
            emit('SIGNED_IN');
            return { data: { user: session.user, session }, error: null };
          },
          async signUp(args) {
            calls.signUp.push(args);
            return options.signUpError
              ? { data: null, error: { message: options.signUpError } }
              : { data: { user: { id: 'new-user', email: args.email, user_metadata: args.options?.data ?? {} }, session: null }, error: null };
          },
          async resetPasswordForEmail(email, args) {
            calls.resetPasswordForEmail.push({ email, options: args });
            if (options.recoveryError) return { error: { message: options.recoveryError } };
            if (options.recoverySession) {
              session = options.recoverySession;
              emit('PASSWORD_RECOVERY');
            }
            return { error: null };
          },
          async updateUser(args) {
            calls.updateUser.push(args);
            return options.updatePasswordError ? { error: { message: options.updatePasswordError } } : { error: null };
          },
          async signOut(args) {
            calls.signOut.push(args ?? null);
            session = null;
            emit('SIGNED_OUT');
            return { error: null };
          },
        },
      };
    },
  };
})();
`;
}

export function withSupabaseSession(appScript, options) {
  return `${supabaseStubScript(options)}\n${appScript}`;
}
