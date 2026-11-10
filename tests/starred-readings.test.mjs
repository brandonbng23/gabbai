import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createApp } from '../backend/app.mjs';
import { openDatabase } from '../backend/database/index.mjs';
import { getShulSchedule } from '../backend/schedule.mjs';

async function setup(t) {
    const db = openDatabase(':memory:');
    const shul = db.createShul({ name: 'Stars', settings: { hebYear: 5788, il: true, a: 3 } });
    const user = db.createUser({ shulId: shul.id, firstName: 'Star', lastName: 'Reader', email: 'star@example.com' });
    const other = db.createUser({ shulId: shul.id, firstName: 'Other', lastName: 'Reader', email: 'other@example.com', role: 'admin' });
    const cookieFor = (person, token) => {
        db.createSession(person.id, createHash('sha256').update(token).digest('hex'), Date.now() + 60_000);
        return `gabbai_session=${token}`;
    };
    const cookie = cookieFor(user, 'a'.repeat(64));
    const otherCookie = cookieFor(other, 'b'.repeat(64));
    const server = createApp(db, { development: false, preview: false }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        db.close();
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (path, method = 'GET', body, sessionCookie = cookie) => fetch(base + path, {
        method, headers: { 'Content-Type': 'application/json', ...(sessionCookie ? { Cookie: sessionCookie } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const reading = getShulSchedule(db, shul.id).find(item => item.psukim[0] && item.psukim[0] !== 'null'
        && item.psukim.some(value => !value || value === 'null'));
    const target = { shulId: shul.id, dateString: reading.dateString, desc: reading.desc, aliyah: 1 };
    return { db, shul, user, other, request, otherCookie, reading, target };
}

const endpoint = '/api/me/starred-readings';

test('stars toggle privately without registering, locking, notifying, or changing statistics', async t => {
    const { db, shul, user, other, request, otherCookie, reading, target } = await setup(t);
    const response = await request(endpoint, 'PUT', target);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const saved = await response.json();
    assert.equal(saved.psukim, reading.psukim[0]);
    assert.equal(saved.verseCount, reading.verseCounts[0]);
    assert.equal(saved.shulName, shul.name);
    assert.deepEqual(db.getUser(user.id).assignedReadings, []);
    assert.deepEqual(db.listReadingReaders(shul.id), []);
    assert.deepEqual(db.listReadingLocks(shul.id), []);
    assert.deepEqual(db.listUserMessages(user.id), []);
    assert.deepEqual(db.listUserMessages(other.id), []);
    assert.equal((await request(endpoint, 'PUT', target)).status, 200, 'Saving twice is idempotent');
    assert.equal((await (await request(endpoint)).json()).length, 1);
    assert.deepEqual(await (await request(endpoint, 'GET', undefined, otherCookie)).json(), [], 'Even admins cannot see someone else’s stars');
    const profile = await (await request(`/api/users/${user.id}`, 'GET', undefined, otherCookie)).json();
    assert.equal('starredReadings' in profile, false);
    assert.equal(profile.assignedReadingCount, 0);
    const schedule = await (await request(`/api/schedule?shul=${shul.id}`)).json();
    assert.equal(schedule.some(item => 'starredReadings' in item || 'starred' in item), false);
    assert.equal((await request(endpoint, 'DELETE', target, otherCookie)).status, 200);
    assert.equal(db.listStarredReadings(user.id).length, 1, 'Removing a star acts only on the signed-in user');
    assert.deepEqual(db.listStarredReadings(other.id), []);
    db.setReadingLocks(shul.id, [{ dateString: target.dateString, desc: target.desc, aliyah: target.aliyah, readerId: user.id }]);
    assert.equal((await request(endpoint, 'DELETE', target)).status, 200);
    assert.deepEqual(await (await request(endpoint)).json(), []);
    assert.equal(db.getUser(user.id).assignedReadings.length, 1, 'Unstarring never cancels a registration');
    assert.equal((await request(endpoint, 'DELETE', target)).status, 200);
});

test('stars require authentication and validate the shul, reading, aliyah, and ownership', async t => {
    const { db, request, target, user, reading } = await setup(t);
    for (const method of ['GET', 'PUT', 'DELETE'])
        assert.equal((await request(endpoint, method, method === 'GET' ? undefined : target, '')).status, 401);
    for (const patch of [{ aliyah: 0 }, { aliyah: 10 }, { aliyah: '1' }, { dateString: '2026-02-30' },
        { desc: '' }, { shulId: null }, { userId: user.id }]) {
        assert.equal((await request(endpoint, 'PUT', { ...target, ...patch })).status, 400);
    }
    const anotherShul = db.createShul({ name: 'Another', settings: { hebYear: 5788 } });
    assert.equal((await request(endpoint, 'PUT', { ...target, shulId: anotherShul.id })).status, 403);
    assert.equal((await request(endpoint, 'PUT', { ...target, desc: 'Not a reading' })).status, 404);
    const missingAliyah = reading.psukim.findIndex(value => !value || value === 'null');
    assert.ok(missingAliyah >= 0, 'The fixture has a hidden aliyah');
    assert.equal((await request(endpoint, 'PUT', { ...target, aliyah: missingAliyah + 1 })).status, 400);
    assert.deepEqual(db.listStarredReadings(user.id), []);
    db.setReadingLocks(target.shulId, [{ dateString: target.dateString, desc: target.desc, aliyah: target.aliyah, locked: true }]);
    assert.equal((await request(endpoint, 'PUT', target)).status, 200, 'Starring a reading does not require the slot to be available');
    db.updateUser(user.id, { shulId: anotherShul.id });
    assert.equal((await (await request(endpoint)).json()).length, 1, 'Saved readings keep their original shul');
    assert.equal((await request(endpoint, 'DELETE', target)).status, 200, 'Users can still remove old stars after changing shuls');
});

test('successful registration removes only the reader’s matching star and failed registration preserves stars', async t => {
    const { db, shul, user, other, request, otherCookie, target } = await setup(t);
    const anotherAliyah = { ...target, aliyah: 2 };
    db.setReadingStar(user.id, target, true);
    db.setReadingStar(user.id, anotherAliyah, true);
    db.setReadingStar(other.id, target, true);
    const register = `/api/shuls/${shul.id}/readings/register`;
    const { dateString, desc, aliyah } = target;
    assert.equal((await request(register, 'POST', { dateString, desc, aliyah: 9 + aliyah })).status, 400);
    assert.equal(db.listStarredReadings(user.id).length, 2, 'Failed registrations preserve saved stars');
    assert.equal((await request(register, 'POST', { dateString, desc, aliyah })).status, 201);
    assert.deepEqual(db.listStarredReadings(user.id).map(item => ({ ...item })), [anotherAliyah]);
    assert.deepEqual(db.getUser(user.id).assignedReadings, [{ dateString, desc, aliyah }]);
    assert.equal((await request(register, 'POST', { dateString, desc, aliyah }, otherCookie)).status, 409);
    assert.deepEqual(db.listStarredReadings(other.id).map(item => ({ ...item })), [target], 'Another user’s star survives an unavailable slot');
    assert.equal((await (await request(endpoint)).json()).length, 1, 'My Readings receives the updated shortlist');
});

test('guest registration preserves both the reader’s star and the booker’s star', t => {
    const db = openDatabase(':memory:');
    t.after(() => db.close());
    const shul = db.createShul({ name: 'Guest stars', settings: { hebYear: 5788 } });
    const booker = db.createUser({ shulId: shul.id, firstName: 'Booking', lastName: 'User', email: 'booker@example.com' });
    const guest = db.createUser({ shulId: shul.id, firstName: 'Guest', lastName: 'Reader', email: 'guest@example.com', role: 'guest' });
    const reading = { shulId: shul.id, dateString: '2027-10-03', desc: 'Rosh Hashana II', aliyah: 1 };
    db.setReadingStar(booker.id, reading, true);
    db.setReadingStar(guest.id, reading, true);
    assert.throws(() => db.registerReading(shul.id, { ...reading, readerId: guest.id }, () => { throw new Error('Unavailable'); }));
    assert.equal(db.listStarredReadings(guest.id).length, 1);
    db.registerReading(shul.id, { ...reading, readerId: booker.id,
        guest: { title: 'Mr.', firstName: guest.firstName, lastName: guest.lastName, email: guest.email } }, () => {});
    assert.equal(db.listStarredReadings(guest.id).length, 1);
    assert.equal(db.listStarredReadings(booker.id).length, 1);
});

test('starred readings survive database reopening and stay separate from assignments', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-stars-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'stars.sqlite');
    let db = openDatabase(path);
    const shul = db.createShul({ name: 'Persistent stars', settings: { hebYear: 5788 } });
    const user = db.createUser({ shulId: shul.id, firstName: 'Saved', lastName: 'Reader', email: 'saved@example.com' });
    const reading = { shulId: shul.id, dateString: '2026-10-10', desc: 'Bereshit', aliyah: 1 };
    db.setReadingStar(user.id, reading, true);
    db.close();
    db = openDatabase(path);
    try {
        assert.deepEqual(db.listStarredReadings(user.id).map(item => ({ ...item })), [reading]);
        assert.deepEqual(db.getUser(user.id).assignedReadings, []);
        db.setReadingStar(user.id, reading, false);
    } finally { db.close(); }
    db = openDatabase(path);
    try { assert.deepEqual(db.listStarredReadings(user.id), []); }
    finally { db.close(); }
});
