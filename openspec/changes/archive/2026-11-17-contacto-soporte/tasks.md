# Tasks

## 1. Backend de contacto y correo

- [x] 1.1 Integrate Resend through the server-side HTTP API using `RESEND_API_KEY`, verified `CONTACT_FROM_EMAIL`, and `CONTACT_SUPPORT_EMAIL`; verify accepted and failed provider responses with mocked-fetch tests.
- [x] 1.2 Add the public contact endpoint with request-size and field validation, bounded rate limiting, and controlled errors; verify anonymous valid submissions, invalid payloads, rate-limit rejection, and provider failures in API tests.
- [x] 1.3 For requests with an Authorization header, validate the session, derive email and username from the authenticated identity/profile using the user's JWT, and reject invalid sessions without sending; verify with API tests and the existing Supabase mock.

## 2. Modal compartido y experiencia responsive

- [x] 2.1 Add the `✉️ Contacto` entries and shared `Contacto` dialog in the access screen and user dropdown; verify accessible open/close behavior and focus restoration with browser tests.
- [x] 2.2 Implement anonymous and authenticated field states, conditional validation, submission feedback, and retry behavior; verify required/optional fields, disabled identity values, and success/error states with automated browser tests.
- [x] 2.3 Add responsive modal styling for small viewports and verify the contact fields and actions remain usable without horizontal overflow in mobile browser tests.
- [x] 2.4 Show a live message character counter and accessible limit warning; test typing/pasting, reaching and leaving the limit, reset, successful sending, and preservation after failure.
- [x] 2.5 Compact login and registration spacing on desktop/mobile/Android; verify empty/error status visibility and measure both forms in desktop and mobile browsers without hiding overflowing controls.

## 3. Android, documentación e integración

- [x] 3.1 Verify the Android web-packaging build includes the contact UI and that the packaged client submits to its configured backend; run the existing Android build validation.
- [x] 3.2 Document the required email-provider and recipient environment settings and verify the instructions match the backend configuration.
- [x] 3.3 Run the focused contact/API/browser tests and the relevant existing authentication and Android regression tests; confirm the web and Android authentication flows remain unchanged.
