import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../backend/app.mjs';
import { openDatabase } from '../backend/database/index.mjs';

async function setup(t, development, options = {}) {
    const db = openDatabase(':memory:');
    const shul = db.createShul({ name: 'API Shul', settings: { hebYear: 5788, il: true, a: 3 } });
    const user = db.createUser({ shulId: shul.id, firstName: 'Test', lastName: 'User', email: 'test@example.com', settings: { language: 'en' } });
    const app = createApp(db, { development, devUserId: user.id, preview: false, ...options });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        db.close();
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    return { shul, user, db, request: (path, options) => fetch(base + path, options) };
}

const patchShul = body => ({
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

test('publishing reading adjustments validates and saves the entire batch atomically', async t => {
    const { request, shul, user, db } = await setup(t, true);
    db.updateUser(user.id, { role: 'admin' });
    const readings = await (await request(`/api/schedule?shul=${shul.id}`)).json();
    const reading = readings.find(item => item.desc === 'Bereshit');
    const other = readings.find(item => item.desc === 'Noach');
    const key = { dateString: reading.dateString, desc: reading.desc };
    const lock = { ...key, aliyah: 1, locked: true };
    const path = `/api/shuls/${shul.id}/readings/locks`;
    for (const changes of [[], [lock, { ...key, aliyah: 4, locked: true }],
        [lock, { ...lock, desc: 'Missing reading' }], [lock, lock], [lock, { ...lock, locked: 'yes', aliyah: 2 }]]) {
        const response = await request(path, patchShul({ changes }));
        assert.ok([400, 404].includes(response.status));
        assert.deepEqual(db.listReadingLocks(shul.id), [], 'An invalid batch must not partially save');
    }
    const response = await request(path, patchShul({ changes: [lock, { ...key, aliyah: 8, locked: true },
        { dateString: other.dateString, desc: other.desc, locked: true }] }));
    assert.equal(response.status, 200);
    const updated = await response.json();
    assert.equal(updated.length, 2);
    assert.equal(updated.find(item => item.desc === 'Bereshit').lockedArr[0], true);
    assert.equal(updated.find(item => item.desc === 'Bereshit').lockedArr[7], true);
    assert.equal(updated.find(item => item.desc === 'Noach').locked, true);
    assert.equal(db.listReadingLocks(shul.id).length, 3);
    db.updateUser(user.id, { role: 'member' });
    assert.equal((await request(path, patchShul({ changes: [{ ...lock, locked: false }] }))).status, 403);
    const production = await setup(t, false);
    assert.equal((await production.request(`/api/shuls/${production.shul.id}/readings/locks`, patchShul({ changes: [lock] }))).status, 401);
});

test('reading and aliyah locks persist in schedules while keeping individual overrides independent', async t => {
    const { request, shul, user, db } = await setup(t, true);
    db.updateUser(user.id, { role: 'admin' });
    const path = `/api/shuls/${shul.id}/readings/lock`;
    const load = async () => (await (await request(`/api/schedule?shul=${shul.id}`)).json());
    const readings = await load();
    assert.ok(readings.every(reading => !reading.locked && reading.lockedArr.every(value => !value)));
    const reading = readings.find(reading => reading.desc === 'Bereshit');
    const key = { desc: reading.desc, dateString: reading.dateString };
    const current = async () => (await load()).find(item => item.desc === key.desc && item.dateString === key.dateString);

    let response = await request(path, patchShul({ ...key, aliyah: 1, locked: true }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).lockedArr[0], true);
    assert.equal((await current()).lockedArr[0], true);
    response = await request(path, patchShul({ ...key, locked: true }));
    assert.equal((await response.json()).locked, true);
    response = await request(path, patchShul({ ...key, locked: false }));
    let updated = await response.json();
    assert.equal(updated.locked, false);
    assert.equal(updated.lockedArr[0], true);
    assert.equal(updated.lockedArr[1], false);
    // Maftir retains position 8 even when aliyot 4–7 are hidden.
    response = await request(path, patchShul({ ...key, aliyah: 8, locked: true }));
    updated = await response.json();
    assert.equal(updated.lockedArr[7], true);
    assert.equal(updated.lockedArr[3], false);
    response = await request(path, patchShul({ ...key, aliyah: 1, locked: false }));
    assert.equal((await response.json()).lockedArr[0], false);

    const other = db.createShul({ name: 'Other', settings: shul.settings });
    const otherReadings = await (await request(`/api/schedule?shul=${other.id}`)).json();
    assert.ok(otherReadings.every(item => !item.locked && item.lockedArr.every(value => !value)));
    db.updateShulSettings(shul.id, { hebYear: 5787 });
    assert.ok((await load()).every(item => !item.locked && item.lockedArr.every(value => !value)));
    db.updateShulSettings(shul.id, { hebYear: 5788, yontifs: { rh2: false } });
    assert.equal((await current()).lockedArr[7], true);
});

test('reading lock updates require the same shul admin and reject invalid or hidden slots', async t => {
    const { request, shul, user, db } = await setup(t, true);
    const reading = (await (await request(`/api/schedule?shul=${shul.id}`)).json())
        .find(item => item.desc === 'Bereshit');
    const body = { desc: reading.desc, dateString: reading.dateString, locked: true };
    const path = `/api/shuls/${shul.id}/readings/lock`;
    assert.equal((await request(path, patchShul(body))).status, 403);
    db.updateUser(user.id, { role: 'admin' });
    const other = db.createShul({ name: 'Other', settings: { hebYear: 5788 } });
    assert.equal((await request(`/api/shuls/${other.id}/readings/lock`, patchShul(body))).status, 403);
    for (const invalid of [null, [], {}, { ...body, locked: 'true' }, { ...body, aliyah: 0 },
        { ...body, aliyah: 10 }, { ...body, aliyah: 1.5 }, { ...body, aliyah: 4 }, { ...body, extra: true }]) {
        assert.equal((await request(path, patchShul(invalid))).status, 400);
    }
    assert.equal((await request(path, patchShul({ ...body, dateString: '2020-01-01' }))).status, 404);
    assert.deepEqual(db.listReadingLocks(shul.id), []);
    const production = await setup(t, false);
    assert.equal((await production.request(`/api/shuls/${production.shul.id}/readings/lock`, patchShul(body))).status, 401);
});

test('shul admins can save contact information without changing reading settings', async t => {
    const { request, shul, user, db } = await setup(t, true);
    db.updateUser(user.id, { role: 'admin' });
    const changes = {
        name: 'Updated Shul', address: '123 Main St', phone: '555-1234',
        email: 'office@example.com', websiteUrl: 'https://example.com', donationUrl: 'https://example.com/donate',
    };
    const response = await request(`/api/shuls/${shul.id}`, patchShul(changes));
    assert.equal(response.status, 200);
    const saved = await response.json();
    for (const [key, value] of Object.entries(changes)) assert.equal(saved[key], value);
    assert.deepEqual(saved.settings, shul.settings);
    assert.deepEqual(db.getShul(shul.id), saved);
    assert.deepEqual(await (await request(`/api/shuls/${shul.id}`)).json(), saved);
    const cleared = await request(`/api/shuls/${shul.id}`, patchShul({ phone: '' }));
    assert.equal(cleared.status, 200);
    assert.equal(db.getShul(shul.id).phone, '');
    assert.equal(db.getShul(shul.id).name, changes.name);
});

test('shul updates reject members and administrators from other shuls', async t => {
    const { request, shul, user, db } = await setup(t, true);
    assert.equal((await request(`/api/shuls/${shul.id}`, patchShul({ name: 'Forbidden' }))).status, 403);
    db.updateUser(user.id, { role: 'admin' });
    const other = db.createShul({ name: 'Other Shul', settings: { hebYear: 5787 } });
    assert.equal((await request(`/api/shuls/${other.id}`, patchShul({ name: 'Forbidden' }))).status, 403);
    assert.deepEqual(db.getShul(shul.id), shul);
    assert.deepEqual(db.getShul(other.id), other);
});

test('shul updates require a current identity and reject invalid fields atomically', async t => {
    const production = await setup(t, false);
    assert.equal((await production.request(`/api/shuls/${production.shul.id}`, patchShul({ name: 'Forbidden' }))).status, 401);
    assert.deepEqual(production.db.getShul(production.shul.id), production.shul);
    const { request, shul, user, db } = await setup(t, true);
    db.updateUser(user.id, { role: 'admin' });
    for (const body of [{ name: ' ' }, { phone: 123 }, { name: 'Changed', settings: {} }, null, []]) {
        const response = await request(`/api/shuls/${shul.id}`, patchShul(body));
        assert.equal(response.status, 400);
        assert.deepEqual(db.getShul(shul.id), shul);
    }
});

test('admins can patch reading settings, preserving profile and other nested settings', async t => {
    const { request, shul, user, db } = await setup(t, true);
    db.updateUser(user.id, { role: 'admin' });
    const response = await request(`/api/shuls/${shul.id}/settings`, patchShul({
        hebYear: 5787, a: 5, yontifs: { rh2: false }, triennial: { yitro: false },
    }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const saved = await response.json();
    assert.deepEqual(saved, {
        ...shul,
        settings: {
            ...shul.settings, hebYear: 5787, a: 5,
            yontifs: { ...shul.settings.yontifs, rh2: false },
            triennial: { ...shul.settings.triennial, yitro: false },
        },
    });
    assert.deepEqual(db.getShul(shul.id), saved);
    const readings = await (await request(`/api/schedule?shul=${shul.id}`)).json();
    assert.ok(readings.length > 0);
    assert.ok(readings.every(reading => reading.hDate.includes('5787')));
});

test('saved schedule preferences change only the selected shul readings', async t => {
    const { request, shul, user, db } = await setup(t, true);
    db.updateUser(user.id, { role: 'admin' });
    db.updateShulSettings(shul.id, { hebYear: 5787, il: false, a: 7 });
    const other = db.createShul({ name: 'Other congregation', settings: { hebYear: 5787 } });
    const schedulePath = id => `/api/schedule?shul=${id}`;
    const before = await (await request(schedulePath(shul.id))).json();
    const otherBefore = await (await request(schedulePath(other.id))).json();
    assert.ok(before.some(reading => reading.desc === 'Rosh Hashana II'));
    const weeklyBefore = before.find(reading => reading.desc === "Ha'azinu");
    assert.ok(weeklyBefore.psukim.slice(0, 7).every(verses => verses !== 'null'));

    const saved = await request(`/api/shuls/${shul.id}/settings`, patchShul({
        a: 3, yontifs: { rh2: false },
    }));
    assert.equal(saved.status, 200);
    const response = await request(schedulePath(shul.id));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const after = await response.json();
    assert.ok(!after.some(reading => reading.desc === 'Rosh Hashana II'));
    const weeklyAfter = after.find(reading => reading.desc === "Ha'azinu");
    assert.deepEqual(weeklyAfter.psukim.slice(3, 7), ['null', 'null', 'null', 'null']);
    assert.deepEqual(weeklyAfter.psukim.slice(0, 3), weeklyBefore.psukim.slice(0, 3));
    assert.deepEqual(weeklyAfter.psukim.slice(7), weeklyBefore.psukim.slice(7));
    assert.deepEqual(await (await request(schedulePath(other.id))).json(), otherBefore);
});

test('only the same shul admin can load its first saved version without modifying current data', async t => {
    const { request, shul, user, db } = await setup(t, true);
    const path = `/api/shuls/${shul.id}/initial-version`;
    assert.equal((await request(path)).status, 403);
    db.updateUser(user.id, { role: 'admin' });
    db.updateShul(shul.id, { name: 'Current name' });
    db.updateShulSettings(shul.id, { a: 7 });
    const current = db.getShul(shul.id);
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const initial = await response.json();
    assert.equal(initial.info.name, shul.name);
    assert.equal(initial.settings.a, 3);
    assert.equal(initial.source, 'creation');
    assert.deepEqual(db.getShul(shul.id), current);
    const other = db.createShul({ name: 'Other', settings: { hebYear: 5787 } });
    assert.equal((await request(`/api/shuls/${other.id}/initial-version`)).status, 403);
    const production = await setup(t, false);
    assert.equal((await production.request(`/api/shuls/${production.shul.id}/initial-version`)).status, 401);
});

test('reading settings require an admin of the same shul', async t => {
    const production = await setup(t, false);
    assert.equal((await production.request(`/api/shuls/${production.shul.id}/settings`, patchShul({ a: 5 }))).status, 401);
    assert.deepEqual(production.db.getShul(production.shul.id), production.shul);
    const { request, shul, user, db } = await setup(t, true);
    assert.equal((await request(`/api/shuls/${shul.id}/settings`, patchShul({ a: 5 }))).status, 403);
    db.updateUser(user.id, { role: 'admin' });
    const other = db.createShul({ name: 'Other', settings: { hebYear: 5787 } });
    assert.equal((await request(`/api/shuls/${other.id}/settings`, patchShul({ a: 5 }))).status, 403);
    assert.deepEqual(db.getShul(shul.id), shul);
    assert.deepEqual(db.getShul(other.id), other);
});

test('invalid reading settings fail atomically', async t => {
    const { request, shul, user, db } = await setup(t, true);
    db.updateUser(user.id, { role: 'admin' });
    for (const body of [
        { a: 8 }, { il: 'true' }, { a: 5, yontifs: { typo: true } },
        { triennial: { triMaftir: true, tradMaftir: true } },
        { tri: true }, { name: 'Changed' }, null, [],
    ]) {
        const response = await request(`/api/shuls/${shul.id}/settings`, patchShul(body));
        assert.equal(response.status, 400);
        assert.deepEqual(db.getShul(shul.id), shul);
    }
});

test('frontend APIs return saved profiles and shul schedules', async t => {
    const { request, shul, user, db } = await setup(t, true);
    assert.deepEqual(await (await request('/api/shuls')).json(), [{ id: shul.id, name: shul.name }]);
    const profile = await (await request(`/api/shuls/${shul.id}`)).json();
    assert.equal(profile.settings.hebYear, 5788);
    assert.equal(profile.settings.il, true);
    const me = await request('/api/me');
    assert.equal(me.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await me.json(), user);
    const readings = await (await request(`/api/schedule?shul=${shul.id}`)).json();
    assert.ok(readings.length > 0);
    assert.ok(readings.every(reading => reading.hDate.includes('5788')));
    db.updateShulSettings(shul.id, { hebYear: 5787 });
    const updated = await (await request(`/api/schedule?shul=${shul.id}`)).json();
    assert.ok(updated.every(reading => reading.hDate.includes('5787')));
    assert.equal((await request('/api/shuls/missing')).status, 404);
    assert.equal((await request('/api/schedule?shul=missing')).status, 404);
    assert.equal((await request('/api/schedule?year=invalid')).status, 400);
    assert.equal((await request(`/registration?shul=${shul.id}&parsha=1&aliyah=1`)).status, 200);
    assert.equal((await request(`/shul?shul=${shul.id}`)).status, 200);
    assert.equal((await request('/shulSettings')).status, 200);
    assert.equal((await request('/shulSettings/')).status, 200);
});

test('production never exposes development user profiles or member lists', async t => {
    const { request, shul, user } = await setup(t, false);
    assert.equal((await request('/api/me')).status, 401);
    assert.equal((await request(`/api/users/${user.id}`)).status, 404);
    assert.equal((await request(`/api/shuls/${shul.id}/users`)).status, 401);
});

test('explicit preview mode works with production NODE_ENV and selects only the demo identity', async t => {
    const { request, user, db } = await setup(t, false, { preview: true });
    const response = await request('/api/me');
    assert.equal(response.status, 200);
    const demo = await response.json();
    assert.equal(demo.email, 'demo@example.com');
    assert.equal(demo.role, 'admin');
    assert.notEqual(demo.id, user.id);
    assert.notEqual(demo.shulId, user.shulId);
    const shul = await (await request(`/api/shuls/${demo.shulId}`)).json();
    assert.equal(shul.name, 'Demo Shul');
    const readings = await (await request(`/api/schedule?shul=${demo.shulId}`)).json();
    assert.ok(readings.length > 0);
    assert.ok(readings.every(reading => reading.hDate.includes('5787')));
    db.updateShulSettings(demo.shulId, { a: 3 });
    createApp(db, { development: false, preview: true });
    assert.equal(db.getUserByEmail('demo@example.com').id, demo.id);
    assert.equal(db.getShul(demo.shulId).settings.a, 3);
    assert.equal(db.listShuls().length, 2);
    assert.equal(db.listShulUsers(demo.shulId).length, 1);
});

test('preview startup recreates its sample data in an empty database', t => {
    for (let restart = 0; restart < 2; restart++) {
        const db = openDatabase(':memory:');
        try {
            createApp(db, { development: false, preview: true });
            const demo = db.getUserByEmail('demo@example.com');
            assert.ok(demo);
            assert.equal(db.getShul(demo.shulId).name, 'Demo Shul');
            assert.equal(db.listShuls().length, 1);
        } finally {
            db.close();
        }
    }
});

test('shul user lists require the owning admin and only include that shul', async t => {
    const { request, shul, user, db } = await setup(t, true);
    const path = `/api/shuls/${shul.id}/users`;
    assert.equal((await request(path)).status, 403);
    db.updateUser(user.id, { role: 'admin' });
    const member = db.createUser({ shulId: shul.id, firstName: 'Demo', lastName: 'Member', email: 'member@example.com' });
    const other = db.createShul({ name: 'Other Shul', settings: shul.settings });
    db.createUser({ shulId: other.id, firstName: 'Other', lastName: 'Member', email: 'other@example.com' });
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const users = await response.json();
    assert.deepEqual(new Set(users.map(item => item.id)), new Set([user.id, member.id]));
    assert.equal(users.find(item => item.id === user.id).role, 'admin');
    assert.equal(users.find(item => item.id === member.id).role, 'member');
    assert.ok(users.every(item => !('settings' in item)));
    assert.equal((await request(`/api/shuls/${other.id}/users`)).status, 403);
    const anonymous = await setup(t, false);
    assert.equal((await anonymous.request(`/api/shuls/${anonymous.shul.id}/users`)).status, 401);
});

test('manual occasions publish with locks, survive reload, preserve calendar tags, and remain shul scoped', async t => {
    const { request, shul, user, db } = await setup(t, true);
    const path = `/api/shuls/${shul.id}/readings/locks`;
    const load = async () => (await (await request(`/api/schedule?shul=${shul.id}`)).json());
    const original = (await load()).find(reading => reading.desc === 'Bereshit');
    const key = { dateString: original.dateString, desc: original.desc };
    const occasion = { ...key, manualOccasions: ['Josh Cohen Bar Mitzvah'] };
    assert.equal((await request(path, patchShul({ changes: [occasion] }))).status, 403);
    db.updateUser(user.id, { role: 'admin' });
    for (const labels of [[''], [' Birthday '], ['Same', 'same'], [123], ['x'.repeat(121)]]) {
        assert.equal((await request(path, patchShul({ changes: [{ ...key, locked: true },
            { ...key, manualOccasions: labels }] }))).status, 400);
        assert.deepEqual(db.listReadingLocks(shul.id), []);
        assert.deepEqual(db.listReadingOccasions(shul.id), []);
    }
    const response = await request(path, patchShul({ changes: [occasion, { ...key, aliyah: 1, locked: true }] }));
    assert.equal(response.status, 200);
    const [updated] = await response.json();
    assert.deepEqual(updated.manualOccasions, occasion.manualOccasions);
    assert.equal(updated.lockedArr[0], true);
    const reloaded = (await load()).find(reading => reading.desc === key.desc);
    assert.deepEqual(reloaded.manualOccasions, occasion.manualOccasions);
    assert.deepEqual(reloaded.occassions, original.occassions);
    assert.ok(reloaded.searchTerms.includes('Josh Cohen Bar Mitzvah'));
    const other = db.createShul({ name: 'Other', settings: shul.settings });
    assert.equal((await request(`/api/shuls/${other.id}/readings/locks`, patchShul({ changes: [occasion] }))).status, 403);
    assert.ok((await (await request(`/api/schedule?shul=${other.id}`)).json()).every(reading => reading.manualOccasions.length === 0));
    assert.equal((await request(path, patchShul({ changes: [{ ...key, manualOccasions: [] }] }))).status, 200);
    const removed = (await load()).find(reading => reading.desc === key.desc);
    assert.deepEqual(removed.manualOccasions, []);
    assert.deepEqual(removed.occassions, original.occassions);
});

test('admin reader assignments publish atomically, respect locks and membership, and reload as ShulUser objects', async t => {
    const { request, shul, user, db } = await setup(t, true);
    const path = `/api/shuls/${shul.id}/readings/locks`;
    const load = async () => (await (await request(`/api/schedule?shul=${shul.id}`)).json()).find(reading => reading.desc === 'Bereshit');
    const original = await load();
    const key = { dateString: original.dateString, desc: original.desc };
    const reader = db.createUser({ shulId: shul.id, firstName: 'Josh', lastName: 'Cohen', email: 'reader@example.com', title: 'Rabbi' });
    const assignment = { ...key, aliyah: 8, readerId: reader.id };
    assert.equal((await request(path, patchShul({ changes: [assignment] }))).status, 403);
    db.updateUser(user.id, { role: 'admin' });
    const other = db.createShul({ name: 'Other', settings: shul.settings });
    const outsider = db.createUser({ shulId: other.id, firstName: 'Other', lastName: 'User', email: 'outsider@example.com' });
    for (const invalid of [{ ...assignment, readerId: outsider.id }, { ...assignment, readerId: 'missing' },
        { ...assignment, readerId: 12 }, { ...assignment, aliyah: 4 }, { ...key, readerId: reader.id }]) {
        assert.equal((await request(path, patchShul({ changes: [{ ...key, locked: true }, invalid] }))).status, 400);
        assert.deepEqual(db.listReadingReaders(shul.id), []);
        assert.deepEqual(db.listReadingLocks(shul.id), []);
    }
    assert.equal((await request(path, patchShul({ changes: [{ ...key, aliyah: 8, locked: true }, assignment] }))).status, 409);
    const response = await request(path, patchShul({ changes: [assignment, { ...key, manualOccasions: ['Birthday'] }] }));
    assert.equal(response.status, 200);
    const [updated] = await response.json();
    assert.deepEqual(updated.readers[7], { id: reader.id, firstName: 'Josh', lastName: 'Cohen', email: reader.email, role: 'member', title: 'Rabbi' });
    assert.equal(updated.readers[0], null);
    assert.equal((await load()).readers[7].id, reader.id);
    assert.deepEqual(db.listReadingReaders(other.id), []);
    db.updateUser(reader.id, { firstName: 'Joshua' });
    assert.equal((await load()).readers[7].firstName, 'Joshua');
    assert.equal((await request(path, patchShul({ changes: [{ ...assignment, readerId: user.id }] }))).status, 200);
    assert.equal((await load()).readers[7].id, user.id);
    assert.equal((await request(path, patchShul({ changes: [{ ...assignment, readerId: null }] }))).status, 200);
    assert.equal((await load()).readers[7], null);
    assert.equal((await request(path, patchShul({ changes: [assignment] }))).status, 200);
    db.updateUser(reader.id, { shulId: other.id });
    assert.equal((await load()).readers[7], null, 'Transferred members must not remain visible on the old shul schedule');
});

test('per-reading aliyah counts override rules independently and publish with new reader slots', async t => {
    const { request, shul, user, db } = await setup(t, true);
    db.updateUser(user.id, { role: 'admin' });
    const schedulePath = `/api/schedule?shul=${shul.id}`;
    const schedule = await (await request(schedulePath)).json();
    const key = desc => ({ dateString: schedule.find(reading => reading.desc === desc).dateString, desc });
    const path = `/api/shuls/${shul.id}/readings/locks`;
    const publish = changes => request(path, patchShul({ changes }));
    const response = await publish([
        { ...key('Bereshit'), aliyah: 6, readerId: user.id },
        { ...key('Bereshit'), aliyahCount: 6 },
        { ...key('Noach'), aliyahCount: 1 },
    ]);
    assert.equal(response.status, 200);
    const updated = await response.json();
    const bereshit = updated.find(reading => reading.desc === 'Bereshit');
    assert.equal(bereshit.aliyahCount, 6);
    assert.equal(bereshit.defaultAliyahCount, 3);
    assert.equal(bereshit.readers[5].id, user.id);
    assert.ok(bereshit.psukim[5] && bereshit.psukim[5] !== 'null');
    assert.equal(bereshit.psukim[6], 'null');
    assert.equal(updated.find(reading => reading.desc === 'Noach').aliyahCount, 1);
    assert.deepEqual(bereshit.psukim.slice(7), schedule.find(reading => reading.desc === 'Bereshit').psukim.slice(7));
    for (const aliyahCount of [0, 8, 2.5, '4', false]) {
        assert.equal((await publish([{ ...key('Bereshit'), aliyahCount }])).status, 400);
    }
    const holiday = schedule.find(reading => reading.aliyahOptions[6].slice(0, 7).filter(value => value && value !== 'null').length < 7);
    assert.ok(holiday);
    assert.equal((await publish([{ dateString: holiday.dateString, desc: holiday.desc, aliyahCount: 7 }])).status, 400);
    assert.equal((await publish([{ ...key('Bereshit'), aliyahCount: 2 }, { ...key('Bereshit'), aliyah: 6, readerId: user.id }])).status, 400);
    assert.equal(db.listReadingAliyahCounts(shul.id).find(reading => reading.desc === 'Bereshit').aliyahCount, 6);
    db.updateShulSettings(shul.id, { a: 4 });
    const refreshed = await (await request(schedulePath)).json();
    assert.equal(refreshed.find(reading => reading.desc === 'Bereshit').aliyahCount, 6);
    assert.equal(refreshed.find(reading => reading.desc === 'Noach').aliyahCount, 1);
    assert.equal(refreshed.find(reading => reading.desc === 'Lech-Lecha').aliyahCount, 4);
    assert.equal((await publish([{ ...key('Bereshit'), aliyahCount: null }])).status, 200);
    const reset = await (await request(schedulePath)).json();
    assert.equal(reset.find(reading => reading.desc === 'Bereshit').aliyahCount, 4);
    assert.equal(reset.find(reading => reading.desc === 'Bereshit').aliyahCountOverride, null);
});

test('guests appear in shul users and can be assigned by admins but have no admin access', async t => {
    const { request, shul, user, db } = await setup(t, true);
    db.updateUser(user.id, { role: 'admin' });
    const visitor = db.createUser({ shulId: shul.id, firstName: 'Guest', lastName: 'Reader',
        hebrewName: 'Yehoshua', email: 'guest@example.com', role: 'guest' });
    const usersPath = `/api/shuls/${shul.id}/users`;
    const users = await (await request(usersPath)).json();
    assert.equal(users.find(item => item.id === visitor.id).role, 'guest');
    const schedule = await (await request(`/api/schedule?shul=${shul.id}`)).json();
    const reading = schedule.find(item => item.desc === 'Bereshit');
    const path = `/api/shuls/${shul.id}/readings/locks`;
    const change = { dateString: reading.dateString, desc: reading.desc, aliyah: 1, readerId: visitor.id };
    const response = await request(path, patchShul({ changes: [change] }));
    assert.equal(response.status, 200);
    assert.equal((await response.json())[0].readers[0].role, 'guest');
    db.updateUser(user.id, { role: 'guest' });
    assert.equal((await request(usersPath)).status, 403);
    assert.equal((await request(path, patchShul({ changes: [{ ...change, readerId: null }] }))).status, 403);
    assert.equal((await request(`/api/shuls/${shul.id}`, patchShul({ name: 'Changed' }))).status, 403);
    assert.equal((await request(`/api/shuls/${shul.id}/settings`, patchShul({ a: 4 }))).status, 403);
});

const registrationRequest = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('profile registration reserves an available aliyah and rejects locked, hidden and foreign-shul selections', async t => {
    const { request, shul, user, db } = await setup(t, true);
    const readings = await (await request(`/api/schedule?shul=${shul.id}`)).json();
    const reading = readings.find(item => item.desc === 'Bereshit');
    const base = { dateString: reading.dateString, desc: reading.desc };
    const path = `/api/shuls/${shul.id}/readings/register`;
    const post = body => request(path, registrationRequest(body));
    assert.equal((await post({ ...base, aliyah: 4 })).status, 400);
    assert.equal((await post({ ...base, aliyah: 1, readerId: user.id })).status, 400);
    assert.equal((await post({ ...base, aliyah: 1, guest: null })).status, 400);
    db.setReadingLocks(shul.id, [{ ...base, aliyah: 2, locked: true }]);
    assert.equal((await post({ ...base, aliyah: 2 })).status, 409);
    db.setReadingLocks(shul.id, [{ ...base, locked: true }]);
    assert.equal((await post({ ...base, aliyah: 1 })).status, 409);
    db.setReadingLocks(shul.id, [{ ...base, locked: false }]);
    const response = await post({ ...base, aliyah: 1 });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { registered: true });
    assert.equal((await post({ ...base, aliyah: 1 })).status, 409);
    const refreshed = await (await request(`/api/schedule?shul=${shul.id}`)).json();
    assert.equal(refreshed.find(item => item.desc === reading.desc).readers[0].id, user.id);
    const other = db.createShul({ name: 'Other', settings: shul.settings });
    assert.equal((await request(`/api/shuls/${other.id}/readings/register`, registrationRequest({ ...base, aliyah: 3 }))).status, 403);
    assert.equal(db.listReadingReaders(other.id).length, 0);
});

test('anonymous guest registration validates details, reuses matching guests and never overwrites existing identities', async t => {
    const { request, shul, user, db } = await setup(t, false);
    const readings = await (await request(`/api/schedule?shul=${shul.id}`)).json();
    const reading = readings.find(item => item.desc === 'Bereshit');
    const base = { dateString: reading.dateString, desc: reading.desc };
    const post = body => request(`/api/shuls/${shul.id}/readings/register`, registrationRequest(body));
    const guest = { firstName: 'Visitor', lastName: 'Cohen', hebrewName: 'Yehoshua', email: 'visitor@example.com' };
    const initialUsers = db.listShulUsers(shul.id).length;
    assert.equal((await post({ ...base, aliyah: 1 })).status, 401);
    for (const invalid of [{ ...guest, email: 'invalid' }, { ...guest, firstName: '' }, { ...guest, role: 'admin' }, { ...guest, email: user.email }]) {
        assert.ok([400, 409].includes((await post({ ...base, aliyah: 1, guest: invalid })).status));
        assert.equal(db.listShulUsers(shul.id).length, initialUsers);
    }
    assert.equal((await post({ ...base, aliyah: 1, guest })).status, 201);
    const visitor = db.listShulUsers(shul.id).find(item => item.email === guest.email);
    assert.equal(visitor.role, 'guest');
    assert.equal(visitor.hebrewName, guest.hebrewName);
    assert.equal((await post({ ...base, aliyah: 2, guest: { ...guest, email: 'VISITOR@EXAMPLE.COM' } })).status, 201);
    assert.equal(db.listShulUsers(shul.id).length, initialUsers + 1);
    assert.equal(db.listReadingReaders(shul.id).find(item => item.aliyah === 2).reader.id, visitor.id);
    assert.equal((await post({ ...base, aliyah: 3, guest: { ...guest, firstName: 'Different' } })).status, 409);
    assert.equal(db.getUser(visitor.id).firstName, guest.firstName);
    const attempts = await Promise.all(['one', 'two'].map(name => post({ ...base, aliyah: 3, guest: { ...guest, email: `${name}@example.com` } })));
    assert.deepEqual(attempts.map(response => response.status).sort(), [201, 409]);
    assert.equal(db.listShulUsers(shul.id).length, initialUsers + 2, 'Failed competing registration creates no guest');
    assert.equal(db.listReadingReaders(shul.id).length, 3);
    assert.equal((await post({ ...base, aliyah: 4, guest: { ...guest, email: 'hidden@example.com' } })).status, 400);
    assert.equal(db.listShulUsers(shul.id).length, initialUsers + 2);
});
