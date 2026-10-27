import { randomUUID } from 'node:crypto';
import { validateKeys } from './settings.mjs';

function fail(status, message) {
    throw Object.assign(new Error(message), { status });
}

function content(input, extra = []) {
    validateKeys(input, ['subject', 'body', ...extra], 'message');
    for (const [key, max] of [['subject', 200], ['body', 10000]]) {
        if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > max)
            throw new TypeError(`${key} must contain 1–${max} characters.`);
    }
    return { subject: input.subject.trim(), body: input.body.trim() };
}

function page(options = {}) {
    validateKeys(options, ['limit', 'offset', 'folder'], 'message query');
    const { limit = 50, offset = 0, folder = 'inbox' } = options;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0)
        throw new TypeError('Use a limit from 1 to 100 and a nonnegative offset.');
    if (!['inbox', 'sent'].includes(folder)) throw new TypeError('Choose inbox or sent.');
    return { limit, offset, folder };
}

export function createMessagingRepository(db, { transaction, getUser, getShul }) {
    function user(id) {
        const actor = typeof id === 'string' ? getUser(id) : null;
        if (!actor) fail(401, 'Sign in to use messages.');
        return actor;
    }
    function member(id, shulId, admin = false) {
        const actor = user(id);
        if (!actor.shulId || actor.shulId !== shulId || !['member', 'admin'].includes(actor.role)
            || (admin && actor.role !== 'admin'))
            fail(403, admin ? 'Only this shul’s administrators can manage its messages.' : 'You can only message your own shul.');
        return actor;
    }
    function recipients(shulId, ids) {
        if (!Array.isArray(ids) || !ids.length || ids.length > 1000
            || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length)
            throw new TypeError('Provide 1–1000 distinct recipient user IDs.');
        for (const id of ids) {
            const recipient = getUser(id);
            if (!recipient || recipient.shulId !== shulId || !['member', 'admin'].includes(recipient.role))
                throw new TypeError('Choose members or administrators from this shul.');
        }
        return ids;
    }
    function decode(row) {
        let sender = { type: 'system', name: 'The Gabbai Team', pictureUrl: '/api/system/picture' };
        if (row.sender_type === 'shul') {
            sender = { ...getShul(row.shul_id), type: 'shul' };
        } else if (row.sender_type === 'user') {
            const { id, firstName, lastName, email, role, title, pictureUrl, assignedReadings } = getUser(row.sender_user_id);
            sender = { type: 'user', id, firstName, lastName, email, role, title, assignedReadings,
                name: `${firstName} ${lastName}`, ...(pictureUrl ? { pictureUrl } : {}) };
        }
        return { id: row.id, shulId: row.shul_id, kind: row.kind,
            sender,
            subject: row.subject, body: row.body, sendAt: row.created_at,
            readAt: row.read_at ?? null };
    }
    const select = 'SELECT m.* FROM messages m';
    function insert({ shulId, senderType, actorId = null, kind = 'message', subject, body, recipientIds = [], idempotencyKey = null }) {
        if (idempotencyKey) {
            const existing = db.prepare(`${select} WHERE m.idempotency_key = ?`).get(idempotencyKey);
            if (existing) {
                const previousIds = db.prepare('SELECT user_id FROM message_recipients WHERE message_id = ? ORDER BY user_id')
                    .all(existing.id).map(row => row.user_id);
                if (existing.shul_id !== shulId || existing.sender_type !== senderType || existing.kind !== kind
                    || existing.subject !== subject || existing.body !== body
                    || JSON.stringify(previousIds) !== JSON.stringify([...recipientIds].sort()))
                    fail(409, 'This idempotency key was already used for a different message.');
                return decode(existing);
            }
        }
        const id = randomUUID();
        db.prepare(`INSERT INTO messages (id, shul_id, sender_type, sender_user_id, actor_user_id, kind, subject, body, idempotency_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, shulId, senderType, senderType === 'user' ? actorId : null,
            actorId, kind, subject, body, idempotencyKey);
        if (senderType === 'user') db.prepare('INSERT INTO shul_message_receipts (message_id) VALUES (?)').run(id);
        const deliver = db.prepare('INSERT INTO message_recipients (message_id, user_id) VALUES (?, ?)');
        for (const recipientId of recipientIds) deliver.run(id, recipientId);
        return decode(db.prepare(`${select} WHERE m.id = ?`).get(id));
    }
    return {
        sendUserMessage(actorId, shulId, input) {
            const values = content(input);
            return transaction(() => {
                const actor = member(actorId, shulId);
                if (actor.role === 'admin') fail(403, 'Administrators send messages on behalf of their shul.');
                return insert({ shulId, senderType: 'user', actorId, ...values });
            });
        },
        sendShulMessage(actorId, shulId, input) {
            const values = content(input, ['recipientIds']);
            return transaction(() => {
                member(actorId, shulId, true);
                const ids = recipients(shulId, input.recipientIds);
                return { ...insert({ shulId, senderType: 'shul', actorId, recipientIds: ids, ...values }), recipientCount: ids.length };
            });
        },
        // Trusted application interface only: never expose system sending as an HTTP route.
        sendSystemMessage(shulId, input) {
            const values = content(input, ['recipientIds', 'kind', 'idempotencyKey']);
            if (!['confirmation', 'reading_invitation'].includes(input.kind)) throw new TypeError('Choose a system message kind.');
            if (typeof input.idempotencyKey !== 'string' || !input.idempotencyKey.trim() || input.idempotencyKey.length > 200)
                throw new TypeError('System messages require an idempotency key of 1–200 characters.');
            return transaction(() => {
                if (!getShul(shulId)) fail(404, 'Shul not found.');
                const ids = recipients(shulId, input.recipientIds);
                return insert({ shulId, senderType: 'system', kind: input.kind, recipientIds: ids,
                    idempotencyKey: `system:${shulId}:${input.idempotencyKey}`, ...values });
            });
        },
        listUserMessages(actorId, options) {
            user(actorId);
            const { limit, offset, folder } = page(options);
            if (folder === 'sent') return db.prepare(`${select} WHERE m.sender_type = 'user' AND m.sender_user_id = ?
                ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ?`).all(actorId, limit, offset).map(decode);
            return db.prepare(`SELECT q.*, r.read_at FROM (${select}) q
                JOIN message_recipients r ON r.message_id = q.id WHERE r.user_id = ?
                ORDER BY q.created_at DESC, q.id DESC LIMIT ? OFFSET ?`).all(actorId, limit, offset).map(decode);
        },
        listShulMessages(actorId, shulId, options) {
            member(actorId, shulId, true);
            const { limit, offset, folder } = page(options);
            if (folder === 'sent') return db.prepare(`${select} WHERE m.shul_id = ? AND m.sender_type = 'shul'
                ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ?`).all(shulId, limit, offset).map(row => ({
                    ...decode(row), recipientIds: db.prepare('SELECT user_id FROM message_recipients WHERE message_id = ? ORDER BY user_id')
                        .all(row.id).map(recipient => recipient.user_id),
                }));
            return db.prepare(`SELECT q.*, r.read_at FROM (${select}) q
                JOIN shul_message_receipts r ON r.message_id = q.id WHERE q.shul_id = ?
                ORDER BY q.created_at DESC, q.id DESC LIMIT ? OFFSET ?`).all(shulId, limit, offset).map(decode);
        },
        markUserMessageRead(actorId, messageId) {
            user(actorId);
            const result = db.prepare(`UPDATE message_recipients SET read_at = COALESCE(read_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                WHERE message_id = ? AND user_id = ?`).run(messageId, actorId);
            if (!result.changes) fail(404, 'Message not found.');
            return { read: true };
        },
        markShulMessageRead(actorId, shulId, messageId) {
            member(actorId, shulId, true);
            const result = db.prepare(`UPDATE shul_message_receipts SET read_at = COALESCE(read_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                WHERE message_id = ? AND message_id IN (SELECT id FROM messages WHERE shul_id = ?)`).run(messageId, shulId);
            if (!result.changes) fail(404, 'Message not found.');
            return { read: true };
        },
        // Called inside the registration transaction: booking and confirmation commit together.
        recordReadingConfirmation(shulId, { dateString, desc, aliyah, recipientIds }) {
            return insert({ shulId, senderType: 'system', kind: 'confirmation', recipientIds: [...new Set(recipientIds)],
                subject: 'Reading registration confirmed',
                body: `Your registration at ${getShul(shulId).name} for ${desc} on ${dateString}, aliyah ${aliyah}, is confirmed.` });
        },
    };
}
