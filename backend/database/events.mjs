import { randomUUID } from 'node:crypto';
import { validateShulEvent } from '../../interfaces/shulEvent.mts';

export function createEventRepository(db, { getShul, getUser, transaction }) {
    const decode = row => row && ({ id: row.id, shulId: row.shul_id, name: row.name, date: row.date, time: row.time,
        location: row.location, registrationLink: row.registration_link, details: row.details });
    function requireShul(shulId) {
        if (!getShul(shulId)) throw Object.assign(new Error('Shul not found.'), { status: 404 });
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
