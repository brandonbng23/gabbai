import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { openDatabase } from '../backend/database/index.mjs';
import { createApp } from '../backend/app.mjs';
import { validateShulEvent } from '../interfaces/shulEvent.mts';
import { scheduleHighlights } from '../frontend/src/scheduleHighlights.ts';

const event = { name: 'Community dinner', date: '2026-12-04', time: '18:30', location: 'Social hall',
    registrationLink: 'https://example.com/register', details: 'Bring your family.\nVegetarian options available.' };

function setup(t, path = ':memory:') {
    const db = openDatabase(path);
    t.after(() => db.close());
    const shul = db.createShul({ name: 'Event Shul', settings: { hebYear: 5787 } });
    const make = (name, role, shulId = shul.id) => db.createUser({ shulId, firstName: name, lastName: 'Test', email: `${name}@example.com`, role });
    return { db, shul, make, admin: make('Admin', 'admin'), member: make('Member', 'member') };
}

test('events validate real dates, times, required fields, bounded details, and safe registration links', () => {
    assert.deepEqual(validateShulEvent(event), event);
    assert.equal(validateShulEvent({ ...event, registrationLink: '', details: '' }).registrationLink, '');
    for (const input of [{ ...event, date: '2026-02-29' }, { ...event, time: '24:00' }, { ...event, name: ' ' },
        { ...event, location: '' }, { ...event, details: 'a'.repeat(2001) }, { ...event, role: 'admin' },
        ...['javascript:alert(1)', 'data:text/html,test', '//example.com', 'https://user:password@example.com'].map(registrationLink => ({ ...event, registrationLink }))]) {
        assert.throws(() => validateShulEvent(input), TypeError);
    }
});

test('event CRUD is shul scoped, persists across reopening, and preserves profile settings', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-events-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'events.sqlite');
    let db = openDatabase(path);
    const shul = db.createShul({ name: 'Event Shul', settings: { hebYear: 5787 } });
    const admin = db.createUser({ shulId: shul.id, firstName: 'Admin', lastName: 'Test', email: 'admin@example.com', role: 'admin' });
    const created = db.createShulEvent(shul.id, admin.id, event);
    db.close();
    db = openDatabase(path);
    try {
        assert.deepEqual(db.listShulEvents(shul.id), [created]);
        db.updateShulEvent(shul.id, admin.id, created.id, { ...event, name: 'Updated dinner' });
        assert.equal(db.listShulEvents(shul.id)[0].name, 'Updated dinner');
        assert.deepEqual(db.getShul(shul.id).settings, shul.settings);
        db.deleteShulEvent(shul.id, admin.id, created.id);
        assert.deepEqual(db.listShulEvents(shul.id), []);
    } finally { db.close(); }
});

test('only an active admin from the owning shul can create, change, or delete an event', t => {
    const { db, shul, make, admin, member } = setup(t);
    const other = db.createShul({ name: 'Other', settings: { hebYear: 5787 } });
    const otherAdmin = make('OtherAdmin', 'admin', other.id);
    const frozenAdmin = make('FrozenAdmin', 'admin');
    db.updateShulUsers(shul.id, admin.id, [{ userId: frozenAdmin.id, previousRole: 'admin', previousFrozen: false, frozen: true }]);
    const created = db.createShulEvent(shul.id, admin.id, event);
    for (const actor of [member, otherAdmin, frozenAdmin]) {
        assert.throws(() => db.createShulEvent(shul.id, actor.id, event), error => error.status === 403);
        assert.throws(() => db.updateShulEvent(shul.id, actor.id, created.id, event), error => error.status === 403);
        assert.throws(() => db.deleteShulEvent(shul.id, actor.id, created.id), error => error.status === 403);
    }
    assert.throws(() => db.deleteShulEvent(other.id, otherAdmin.id, created.id), error => error.status === 404);
    assert.deepEqual(db.listShulEvents(other.id), []);
    assert.deepEqual(db.listShulEvents(shul.id), [created]);
});

test('public event API lists featured events while writes require the owning admin', async t => {
    const { db, shul, admin, member } = setup(t);
    const app = createApp(db, { development: true, devUserId: member.id, preview: false });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const path = `http://127.0.0.1:${server.address().port}/api/shuls/${shul.id}/events`;
    const write = (url, body, method = 'POST', anonymous = false) => fetch(url, {
        method, headers: { 'Content-Type': 'application/json', ...(anonymous ? { Cookie: 'gabbai_session=' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal((await write(path, event, 'POST', true)).status, 401);
    assert.equal((await write(path, event)).status, 403);
    db.updateUser(member.id, { role: 'admin' });
    const createdResponse = await write(path, event);
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    const publicResponse = await fetch(path, { headers: { Cookie: 'gabbai_session=' } });
    assert.equal(publicResponse.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await publicResponse.json(), [created]);
    assert.equal((await write(`${path}/${created.id}`, { ...event, registrationLink: 'javascript:alert(1)' }, 'PATCH')).status, 400);
    assert.equal((await write(`${path}/${created.id}`, { ...event, name: 'Edited dinner' }, 'PATCH')).status, 200);
    assert.equal((await write(`${path}/${created.id}`, undefined, 'DELETE')).status, 204);
    assert.deepEqual(db.listShulEvents(shul.id), []);
    assert.equal(db.getUser(admin.id).role, 'admin');
});

test('highlights combine personal parshiyot and public events chronologically without truncating additional rows', () => {
    const readings = Array.from({ length: 7 }, (_, i) => ({ dateString: `2026-12-${String(i + 1).padStart(2, '0')}`, desc: `Parsha ${i}` }));
    const saved = readings.map(reading => ({ portion: reading.desc, occasion: 'Anniversary' }));
    const events = [
        { ...event, id: 'past', shulId: 'shul', date: '2026-11-30' },
        { ...event, id: 'second', shulId: 'shul', date: '2026-12-02', time: '20:00' },
        { ...event, id: 'first', shulId: 'shul', date: '2026-12-02', time: '10:00' },
    ];
    const highlights = scheduleHighlights(readings, saved, events, '2026-12-01');
    assert.equal(highlights.length, 9, 'All highlights remain available beyond the first five');
    assert.deepEqual(highlights.slice(0, 5).map(item => item.kind), ['parsha', 'parsha', 'event', 'event', 'parsha']);
    assert.deepEqual(highlights.filter(item => item.kind === 'event').map(item => item.event.id), ['first', 'second']);
    assert.equal(highlights.slice(5).length, 4);
    assert.equal(scheduleHighlights(readings, [], events, '2026-12-01').length, 2, 'Visitors see public events without any personal parshiyot');
    assert.equal(scheduleHighlights(readings, saved, events, '2027-01-01').length, 0);
});
