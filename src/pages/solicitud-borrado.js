const form = document.querySelector('#solicitud-borrado');
const status = document.querySelector('#solicitud-estado');
const email = form.elements.namedItem('email');
const username = form.elements.namedItem('username');
const submit = form.querySelector('button');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  const body = JSON.stringify({ email: email.value.trim(), username: username.value.trim() });
  for (const control of [email, username, submit]) control.disabled = true;
  form.setAttribute('aria-busy', 'true');
  status.removeAttribute('data-error');
  status.textContent = 'Enviando solicitud…';
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (response.ok && (await response.json()).ok === true) {
      form.reset();
      status.textContent = 'Solicitud enviada. Soporte se pondrá en contacto para verificar la titularidad. Tu cuenta aún no se ha eliminado.';
      return;
    }
    status.setAttribute('data-error', '');
    status.textContent = response.status === 429
      ? 'Demasiadas solicitudes. Espera al menos un minuto antes de reintentar.'
      : response.status === 400
        ? 'Revisa el correo y el username antes de reintentar.'
        : 'No se pudo confirmar el envío. Reintenta o usa el enlace de correo.';
  } catch {
    status.setAttribute('data-error', '');
    status.textContent = 'No se pudo confirmar el envío. Reintenta o usa el enlace de correo.';
  } finally {
    for (const control of [email, username, submit]) control.disabled = false;
    form.removeAttribute('aria-busy');
  }
});

form.hidden = false;
