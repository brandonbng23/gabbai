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
import { createNotificationService, buildReadingRoundup } from '../backend/notifications.mjs';
import { localClock, threeMonthWindow } from '../backend/notificationPolicy.mjs';
import { getShulSchedule } from '../backend/schedule.mjs';

function fixture(t, path = ':memory:') {
    const db = openDatabase(path);
    t.after(() => db.close());
    const shul = db.createShul({ name: 'Notification Shul', settings: { hebYear: 5787 } });
    const make = (name, role = 'member', shulId = shul.id) => db.createUser({ shulId, firstName: name, lastName: 'Test', email: `${name.toLowerCase()}@example.com`, role });
    return { db, shul, make, admin: make('Admin', 'admin'), admin2: make('Admin2', 'admin'), member: make('Member'), sequence: 0 };
}
function book(state, options = {}) {
    return state.db.registerReading(state.shul.id, { dateString: '2026-11-07', desc: `Reading ${state.sequence++}`, aliyah: 1,
        readerId: state.member.id, emailEnabled: true, emailConfirmation: true,
        now: new Date('2026-10-28T03:50:00Z'), ...options }, () => {});
}
function fakeMailer() {
    const calls = [];
    return { enabled: true, calls, async send(email) { calls.push(email); return { status: 'accepted', id: `mail-${calls.length}` }; } };
}

test('member confirmation emails are opt-in, limited to five per local day, and never suppress inbox confirmations', t => {
    const state = fixture(t);
    assert.equal(book(state, { emailConfirmation: false }).emailConfirmation.status, 'not_requested');
    for (let i = 0; i < 5; i++) assert.equal(book(state).emailConfirmation.status, 'queued');
    assert.equal(book(state).emailConfirmation.status, 'daily_limit');
    assert.equal(state.db.listUserMessages(state.member.id).length, 7);
    assert.ok(state.db.listUserMessages(state.member.id).every(message => message.sender.type === 'system'));
    assert.equal(book(state, { now: new Date('2026-10-28T04:10:00Z') }).emailConfirmation.status, 'queued', 'New York local midnight resets the quota');
});

test('guest confirmations are limited by normalized guest email, even without an account or across bookers', t => {
    const state = fixture(t);
    const guest = { title: 'Mr.', firstName: 'Visitor', lastName: 'Test', email: 'visitor@example.com' };
    assert.equal(book(state, { guest, readerId: undefined }).emailConfirmation.status, 'queued');
    assert.equal(book(state, { guest: { ...guest, email: 'VISITOR@example.com' }, readerId: state.member.id }).emailConfirmation.status, 'daily_limit');
    const profile = state.db.getUserByEmail(guest.email);
    assert.equal(book(state, { readerId: profile.id }).emailConfirmation.status, 'daily_limit', 'Using a guest profile does not grant the five-email member limit');
    assert.equal(state.db.listUserMessages(profile.id).length, 3);
    assert.equal(state.db.listUserMessages(state.member.id).length, 1, 'Signed-in guest booker also gets the in-app confirmation');
    assert.equal(book(state, { guest, readerId: undefined, now: new Date('2026-10-28T04:10:00Z') }).emailConfirmation.status, 'queued');
});

test('disabled email and failed bookings do not consume confirmation quota', t => {
    const state = fixture(t);
    assert.equal(book(state, { emailEnabled: false }).emailConfirmation.status, 'unavailable');
    assert.throws(() => state.db.registerReading(state.shul.id, { dateString: '2026-11-07', desc: 'Unavailable', aliyah: 1,
        readerId: state.member.id, emailConfirmation: true, emailEnabled: true }, () => { throw new Error('Locked'); }), /Locked/);
    for (let i = 0; i < 5; i++) assert.equal(book(state).emailConfirmation.status, 'queued');
    assert.equal(book(state).emailConfirmation.status, 'daily_limit');
});

test('only the selected current admin gets instant alerts, and inbox alerts survive unavailable email', t => {
    const state = fixture(t);
    state.db.updateNotificationSettings(state.admin.id, state.shul.id, { instantAdminUserId: state.admin2.id });
    book(state, { emailEnabled: false, emailConfirmation: false });
    assert.equal(state.db.listUserMessages(state.admin.id).length, 0);
    const [alert] = state.db.listUserMessages(state.admin2.id);
    assert.equal(alert.sender.type, 'system');
    assert.match(alert.body, /Member Test/);
    assert.match(alert.body, /Aliyah: 1/);
    state.db.updateUser(state.admin2.id, { role: 'member' });
    book(state, { emailConfirmation: false });
    assert.equal(state.db.listUserMessages(state.admin2.id).length, 1, 'Demoted selected admin receives no new registration details');
});

test('timezones follow DST and calendar-month windows clamp at month end', () => {
    assert.equal(localClock(new Date('2026-11-01T05:30:00Z'), 'America/New_York').day, '2026-11-01');
    assert.equal(localClock(new Date('2026-11-01T06:30:00Z'), 'America/New_York').hour, 1);
    assert.equal(localClock(new Date('2026-11-01T21:00:00Z'), 'America/New_York').hour, 16);
    assert.deepEqual(threeMonthWindow(new Date('2026-11-30T18:00:00Z'), 'America/New_York'), { start: '2026-11-30', end: '2027-02-28' });
});

test('roundups run once per admin at 4 PM local, catch up the same day, and create inbox messages without email', async t => {
    const state = fixture(t);
    state.db.updateNotificationSettings(state.admin.id, state.shul.id, { timezone: 'America/Los_Angeles' });
    let now = new Date('2026-10-27T22:59:00Z');
    let builds = 0;
    const service = createNotificationService({ database: state.db, mailer: { enabled: false }, clock: () => now,
        roundupBuilder() { builds++; return 'Upcoming registrations and vacancies.'; } });
    await service.tick();
    assert.equal(state.db.listUserMessages(state.admin.id).length, 0);
    now = new Date('2026-10-27T23:00:00Z');
    await service.tick();
    await service.tick();
    assert.equal(builds, 1);
    for (const admin of [state.admin, state.admin2]) {
        assert.equal(state.db.listUserMessages(admin.id).length, 1);
        assert.equal(state.db.listUserMessages(admin.id)[0].sender.type, 'system');
    }
    now = new Date('2026-10-29T01:00:00Z'); // Oct 28, 6 PM: same-day catch-up.
    await service.tick();
    assert.equal(state.db.listUserMessages(state.admin.id).length, 2);
});

test('all email categories share the global UTC cap across shuls and concurrent workers', async t => {
    const state = fixture(t);
    const other = state.db.createShul({ name: 'Second Shul', settings: { hebYear: 5787 } });
    for (let i = 0; i < 104; i++) state.make(`Admin${i + 10}`, 'admin', i % 2 ? other.id : state.shul.id);
    let now = new Date('2026-10-27T19:00:00Z'); // Before local 4 PM, so use the prepared roundups.
    state.db.recordDailyRoundup(state.shul.id, '2026-10-27', 'Report one', { now, emailEnabled: true });
    state.db.recordDailyRoundup(other.id, '2026-10-27', 'Report two', { now, emailEnabled: true });
    const mailer = fakeMailer();
    const first = createNotificationService({ database: state.db, mailer, clock: () => now });
    const second = createNotificationService({ database: state.db, mailer, clock: () => now });
    await Promise.all([first.tick(), second.tick()]);
    assert.equal(mailer.calls.length, 100);
    assert.equal(new Set(mailer.calls.map(call => call.to)).size, 100);
    assert.equal(state.db.listUserMessages(state.admin.id).length, 1, 'Cap does not suppress the platform roundup');
    state.db.updateNotificationSettings(state.admin.id, state.shul.id, { instantAdminUserId: state.admin.id });
    book(state, { now }); // Confirmation plus instant alert are also capped.
    await first.tick();
    assert.equal(mailer.calls.length, 100);
    assert.equal(state.db.listUserMessages(state.member.id).length, 1);
    assert.equal(state.db.listUserMessages(state.admin.id).length, 2);
    now = new Date('2026-10-28T00:01:00Z');
    book(state, { now });
    await first.tick();
    assert.equal(mailer.calls.length, 102, 'UTC midnight resets the shared sending budget');
});

test('uncertain delivery is not retried and does not block registration', async t => {
    const state = fixture(t);
    book(state);
    let calls = 0;
    const service = createNotificationService({ database: state.db, clock: () => new Date('2026-10-28T03:50:00Z'),
        roundupBuilder: () => 'Daily report', mailer: { enabled: true, async send() { calls++; throw new Error('network timeout'); } } });
    await service.tick();
    const previous = calls;
    await service.tick();
    assert.equal(calls, previous, 'Ambiguous outcomes must not produce duplicate emails');
    assert.equal(state.db.getUser(state.member.id).assignedReadings.length, 1);
    assert.equal(state.db.listUserMessages(state.member.id).length, 1);
});

test('queued email and quota survive reopening; interrupted sends are not automatically duplicated', async t => {
    const dir = mkdtempSync(join(tmpdir(), 'gabbai-notification-restart-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const path = join(dir, 'notifications.sqlite');
    let db = openDatabase(path);
    const shul = db.createShul({ name: 'Restart Shul', settings: { hebYear: 5787 } });
    const member = db.createUser({ shulId: shul.id, firstName: 'Reader', lastName: 'Test', email: 'restart@example.com' });
    const now = new Date('2026-10-27T19:00:00Z');
    for (let i = 0; i < 2; i++) db.registerReading(shul.id, { dateString: '2026-11-07', desc: `Restart ${i}`, aliyah: 1,
        readerId: member.id, emailEnabled: true, emailConfirmation: true, now }, () => {});
    const interrupted = db.claimNotificationEmail(now);
    db.close();
    db = openDatabase(path);
    try {
        const mailer = fakeMailer();
        await createNotificationService({ database: db, mailer, clock: () => new Date('2026-10-27T19:06:00Z') }).tick();
        assert.equal(mailer.calls.length, 1);
        assert.match(mailer.calls[0].text, /Restart 1/);
        for (let i = 2; i < 5; i++) assert.equal(db.registerReading(shul.id, { dateString: '2026-11-07', desc: `Restart ${i}`, aliyah: 1,
            readerId: member.id, emailEnabled: true, emailConfirmation: true, now }, () => {}).emailConfirmation.status, 'queued');
        assert.equal(db.registerReading(shul.id, { dateString: '2026-11-07', desc: 'Over limit', aliyah: 1,
            readerId: member.id, emailEnabled: true, emailConfirmation: true, now }, () => {}).emailConfirmation.status, 'daily_limit');
        const inspect = new DatabaseSync(path, { readOnly: true });
        try { assert.equal(inspect.prepare('SELECT status FROM notification_email_outbox WHERE id = ?').get(interrupted.id).status, 'unknown'); }
        finally { inspect.close(); }
    } finally { db.close(); }
});

test('a roundup emails once per admin while preserving reports longer than one inbox message', async t => {
    const state = fixture(t);
    const now = new Date('2026-10-27T19:00:00Z');
    const report = 'Full registration details.\n'.repeat(1000);
    state.db.recordDailyRoundup(state.shul.id, '2026-10-27', report, { now, emailEnabled: true });
    const mailer = fakeMailer();
    await createNotificationService({ database: state.db, mailer, clock: () => now }).tick();
    assert.equal(mailer.calls.length, 2);
    assert.ok(mailer.calls.every(call => call.text === report));
    const pieces = state.db.listUserMessages(state.admin.id);
    assert.ok(pieces.length > 1);
    assert.equal(pieces.reduce((sum, message) => sum + message.body.length, 0), report.length);
});

test('roundup includes detailed registrations and compact vacancies from the real schedule', t => {
    const state = fixture(t);
    const now = new Date('2026-10-27T19:00:00Z');
    const reading = getShulSchedule(state.db, state.shul.id).find(item => item.dateString >= '2026-10-27' && item.dateString <= '2027-01-27' && item.psukim[0] && item.psukim[0] !== 'null');
    state.db.registerReading(state.shul.id, { dateString: reading.dateString, desc: reading.desc, aliyah: 1, readerId: state.member.id }, () => {});
    const report = buildReadingRoundup(state.db, state.shul.id, now, 'America/New_York');
    assert.ok(report.includes(`${reading.dateString} · ${reading.desc} · Aliyah 1: Member Test`));
    assert.ok(report.includes(reading.psukim[0]));
    assert.match(report, /\d+ open \([\d, ]+\)/);
    assert.ok(report.includes('2027-01-27'));
});

test('queue and confirmation quota roll back atomically if notification persistence fails', t => {
    const dir = mkdtempSync(join(tmpdir(), 'gabbai-notification-atomic-'));
    const state = fixture(t, join(dir, 'notifications.sqlite'));
    const raw = new DatabaseSync(state.db.path);
    t.after(() => raw.close());
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    raw.exec("CREATE TRIGGER fail_email BEFORE INSERT ON notification_email_outbox BEGIN SELECT RAISE(ABORT, 'Queue failed'); END;");
    assert.throws(() => book(state), /Queue failed/);
    assert.deepEqual(state.db.getUser(state.member.id).assignedReadings, []);
    assert.deepEqual(state.db.listUserMessages(state.member.id), []);
    raw.exec('DROP TRIGGER fail_email');
    for (let i = 0; i < 5; i++) assert.equal(book(state).emailConfirmation.status, 'queued');
});

test('notification settings are admin-only and the rules are publicly readable', async t => {
    const state = fixture(t);
    const app = createApp(state.db, { development: true, preview: false });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    function cookie(user) {
        const token = createHash('sha256').update(`notifications-${user.id}`).digest('hex');
        state.db.createSession(user.id, createHash('sha256').update(token).digest('hex'), Date.now() + 60000);
        return `gabbai_session=${token}`;
    }
    const adminCookie = cookie(state.admin);
    const memberCookie = cookie(state.member);
    const request = (path, auth, body) => fetch(base + path, { method: body ? 'PATCH' : 'GET', headers: { 'Content-Type': 'application/json', ...(auth ? { Cookie: auth } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const policy = await (await request(`/api/shuls/${state.shul.id}/notification-policy`)).json();
    assert.equal(policy.memberDailyLimit, 5);
    assert.equal(policy.guestDailyLimit, 1);
    assert.equal(policy.globalDailyLimit, 100);
    assert.equal(policy.globalResetTimezone, 'UTC');
    assert.equal((await request(`/api/shuls/${state.shul.id}/notifications`)).status, 401);
    assert.equal((await request(`/api/shuls/${state.shul.id}/notifications`, memberCookie, { timezone: 'UTC' })).status, 403);
    assert.equal((await request(`/api/shuls/${state.shul.id}/notifications`, adminCookie, { timezone: 'invalid/timezone' })).status, 400);
    assert.equal((await request(`/api/shuls/${state.shul.id}/notifications`, adminCookie, { instantAdminUserId: state.member.id })).status, 400);
    assert.equal((await request(`/api/shuls/${state.shul.id}/notifications`, adminCookie, { timezone: 'Asia/Jerusalem', instantAdminUserId: state.admin2.id })).status, 200);
    assert.equal((await (await request(`/api/shuls/${state.shul.id}/notification-policy`)).json()).timezone, 'Asia/Jerusalem');
    app.locals.mailer = fakeMailer();
    assert.equal((await (await request(`/api/shuls/${state.shul.id}/notification-policy`)).json()).emailAvailable, true);
    const reading = getShulSchedule(state.db, state.shul.id).find(item => !item.locked && !item.lockedArr[0] && item.psukim[0] && item.psukim[0] !== 'null');
    const response = await fetch(`${base}/api/shuls/${state.shul.id}/readings/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: memberCookie },
        body: JSON.stringify({ dateString: reading.dateString, desc: reading.desc, aliyah: 1, emailConfirmation: true }),
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).emailConfirmation.status, 'queued');
    assert.equal(state.db.listUserMessages(state.admin2.id)[0].sender.type, 'system');
});
