export const DEFAULT_SESSION = {
  access_token: 'token-navegador',
  user: { id: 'user-a', email: 'a@example.com', user_metadata: { full_name: 'Usuaria A' } },
};

// Returns browser-side JS that fakes window.supabase and answers /config/supabase before app.js runs.
export function supabaseStubScript({ session = DEFAULT_SESSION, signInError = null } = {}) {
  return `(() => {
  const options = ${JSON.stringify({ session, signInError })};
  let session = options.session;
  const listeners = [];
  const calls = { createClient: [], signInWithOAuth: [], signOut: [], channel: [], removeChannel: [] };
  const channels = [];
  const appFetch = window.fetch;
  window.fetch = (url, init) => url === '/config/supabase'
    ? Promise.resolve({ ok: true, status: 200, json: async () => ({ url: 'https://proyecto.supabase.test', anonKey: 'anon-key-publica' }) })
    : appFetch(url, init);
  const emit = (event) => listeners.forEach((listener) => listener(event, session));
  window.__supabaseStub = {
    calls,
    channels,
    setSession(event, next) { session = next; emit(event); },
  };
  window.supabase = {
    createClient(url, key, clientOptions) {
      calls.createClient.push({ url, key, clientOptions });
      return {
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
          async getSession() { return { data: { session }, error: null }; },
          onAuthStateChange(listener) {
            listeners.push(listener);
            return { data: { subscription: { unsubscribe() {} } } };
          },
          async signInWithOAuth(args) {
            calls.signInWithOAuth.push(args);
            return options.signInError ? { data: null, error: { message: options.signInError } } : { data: {}, error: null };
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
