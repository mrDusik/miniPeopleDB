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
  const calls = { createClient: [], signInWithOAuth: [], signOut: [] };
  const appFetch = window.fetch;
  window.fetch = (url, init) => url === '/config/supabase'
    ? Promise.resolve({ ok: true, status: 200, json: async () => ({ url: 'https://proyecto.supabase.test', anonKey: 'anon-key-publica' }) })
    : appFetch(url, init);
  const emit = (event) => listeners.forEach((listener) => listener(event, session));
  window.__supabaseStub = {
    calls,
    setSession(event, next) { session = next; emit(event); },
  };
  window.supabase = {
    createClient(url, key, clientOptions) {
      calls.createClient.push({ url, key, clientOptions });
      return {
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
