import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ContactEmailDeliveryError,
  ContactEmailUnavailableError,
  createResendContactMailer,
} from '../src/contact-email.js';

const config = {
  apiKey: 'resend-test-key',
  fromEmail: 'MiniPeopleDB <contact@example.com>',
  recipientEmail: 'mrdusik.gh@gmail.com',
};

test('Resend recibe el contacto de soporte y usa el email válido para responder', async () => {
  let request;
  const send = createResendContactMailer({
    ...config,
    fetchImpl: async (url, init) => {
      request = { url, init, body: JSON.parse(init.body) };
      return { ok: true, status: 200 };
    },
  });

  await send({ email: 'person@example.com', username: 'BrickFan', message: 'No puedo acceder.' });

  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.headers.authorization, 'Bearer resend-test-key');
  assert.equal(request.body.from, config.fromEmail);
  assert.deepEqual(request.body.to, [config.recipientEmail]);
  assert.equal(request.body.reply_to, 'person@example.com');
  assert.match(request.body.text, /Usuario: BrickFan/);
  assert.match(request.body.text, /Mensaje:\nNo puedo acceder\./);
});

test('Resend no configura reply-to cuando el contacto anónimo no proporciona email', async () => {
  let payload;
  const send = createResendContactMailer({
    ...config,
    fetchImpl: async (_url, init) => {
      payload = JSON.parse(init.body);
      return { ok: true };
    },
  });

  await send({ username: 'BrickFan', message: 'Tengo una pregunta.' });

  assert.equal(Object.hasOwn(payload, 'reply_to'), false);
  assert.match(payload.text, /Email: No proporcionado/);
});

test('Resend exige configuración y comunica fallos del proveedor', async () => {
  await assert.rejects(
    createResendContactMailer({ ...config, apiKey: null })({ message: 'Hola' }),
    ContactEmailUnavailableError,
  );
  await assert.rejects(
    createResendContactMailer({ ...config, fetchImpl: async () => ({ ok: false }) })({ message: 'Hola' }),
    ContactEmailDeliveryError,
  );
  await assert.rejects(
    createResendContactMailer({ ...config, fetchImpl: async () => { throw new Error('network'); } })({ message: 'Hola' }),
    ContactEmailDeliveryError,
  );
});
