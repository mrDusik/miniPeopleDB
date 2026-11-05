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
    message.textContent = 'No se pudo confirmar el email. Solicita un nuevo enlace e inténtalo otra vez.';
  };

  if (flow !== 'signup' || !tokenHash || tokenHash.length > 2048 || type !== 'email'
    || parameterNames.length !== 3
    || parameterNames.some((name) => !['flow', 'token_hash', 'type'].includes(name))) {
    showError();
    return;
  }

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
    message.textContent = 'Email confirmado. Vuelve a la pestaña donde iniciaste el registro; debería continuar automáticamente.';
  }

  void confirmEmail().catch(showError);
})();
