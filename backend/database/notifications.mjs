import { randomUUID } from 'node:crypto';
import { validateKeys } from './settings.mjs';
import { localClock, notificationPolicy } from '../notificationPolicy.mjs';

export function createNotificationRepository(db, { transaction, getUser, getShul, recordSystemNotification }) {
    function settings(shulId) {
        if (!getShul(shulId)) throw Object.assign(new Error('Shul not found.'), { status: 404 });
        const row = db.prepare('SELECT * FROM shul_notification_settings WHERE shul_id = ?').get(shulId);
        return { timezone: row?.timezone ?? 'America/New_York', instantAdminUserId: row?.instant_admin_user_id ?? null };
    }
    function admin(actorId, shulId) {
        const actor = getUser(actorId);
        if (!actor) throw Object.assign(new Error('Sign in to manage notifications.'), { status: 401 });
        if (actor.role !== 'admin' || actor.shulId !== shulId) throw Object.assign(new Error('Only this shul’s administrators can manage notifications.'), { status: 403 });
    }
    function queue({ key, shulId, recipientId, messageId, category, subject, body, now }) {
        db.prepare(`INSERT OR IGNORE INTO notification_email_outbox
            (id, dedupe_key, shul_id, recipient_user_id, message_id, category, subject, body, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(randomUUID(), key, shulId, recipientId, messageId, category, subject, body, now.toISOString());
    }
    function system(shulId, recipientId, subject, body, key, kind = 'confirmation') {
        return recordSystemNotification({ shulId, recipientIds: [recipientId], subject, body, kind, idempotencyKey: key });
    }
    return {
        getNotificationSettings: settings,
        updateNotificationSettings(actorId, shulId, input) {
            admin(actorId, shulId);
            validateKeys(input, ['timezone', 'instantAdminUserId'], 'notification settings');
            return transaction(() => {
                const next = { ...settings(shulId), ...input };
                if (typeof next.timezone !== 'string') throw new TypeError('Choose a valid IANA timezone.');
                try { new Intl.DateTimeFormat('en', { timeZone: next.timezone }).format(); }
                catch { throw new TypeError('Choose a valid IANA timezone.'); }
                if (next.instantAdminUserId !== null) {
                    const selected = typeof next.instantAdminUserId === 'string' ? getUser(next.instantAdminUserId) : null;
                    if (!selected || selected.role !== 'admin' || selected.shulId !== shulId) throw new TypeError('Choose a current admin of this shul.');
                }
                db.prepare(`INSERT INTO shul_notification_settings (shul_id, timezone, instant_admin_user_id) VALUES (?, ?, ?)
                    ON CONFLICT(shul_id) DO UPDATE SET timezone = excluded.timezone, instant_admin_user_id = excluded.instant_admin_user_id`)
                    .run(shulId, next.timezone, next.instantAdminUserId);
                return next;
            });
        },
        // Called inside the booking transaction: inbox records and email reservations commit with the booking.
        recordRegistrationNotifications({ shulId, readerId, bookerId, guest, dateString, desc, aliyah, confirmation, emailConfirmation = false, emailEnabled = false, now = new Date() }) {
            const config = settings(shulId);
            const reader = getUser(readerId);
            const isGuest = guest || reader.role === 'guest';
            const booker = bookerId ? getUser(bookerId) : null;
            const memberBooker = booker && booker.shulId === shulId && ['member', 'admin'].includes(booker.role);
            let status = emailConfirmation ? 'unavailable' : 'not_requested';
            if (emailConfirmation && emailEnabled) {
                const identityType = memberBooker ? 'member' : 'guest';
                const identity = memberBooker ? booker.id : reader.email.trim().toLowerCase();
                const day = localClock(now, config.timezone).day;
                const limit = memberBooker ? notificationPolicy.memberDailyLimit : notificationPolicy.guestDailyLimit;
                db.prepare(`INSERT OR IGNORE INTO confirmation_email_quotas (shul_id, identity_type, identity, local_day) VALUES (?, ?, ?, ?)`).run(shulId, identityType, identity, day);
                const result = db.prepare(`UPDATE confirmation_email_quotas SET requested = requested + 1 WHERE shul_id = ? AND identity_type = ? AND identity = ? AND local_day = ? AND requested < ?`)
                    .run(shulId, identityType, identity, day, limit);
                status = result.changes ? 'queued' : 'daily_limit';
                if (result.changes) queue({ key: `confirmation:${confirmation.id}:${reader.id}`, shulId, recipientId: reader.id, messageId: confirmation.id,
                    category: 'confirmation', subject: confirmation.subject, body: confirmation.body, now });
            }
            const selected = config.instantAdminUserId ? getUser(config.instantAdminUserId) : null;
            if (selected?.role === 'admin' && selected.shulId === shulId) {
                const subject = 'New reading registration';
                const body = `${reader.title} ${reader.firstName} ${reader.lastName}${isGuest ? ' (guest)' : ''} registered at ${getShul(shulId).name}.\n\nDate: ${dateString}\nReading: ${desc}\nAliyah: ${aliyah}`;
                const key = `registration-alert:${confirmation.id}:${selected.id}`;
                const message = system(shulId, selected.id, subject, body, key);
                if (emailEnabled) queue({ key, shulId, recipientId: selected.id, messageId: message.id, category: 'instant', subject, body, now });
            }
            return { status, timezone: config.timezone };
        },
        needsDailyRoundup(shulId, localDay) {
            return db.prepare(`SELECT 1 FROM users u WHERE u.shul_id = ? AND u.role = 'admin' AND NOT EXISTS
                (SELECT 1 FROM notification_roundups r WHERE r.shul_id = ? AND r.user_id = u.id AND r.local_day = ?) LIMIT 1`).get(shulId, shulId, localDay) !== undefined;
        },
        recordDailyRoundup(shulId, localDay, body, { now = new Date(), emailEnabled = false } = {}) {
            if (typeof body !== 'string' || body.length > 2000000 || !body.trim()) throw new TypeError('Invalid roundup content.');
            return transaction(() => {
                let added = 0;
                const admins = db.prepare("SELECT id FROM users WHERE shul_id = ? AND role = 'admin'").all(shulId);
                // Platform messages have a 10,000-character limit; preserve the entire report in numbered parts.
                const parts = body.match(/[\s\S]{1,9500}/g);
                for (const recipient of admins) {
                    const created = db.prepare('INSERT OR IGNORE INTO notification_roundups (shul_id, user_id, local_day, created_at) VALUES (?, ?, ?, ?)').run(shulId, recipient.id, localDay, now.toISOString());
                    if (!created.changes) continue;
                    const subject = `Daily reading roundup — ${localDay}`;
                    let firstMessage;
                    for (const [index, text] of parts.entries()) {
                        const message = system(shulId, recipient.id, parts.length > 1 ? `${subject} (${index + 1}/${parts.length})` : subject, text,
                            `roundup:${shulId}:${localDay}:${recipient.id}:${index}`, 'reading_invitation');
                        firstMessage ??= message;
                    }
                    if (emailEnabled) queue({ key: `roundup:${shulId}:${localDay}:${recipient.id}`, shulId, recipientId: recipient.id,
                        messageId: firstMessage.id, category: 'roundup', subject, body, now });
                    added++;
                }
                return added;
            });
        },
        claimNotificationEmail(now = new Date()) {
            return transaction(() => {
                db.prepare("UPDATE notification_email_outbox SET status = 'unknown', error_code = 'worker-interrupted' WHERE status = 'sending' AND claimed_at < ?")
                    .run(new Date(now.getTime() - 5 * 60000).toISOString());
                const job = db.prepare("SELECT * FROM notification_email_outbox WHERE status = 'queued' ORDER BY created_at, rowid LIMIT 1").get();
                if (!job) return null;
                const recipient = getUser(job.recipient_user_id);
                if (!recipient || (job.category !== 'confirmation' && (recipient.role !== 'admin' || recipient.shulId !== job.shul_id))) {
                    db.prepare("UPDATE notification_email_outbox SET status = 'skipped', error_code = 'recipient-no-longer-eligible' WHERE id = ?").run(job.id);
                    return { skipped: true };
                }
                const day = now.toISOString().slice(0, 10);
                db.prepare('INSERT OR IGNORE INTO notification_email_daily_usage (utc_day) VALUES (?)').run(day);
                if (!db.prepare('UPDATE notification_email_daily_usage SET reserved = reserved + 1 WHERE utc_day = ? AND reserved < 100').run(day).changes) {
                    db.prepare("UPDATE notification_email_outbox SET status = 'capped', error_code = 'global-daily-limit' WHERE id = ?").run(job.id);
                    return { skipped: true };
                }
                db.prepare("UPDATE notification_email_outbox SET status = 'sending', claimed_at = ?, quota_day = ? WHERE id = ?").run(now.toISOString(), day, job.id);
                return { id: job.id, to: recipient.email, subject: job.subject, text: job.body };
            });
        },
        finishNotificationEmail(id, { status, providerId = null, releaseQuota = false }) {
            if (!['accepted', 'failed', 'unknown', 'skipped'].includes(status)) throw new TypeError('Invalid email result.');
            return transaction(() => {
                const job = db.prepare("SELECT quota_day FROM notification_email_outbox WHERE id = ? AND status = 'sending'").get(id);
                if (!job) return;
                db.prepare('UPDATE notification_email_outbox SET status = ?, provider_id = ?, error_code = ? WHERE id = ?').run(status, providerId, status === 'accepted' ? null : status, id);
                if (releaseQuota) db.prepare('UPDATE notification_email_daily_usage SET reserved = MAX(0, reserved - 1) WHERE utc_day = ?').run(job.quota_day);
            });
        },
    };
}
