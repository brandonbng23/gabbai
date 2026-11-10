import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { openDatabase } from '../backend/database/index.mjs';
import { createApp } from '../backend/app.mjs';
import { hashPassword } from '../backend/passwords.mjs';
import { getShulSchedule } from '../backend/schedule.mjs';

function fixture(t, path = ':memory:') {
    const db = openDatabase(path);
    t.after(() => db.close());
    const shul = db.createShul({ name: 'Freeze Shul', settings: { hebYear: 5787 } });
    const make = (name, role) => db.createUser({ shulId: shul.id, firstName: name, lastName: 'Test', title: 'Mr.', email: `${name.toLowerCase()}@example.com`, role });
    return { db, shul, admin: make('Admin', 'admin'), member: make('Member', 'member'), guest: make('Guest', 'guest'), admin2: make('AdminTwo', 'admin') };
}
const change = (user, frozen = true) => ({ userId: user.id, previousRole: user.role, previousFrozen: Boolean(user.frozen), frozen });
const booking = user => ({ dateString: '2026-12-05', desc: 'Vayeshev', aliyah: 1, readerId: user.id });
const frozenError = error => error.status === 403 && /frozen/.test(error.message);

test('admins can freeze and unfreeze members, guests, and other admins while preserving roles and assignments', t => {
    const { db, shul, admin, member, guest, admin2 } = fixture(t);
    db.registerReading(shul.id, booking(member), () => {});
    db.updateShulUsers(shul.id, admin.id, [member, guest, admin2].map(user => change(user)));
    for (const user of [member, guest, admin2]) {
        assert.equal(db.getUser(user.id).frozen, true);
        assert.equal(db.getUser(user.id).role, user.role);
        assert.throws(() => db.registerReading(shul.id, { ...booking(user), aliyah: 2 }, () => {}), frozenError);
        assert.throws(() => db.setPasswordHash(user.id, 'replacement'), frozenError, 'A password request already in progress cannot write after the freeze');
    }
    assert.equal(db.getUser(member.id).assignedReadings.length, 1);
    assert.throws(() => db.registerReading(shul.id, { ...booking(guest), readerId: undefined,
        guest: { title: 'Mr.', firstName: 'Changed', lastName: 'Name', email: guest.email.toUpperCase() } }, () => {}), frozenError);
    assert.equal(db.getUser(guest.id).firstName, guest.firstName, 'Frozen guest details are not changed by a booking');
    assert.throws(() => db.updateShulUsers(shul.id, admin2.id, [change(member, false)]), error => error.status === 403);
    db.updateShulUsers(shul.id, admin.id, [change(db.getUser(member.id), false)]);
    db.registerReading(shul.id, { ...booking(member), aliyah: 2 }, () => {});
    assert.equal(db.getUser(member.id).assignedReadings.length, 2);
});

test('freeze changes enforce ownership, prevent self-freezing, detect stale state, and roll back mixed batches', t => {
    const { db, shul, admin, member, guest } = fixture(t);
    assert.throws(() => db.updateShulUsers(shul.id, member.id, [change(guest)]), error => error.status === 403);
    assert.throws(() => db.updateShulUsers(shul.id, admin.id, [change(admin)]), error => error.status === 400);
    assert.throws(() => db.updateShulUsers(shul.id, admin.id, [change(member), { ...change(guest), frozen: 'true' }]), TypeError);
    assert.equal(db.getUser(member.id).frozen, false);
    const other = db.createShul({ name: 'Other', settings: { hebYear: 5787 } });
    assert.throws(() => db.updateShulUsers(other.id, admin.id, [change(guest)]), error => error.status === 403);
    const otherAdmin = db.createUser({ shulId: other.id, firstName: 'Other', lastName: 'Admin', email: 'other-admin@example.com', role: 'admin' });
    assert.throws(() => db.updateShulUsers(other.id, otherAdmin.id, [change(guest)]), error => error.status === 404);
    db.updateShulUsers(shul.id, admin.id, [change(member)]);
    assert.throws(() => db.updateShulUsers(shul.id, admin.id, [change(member)]), error => error.status === 409);
});

test('freeze status persists and old accounts migrate to unfrozen without changing their profiles', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-frozen-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'accounts.sqlite');
    let db = openDatabase(path);
    const shul = db.createShul({ name: 'Migration Shul', settings: { hebYear: 5787 } });
    const admin = db.createUser({ shulId: shul.id, firstName: 'Admin', lastName: 'Test', email: 'admin@example.com', role: 'admin' });
    const member = db.createUser({ shulId: shul.id, firstName: 'Member', lastName: 'Test', email: 'member@example.com' });
    db.updateShulUsers(shul.id, admin.id, [change(member)]);
    db.close();
    db = openDatabase(path);
    assert.equal(db.getUser(member.id).frozen, true);
    const beforeMigration = db.getUser(member.id);
    db.close();
    const legacy = new DatabaseSync(path);
    legacy.exec('ALTER TABLE users DROP COLUMN frozen; DELETE FROM schema_migrations WHERE version >= 31');
    legacy.close();
    db = openDatabase(path);
    try { assert.deepEqual(db.getUser(member.id), { ...beforeMigration, frozen: false }); }
    finally { db.close(); }
});

async function server(t) {
    const state = fixture(t);
    const app = createApp(state.db, { development: false, preview: false });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    function session(user) {
        const token = createHash('sha256').update(user.id).digest('hex');
        const hash = createHash('sha256').update(token).digest('hex');
        if (!state.db.getSessionUserId(hash)) state.db.createSession(user.id, hash, Date.now() + 60000);
        return `gabbai_session=${token}`;
    }
    const request = (path, user, body, method = body ? 'POST' : 'GET') => fetch(base + path, {
        method, headers: { ...(user ? { Cookie: session(user) } : {}), 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { ...state, base, request, session };
}

test('frozen accounts can sign in and read, while every account mutation and registration is blocked', async t => {
    const { db, shul, admin, member, request, base, session } = await server(t);
    const password = 'Frozen account password 2026!';
    db.setPasswordHash(member.id, await hashPassword(password));
    const existingSession = session(member);
    const freeze = await request(`/api/shuls/${shul.id}/users`, admin, { changes: [change(member)] }, 'PATCH');
    assert.equal(freeze.status, 200);
    assert.equal((await freeze.json()).find(user => user.id === member.id).frozen, true);
    assert.equal((await fetch(base + '/api/me', { headers: { Cookie: existingSession } })).status, 200);
    assert.equal((await fetch(base + '/api/me', { method: 'PATCH', headers: { Cookie: existingSession, 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: 'Changed' }) })).status, 403);
    assert.equal((await request('/api/auth/signin', undefined, { email: member.email, password })).status, 200);
    for (const [path, body, method] of [
        ['/api/me', { firstName: 'Changed' }, 'PATCH'],
        ['/api/me/significant-portions', { portions: [] }, 'PATCH'],
        ['/api/auth/password', { currentPassword: password, password: 'Another password 2026!' }, 'POST'],
        [`/api/shuls/${shul.id}/readings/register`, booking(member), 'POST'],
        ['/api/me/starred-readings', {}, 'PUT'],
    ]) assert.equal((await request(path, member, body, method)).status, 403, path);
    assert.equal(db.getUser(member.id).firstName, member.firstName);
    assert.equal((await request('/api/auth/signout', member, {})).status, 204);
    assert.equal((await request(`/api/shuls/${shul.id}/users`, admin, { changes: [change(db.getUser(member.id), false)] }, 'PATCH')).status, 200);
    assert.equal((await request('/api/me', member, { firstName: 'Unfrozen' }, 'PATCH')).status, 200);
});

test('anonymous guest registrations cannot bypass freezing by reusing an email with different casing or details', async t => {
    const { db, shul, admin, guest, request } = await server(t);
    db.updateShulUsers(shul.id, admin.id, [change(guest)]);
    const reading = getShulSchedule(db, shul.id).find(reading => reading.dateString >= '2026-11-10' && reading.psukim[0] && reading.psukim[0] !== 'null');
    const response = await request(`/api/shuls/${shul.id}/readings/register`, undefined, {
        dateString: reading.dateString, desc: reading.desc, aliyah: 1,
        guest: { title: 'Mr.', firstName: 'New', lastName: 'Name', email: guest.email.toUpperCase() },
    });
    assert.equal(response.status, 403);
    assert.match((await response.json()).error, /frozen/);
    assert.equal(db.getUser(guest.id).assignedReadings.length, 0);
});

test('frozen admins retain read access but cannot change shul settings or unfreeze themselves', async t => {
    const { db, shul, admin, admin2, request } = await server(t);
    db.updateShulUsers(shul.id, admin.id, [change(admin2)]);
    assert.equal((await request(`/api/shuls/${shul.id}/users`, admin2)).status, 200);
    assert.equal((await request(`/api/shuls/${shul.id}`, admin2, { name: 'Changed' }, 'PATCH')).status, 403);
    assert.equal((await request(`/api/shuls/${shul.id}/users`, admin2,
        { changes: [change(db.getUser(admin2.id), false)] }, 'PATCH')).status, 403);
    assert.equal(db.getShul(shul.id).name, shul.name);
    assert.equal((await request(`/api/shuls/${shul.id}/users`, admin,
        { changes: [change(db.getUser(admin2.id), false)] }, 'PATCH')).status, 200);
    assert.equal((await request(`/api/shuls/${shul.id}`, admin2, { name: 'Unfrozen Shul' }, 'PATCH')).status, 200);
});
