# Backend messaging

Messages are persisted in SQLite by migration 16, which runs on startup. This
implements in-app messaging; it does not send email, SMS, or push notifications.
Message subjects and bodies are plain text. Clients should render them as text,
never as HTML.

## Identities and permissions

- Gabbai sends system confirmations and reading invitations. Only trusted backend
  code can create system messages; there is no public system-send endpoint.
- Members can send messages to their current shul. They cannot choose a user
  recipient, impersonate another sender, or message a different shul.
- Administrators send on behalf of their shul, using the shul endpoint. All of
  that shul's current administrators share its inbox and sent history. The
  initiating administrator's ID is stored privately in `messages.actor_user_id`
  for auditing and is excluded from message responses.
- Shuls can address one or more current members/admins of that shul. Each
  recipient gets a private delivery and independent read status. Other recipients
  and their read status are not disclosed in a user's inbox.
- Guest profiles receive stored registration confirmations, but cannot initiate
  conversations or receive shul broadcasts/invitations. Guest account claiming
  and external delivery are separate work.
- Membership and role checks use the current database record on every request.
  Users keep access to messages previously delivered to their personal inbox
  after leaving a shul; they lose the ability to contact its inbox. Former admins
  immediately lose access to its shared inbox and history.

Existing session authentication, same-origin write checks, and opt-in demo
identities apply. Inbox responses use `Cache-Control: no-store`.

## HTTP API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/me/messages` | Current user's inbox |
| GET | `/api/me/messages?folder=sent` | Messages the member sent to their shul |
| POST | `/api/me/messages` | Send `{ subject, body }` to the member's current shul |
| PATCH | `/api/me/messages/:messageId/read` | Mark a personal delivery read; body `{}` |
| GET | `/api/shuls/:id/messages` | Admin-only shared inbox of member messages |
| GET | `/api/shuls/:id/messages?folder=sent` | Admin-only history of shul messages, including `recipientIds` |
| POST | `/api/shuls/:id/messages` | Send `{ subject, body, recipientIds: [...] }` as the shul |
| PATCH | `/api/shuls/:id/messages/:messageId/read` | Mark a shared inbox message read; body `{}` |

GET lists return arrays, ordered newest first with a stable ID tie-breaker.
Both lists accept `limit` (1–100, default 50), `offset` (default 0), and `folder`
(`inbox` or `sent`). Unknown fields/query parameters are rejected. Subject and
body are required, trimmed, and limited to 200 and 10,000 characters. A shul send
accepts 1–1000 distinct recipient IDs and commits all deliveries atomically.
For a broadcast, supply the intended member/admin IDs from the existing shul
users endpoint. Permission changes or invalid recipients abort the whole send.

Responses include `id`, `shulId`, `kind`, `sender`, `subject`, `body`, `createdAt`,
and `readAt`. Sender examples:

```json
{ "type": "system", "name": "Gabbai" }
{ "type": "shul", "id": "shul-uuid", "name": "Example Shul" }
{ "type": "user", "id": "user-uuid", "name": "Example Member" }
```

`readAt` is null for unread deliveries and sent-folder entries. A successful
shul send also returns `recipientCount`. Read operations return `{ "read": true }`
and preserve the original read timestamp on repeated calls. The shul inbox's
read state is shared among admins. There are no edit/delete or user-to-user
send routes. These are individual messages; conversation threading is not yet
implemented.

## System sending

Successful reading registrations automatically create a system confirmation in
the **same transaction** as the assignment. A failed registration or confirmation
write rolls back both. The assigned reader receives it; for guest bookings, a
signed-in booker also receives a copy, even if they belong to another shul.
Anonymous guest bookings store a copy for the guest profile only. Existing
registrations are not backfilled. Admin assignment changes do not currently
generate confirmations.

Trusted backend jobs/services can send invitations with:

```js
database.sendSystemMessage(shulId, {
    kind: 'reading_invitation', // alternatively 'confirmation'
    subject: 'Readers needed this Shabbat',
    body: 'Please visit your shul schedule to register for an available reading.',
    recipientIds: [memberId],
    idempotencyKey: 'weekly-invitation:2026-10-31',
});
```

System sends require current member/admin recipients from that shul. Keys are
scoped to the shul and must contain 1–200 characters. Retry the same key, content,
kind, and recipients to return the existing message without duplicate delivery.
Reusing a key with different content/recipients returns a conflict. Use a new key
for each intended campaign. Automatic invitation scheduling, recipient selection,
and notification preferences are not implemented; this interface supplies the
durable sending infrastructure for that work.

Run `npm run test:messages`, `npm run test:db`, `npm run test:api`, and
`npm run test:auth` to verify messaging and the surrounding backend behavior.
