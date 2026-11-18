(() => {
  const message = document.querySelector('#confirmation-message');
  const parameters = new URLSearchParams(window.location.search);
  const exactlyOne = (name) => {
    const values = parameters.getAll(name);
    return values.length === 1 ? values[0] : null;
  };
  const flow = exactlyOne('flow');
  const tokenHash = exactlyOne('token_hash');
  const type = exactlyOne('type');
  const parameterNames = [...parameters.keys()];

  window.history.replaceState(null, '', window.location.pathname);

  const showError = () => {
    message.textContent = window.MiniPeopleI18n.t('confirmation.error');
  };

  const invalid = flow !== 'signup' || !tokenHash || tokenHash.length > 2048 || type !== 'email'
    || parameterNames.length !== 3
    || parameterNames.some((name) => !['flow', 'token_hash', 'type'].includes(name));

  async function confirmEmail() {
    const configResponse = await fetch('/config/supabase', { cache: 'no-store' });
    if (!configResponse.ok) throw new Error('CONFIGURACION_NO_DISPONIBLE');
    const config = await configResponse.json();
    const client = window.supabase.createClient(config.url, config.anonKey, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
    if (error || !data?.session?.access_token || !data.session.refresh_token) {
      throw new Error('CONFIRMACION_INVALIDA');
    }
    message.textContent = window.MiniPeopleI18n.t('confirmation.webSuccess');
  }

  async function start() {
    try {
      await window.MiniPeopleI18n.initialize();
    } catch {
      message.textContent = 'No se pudieron cargar las traducciones. Reintenta para continuar.';
      const retry = document.createElement('button');
      retry.textContent = 'Reintentar';
      retry.addEventListener('click', () => { retry.remove(); void start(); }, { once: true });
      message.after(retry);
      return;
    }
    message.textContent = window.MiniPeopleI18n.t('confirmation.checking');
    if (invalid) showError();
    else await confirmEmail().catch(showError);
  }
  void start();
})();
