(() => {
  const message = document.querySelector('#confirmation-message');
  const parameters = new URLSearchParams(window.location.search);
  const exactlyOne = (name) => {
    const values = parameters.getAll(name);
    return values.length === 1 ? values[0] : null;
  };
  const handoffId = exactlyOne('handoff_id');
  const tokenHash = exactlyOne('token_hash');
  const type = exactlyOne('type');
  const allowedParameters = new Set(['handoff_id', 'token_hash', 'type']);
  const parameterNames = [...parameters.keys()];

  window.history.replaceState(null, '', window.location.pathname);

  const showError = () => {
    message.textContent = 'No se pudo confirmar el email. Solicita un nuevo enlace e inténtalo otra vez.';
  };

  if (!handoffId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(handoffId)
    || !tokenHash || tokenHash.length > 2048 || type !== 'email'
    || parameterNames.some((name) => !allowedParameters.has(name))
    || parameterNames.length !== 3 || typeof window.crypto?.subtle?.encrypt !== 'function') {
    showError();
    return;
  }

  const toBase64Url = (bytes) => {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };

  async function completeConfirmation() {
    const configResponse = await fetch('/config/supabase', { cache: 'no-store' });
    if (!configResponse.ok) throw new Error('CONFIGURACION_NO_DISPONIBLE');
    const config = await configResponse.json();
    const client = window.supabase.createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: verified, error: verifyError } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'email',
    });
    const session = verified?.session;
    if (verifyError || !session?.access_token || !session?.refresh_token) {
      throw new Error('CONFIRMACION_INVALIDA');
    }

    const keyResponse = await fetch(`/api/android/email-handoff/${handoffId}/public-key`, { cache: 'no-store' });
    if (!keyResponse.ok) throw new Error('HANDOFF_NO_DISPONIBLE');
    const { publicKey } = await keyResponse.json();
    const wrappingKey = await window.crypto.subtle.importKey('jwk', publicKey, {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    }, false, ['encrypt']);
    const aesKey = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
    const rawAesKey = await window.crypto.subtle.exportKey('raw', aesKey);
    const wrappedKey = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, wrappingKey, rawAesKey);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const sessionBytes = new TextEncoder().encode(JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }));
    const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, sessionBytes);
    const response = await fetch(`/api/android/email-handoff/${handoffId}/publish`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        payload: {
          iv: toBase64Url(iv),
          wrappedKey: toBase64Url(new Uint8Array(wrappedKey)),
          ciphertext: toBase64Url(new Uint8Array(ciphertext)),
        },
      }),
    });
    if (!response.ok) throw new Error('HANDOFF_NO_DISPONIBLE');
    message.textContent = 'Email confirmado. Vuelve a la app Android para continuar.';
  }

  void completeConfirmation().catch(showError);
})();
