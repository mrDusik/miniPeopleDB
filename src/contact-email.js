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
  return async function sendContactEmail({ email = null, username = null, message } = {}) {
    if (!apiKey || !fromEmail || !recipientEmail || typeof fetchImpl !== 'function') {
      throw new ContactEmailUnavailableError();
    }

    const text = [
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
      subject: 'Contacto desde MiniPeopleDB',
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
