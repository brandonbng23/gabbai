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

## Current delivery status

No email provider is configured, so outgoing email is disabled. Registration
confirmations, scheduled summaries, and instant alerts still appear in platform
inboxes. The registration form reports email as unavailable.

The provider-independent queue, quotas, and notification settings are retained
for a future email provider. Tests use a fake mailer without real recipients.

## Persistence, scheduling, and failure behavior

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
