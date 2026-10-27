# Backend messaging

Messages are persisted in SQLite by migration 16, which runs on startup. This
implements in-app messaging; it does not send email, SMS, or push notifications.
Migration 17 adds per-recipient trash status without removing message content.
Migration 18 adds trash status for shared shul inbox messages.
Migration 19 adds persistent replies associated with the original message.
Migration 20 adds permanent trash expiration records and cleanup indexes.
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
- Administrators can also use the personal send endpoint to write to their own
  shul's shared inbox as themselves, just like members.
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
| GET | `/api/me/messages/counts` | Current user's totals: `{ all, unread, trash }`, independent of pagination; All and Unread exclude trash |
| GET | `/api/me/messages?folder=sent` | Messages the member sent to their shul |
| POST | `/api/me/messages` | Send `{ subject, body }` to the member's current shul |
| GET | `/api/me/messages/:messageId/thread` | Original message, chronological replies, and reply permissions |
| POST | `/api/me/messages/:messageId/replies` | Send `{ body, participantId? }` in a conversation |
| PATCH | `/api/me/messages/:messageId/read` | Mark a personal delivery read; body `{}` |
| PATCH | `/api/me/messages/:messageId/unread` | Mark a personal delivery unread; body `{}` |
| PATCH | `/api/me/messages/:messageId/trash` | Move to trash or restore; body `{ trashed: true }` or `{ trashed: false }` |
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

The current user's inbox and totals include personal deliveries plus shared shul
messages when the user is a current administrator of that shul. Shul-addressed
messages include `recipient: { type: 'shul', id, name }`. Read, unread, trash, and
restore actions on these messages update the shared shul receipt. All current
admins see that shared state; former admins lose access immediately. Personal
delivery status remains private to its recipient. The merged inbox is sorted and
paginated together, including messages sent before this feature was added.

Personal lists also accept `folder=trash`, `sort=newest|oldest` (default `newest`),
and `unread=true|false` (default `false`). Filters and ordering apply before
pagination. Trashed deliveries are excluded from the inbox. Trash and read status
belong to the recipient for personal deliveries; changing them never modifies
another personal recipient's copy. Shared shul deliveries use the shared status
described above.

## Trash retention

A delivery expires after 30 continuous days in Trash, measured from `deleted_at`
in UTC. Repeated delete actions preserve the original deadline. Restoring before
the deadline clears it; moving the restored message back to Trash starts a new
30-day period. Trash responses include `trashExpiresAt` so the UI can display the
deadline along with warnings before deletion and in the Trash folder.

Cleanup runs at database startup, hourly in the server, and before authenticated
messaging requests. Expired delivery receipts are permanently removed, and minimal
expiration records prevent restoration or resurrection through an old thread.
Expiring a personal copy does not remove other recipients' copies. Expiring a
shared shul copy removes it for all admins. Affected conversations must be started
again as new messages rather than replying into an expired delivery.

Content still owned by another recipient or by the original sender's sent history
is retained for that owner. Unowned system-message content is physically removed.
These are per-owner deletions, not deletion of other users' message copies.

## Replies

Replies stay attached to their original message. All current admins of the
message's shul can read and contribute to the conversation, and reply as the shul.
Admins see the contributing administrator's name; members see the shul identity.
Members can see only their own conversation with the shul, including when the
original message was a broadcast. Admins choose `participantId` when replying to
a broadcast with multiple recipients. This must be an original recipient; clients
cannot add arbitrary participants or spoof a sender. Normal members cannot reply
on another recipient's branch. System messages do not accept replies. Leaving the
shul prevents further replies, while existing personal deliveries remain readable.

A reply restores the receiving side's conversation from trash, makes it unread,
and moves it up the inbox using its latest reply date. Inbox entries include
`replyCount` and `lastReplyAt` scoped to the viewer. Shared and personal entries
for the same message are deduplicated for admins. The UI refreshes visible threads
and inboxes every ten seconds and when the window regains focus.

Responses include `id`, `shulId`, `kind`, `sender`, `subject`, `body`, `sendAt`,
and `readAt`. User senders include the `ShulUser` profile fields; shul senders
include the `Shul` profile fields. Both can include `pictureUrl`. The `type`
discriminator identifies the profile shape. User senders also retain `name` as
their combined display name. These are JSON data objects, not class instances.
System senders use the Gabbai identity and favicon at `/api/system/picture`.
Simplified sender examples:

```json
{ "type": "system", "name": "The Gabbai Team", "pictureUrl": "/api/system/picture" }
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

## Sample inboxes

Run `npm run db:seed-messages` to add 3–5 sample messages to each affiliated
user in `data/gabbai.dev.sqlite`, including guest profiles. The count is stable
per user and varies by user ID. Profiles without a shul are skipped. The utility
includes system messages and, where an administrator exists, shul messages.
Timestamps vary and each inbox receives read and unread examples. Sample
confirmations do not create reading assignments. Existing messages are retained;
rerunning the command adds no duplicate samples and preserves read status. Run
it again after adding development users to populate their inboxes. This command
does not seed the production or Render preview databases.
