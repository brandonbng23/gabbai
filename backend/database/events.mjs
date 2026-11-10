import { randomUUID } from 'node:crypto';
import { validateShulEvent } from '../../interfaces/shulEvent.mts';

export function createEventRepository(db, { getShul, getUser, transaction }) {
    const decode = row => row && ({ id: row.id, shulId: row.shul_id, name: row.name, date: row.date, time: row.time,
        location: row.location, registrationLink: row.registration_link, details: row.details });
    function requireShul(shulId) {
        if (!getShul(shulId)) throw Object.assign(new Error('Shul not found.'), { status: 404 });
    }
    function destination(value) {
        try {
            const url = new URL(value);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
            return url.href;
        } catch { throw Object.assign(new Error('This link is not available.'), { status: 404 }); }
    }
    function admin(shulId, actorId) {
        const actor = actorId ? getUser(actorId) : null;
        if (!actor || actor.frozen || actor.role !== 'admin' || actor.shulId !== shulId)
            throw Object.assign(new Error('Only this shul’s active administrators can manage events.'), { status: 403 });
        requireShul(shulId);
    }
    function save(shulId, actorId, id, input, creating) {
        const event = validateShulEvent(input);
        return transaction(() => {
            admin(shulId, actorId);
            const values = [event.name, event.date, event.time, event.location, event.registrationLink, event.details];
            if (creating) db.prepare(`INSERT INTO shul_events (name, date, time, location, registration_link, details, id, shul_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(...values, id, shulId);
            else if (!db.prepare(`UPDATE shul_events SET name = ?, date = ?, time = ?, location = ?, registration_link = ?, details = ?
                WHERE id = ? AND shul_id = ?`).run(...values, id, shulId).changes)
                throw Object.assign(new Error('Event not found.'), { status: 404 });
            return decode(db.prepare('SELECT * FROM shul_events WHERE id = ? AND shul_id = ?').get(id, shulId));
        });
    }
    return {
        eventRegistrationDestination(shulId, eventId, count = true) {
            return transaction(() => {
                requireShul(shulId);
                const event = db.prepare('SELECT registration_link FROM shul_events WHERE shul_id = ? AND id = ?').get(shulId, eventId);
                const url = destination(event?.registration_link);
                if (count) {
                    db.prepare('UPDATE shul_events SET registration_clicks = registration_clicks + 1 WHERE shul_id = ? AND id = ?').run(shulId, eventId);
                    db.prepare(`INSERT INTO shul_link_clicks (shul_id, event_registration_clicks) VALUES (?, 1)
                        ON CONFLICT(shul_id) DO UPDATE SET event_registration_clicks = event_registration_clicks + 1`).run(shulId);
                }
                return url;
            });
        },
        donationDestination(shulId, count = true) {
            return transaction(() => {
                requireShul(shulId);
                const url = destination(getShul(shulId).donationUrl);
                if (count) db.prepare(`INSERT INTO shul_link_clicks (shul_id, donation_clicks) VALUES (?, 1)
                    ON CONFLICT(shul_id) DO UPDATE SET donation_clicks = donation_clicks + 1`).run(shulId);
                return url;
            });
        },
        getShulLinkAnalytics(shulId, actorId, today) {
            const actor = actorId ? getUser(actorId) : null;
            if (!actor || actor.role !== 'admin' || actor.shulId !== shulId)
                throw Object.assign(new Error('Only this shul’s administrators can view link analytics.'), { status: 403 });
            requireShul(shulId);
            const totals = db.prepare('SELECT * FROM shul_link_clicks WHERE shul_id = ?').get(shulId);
            const events = db.prepare('SELECT id, date, registration_clicks FROM shul_events WHERE shul_id = ?').all(shulId);
            const currentEvents = events.filter(event => event.date >= today);
            return { currentEventCount: currentEvents.length,
                eventRegistrationClicks: currentEvents.reduce((total, event) => total + event.registration_clicks, 0), donationClicks: totals?.donation_clicks ?? 0,
                eventRegistrationByEvent: Object.fromEntries(events.map(event => [event.id, event.registration_clicks])) };
        },
        listShulEvents(shulId) {
            requireShul(shulId);
            return db.prepare('SELECT * FROM shul_events WHERE shul_id = ? ORDER BY date, time, name, id').all(shulId).map(decode);
        },
        createShulEvent: (shulId, actorId, input) => save(shulId, actorId, randomUUID(), input, true),
        updateShulEvent: (shulId, actorId, id, input) => save(shulId, actorId, id, input, false),
        deleteShulEvent(shulId, actorId, id) {
            return transaction(() => {
                admin(shulId, actorId);
                if (!db.prepare('DELETE FROM shul_events WHERE id = ? AND shul_id = ?').run(id, shulId).changes)
                    throw Object.assign(new Error('Event not found.'), { status: 404 });
            });
        },
    };
}
