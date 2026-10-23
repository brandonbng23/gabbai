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

test('inline picture edits publish with user changes atomically and enforce ownership and stale-picture checks', async t => {
    const { request, shul, user: actor, db } = await setup(t, true);
    db.updateUser(actor.id, { role: 'admin' });
    const member = db.createUser({ shulId: shul.id, firstName: 'Picture', lastName: 'Member', email: 'picture@example.com' });
    const guest = db.createUser({ shulId: shul.id, firstName: 'Other', lastName: 'Guest', email: 'guest-picture@example.com', role: 'guest' });
    const admin = db.createUser({ shulId: shul.id, firstName: 'Other', lastName: 'Admin', email: 'admin-picture@example.com', role: 'admin' });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const picture = `data:image/png;base64,${png.toString('base64')}`;
    const path = `/api/shuls/${shul.id}/users`;
    const change = { userId: member.id, previousRole: 'member', picture, previousPictureUrl: null };
    const publish = changes => request(path, patchShul({ changes }));
    assert.equal(db.getPicture('users', member.id), null);
    for (const bad of [false, 'invalid', `data:image/png;base64,${Buffer.from('invalid').toString('base64')}`])
        assert.equal((await publish([{ ...change, picture: bad }])).status, 400);
    assert.equal((await publish([{ ...change, previousPictureUrl: undefined }])).status, 400);
    assert.equal((await publish([{ ...change, userId: admin.id, previousRole: 'admin' }])).status, 400);
    const conflict = { userId: guest.id, previousRole: 'guest', profile: { email: member.email }, previousProfile: { email: guest.email } };
    assert.equal((await publish([change, conflict])).status, 409);
    assert.equal(db.getPicture('users', member.id), null, 'Failed batches must roll back the picture');
    assert.equal(db.getUser(guest.id).email, guest.email);
    const response = await publish([{ ...change, profile: { firstName: 'Updated' }, previousProfile: { firstName: member.firstName } }]);
    assert.equal(response.status, 200);
    const saved = db.getUser(member.id);
    assert.equal(saved.firstName, 'Updated');
    assert.ok(saved.pictureUrl);
    assert.deepEqual(Buffer.from(db.getPicture('users', member.id).png), png);
    assert.equal((await publish([{ ...change, picture: null }])).status, 409, 'A stale picture cannot be removed');
    assert.ok(db.getPicture('users', member.id));
    db.updateUser(actor.id, { role: 'member' });
    assert.equal((await publish([{ ...change, previousPictureUrl: saved.pictureUrl, picture: null }])).status, 403);
    db.updateUser(actor.id, { role: 'admin' });
    const otherShul = db.createShul({ name: 'Other', settings: { hebYear: 5788 } });
    const otherPath = `/api/shuls/${otherShul.id}/users`;
    assert.equal((await request(otherPath, patchShul({ changes: [change] }))).status, 403);
    assert.equal((await publish([{ ...change, previousPictureUrl: saved.pictureUrl, picture: null }])).status, 200);
    assert.equal(db.getPicture('users', member.id), null);
    assert.equal(db.getUser(member.id).firstName, 'Updated');
    assert.equal((await publish([{ userId: guest.id, previousRole: 'guest', picture, previousPictureUrl: null }])).status, 200);
    assert.ok(db.getUser(guest.id).pictureUrl);
});

test('inline user editing exposes only editable fields and publishes profile changes atomically', async t => {
    const { request, shul, user: actor, db } = await setup(t, true);
    db.updateUser(actor.id, { role: 'admin' });
    const member = db.createUser({ shulId: shul.id, firstName: 'Member', lastName: 'Reader', email: 'member@example.com', settings: { private: true } });
    const guest = db.createUser({ shulId: shul.id, firstName: 'Guest', lastName: 'Reader', email: 'guest@example.com', role: 'guest' });
    const path = `/api/shuls/${shul.id}/users`;
    const editorPath = id => `${path}/${id}/profile`;
    let response = await request(editorPath(member.id));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { title: '', firstName: 'Member', lastName: 'Reader', hebrewName: '', email: member.email, phone: '' });
    const change = (target, profile) => ({ userId: target.id, previousRole: target.role, profile,
        previousProfile: Object.fromEntries(Object.keys(profile).map(key => [key, target[key]])) });
    const publish = changes => request(path, patchShul({ changes }));
    for (const profile of [{ firstName: '' }, { email: 'bad' }, { title: 'Not a title' }, { phone: 123 },
        { settings: {} }, { shulId: 'other' }, { picture: null }, { firstName: 'x'.repeat(255) }]) {
        assert.equal((await publish([change(guest, { firstName: 'Partial' }), change(member, profile)])).status, 400);
        assert.deepEqual(db.getUser(guest.id), guest);
        assert.deepEqual(db.getUser(member.id), member);
    }
    assert.equal((await publish([change(member, { email: guest.email })])).status, 409);
    const stale = change(member, { firstName: 'Edited' });
    stale.previousProfile.firstName = 'Outdated';
    assert.equal((await publish([stale])).status, 409);
    assert.equal((await publish([{ ...change(member, { phone: '555-0100' }), previousProfile: {} }])).status, 400);
    assert.equal((await publish([change(actor, { firstName: 'Other' })])).status, 400);
    const other = db.createShul({ name: 'Other', settings: { hebYear: 5788 } });
    const foreign = db.createUser({ shulId: other.id, firstName: 'Other', lastName: 'Reader', email: 'foreign@example.com' });
    assert.equal((await request(editorPath(foreign.id))).status, 404);
    assert.equal((await publish([change(foreign, { phone: '555' })])).status, 404);
    assert.equal((await request(editorPath(actor.id))).status, 403);
    response = await publish([change(member, { title: 'Dr.', firstName: ' Edited ', email: ' EDITED@EXAMPLE.COM ', phone: '555-0100' }),
        change(guest, { hebrewName: 'Hebrew name' })]);
    assert.equal(response.status, 200);
    const saved = db.getUser(member.id);
    assert.equal(saved.firstName, 'Edited');
    assert.equal(saved.email, 'edited@example.com');
    assert.equal(saved.title, 'Dr.');
    assert.equal(saved.phone, '555-0100');
    assert.deepEqual(saved.settings, member.settings);
    assert.equal(db.getUser(guest.id).hebrewName, 'Hebrew name');
    assert.ok((await response.json()).every(user => !('phone' in user) && !('settings' in user)));
    for (const role of ['member', 'guest']) {
        db.updateUser(actor.id, { role });
        assert.equal((await request(editorPath(member.id))).status, 403);
        assert.equal((await publish([change(saved, { phone: 'changed' })])).status, 403);
    }
    const anonymous = await setup(t, false);
    assert.equal((await anonymous.request(`/api/shuls/${anonymous.shul.id}/users/${anonymous.user.id}/profile`)).status, 401);
});

test('shul user actions publish atomically, protect permissions and retain discarded accounts', async t => {
    const { request, shul, user: actor, db } = await setup(t, true);
    db.updateUser(actor.id, { role: 'admin' });
    const member = db.createUser({ shulId: shul.id, firstName: 'Member', lastName: 'Reader', email: 'member@example.com', settings: { language: 'he' } });
    const guest = db.createUser({ shulId: shul.id, firstName: 'Guest', lastName: 'Reader', email: 'guest@example.com', role: 'guest' });
    const other = db.createShul({ name: 'Other', settings: { hebYear: 5788 } });
    const foreign = db.createUser({ shulId: other.id, firstName: 'Other', lastName: 'Reader', email: 'other@example.com' });
    const path = `/api/shuls/${shul.id}/users`;
    const change = (target, role) => ({ userId: target.id, previousRole: target.role, role });
    const publish = changes => request(path, patchShul({ changes }));
    const promote = change(member, 'admin');
    for (const [changes, status] of [
        [[], 400], [[promote, promote], 400], [[change(actor, 'member')], 400],
        [[change(actor, null)], 400], [[change(guest, 'admin')], 400],
        [[promote, change(foreign, null)], 404], [[promote, { ...change(guest, null), role: 'guest' }], 400],
        [[promote, { ...change(guest, null), unexpected: true }], 400],
        [[promote, { ...change(guest, null), previousRole: 'member' }], 409],
    ]) {
        assert.equal((await publish(changes)).status, status);
        assert.deepEqual(db.getUser(member.id), member, 'Invalid batches must roll back earlier role changes');
        assert.deepEqual(db.getUser(guest.id), guest);
    }
    let response = await publish([promote]);
    assert.equal(response.status, 200);
    const publicUsers = await response.json();
    assert.equal(publicUsers.find(user => user.id === member.id).role, 'admin');
    assert.ok(publicUsers.every(user => !('settings' in user) && !('phone' in user)));
    assert.equal((await publish([promote])).status, 409, 'Stale roles cannot overwrite current permissions');
    assert.equal((await publish([change(db.getUser(member.id), null)])).status, 400, 'Admins must be demoted first');
    assert.equal((await publish([change(db.getUser(member.id), 'member')])).status, 200);
    const key = { dateString: '2027-10-30', desc: 'Bereshit' };
    db.setReadingLocks(shul.id, [{ ...key, aliyah: 1, readerId: member.id }, { ...key, aliyah: 2, readerId: guest.id }]);
    assert.equal((await publish([change(guest, null), change(foreign, null)])).status, 404);
    assert.equal(db.getUser(guest.id).shulId, shul.id);
    assert.equal(db.listReadingReaders(shul.id).length, 2, 'Failed removals must restore reader assignments');
    assert.equal((await publish([change(db.getUser(member.id), null), change(guest, null)])).status, 200);
    for (const removed of [member, guest]) {
        const saved = db.getUser(removed.id);
        assert.equal(saved.shulId, null);
        assert.equal(saved.email, removed.email);
        assert.deepEqual(saved.settings, removed.settings);
        assert.deepEqual(saved.assignedReadings, []);
        assert.ok(!db.listShulUsers(shul.id).some(user => user.id === removed.id));
    }
    assert.deepEqual(db.listReadingReaders(shul.id), []);
    db.updateUser(actor.id, { shulId: null, role: 'member' });
    assert.equal((await request(`/api/users/${member.id}`)).status, 403, 'Detached users cannot access other detached profiles');
    db.updateUser(actor.id, { shulId: shul.id, role: 'admin' });
    assert.equal((await publish([change(guest, null)])).status, 404);
    assert.equal((await request(`/api/shuls/${other.id}/users`, patchShul({ changes: [change(foreign, null)] }))).status, 403);
    db.updateUser(actor.id, { role: 'member' });
    assert.equal((await publish([change(foreign, null)])).status, 403);
    db.updateUser(actor.id, { role: 'guest' });
    assert.equal((await publish([change(foreign, null)])).status, 403);
    const anonymous = await setup(t, false);
    assert.equal((await anonymous.request(`/api/shuls/${anonymous.shul.id}/users`, patchShul({ changes: [] }))).status, 401);
});

test('user views are read-only and exclude sensitive fields for members and admins', async t => {
    const { request, shul, user, db } = await setup(t, true);
    const target = db.createUser({ shulId: shul.id, title: 'Mr.', firstName: 'Viewed', lastName: 'Guest',
        hebrewName: 'Hebrew name', email: 'private@example.com', phone: '555-0100', role: 'guest',
        settings: { privatePreference: true } });
    const path = `/api/users/${target.id}`;
    const expected = { id: target.id, title: target.title, firstName: target.firstName,
        lastName: target.lastName, hebrewName: target.hebrewName, role: 'guest',
        shulName: shul.name, assignedReadingCount: 0 };
    for (const role of ['member', 'admin']) {
        db.updateUser(user.id, { role });
        const response = await request(path);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await response.json(), expected);
    }
    const otherShul = db.createShul({ name: 'Other', settings: { hebYear: 5788 } });
    const foreign = db.createUser({ shulId: otherShul.id, firstName: 'Other', lastName: 'User', email: 'foreign@example.com' });
    assert.equal((await request(`/api/users/${foreign.id}`)).status, 404);
    assert.equal((await request('/api/users/missing')).status, 404);
    assert.equal((await request('/userView?user=' + target.id)).status, 200);
    for (const method of ['PATCH', 'PUT', 'DELETE']) {
        const response = await request(path, { ...patchShul({ firstName: 'Changed' }), method });
        assert.equal(response.status, 404);
        assert.deepEqual(db.getUser(target.id), target);
    }
    db.updateUser(user.id, { role: 'guest' });
    assert.equal((await request(path)).status, 403);
    const anonymous = await setup(t, false);
    assert.equal((await anonymous.request(`/api/users/${anonymous.user.id}`)).status, 401);
});

test('shul codes resolve to a shul without exposing user profiles', async t => {
    const { request, shul, db } = await setup(t, false);
    const response = await request(`/api/shuls/by-code/${shul.code}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: shul.id, name: shul.name });
    assert.equal((await request('/api/shuls/by-code/123')).status, 400);
    assert.equal((await request('/api/shuls/by-code/DEMO')).status, 404);
    assert.equal((await (await request(`/api/shuls/${shul.id}`)).json()).code, shul.code);
    const codes = new Set(db.listShuls().map(item => item.code));
    const unused = Array.from({ length: 676 }, (_, i) => `AA${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + i % 26)}`).find(code => !codes.has(code));
    assert.equal((await request(`/api/shuls/by-code/${unused}`)).status, 404);
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
    assert.equal((await request(`/api/users/${user.id}`)).status, 401);
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
    assert.deepEqual(updated.readers[7], { id: reader.id, firstName: 'Josh', lastName: 'Cohen', email: reader.email, role: 'member', title: 'Rabbi', assignedReadings: [{ ...key, aliyah: 8 }] });
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
    const guest = { title: 'Mr.', firstName: 'Visitor', lastName: 'Cohen', hebrewName: 'Yehoshua', email: 'visitor@example.com' };
    const initialUsers = db.listShulUsers(shul.id).length;
    assert.equal((await post({ ...base, aliyah: 1 })).status, 401);
    for (const invalid of [{ ...guest, title: undefined }, { ...guest, title: '' }, { ...guest, title: 'Invented' }, { ...guest, firstName: undefined }, { ...guest, lastName: undefined }, { ...guest, email: undefined }, { ...guest, email: 'invalid' }, { ...guest, firstName: '' }, { ...guest, role: 'admin' }, { ...guest, email: user.email }]) {
        assert.ok([400, 409].includes((await post({ ...base, aliyah: 1, guest: invalid })).status));
        assert.equal(db.listShulUsers(shul.id).length, initialUsers);
    }
    assert.equal((await post({ ...base, aliyah: 1, guest })).status, 201);
    const visitor = db.listShulUsers(shul.id).find(item => item.email === guest.email);
    assert.equal(visitor.role, 'guest');
    assert.equal(visitor.title, 'Mr.');
    assert.equal(visitor.hebrewName, guest.hebrewName);
    assert.equal((await post({ ...base, aliyah: 2, guest: { ...guest, email: 'VISITOR@EXAMPLE.COM' } })).status, 201);
    assert.equal(db.listShulUsers(shul.id).length, initialUsers + 1);
    assert.equal(db.listReadingReaders(shul.id).find(item => item.aliyah === 2).reader.id, visitor.id);
    assert.equal((await post({ ...base, aliyah: 3, guest: { ...guest, firstName: 'Different' } })).status, 409);
    assert.equal(db.getUser(visitor.id).firstName, guest.firstName);
    const attempts = await Promise.all(['one', 'two'].map(name => post({ ...base, aliyah: 3, guest: { ...guest, hebrewName: undefined, email: `${name}@example.com` } })));
    assert.deepEqual(attempts.map(response => response.status).sort(), [201, 409]);
    assert.equal(db.listShulUsers(shul.id).length, initialUsers + 2, 'Failed competing registration creates no guest');
    assert.equal(db.listReadingReaders(shul.id).length, 3);
    const optionalHebrewReader = db.listReadingReaders(shul.id).find(item => item.aliyah === 3).reader;
    assert.equal(db.getUser(optionalHebrewReader.id).hebrewName, '');
    assert.equal(optionalHebrewReader.title, 'Mr.');
    assert.equal((await post({ ...base, aliyah: 4, guest: { ...guest, email: 'hidden@example.com' } })).status, 400);
    assert.equal(db.listShulUsers(shul.id).length, initialUsers + 2);
});

test('users can edit only their own profile fields and failed edits preserve saved data', async t => {
    const { request, shul, user, db } = await setup(t, true);
    const other = db.createUser({ shulId: shul.id, firstName: 'Other', lastName: 'Member', email: 'taken@example.com' });
    db.setUserSettings(user.id, { language: 'he' });
    const edits = { title: 'Chazan', firstName: ' Updated ', lastName: ' Reader ', hebrewName: 'Yehoshua', email: 'UPDATED@EXAMPLE.COM', phone: '(202) 555-0101' };
    const response = await request('/api/me', patchShul(edits));
    assert.equal(response.status, 200);
    const updated = await response.json();
    assert.equal(updated.id, user.id);
    assert.equal(updated.firstName, 'Updated');
    assert.equal(updated.lastName, 'Reader');
    assert.equal(updated.email, 'updated@example.com');
    assert.equal(updated.title, 'Chazan');
    assert.equal(updated.phone, edits.phone);
    assert.equal(updated.hebrewName, edits.hebrewName);
    assert.equal(updated.role, 'member');
    assert.equal(updated.shulId, shul.id);
    assert.deepEqual(updated.settings, { language: 'he' });
    assert.deepEqual(await (await request('/api/me')).json(), updated);
    for (const invalid of [null, { id: other.id }, { role: 'admin' }, { shulId: 'other' }, { settings: {} },
        { title: 'Invented' }, { firstName: '' }, { lastName: ' ' }, { email: 'bad' }, { phone: 123 }, { firstName: 'a'.repeat(255) }]) {
        assert.equal((await request('/api/me', patchShul(invalid))).status, 400);
        assert.deepEqual(db.getUser(user.id), updated);
    }
    assert.equal((await request('/api/me', patchShul({ firstName: 'Must not save', email: other.email }))).status, 409);
    assert.deepEqual(db.getUser(user.id), updated);
    assert.deepEqual(db.getUser(other.id), other);
    const anonymous = await setup(t, false);
    assert.equal((await anonymous.request('/api/me', patchShul({ firstName: 'Changed' }))).status, 401);
});

const picturePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const pictureRequest = (body = picturePng, type = 'image/png') => ({ method: 'PUT', headers: { 'Content-Type': type }, body });

test('profile pictures enforce ownership, file limits and shul permissions, and update reader profiles', async t => {
    const { request, shul, user, db } = await setup(t, true);
    const other = db.createUser({ shulId: shul.id, firstName: 'Other', lastName: 'Reader', email: 'picture-other@example.com' });
    assert.equal((await request(`/api/shuls/${shul.id}/picture`, pictureRequest())).status, 403);
    assert.equal((await request('/api/me/picture', pictureRequest(Buffer.from('<svg/>'), 'image/svg+xml'))).status, 415);
    assert.equal((await request('/api/me/picture', pictureRequest(Buffer.from('not a picture')))).status, 400);
    assert.equal((await request('/api/me/picture', pictureRequest(Buffer.alloc(1024 * 1024 + 1)))).status, 413);
    assert.equal(db.getPicture('users', user.id), null);
    const response = await request('/api/me/picture', pictureRequest());
    assert.equal(response.status, 200);
    const updated = await response.json();
    assert.ok(updated.pictureUrl.startsWith(`/api/users/${user.id}/picture?v=`));
    assert.equal(updated.role, user.role);
    assert.equal(db.getUser(other.id).pictureUrl, undefined);
    const image = await request(updated.pictureUrl);
    assert.equal(image.headers.get('content-type'), 'image/png');
    assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), picturePng);
    const reading = (await (await request(`/api/schedule?shul=${shul.id}`)).json()).find(item => item.desc === 'Bereshit');
    db.setReadingLocks(shul.id, [{ dateString: reading.dateString, desc: reading.desc, aliyah: 1, readerId: user.id }]);
    const schedule = await (await request(`/api/schedule?shul=${shul.id}`)).json();
    assert.equal(schedule.find(item => item.desc === reading.desc).readers[0].pictureUrl, updated.pictureUrl);
    db.updateUser(user.id, { role: 'admin' });
    const users = await (await request(`/api/shuls/${shul.id}/users`)).json();
    assert.equal(users.find(item => item.id === user.id).pictureUrl, updated.pictureUrl);
    const replaced = await (await request('/api/me/picture', pictureRequest())).json();
    assert.notEqual(replaced.pictureUrl, updated.pictureUrl);
    assert.equal((await request(updated.pictureUrl)).status, 404);
    const shulResponse = await request(`/api/shuls/${shul.id}/picture`, pictureRequest());
    assert.equal(shulResponse.status, 200);
    const withPicture = await shulResponse.json();
    assert.ok(withPicture.pictureUrl.startsWith(`/api/shuls/${shul.id}/picture?v=`));
    assert.equal((await request(withPicture.pictureUrl)).status, 200);
    const foreign = db.createShul({ name: 'Foreign shul', settings: shul.settings });
    assert.equal((await request(`/api/shuls/${foreign.id}/picture`, pictureRequest())).status, 403);
    assert.equal((await request(`/api/shuls/${foreign.id}/picture`, { method: 'DELETE' })).status, 403);
    assert.equal((await request('/api/me/picture', pictureRequest(Buffer.from('bad')))).status, 400);
    assert.equal(db.getUser(user.id).pictureUrl, replaced.pictureUrl);
    const removed = await request('/api/me/picture', { method: 'DELETE' });
    assert.equal(removed.status, 200);
    assert.equal((await removed.json()).pictureUrl, undefined);
    assert.equal((await request(replaced.pictureUrl)).status, 404);
    const removedShul = await request(`/api/shuls/${shul.id}/picture`, { method: 'DELETE' });
    assert.equal((await removedShul.json()).pictureUrl, undefined);
    const anonymous = await setup(t, false);
    assert.equal((await anonymous.request('/api/me/picture', pictureRequest())).status, 401);
    assert.equal((await anonymous.request(`/api/shuls/${anonymous.shul.id}/picture`, pictureRequest())).status, 401);
});

test('profile and shul form saves commit pictures and fields atomically', async t => {
    const { request, shul, user, db } = await setup(t, true);
    const picture = `data:image/png;base64,${picturePng.toString('base64')}`;
    const other = db.createUser({ shulId: shul.id, firstName: 'Other', lastName: 'Reader', email: 'atomic-picture@example.com' });
    let response = await request('/api/me', patchShul({ firstName: 'Updated', picture }));
    assert.equal(response.status, 200);
    const updated = await response.json();
    assert.equal(updated.firstName, 'Updated');
    assert.ok(updated.pictureUrl);
    for (const patch of [{ firstName: 'Bad', picture: 'invalid' }, { firstName: 'Bad', email: other.email, picture: null }]) {
        response = await request('/api/me', patchShul(patch));
        assert.ok([400, 409].includes(response.status));
        assert.deepEqual(db.getUser(user.id), updated);
        assert.deepEqual(Buffer.from(db.getPicture('users', user.id).png), picturePng);
    }
    response = await request('/api/me', patchShul({ phone: '123', picture: null }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).pictureUrl, undefined);
    assert.equal(db.getUser(user.id).phone, '123');
    const path = `/api/shuls/${shul.id}`;
    assert.equal((await request(path, patchShul({ picture }))).status, 403);
    db.updateUser(user.id, { role: 'admin' });
    response = await request(path, patchShul({ name: 'Updated Shul', picture }));
    assert.equal(response.status, 200);
    const savedShul = await response.json();
    assert.ok(savedShul.pictureUrl);
    assert.equal(savedShul.name, 'Updated Shul');
    assert.equal((await request(path, patchShul({ name: 'Do not save', picture: 'invalid' }))).status, 400);
    assert.deepEqual(db.getShul(shul.id), savedShul);
    assert.equal((await request(path, patchShul({ name: '', picture: null }))).status, 400);
    assert.deepEqual(db.getShul(shul.id), savedShul);
    response = await request(path, patchShul({ picture: null }));
    assert.equal((await response.json()).pictureUrl, undefined);
    assert.equal(db.getPicture('shuls', shul.id), null);
});

test('user reading lists are available to the current user and owning admin without nested profiles', async t => {
    const { request, shul, user, db } = await setup(t, true);
    const reading = (await (await request(`/api/schedule?shul=${shul.id}`)).json()).find(item => item.desc === 'Bereshit');
    const assignment = { dateString: reading.dateString, desc: reading.desc, aliyah: 1 };
    assert.deepEqual((await (await request('/api/me')).json()).assignedReadings, []);
    const registration = await request(`/api/shuls/${shul.id}/readings/register`, registrationRequest(assignment));
    assert.equal(registration.status, 201);
    assert.deepEqual((await (await request('/api/me')).json()).assignedReadings, [assignment]);
    assert.equal((await request('/api/me', patchShul({ assignedReadings: [] }))).status, 400);
    db.updateUser(user.id, { role: 'admin' });
    const users = await (await request(`/api/shuls/${shul.id}/users`)).json();
    assert.deepEqual(users.find(item => item.id === user.id).assignedReadings, [assignment]);
    assert.ok(users.every(item => !('settings' in item)));
    const schedule = await (await request(`/api/schedule?shul=${shul.id}`)).json();
    const reader = schedule.find(item => item.desc === reading.desc).readers[0];
    assert.deepEqual(reader.assignedReadings, [assignment]);
    assert.ok(reader.assignedReadings.every(item => !('reader' in item)), 'Reading summaries must not contain nested users');
    db.setReadingLocks(shul.id, [{ ...assignment, readerId: null }]);
    assert.deepEqual((await (await request('/api/me')).json()).assignedReadings, []);
});
