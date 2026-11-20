const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

export class ContactEmailUnavailableError extends Error {
  constructor() {
    super('Contact email delivery is not configured');
    this.name = 'ContactEmailUnavailableError';
  }
}

export class ContactEmailDeliveryError extends Error {
  constructor() {
    super('Contact email delivery failed');
    this.name = 'ContactEmailDeliveryError';
  }
}

export function createResendContactMailer({
  apiKey,
  fromEmail,
  recipientEmail,
  fetchImpl = globalThis.fetch,
} = {}) {
  return async function sendContactEmail({ email = null, username = null, message, kind } = {}) {
    if (!apiKey || !fromEmail || !recipientEmail || typeof fetchImpl !== 'function') {
      throw new ContactEmailUnavailableError();
    }

    const deletion = kind === 'account-deletion';
    const text = deletion ? [
      'Solicitud de eliminación de cuenta de MiniPeopleDB. Verificar la titularidad antes de tramitarla.',
      `Correo de respuesta: ${email}`,
      `Usuario declarado: ${username || 'No proporcionado'}`,
    ].join('\n') : [
      'Nuevo mensaje desde el formulario de contacto de MiniPeopleDB.',
      `Email: ${email || 'No proporcionado'}`,
      `Usuario: ${username || 'No proporcionado'}`,
      '',
      'Mensaje:',
      message,
    ].join('\n');
    const payload = {
      from: fromEmail,
      to: [recipientEmail],
      subject: deletion ? 'Solicitud de eliminación de cuenta de MiniPeopleDB' : 'Contacto desde MiniPeopleDB',
      text,
      ...(email ? { reply_to: email } : {}),
    };

    let response;
    try {
      response = await fetchImpl(RESEND_EMAILS_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new ContactEmailDeliveryError();
    }

    if (!response?.ok) throw new ContactEmailDeliveryError();
  };
}
