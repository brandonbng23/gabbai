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

function page(options = {}, personal = false) {
    validateKeys(options, personal ? ['limit', 'offset', 'folder', 'sort', 'unread'] : ['limit', 'offset', 'folder'], 'message query');
    const { limit = 50, offset = 0, folder = 'inbox', sort = 'newest', unread = false } = options;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0)
        throw new TypeError('Use a limit from 1 to 100 and a nonnegative offset.');
    if (!(personal ? ['inbox', 'sent', 'trash'] : ['inbox', 'sent']).includes(folder)) throw new TypeError('Choose a valid message folder.');
    if (!['newest', 'oldest'].includes(sort) || typeof unread !== 'boolean') throw new TypeError('Choose a valid sort order and unread filter.');
    return { limit, offset, folder, sort, unread };
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
    function decode(row, viewer) {
        let sender = { type: 'system', name: 'The Gabbai Team', pictureUrl: '/api/system/picture' };
        if (row.sender_type === 'shul') {
            sender = { ...getShul(row.shul_id), type: 'shul' };
        } else if (row.sender_type === 'user') {
            const { id, firstName, lastName, email, role, title, pictureUrl, assignedReadings } = getUser(row.sender_user_id);
            sender = { type: 'user', id, firstName, lastName, email, role, title, assignedReadings,
                name: `${firstName} ${lastName}`, ...(pictureUrl ? { pictureUrl } : {}) };
        }
        const adminViewer = viewer?.role === 'admin' && viewer.shulId === row.shul_id && !expired(row.id, 'shul', row.shul_id);
        const replyStats = viewer ? db.prepare(`SELECT COUNT(*) AS replyCount, MAX(created_at) AS lastReplyAt
            FROM message_replies WHERE message_id = ? ${adminViewer ? '' : 'AND participant_user_id = ?'}`)
            .get(row.id, ...(adminViewer ? [] : [viewer.id])) : {};
        return { id: row.id, shulId: row.shul_id, kind: row.kind, ...replyStats,
            sender,
            ...(viewer?.role === 'admin' && viewer.shulId === row.shul_id
                && db.prepare('SELECT 1 FROM shul_message_receipts WHERE message_id = ?').get(row.id)
                ? { sharedInbox: { id: row.shul_id, name: getShul(row.shul_id).name } } : {}),
            ...(row.sender_type === 'user' ? { recipient: { type: 'shul', id: row.shul_id, name: getShul(row.shul_id).name } } : {}),
            subject: row.subject, body: row.body, sendAt: row.created_at,
            ...(row.deleted_at ? { trashExpiresAt: new Date(new Date(row.deleted_at).getTime() + 30 * 86400000).toISOString() } : {}),
            readAt: row.read_at ?? null };
    }
    const select = 'SELECT m.* FROM messages m';
    function expired(messageId, ownerType, ownerId) {
        return Boolean(db.prepare('SELECT 1 FROM message_delivery_expirations WHERE message_id = ? AND owner_type = ? AND owner_id = ?').get(messageId, ownerType, ownerId));
    }
    function inbox(actor) {
        const sharedAdmin = actor.role === 'admin' && Boolean(actor.shulId);
        const sql = `SELECT m.*, r.read_at, r.deleted_at,
            (SELECT MAX(created_at) FROM message_replies WHERE message_id = m.id AND participant_user_id = r.user_id) AS activity_at FROM messages m
            JOIN message_recipients r ON r.message_id = m.id WHERE r.user_id = ?
            ${sharedAdmin ? 'AND NOT (m.shul_id = ? AND EXISTS (SELECT 1 FROM shul_message_receipts s WHERE s.message_id = m.id))' : ''}`;
        if (!sharedAdmin) return { sql, params: [actor.id] };
        return { sql: `${sql} UNION ALL
            SELECT m.*, r.read_at, r.deleted_at,
            (SELECT MAX(created_at) FROM message_replies WHERE message_id = m.id) AS activity_at FROM messages m
            JOIN shul_message_receipts r ON r.message_id = m.id WHERE m.shul_id = ?`, params: [actor.id, actor.shulId, actor.shulId] };
    }
    function updateReceipt(actorId, messageId, assignment) {
        const actor = user(actorId);
        let result;
        if (actor.role === 'admin' && actor.shulId) {
            result = db.prepare(`UPDATE shul_message_receipts SET ${assignment} WHERE message_id = ?
                AND message_id IN (SELECT id FROM messages WHERE shul_id = ?)`).run(messageId, actor.shulId);
        }
        if (!result?.changes) result = db.prepare(`UPDATE message_recipients SET ${assignment} WHERE message_id = ? AND user_id = ?`).run(messageId, actorId);
        if (!result.changes) fail(404, 'Message not found.');
    }
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
    function conversation(actorId, messageId) {
        const actor = user(actorId);
        const root = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
        if (!root) fail(404, 'Message not found.');
        const sharedExpired = expired(messageId, 'shul', root.shul_id);
        const isAdmin = actor.role === 'admin' && actor.shulId === root.shul_id && !sharedExpired;
        const delivered = Boolean(db.prepare('SELECT 1 FROM message_recipients WHERE message_id = ? AND user_id = ?').get(messageId, actorId));
        const originalSender = root.sender_type === 'user' && root.sender_user_id === actorId && !expired(messageId, 'user', actorId);
        if (!(delivered || originalSender || (isAdmin && root.sender_type !== 'system'))) fail(404, 'Message not found.');
        const originalParticipants = root.sender_type === 'user' ? [getUser(root.sender_user_id)]
            : root.sender_type === 'shul' ? db.prepare('SELECT user_id FROM message_recipients WHERE message_id = ?').all(messageId).map(row => getUser(row.user_id)) : [];
        const participants = originalParticipants.filter(person => !expired(messageId, 'user', person.id));
        return { actor, root, isAdmin, participants, sharedExpired };
    }
    function thread(actorId, messageId) {
        const { actor, root, isAdmin, participants, sharedExpired } = conversation(actorId, messageId);
        const replies = db.prepare(`SELECT * FROM message_replies WHERE message_id = ? ${isAdmin ? '' : 'AND participant_user_id = ?'} ORDER BY created_at, rowid`)
            .all(messageId, ...(isAdmin ? [] : [actorId])).map(row => {
                const author = getUser(row.actor_user_id);
                const participant = getUser(row.participant_user_id);
                return { id: row.id, body: row.body, sendAt: row.created_at,
                    sender: row.sender_type === 'shul' ? { type: 'shul', name: getShul(root.shul_id).name }
                        : { type: 'user', name: `${author.firstName} ${author.lastName}` },
                    ...(isAdmin ? { authorName: `${author.firstName} ${author.lastName}`, participantId: participant.id, participantName: `${participant.firstName} ${participant.lastName}` } : {}) };
            });
        return { message: decode(root, actor), replies,
            canReply: !sharedExpired && participants.length > 0 && root.sender_type !== 'system' && actor.shulId === root.shul_id && ['member', 'admin'].includes(actor.role),
            ...(sharedExpired || (root.sender_type !== 'system' && !participants.length) ? { replyUnavailableReason: 'This conversation has expired from Trash. Compose a new message to continue.' } : {}),
            replyAs: isAdmin ? getShul(root.shul_id).name : `${actor.firstName} ${actor.lastName}`,
            ...(isAdmin ? { participants: participants.map(person => ({ id: person.id, name: `${person.firstName} ${person.lastName}` })) } : {}) };
    }
    return {
        purgeExpiredMessages(now = new Date()) {
            if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError('Choose a valid cleanup time.');
            const cutoff = new Date(now.getTime() - 30 * 86400000).toISOString();
            const purgedAt = now.toISOString();
            return transaction(() => {
                db.prepare(`INSERT OR IGNORE INTO message_delivery_expirations (message_id, owner_type, owner_id, purged_at)
                    SELECT message_id, 'user', user_id, ? FROM message_recipients WHERE deleted_at <= ?`).run(purgedAt, cutoff);
                db.prepare(`INSERT OR IGNORE INTO message_delivery_expirations (message_id, owner_type, owner_id, purged_at)
                    SELECT r.message_id, 'shul', m.shul_id, ? FROM shul_message_receipts r JOIN messages m ON m.id = r.message_id WHERE r.deleted_at <= ?`).run(purgedAt, cutoff);
                const personal = db.prepare('DELETE FROM message_recipients WHERE deleted_at <= ?').run(cutoff).changes;
                const shared = db.prepare('DELETE FROM shul_message_receipts WHERE deleted_at <= ?').run(cutoff).changes;
                // User/shul authored originals still belong to their senders' sent history.
                const messages = db.prepare(`DELETE FROM messages WHERE sender_type = 'system'
                    AND NOT EXISTS (SELECT 1 FROM message_recipients r WHERE r.message_id = messages.id)
                    AND NOT EXISTS (SELECT 1 FROM shul_message_receipts r WHERE r.message_id = messages.id)`).run().changes;
                return { deliveriesRemoved: personal + shared, messagesRemoved: messages };
            });
        },
        getMessageThread: thread,
        replyToMessage(actorId, messageId, input) {
            validateKeys(input, ['body', 'participantId'], 'reply');
            if (typeof input.body !== 'string' || !input.body.trim() || input.body.length > 10000) throw new TypeError('Reply must contain 1–10000 characters.');
            return transaction(() => {
                const { actor, root, isAdmin, participants, sharedExpired } = conversation(actorId, messageId);
                if (sharedExpired) fail(410, 'This conversation has expired from Trash. Compose a new message to continue.');
                if (root.sender_type === 'system') fail(403, 'System messages do not accept replies.');
                member(actorId, root.shul_id);
                const participantId = isAdmin ? input.participantId ?? (participants.length === 1 ? participants[0].id : null) : actor.id;
                if (!participants.some(person => person.id === participantId) || (!isAdmin && input.participantId && input.participantId !== actor.id))
                    throw new TypeError('Choose a recipient from this conversation.');
                const id = randomUUID();
                db.prepare('INSERT INTO message_replies (id, message_id, participant_user_id, sender_type, actor_user_id, body) VALUES (?, ?, ?, ?, ?, ?)')
                    .run(id, messageId, participantId, isAdmin ? 'shul' : 'user', actorId, input.body.trim());
                if (isAdmin) {
                    db.prepare(`INSERT INTO message_recipients (message_id, user_id) VALUES (?, ?)
                        ON CONFLICT(message_id, user_id) DO UPDATE SET read_at = NULL, deleted_at = NULL`).run(messageId, participantId);
                    db.prepare(`INSERT INTO shul_message_receipts (message_id, read_at) VALUES (?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                        ON CONFLICT(message_id) DO UPDATE SET read_at = excluded.read_at, deleted_at = NULL`).run(messageId);
                } else {
                    db.prepare(`INSERT INTO shul_message_receipts (message_id) VALUES (?)
                        ON CONFLICT(message_id) DO UPDATE SET read_at = NULL, deleted_at = NULL`).run(messageId);
                    db.prepare("UPDATE message_recipients SET read_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), deleted_at = NULL WHERE message_id = ? AND user_id = ?").run(messageId, actorId);
                }
                return thread(actorId, messageId);
            });
        },
        sendUserMessage(actorId, shulId, input) {
            const values = content(input);
            return transaction(() => {
                member(actorId, shulId);
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
        getUserMessageCounts(actorId) {
            const { sql, params } = inbox(user(actorId));
            return db.prepare(`SELECT
                COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) AS "all",
                COUNT(CASE WHEN deleted_at IS NULL AND read_at IS NULL THEN 1 END) AS unread,
                COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) AS trash
                FROM (${sql})`).get(...params);
        },
        listUserMessages(actorId, options) {
            const actor = user(actorId);
            const { limit, offset, folder, sort, unread } = page(options, true);
            const order = sort === 'oldest' ? 'ASC' : 'DESC';
            if (folder === 'sent') return db.prepare(`${select} WHERE m.sender_type = 'user' AND m.sender_user_id = ?
                AND NOT EXISTS (SELECT 1 FROM message_delivery_expirations e WHERE e.message_id = m.id AND e.owner_type = 'user' AND e.owner_id = ?)
                ORDER BY m.created_at ${order}, m.id ${order} LIMIT ? OFFSET ?`).all(actorId, actorId, limit, offset).map(row => decode(row, actor));
            const { sql, params } = inbox(actor);
            return db.prepare(`SELECT * FROM (${sql}) WHERE deleted_at IS ${folder === 'trash' ? 'NOT NULL' : 'NULL'}
                ${unread ? 'AND read_at IS NULL' : ''}
                ORDER BY COALESCE(activity_at, created_at) ${order}, id ${order} LIMIT ? OFFSET ?`).all(...params, limit, offset).map(row => decode(row, actor));
        },
        listShulMessages(actorId, shulId, options) {
            member(actorId, shulId, true);
            const { limit, offset, folder } = page(options);
            if (folder === 'sent') return db.prepare(`${select} WHERE m.shul_id = ? AND m.sender_type = 'shul'
                AND NOT EXISTS (SELECT 1 FROM message_delivery_expirations e WHERE e.message_id = m.id AND e.owner_type = 'shul' AND e.owner_id = ?)
                ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ?`).all(shulId, shulId, limit, offset).map(row => ({
                    ...decode(row), recipientIds: db.prepare('SELECT user_id FROM message_recipients WHERE message_id = ? ORDER BY user_id')
                        .all(row.id).map(recipient => recipient.user_id),
                }));
            return db.prepare(`SELECT q.*, r.read_at FROM (${select}) q
                JOIN shul_message_receipts r ON r.message_id = q.id WHERE q.shul_id = ? AND r.deleted_at IS NULL
                ORDER BY q.created_at DESC, q.id DESC LIMIT ? OFFSET ?`).all(shulId, limit, offset).map(row => decode(row));
        },
        markUserMessageUnread(actorId, messageId) {
            updateReceipt(actorId, messageId, 'read_at = NULL');
            return { read: false };
        },
        setUserMessageTrash(actorId, messageId, trashed) {
            if (typeof trashed !== 'boolean') throw new TypeError('Choose a boolean trash status.');
            updateReceipt(actorId, messageId, `deleted_at = ${trashed
                ? "COALESCE(deleted_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))" : 'NULL'}`);
            return { trashed };
        },
        markUserMessageRead(actorId, messageId) {
            updateReceipt(actorId, messageId, "read_at = COALESCE(read_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))");
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
