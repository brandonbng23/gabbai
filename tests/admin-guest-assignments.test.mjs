import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { openDatabase } from '../backend/database/index.mjs';
import { createApp } from '../backend/app.mjs';
import { getShulSchedule } from '../backend/schedule.mjs';

const guest = { title: 'Mr.', firstName: 'Guest', lastName: 'Reader', hebrewName: 'Moshe', email: 'guest-reader@example.com', phone: '555-0100' };
const slot = { dateString: '2026-12-05', desc: 'Vayeshev', aliyah: 1 };
const assignment = (profile = guest) => ({ ...slot, readerId: null, guest: profile });

function fixture(t) {
    const db = openDatabase(':memory:');
    t.after(() => db.close());
    const shul = db.createShul({ name: 'Guest Assignment Shul', settings: { hebYear: 5787 } });
    const admin = db.createUser({ shulId: shul.id, title: 'Mr.', firstName: 'Admin', lastName: 'Test', email: 'admin@example.com', role: 'admin' });
    const member = db.createUser({ shulId: shul.id, firstName: 'Member', lastName: 'Test', email: 'member@example.com' });
    return { db, shul, admin, member };
}

test('admin guest assignments save all profile fields and reuse a guest email while preserving locks', t => {
    const { db, shul } = fixture(t);
    db.setReadingLocks(shul.id, [{ ...slot, locked: true }, { ...slot, aliyah: 0, locked: true }, assignment()]);
    const saved = db.getUserByEmail(guest.email);
    assert.equal(saved.role, 'guest');
    for (const [key, value] of Object.entries(guest)) assert.equal(saved[key], value);
    assert.equal(saved.assignedReadings.length, 1);
    db.setReadingLocks(shul.id, [{ ...assignment({ ...guest, email: guest.email.toUpperCase(), firstName: 'Updated' }), aliyah: 2 }]);
    assert.equal(db.getUserByEmail(guest.email).id, saved.id);
    assert.equal(db.getUser(saved.id).assignedReadings.length, 2);
    assert.equal(db.getUser(saved.id).firstName, 'Updated');
    assert.ok(db.listReadingLocks(shul.id).every(lock => lock.locked));
});

test('failed guest assignment batches roll back profiles, assignments, and locks together', t => {
    const { db, shul, member } = fixture(t);
    assert.throws(() => db.setReadingLocks(shul.id, [assignment(), { ...assignment({ ...guest, email: member.email }), aliyah: 2 }]), error => error.status === 409);
    assert.equal(db.getUserByEmail(guest.email), null);
    assert.deepEqual(db.listReadingReaders(shul.id), []);
    for (const invalid of [{ ...guest, firstName: '' }, { ...guest, email: 'invalid' }, { ...guest, title: '' }, { ...guest, role: 'admin' }]) {
        assert.throws(() => db.setReadingLocks(shul.id, [{ ...slot, locked: true }, assignment(invalid)]), TypeError);
        assert.deepEqual(db.listReadingLocks(shul.id), []);
    }
});

test('admin guest assignment rejects frozen guests and guest emails from another shul', t => {
    const { db, shul, admin } = fixture(t);
    const otherShul = db.createShul({ name: 'Other Shul', settings: { hebYear: 5787 } });
    const other = db.createUser({ ...guest, shulId: otherShul.id, role: 'guest' });
    assert.throws(() => db.setReadingLocks(shul.id, [assignment()]), error => error.status === 409);
    db.updateUser(other.id, { shulId: shul.id });
    db.updateShulUsers(shul.id, admin.id, [{ userId: other.id, previousRole: 'guest', previousFrozen: false, frozen: true }]);
    assert.throws(() => db.setReadingLocks(shul.id, [assignment()]), error => error.status === 403);
    assert.deepEqual(db.getUser(other.id).assignedReadings, []);
});

test('guest assignment API enforces admin access and validates guest details and real aliyot', async t => {
    const { db, shul, admin, member } = fixture(t);
    const app = createApp(db, { development: true, devUserId: member.id, preview: false });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    const reading = getShulSchedule(db, shul.id).find(reading => reading.desc === 'Bereshit');
    const target = { ...assignment(), dateString: reading.dateString, desc: reading.desc };
    const publish = changes => fetch(`${base}/api/shuls/${shul.id}/readings/locks`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes }),
    });
    assert.equal((await publish([target])).status, 403);
    db.updateUser(member.id, { role: 'admin' });
    for (const invalid of [{ ...target, guest: { ...guest, email: 'invalid' } }, { ...target, readerId: admin.id }, { ...target, aliyah: 10 }]) {
        assert.equal((await publish([invalid])).status, 400);
        assert.equal(db.getUserByEmail(guest.email), null);
    }
    const response = await publish([{ dateString: reading.dateString, desc: reading.desc, locked: true }, target]);
    assert.equal(response.status, 200);
    const [saved] = await response.json();
    assert.equal(saved.locked, true);
    assert.equal(saved.readers[0].email, guest.email);
    assert.equal(saved.readers[0].role, 'guest');
    assert.equal(db.getUser(saved.readers[0].id).phone, guest.phone);
    assert.equal((await publish([{ ...target, guest: { ...guest, email: admin.email } }])).status, 409);
});
