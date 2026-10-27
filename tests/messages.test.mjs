import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../backend/database/index.mjs';
import { createApp } from '../backend/app.mjs';
import { getShulSchedule } from '../backend/schedule.mjs';

function fixture(t, path = ':memory:') {
    const db = openDatabase(path);
    t.after(() => db.close());
    const shul = db.createShul({ name: 'First Shul', settings: { hebYear: 5787 } });
    const other = db.createShul({ name: 'Other Shul', settings: { hebYear: 5787 } });
    const make = (name, role = 'member', shulId = shul.id) => db.createUser({ shulId,
        firstName: name, lastName: 'Test', email: `${name}@example.com`, role });
    return { db, shul, other, admin: make('Admin', 'admin'), admin2: make('SecondAdmin', 'admin'),
        member: make('Member'), member2: make('SecondMember'), outsider: make('Outsider', 'admin', other.id),
        guest: make('Guest', 'guest') };
}
const message = { subject: 'Available readings', body: 'Please register for an upcoming reading.' };
const status = expected => error => error.status === expected;

test('members message only their shul and the shared inbox is restricted to its current admins', t => {
    const { db, shul, other, admin, admin2, member, member2, outsider, guest } = fixture(t);
    const sent = db.sendUserMessage(member.id, shul.id, message);
    assert.equal(sent.sender.type, 'user');
    assert.equal(sent.sender.id, member.id);
    assert.equal(sent.sender.firstName, member.firstName);
    assert.equal(sent.sender.email, member.email);
    assert.deepEqual(sent.sender.assignedReadings, member.assignedReadings);
    for (const field of ['phone', 'settings', 'password', 'hebrewName']) assert.equal(field in sent.sender, false);
    assert.equal(db.listShulMessages(admin.id, shul.id)[0].id, sent.id);
    assert.equal(db.listUserMessages(member.id, { folder: 'sent' })[0].id, sent.id);
    assert.deepEqual(db.listUserMessages(member2.id), []);
    assert.throws(() => db.sendUserMessage(member.id, other.id, message), status(403));
    assert.throws(() => db.sendUserMessage(admin.id, shul.id, message), status(403));
    assert.throws(() => db.sendUserMessage(guest.id, shul.id, message), status(403));
    for (const actor of [member, outsider, guest]) {
        assert.throws(() => db.listShulMessages(actor.id, shul.id), status(403));
        assert.throws(() => db.markShulMessageRead(actor.id, shul.id, sent.id), status(403));
    }
    db.markShulMessageRead(admin.id, shul.id, sent.id);
    const firstRead = db.listShulMessages(admin2.id, shul.id)[0].readAt;
    assert.ok(firstRead);
    db.markShulMessageRead(admin2.id, shul.id, sent.id);
    assert.equal(db.listShulMessages(admin.id, shul.id)[0].readAt, firstRead);
    db.updateUser(admin.id, { role: 'member' });
    assert.throws(() => db.listShulMessages(admin.id, shul.id), status(403));
});

test('shul broadcasts use the shul identity, keep recipients private and track each recipient independently', t => {
    const { db, shul, admin, admin2, member, member2, outsider } = fixture(t);
    const sent = db.sendShulMessage(admin.id, shul.id, { ...message, recipientIds: [member.id, member2.id] });
    assert.deepEqual(sent.sender, { ...shul, type: 'shul' });
    assert.equal(sent.recipientCount, 2);
    const inbox = db.listUserMessages(member.id)[0];
    for (const field of ['actorId', 'actor_user_id', 'recipientIds', 'email']) assert.equal(field in inbox, false);
    db.markUserMessageRead(member.id, sent.id);
    assert.ok(db.listUserMessages(member.id)[0].readAt);
    assert.equal(db.listUserMessages(member2.id)[0].readAt, null);
    assert.throws(() => db.markUserMessageRead(outsider.id, sent.id), status(404));
    const history = db.listShulMessages(admin2.id, shul.id, { folder: 'sent' });
    assert.deepEqual(new Set(history[0].recipientIds), new Set([member.id, member2.id]));
    assert.throws(() => db.sendShulMessage(member.id, shul.id, { ...message, recipientIds: [member2.id] }), status(403));
    assert.throws(() => db.sendShulMessage(outsider.id, shul.id, { ...message, recipientIds: [member.id] }), status(403));
    assert.throws(() => db.sendShulMessage(admin.id, shul.id, { ...message, recipientIds: [member.id, outsider.id] }), TypeError);
    assert.equal(db.listUserMessages(member.id).length, 1, 'Invalid batches save no deliveries');
});

test('sender pictures use the current user or shul image and never expose the sending admin image', t => {
    const { db, shul, admin, member } = fixture(t);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    db.setPicture('users', member.id, png);
    db.setPicture('users', admin.id, png);
    const shulMessage = db.sendShulMessage(admin.id, shul.id, { ...message, recipientIds: [member.id] });
    assert.equal(shulMessage.sender.pictureUrl, undefined);
    db.setPicture('shuls', shul.id, png);
    const url = db.getShul(shul.id).pictureUrl;
    assert.equal(db.listUserMessages(member.id)[0].sender.pictureUrl, url);
    db.sendUserMessage(member.id, shul.id, message);
    assert.equal(db.listShulMessages(admin.id, shul.id)[0].sender.pictureUrl, db.getUser(member.id).pictureUrl);
    db.setPicture('users', member.id, null);
    assert.equal(db.listShulMessages(admin.id, shul.id)[0].sender.pictureUrl, undefined);
    db.sendSystemMessage(shul.id, { ...message, kind: 'reading_invitation', recipientIds: [member.id], idempotencyKey: 'picture-test' });
    assert.equal(db.listUserMessages(member.id).find(item => item.sender.type === 'system').sender.pictureUrl, '/api/system/picture');
});

test('system invitations are durable and idempotent, with validation and pagination', t => {
    const { db, shul, member, admin, guest } = fixture(t);
    const input = { ...message, kind: 'reading_invitation', recipientIds: [member.id], idempotencyKey: 'weekly-5787-01' };
    const first = db.sendSystemMessage(shul.id, input);
    assert.equal(db.sendSystemMessage(shul.id, input).id, first.id);
    assert.throws(() => db.sendSystemMessage(shul.id, { ...input, body: 'Different content' }), status(409));
    assert.deepEqual(db.listUserMessages(member.id)[0].sender, { type: 'system', name: 'The Gabbai Team', pictureUrl: '/api/system/picture' });
    assert.equal(db.listUserMessages(member.id).length, 1);
    for (const bad of [{ subject: '' }, { body: 'x'.repeat(10001) }, { senderType: 'system' },
        { recipientIds: [] }, { recipientIds: [member.id, member.id] }, { recipientIds: [guest.id] }]) {
        assert.throws(() => db.sendShulMessage(admin.id, shul.id, { ...message, recipientIds: [member.id], ...bad }), TypeError);
    }
    for (const options of [{ limit: 0 }, { limit: 101 }, { offset: -1 }, { folder: 'other' }])
        assert.throws(() => db.listUserMessages(member.id, options), TypeError);
    assert.deepEqual(db.listUserMessages(member.id, { limit: 1, offset: 1 }), []);
    db.sendSystemMessage(shul.id, { ...input, idempotencyKey: 'weekly-5787-02' });
    assert.equal(db.listUserMessages(member.id, { limit: 1 }).length, 1);
});

test('registration confirmations commit atomically and include signed-in guest bookers', t => {
    const { db, shul, member, outsider } = fixture(t);
    const slot = { dateString: '2026-10-31', desc: 'Vayera', aliyah: 1 };
    db.registerReading(shul.id, { ...slot, readerId: member.id }, () => {});
    assert.equal(db.listUserMessages(member.id)[0].kind, 'confirmation');
    assert.match(db.listUserMessages(member.id)[0].body, /Vayera.*2026-10-31/);
    assert.throws(() => db.registerReading(shul.id, { ...slot, readerId: member.id }, () => {}));
    assert.equal(db.listUserMessages(member.id).length, 1);
    const guestSlot = { ...slot, aliyah: 2, readerId: outsider.id,
        guest: { title: 'Mr.', firstName: 'Visiting', lastName: 'Reader', email: 'visiting@example.com' } };
    db.registerReading(shul.id, guestSlot, () => {});
    assert.equal(db.listUserMessages(outsider.id)[0].kind, 'confirmation');
    assert.equal(db.listUserMessages(db.getUserByEmail('visiting@example.com').id).length, 1);
    assert.throws(() => db.registerReading(shul.id, { ...guestSlot, aliyah: 3 }, () => { throw new Error('Locked'); }));
    assert.equal(db.listUserMessages(outsider.id).length, 1);
});

test('messages and read receipts survive database reopening and migrations', t => {
    const dir = mkdtempSync(join(tmpdir(), 'gabbai-messages-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const path = join(dir, 'messages.sqlite');
    const db = openDatabase(path);
    let member, shul, sent;
    try {
        shul = db.createShul({ name: 'Persistent Shul', settings: { hebYear: 5787 } });
        member = db.createUser({ shulId: shul.id, firstName: 'Saved', lastName: 'User', email: 'saved@example.com' });
        sent = db.sendSystemMessage(shul.id, { ...message, kind: 'reading_invitation', recipientIds: [member.id], idempotencyKey: 'saved' });
        db.markUserMessageRead(member.id, sent.id);
    } finally { db.close(); }
    const reopened = openDatabase(path);
    try {
        assert.equal(reopened.listUserMessages(member.id)[0].id, sent.id);
        assert.ok(reopened.listUserMessages(member.id)[0].readAt);
        assert.equal(reopened.sendSystemMessage(shul.id, { ...message, kind: 'reading_invitation', recipientIds: [member.id], idempotencyKey: 'saved' }).id, sent.id);
        reopened.markUserMessageUnread(member.id, sent.id);
        reopened.setUserMessageTrash(member.id, sent.id, true);
    } finally { reopened.close(); }
    const restored = openDatabase(path);
    try {
        assert.deepEqual(restored.listUserMessages(member.id), []);
        const [trashed] = restored.listUserMessages(member.id, { folder: 'trash' });
        assert.equal(trashed.id, sent.id);
        assert.equal(trashed.readAt, null);
        restored.setUserMessageTrash(member.id, sent.id, false);
        assert.equal(restored.listUserMessages(member.id)[0].id, sent.id);
    } finally { restored.close(); }
});

test('version 15 databases migrate without changing memberships, and failed confirmation writes roll back bookings', t => {
    const dir = mkdtempSync(join(tmpdir(), 'gabbai-message-migration-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const path = join(dir, 'legacy.sqlite');
    let db = openDatabase(path);
    const shul = db.createShul({ name: 'Existing Shul', settings: { hebYear: 5787 } });
    const member = db.createUser({ shulId: shul.id, firstName: 'Existing', lastName: 'User', email: 'legacy@example.com' });
    db.close();
    const raw = new DatabaseSync(path);
    raw.exec(`DROP TABLE message_recipients; DROP TABLE shul_message_receipts; DROP TABLE messages;
        DELETE FROM schema_migrations WHERE version >= 16;`);
    raw.close();
    db = openDatabase(path);
    try {
        assert.deepEqual(db.getUser(member.id), member);
        assert.deepEqual(db.listUserMessages(member.id), []);
        const sabotage = new DatabaseSync(path);
        sabotage.exec(`CREATE TRIGGER fail_confirmation BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT, 'Confirmation failed'); END;`);
        sabotage.close();
        assert.throws(() => db.registerReading(shul.id, {
            dateString: '2026-10-31', desc: 'Vayera', aliyah: 1, readerId: member.id,
        }, () => {}), /Confirmation failed/);
        assert.deepEqual(db.getUser(member.id).assignedReadings, []);
    } finally { db.close(); }
});

test('personal inbox filters, sorting, unread status, and trash stay scoped to the recipient', t => {
    const { db, shul, admin, member, member2, outsider } = fixture(t);
    const first = db.sendShulMessage(admin.id, shul.id, { ...message, recipientIds: [member.id, member2.id] });
    const second = db.sendShulMessage(admin.id, shul.id, { ...message, subject: 'Another message', recipientIds: [member.id] });
    const newest = db.listUserMessages(member.id);
    assert.deepEqual({ ...db.getUserMessageCounts(member.id) }, { all: 2, unread: 2, trash: 0 });
    db.listUserMessages(member.id, { limit: 1 });
    assert.equal(db.getUserMessageCounts(member.id).all, 2, 'Counts cover all pages');
    assert.equal(db.getUserMessageCounts(member2.id).all, 1, 'Counts are private to each recipient');
    assert.throws(() => db.getUserMessageCounts(null), status(401));
    assert.deepEqual(db.listUserMessages(member.id, { sort: 'oldest' }).map(item => item.id), newest.map(item => item.id).reverse());
    assert.deepEqual(db.listUserMessages(member.id, { sort: 'oldest', limit: 1 }).map(item => item.id), [newest.at(-1).id]);
    db.markUserMessageRead(member.id, first.id);
    assert.equal(db.getUserMessageCounts(member.id).unread, 1);
    assert.deepEqual(db.listUserMessages(member.id, { unread: true }).map(item => item.id), [second.id]);
    db.markUserMessageUnread(member.id, first.id);
    assert.equal(db.listUserMessages(member.id, { unread: true }).length, 2);
    db.setUserMessageTrash(member.id, first.id, true);
    assert.deepEqual({ ...db.getUserMessageCounts(member.id) }, { all: 1, unread: 1, trash: 1 });
    assert.deepEqual(db.listUserMessages(member.id).map(item => item.id), [second.id]);
    assert.deepEqual(db.listUserMessages(member.id, { folder: 'trash', unread: true }).map(item => item.id), [first.id]);
    assert.ok(db.listUserMessages(member2.id).some(item => item.id === first.id));
    assert.throws(() => db.setUserMessageTrash(outsider.id, first.id, true), status(404));
    assert.throws(() => db.markUserMessageUnread(outsider.id, first.id), status(404));
    assert.throws(() => db.setUserMessageTrash(member.id, first.id, 'true'), TypeError);
    assert.throws(() => db.listUserMessages(member.id, { sort: 'invalid' }), TypeError);
    db.setUserMessageTrash(member.id, first.id, false);
    assert.deepEqual({ ...db.getUserMessageCounts(member.id) }, { all: 2, unread: 2, trash: 0 });
    assert.equal(db.listUserMessages(member.id).length, 2);
    assert.deepEqual(db.listUserMessages(member.id, { folder: 'trash' }), []);
});

test('HTTP messaging authenticates sessions, enforces direction and rejects sender spoofing and cross-site writes', async t => {
    const { db, shul, admin, member, member2, outsider } = fixture(t);
    const app = createApp(db, { development: true, preview: false });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    function session(actor) {
        const token = createHash('sha256').update(`test-${actor.id}`).digest('hex');
        db.createSession(actor.id, createHash('sha256').update(token).digest('hex'), Date.now() + 60000);
        return `gabbai_session=${token}`;
    }
    const cookies = new Map([admin, member, member2, outsider].map(actor => [actor.id, session(actor)]));
    const request = (actor, path, method = 'GET', body, headers = {}) => fetch(base + path, {
        method, headers: { 'Content-Type': 'application/json', ...(actor ? { Cookie: cookies.get(actor.id) } : {}), ...headers },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal((await request(null, '/api/me/messages')).status, 401);
    assert.equal((await request(null, '/api/me/messages/counts')).status, 401);
    const systemPicture = await request(null, '/api/system/picture');
    assert.equal(systemPicture.status, 200);
    assert.match(systemPicture.headers.get('content-type'), /image\/png/);
    await systemPicture.arrayBuffer();
    const sent = await request(member, '/api/me/messages', 'POST', message);
    assert.equal(sent.status, 201);
    assert.equal(sent.headers.get('cache-control'), 'no-store');
    const id = (await sent.json()).id;
    assert.equal((await request(member, '/api/me/messages', 'POST', { ...message, recipientIds: [member2.id] })).status, 400);
    assert.equal((await request(member, '/api/me/messages', 'POST', { ...message, senderType: 'system' })).status, 400);
    assert.equal((await request(member, '/api/me/messages', 'POST', message, { Origin: 'https://foreign.example' })).status, 403);
    assert.equal((await request(admin, '/api/me/messages', 'POST', message)).status, 403);
    assert.equal((await request(member, `/api/shuls/${shul.id}/messages`)).status, 403);
    assert.equal((await request(outsider, `/api/shuls/${shul.id}/messages`)).status, 403);
    assert.equal((await (await request(admin, `/api/shuls/${shul.id}/messages`)).json())[0].id, id);
    assert.equal((await request(admin, `/api/shuls/${shul.id}/messages/${id}/read`, 'PATCH', {})).status, 200);
    const broadcast = await request(admin, `/api/shuls/${shul.id}/messages`, 'POST', { ...message, recipientIds: [member.id] });
    assert.equal(broadcast.status, 201);
    const broadcastId = (await broadcast.json()).id;
    const countsResponse = await request(member, '/api/me/messages/counts');
    assert.equal(countsResponse.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await countsResponse.json(), { all: 1, unread: 1, trash: 0 });
    assert.equal((await request(member2, `/api/me/messages/${broadcastId}/read`, 'PATCH', {})).status, 404);
    assert.equal((await request(member, `/api/me/messages/${broadcastId}/read`, 'PATCH', {})).status, 200);
    assert.equal((await request(member2, `/api/me/messages/${broadcastId}/unread`, 'PATCH', {})).status, 404);
    assert.equal((await request(member, `/api/me/messages/${broadcastId}/unread`, 'PATCH', {})).status, 200);
    assert.equal((await request(member, `/api/me/messages/${broadcastId}/trash`, 'PATCH', { trashed: true }, { Origin: 'https://foreign.example' })).status, 403);
    assert.equal((await request(member2, `/api/me/messages/${broadcastId}/trash`, 'PATCH', { trashed: true })).status, 404);
    assert.equal((await request(member, `/api/me/messages/${broadcastId}/trash`, 'PATCH', { trashed: true })).status, 200);
    assert.deepEqual((await (await request(member, '/api/me/messages?folder=trash&sort=oldest&unread=true')).json()).map(item => item.id), [broadcastId]);
    assert.equal((await request(member, `/api/me/messages/${broadcastId}/trash`, 'PATCH', { trashed: false })).status, 200);
    assert.equal((await request(member, '/api/me/messages?unread=invalid')).status, 400);
    assert.equal((await request(member, '/api/me/messages?limit=foo')).status, 400);
    assert.equal((await request(member, '/api/me/messages?sender=system')).status, 400);
    // Use the real booking endpoint to verify the integration, rather than only repository calls.
    const reading = getShulSchedule(db, shul.id).find(item => !item.locked && item.psukim[0] && item.psukim[0] !== 'null');
    const booked = await request(member, `/api/shuls/${shul.id}/readings/register`, 'POST', {
        dateString: reading.dateString, desc: reading.desc, aliyah: 1,
    });
    assert.equal(booked.status, 201);
    assert.ok((await (await request(member, '/api/me/messages')).json()).some(item => item.kind === 'confirmation'));
});
