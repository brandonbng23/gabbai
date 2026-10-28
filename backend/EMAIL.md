# Registration notifications and email

## Public rules

- Registration confirmations are always saved as system messages in the reader’s
  platform inbox. A signed-in guest booker also gets the guest confirmation.
- Emailing a confirmation is optional, unchecked by default. Members and admins
  can request five per shul-local day across their own and guest bookings.
  Registrations without a signed-in member/admin use a limit of one per
  normalized guest email address per shul-local day. This also applies when
  using a guest profile without the guest form. Guest identity is not verified, so this
  is an email-address limit, not a reliable per-person limit.
- Admins enabled for daily reports get a system inbox roundup at the shul’s chosen time in its
  configured IANA timezone. Schedules can be daily, Monday/Thursday (M/R), or
  Monday/Wednesday/Friday (M/W/F). Summaries cover 2–12 weeks in two-week steps (up to about three months),
  including today, with reader names, dates, aliyot, and passages for assigned
  readings. Vacancies have only date, reading name, count, and aliyah numbers;
  locked/unavailable slots are not advertised as vacancies.
- One current admin per shul can be selected for a system message with every
  successful self-service reading registration. The same alert is queued for
  email when available. Daily report switches are independent of the instant-alert
  selection. Admin-assigned slots are included in the roundup.
- **All email types share a limit of 100 outgoing emails across the entire app
  per UTC day**, resetting at midnight UTC. This includes confirmations, instant
  alerts, and roundups. System inbox messages and registrations continue when
  email is disabled, capped, or unavailable.

These rules appear publicly on the registration form and in the README. They are
also available without signing in at `GET /api/shuls/:id/notification-policy`.
Each shul’s timezone, per-admin daily report switches, and instant-alert admin are editable under **Administration
Settings → Communication Settings**. New shuls default to `America/New_York`
until an admin changes the timezone.

## Gmail setup

Gmail supports OAuth through its send-only API, or SMTP with an app password.
Use a dedicated Gmail account so notification sending stays separate from personal email.

### OAuth (no app password required)

1. Create or select a project in [Google Cloud Console](https://console.cloud.google.com/)
   and enable the **Gmail API** under APIs & Services → Library.
2. Configure **Google Auth Platform**: set the app name to Gabbai, choose an
   External audience, and add `teamgabbai@gmail.com` as a test user while Testing.
   Under Data Access add `https://www.googleapis.com/auth/gmail.send`, `openid`,
   and the email identity scope (`https://www.googleapis.com/auth/userinfo.email`).
3. Under Clients, create an OAuth client with application type **Desktop app**.
   This type supports the local loopback callback; do not choose Web application.
4. Add its client ID and client secret to the project-root `.env`:

   ```dotenv
   GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GMAIL_CLIENT_SECRET=your-client-secret
   ```

5. From the project root, run:

   ```sh
   node --env-file=.env scripts/authorize-gmail.mjs teamgabbai@gmail.com
   ```

   Open the printed Google URL, select that account, and approve sending access.
   The helper listens only on `127.0.0.1`, validates OAuth state and PKCE, and
   confirms the authorized email address. It saves the refresh token privately
   to `.env`, switches `GMAIL_USER` and `GMAIL_AUTH_MODE=oauth2`, enables sending,
   and clears any previous app password only after successful authorization.
   It sends no email. Failed or cancelled authorization leaves `.env` unchanged.

Google's External apps in **Testing** issue refresh tokens that expire after
seven days for this scope. Reauthorize when needed during testing. Before relying
on unattended delivery, review Google's Production publishing and verification
requirements; publishing status and verification are separate. Only the sender
authorizes Google access; notification recipients do not need to sign in to Google.

References: [Google desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app),
[token expiration](https://developers.google.com/identity/protocols/oauth2),
[Gmail send-only scope](https://developers.google.com/workspace/gmail/api/auth/scopes).

### App password alternative

For SMTP through Nodemailer,
enable [2-Step Verification](https://support.google.com/accounts/answer/185833),
then create an [app password](https://myaccount.google.com/apppasswords) named
Gabbai. Some managed or protected accounts do not offer app passwords.

Copy `.env.example` to `.env` in the project root and set:

```dotenv
GMAIL_ENABLED=true
GMAIL_USER=your-dedicated-account@gmail.com
GMAIL_AUTH_MODE=app_password
GMAIL_APP_PASSWORD=your-16-character-app-password
GMAIL_FROM_NAME=Gabbai
```

Use the generated app password, not the normal Google password. Spaces in the
app password are stripped. Keep these values server-side, outside Git and any
`VITE_` variables. The sender address is always the authenticated Gmail address.

### Verify and start

For either method, check authentication without sending a message:

```sh
node --env-file=.env scripts/verify-email.mjs
```

Then start development with `node --env-file=.env scripts/dev.mjs` (or production
with `node --env-file=.env index.js`). The usual npm scripts do not load `.env`
automatically. In hosting, set the same environment variables and restart.
The server must stay running for scheduled summaries.

For a delivery test, register for a reading with an email address you control
and request a confirmation. Verify that it arrives, including checking spam.
Provider acceptance is not confirmed inbox delivery. Gmail also applies its own
sending limits; the app's shared 100-email UTC-day cap remains in place.

Email is disabled unless explicitly enabled, and always disabled in preview.
Platform inbox messages remain active without Gmail. Tests use fake transports
and do not send email.

Reference: [Nodemailer Gmail setup](https://nodemailer.com/guides/using-gmail).

## Persistence, scheduling, and failure behavior

### Email appearance

Edit `backend/emailTemplate.html` for the shared email layout and inline styles.
It is loaded by `backend/emailTemplate.mjs` at send time for both SMTP and OAuth,
so HTML edits apply to the next email without a server restart. No JSX compiler
is required. Placeholders are `{{title}}`, `{{preheader}}`, `{{content}}`,
`{{footer}}`, and `{{inboxUrl}}`. The `IF_INBOX` / `END_IF_INBOX` comments surround
the optional button; keep those markers to hide it when no public URL is set.
The JavaScript wrapper handles escaped message content and the plain-text
fallback. Platform inbox messages retain their original content.

Set `GABBAI_PUBLIC_URL` to the app's public origin (for example,
`https://your-gabbai-site.example`) to include an **Open Gabbai** inbox button.
Without a configured URL, the button is omitted. Restart the server after editing
environment variables. The footer asks recipients to respond through Gabbai;
it does not technically prevent replies.

### Notification storage and delivery

Migration 22 creates shul notification preferences, daily confirmation request
quotas, per-admin roundup markers, the email outbox, and the global UTC sending
budget. Booking, inbox confirmation, instant admin alert, quota reservation, and
outbox entries commit in one SQLite transaction. Email delivery runs separately;
a provider failure cannot roll back a successful registration.

The server checks for due roundups every minute, starting at the configured local time on the selected weekdays, and
catches up for the current local day if it starts later. A marker per admin/day
prevents duplicates across restarts and workers. The server must be running;
an always-on server is required for the chosen schedule. It does not backfill prior
days. New registrations wake the queue worker after the response is sent.
A long roundup is split into numbered platform messages while retaining one
complete email per admin.

Workers claim queued jobs and reserve the global budget atomically. Emailing
stops at 100 reserved/accepted submissions per UTC day; capped jobs are terminal
rather than spilling stale notifications into tomorrow. Provider acceptance means
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

Migration 23 adds per-admin summary preferences, enabled by default to preserve
existing behavior. Switching off stops future inbox reports and queued report
emails; past inbox reports remain. New admins default to enabled.

Migration 24 stores `reportTime` (24-hour HH:mm), `reportFrequency` (`daily`,
`mon_thu`, `mon_wed_fri`), and `reportRange` (`2weeks`, `1month`, `2months`,
`3months`). Defaults preserve 4 PM daily reports covering three months. Weekdays
use the shul-local civil calendar, assuming the selected send time is before
sundown. Sunset is not calculated automatically. At most one roundup is generated
per enabled admin per scheduled local date, including same-day startup catch-up.

Migration 25 adds the two-week summary slider: `2weeks`, `4weeks`, `6weeks`,
`8weeks`, `10weeks`, `12weeks`. Twelve weeks is approximately three months,
not three exact calendar months. Legacy one-, two-, and three-month selections
migrate to 4, 8, and 12 weeks respectively, preserving the other settings.
New inbox and email subjects call these Registration Summaries. Internal report
field names and outbox categories remain unchanged for compatibility.
