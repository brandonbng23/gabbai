# Mailgun email transport

Email selection rules are TBD. No message, reply, confirmation, or invitation
currently triggers an email. Existing messaging remains in-app only.

`app.locals.mailer` provides a server-side Mailgun transport, disabled by default.
No browser configuration or API exposes credentials or arbitrary email sending.

## Configuration

Copy `.env.example` to `.env` locally and fill in the Mailgun API key, sending
domain, sender address, and region (`us` or `eu`). Keep `MAILGUN_ENABLED=false`
until email rules are implemented. On hosted environments, use server environment
variables. Never put these values in `VITE_` variables or commit the API key.

The existing start command reads the process environment. To explicitly load a
local `.env` file, run `node --env-file=.env index.js`. Merely creating `.env`
does not change the existing npm scripts.

When enabled and explicitly invoked by backend code, the transport sends one
plain-text email per recipient using Mailgun's HTTP API. An accepted response
means queued by Mailgun, not confirmed delivery. It has a ten-second timeout and
does not automatically retry ambiguous failures. No real email was sent during
implementation; tests use mocked HTTP responses.

Before enabling automatic delivery, implement the agreed selection rules and a
durable outbox so email failures do not affect bookings or in-app messages. Demo
and seed data must not be used as historical email jobs.

Run `npm run test:email` for transport tests.

Reference: [Mailgun HTTP sending documentation](https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/send-http).
