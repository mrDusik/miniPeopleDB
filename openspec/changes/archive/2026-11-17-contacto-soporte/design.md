# Design

## Context

See `proposal.md` for motivation and `specs/contacto-soporte/spec.md` for the user-visible contract. The web client is a static application in `public/`; the Android build copies that directory into its local package. The Express server has a shared authentication helper for protected routes, while unauthenticated contact from the access screen requires this new endpoint to remain public. No email-delivery integration currently exists.

## Goals / Non-Goals

**Goals:**

- Reuse one responsive dialog and submission flow across browser, mobile layouts, and Android.
- Keep email delivery credentials and contact handling on the backend.
- Bind authenticated submissions to the verified session and saved username.
- Make public submission bounded, validated, and protected against routine abuse.

**Non-Goals:**

- Add a support inbox, persistent ticket history, or in-app conversation workflow.
- Change authentication, profile, or account-recovery behavior.
- Send email directly from the browser or Android package.

## Decisions

### Reuse the shared web client

Add the login entry point within the access screen and the authenticated entry next to Preferences in the user dropdown. Implement the dialog once in the existing static client so Android receives it through the current `public/` packaging step. This avoids separate behavior and validation rules in a native Android screen.

The message field uses its 1,000-character HTML limit as the source for a visible counter updated on input. The backend enforces the same maximum. A separate polite live region announces the limit only when reached, without announcing every character. Reset the counter and warning when clearing the form or after a successful submission; preserve them with the message after a failed submission.

### Compact the access and registration card

Reduce vertical card padding and form gaps, use the dynamic viewport height, and constrain the logo block without changing its aspect ratio or the shared application header. Apply tighter spacing below 740px of viewport height while retaining the existing mobile input heights. Hide only empty status elements; nonempty errors and content that exceeds very small viewports remain scrollable. Android inherits the same CSS when rebuilt.

### Keep the contact endpoint public but authenticate presented sessions

The endpoint must accept anonymous requests so users locked out of their account can contact support. If a request includes an Authorization bearer token, validate it with the existing Supabase Auth mechanism; reject invalid tokens rather than silently downgrading them to anonymous. For authenticated requests, derive email from the verified identity and username from that user's profile using the user's JWT and existing RLS-backed access. Do not use `service_role` or trust client-supplied identity fields.

### Isolate email delivery in the backend

Use the Resend HTTP API through the existing Node `fetch` capability, avoiding an extra runtime dependency. Configure `RESEND_API_KEY`, a Resend-verified `CONTACT_FROM_EMAIL`, and `CONTACT_SUPPORT_EMAIL` in the backend environment; the latter is `mrdusik.gh@gmail.com`. Keep provider credentials out of client assets and logs. Format user-provided data as message content rather than mail headers; only a validated email may be used as a reply address. The endpoint returns success only after Resend accepts the message. SMTP/Nodemailer was considered but would add a dependency and a second provider configuration path without improving the required behavior.

### Bound and validate public submissions

Enforce a request-body size limit, validate the conditional anonymous identity fields and required message on the server, and apply a bounded rate limit to submissions. Return generic client errors for provider failures and abuse limits; do not log message contents, credentials, or tokens. Do not persist contact submissions in application tables.

## Risks / Trade-offs

- [The public endpoint may be abused to send unwanted email] → Validate input, cap request size, rate-limit submissions, and rely on the provider's sending quotas.
- [Provider configuration may be absent or fail at runtime] → Fail visibly with a controlled error; never report success unless the provider accepts the message.
- [Disabled fields in the UI alone do not prevent identity spoofing] → Derive authenticated identity server-side and ignore client identity fields for authenticated submissions.

## Migration Plan

No database migration is required. Configure the chosen mail provider's credentials and support-recipient setting in the backend environment before deployment. Deploy the backend and shared client together; Android packages created from the updated `public/` directory receive the same interface. Roll back by disabling/removing the contact entry points and endpoint, then removing the mail configuration; existing authentication and collection flows remain unchanged.

