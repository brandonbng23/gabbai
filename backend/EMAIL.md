# Registration notifications and Mailgun

## Public rules

- Registration confirmations are always saved as system messages in the reader’s
  platform inbox. A signed-in guest booker also gets the guest confirmation.
- Emailing a confirmation is optional, unchecked by default. Members and admins
  can request five per shul-local day. Guest registrations can request one per
  normalized email address per shul-local day. This also applies when using a
  guest profile without the guest form. Guest identity is not verified, so this
  is an email-address limit, not a reliable per-person limit.
- Every current admin gets a daily system inbox roundup at 4 PM in the shul’s
  configured IANA timezone. It covers the upcoming three calendar months,
  including today, with reader names, dates, aliyot, and passages for assigned
  readings. Vacancies have only date, reading name, count, and aliyah numbers;
  locked/unavailable slots are not advertised as vacancies.
- One current admin per shul can be selected for a system message with every
  successful self-service reading registration. The same alert is queued for
  email when available. Daily roundups go to every admin, regardless of this
  selection. Admin-assigned slots are included in the roundup.
- **All email types share a limit of 100 outgoing emails across the entire app
  per UTC day**, resetting at midnight UTC. This includes confirmations, instant
  alerts, and roundups. System inbox messages and registrations continue when
  email is disabled, capped, or unavailable.

These rules appear publicly on the registration form and in the README. They are
also available without signing in at `GET /api/shuls/:id/notification-policy`.
Each shul’s timezone and instant-alert admin are editable under **Administration
Settings → Notifications and email**. New shuls default to `America/New_York`
until an admin changes the timezone.

## Configuration

Copy `.env.example` to `.env` locally, fill in `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`,
`MAILGUN_FROM`, and `MAILGUN_REGION` (`us` or `eu`), then set `MAILGUN_ENABLED=true`
when ready to send. On hosted environments use server environment variables.
Never use `VITE_` variables for these values or commit the API key.

The existing npm scripts read the process environment; they do not automatically
load `.env`. Run `node --env-file=.env index.js` to explicitly load it locally,
or use `node --env-file=.env scripts/dev.mjs` for the development server.
Email is disabled by default and in preview mode. Tests mock Mailgun; no live
credentials or real recipients are needed.

## Persistence, scheduling, and failure behavior

Migration 22 creates shul notification preferences, daily confirmation request
quotas, per-admin roundup markers, the email outbox, and the global UTC sending
budget. Booking, inbox confirmation, instant admin alert, quota reservation, and
outbox entries commit in one SQLite transaction. Mailgun is called separately;
a provider failure cannot roll back a successful registration.

The server checks for due roundups every minute, starting at 4 PM local time, and
catches up for the current local day if it starts later. A marker per admin/day
prevents duplicates across restarts and workers. The server must be running;
an always-on server is required for the 4 PM schedule. It does not backfill prior
days. New registrations wake the queue worker after the response is sent.
A long roundup is split into numbered platform messages while retaining one
complete email per admin.

Workers claim queued jobs and reserve the global budget atomically. Emailing
stops at 100 reserved/accepted submissions per UTC day; capped jobs are terminal
rather than spilling stale notifications into tomorrow. Mailgun acceptance means
queued by the provider, not confirmed delivery. Definite 4xx rejections release
the reserved sending slot. Timeout, network, 5xx, malformed-success, or interrupted
worker outcomes remain `unknown` and keep their reservation to avoid exceeding
the cap or duplicating email. They are not automatically resent. Thus uncertain
attempts can reduce the day’s remaining allowance. Current shul admin membership
is checked again immediately before sending admin-only information.

Existing seeded messages are never converted into email jobs. Failed bookings
consume no quota and produce no notification. Confirmation limits apply to
requests accepted into the outbox; hitting one never blocks the reading booking.
Guest confirmations are stored in guest profiles; anonymous guests do not yet
have an account-claim flow to open that inbox.

Run `npm run test:email`, `npm run test:messages`, and `npm run test:api` to verify.

Reference: [Mailgun HTTP sending documentation](https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/send-http).
