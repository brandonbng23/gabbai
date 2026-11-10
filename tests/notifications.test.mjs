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
import { isShabbatDeliveryPaused, localClock, threeMonthWindow, reportWindow, isReportDue } from '../backend/notificationPolicy.mjs';
import { getShulSchedule } from '../backend/schedule.mjs';
import { formatCommunicationDate } from '../backend/communicationDate.mjs';

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
    assert.ok(state.db.listUserMessages(state.member.id).every(message => message.body.includes('Saturday, November 7, 2026')));
    assert.equal(book(state, { now: new Date('2026-10-28T04:10:00Z') }).emailConfirmation.status, 'queued', 'New York local midnight resets the quota');
});

test('anonymous guest confirmations use the guest email limit while member guest bookings use the member limit', t => {
    const state = fixture(t);
    const guest = { title: 'Mr.', firstName: 'Visitor', lastName: 'Test', email: 'visitor@example.com' };
    assert.equal(book(state, { guest, readerId: undefined }).emailConfirmation.status, 'queued');
    assert.equal(book(state, { guest: { ...guest, email: 'VISITOR@example.com' }, readerId: state.member.id }).emailConfirmation.status, 'queued');
    const profile = state.db.getUserByEmail(guest.email);
    assert.equal(book(state, { readerId: profile.id }).emailConfirmation.status, 'daily_limit', 'Using a guest profile does not grant the five-email member limit');
    assert.equal(state.db.listUserMessages(profile.id).length, 3);
    assert.equal(state.db.listUserMessages(state.member.id).length, 1, 'Signed-in guest booker also gets the in-app confirmation');
    assert.equal(book(state, { guest, readerId: undefined, now: new Date('2026-10-28T04:10:00Z') }).emailConfirmation.status, 'queued');
});

test('a member shares five confirmation requests across self and guest bookings', t => {
    const state = fixture(t);
    for (let i = 0; i < 4; i++) assert.equal(book(state).emailConfirmation.status, 'queued');
    const guest = { title: 'Mr.', firstName: 'Visitor', lastName: 'Test', email: 'booked-guest@example.com' };
    assert.equal(book(state, { guest }).emailConfirmation.status, 'queued');
    assert.equal(book(state, { guest: { ...guest, email: 'another-guest@example.com' } }).emailConfirmation.status, 'daily_limit');
    assert.equal(book(state).emailConfirmation.status, 'daily_limit');
});

test('quota checks match booking limits, share member guest allowances, and reset at local midnight', t => {
    const state = fixture(t);
    const now = new Date('2026-10-28T03:50:00Z');
    const quota = options => state.db.getConfirmationEmailQuota(state.shul.id, options, now);
    assert.deepEqual(quota({ bookerId: state.member.id }), {
        limit: 5, used: 0, remaining: 5, timezone: 'America/New_York', localDay: '2026-10-27',
    });
    for (let i = 0; i < 5; i++) assert.equal(book(state, { now }).emailConfirmation.status, 'queued');
    assert.equal(quota({ bookerId: state.member.id }).remaining, 0);
    assert.equal(quota({ bookerId: state.member.id, readerEmail: 'visitor@example.com' }).remaining, 0);
    assert.equal(quota({ bookerId: state.admin.id }).remaining, 5, 'Other accounts keep their own allowance');
    assert.equal(state.db.getConfirmationEmailQuota(state.shul.id, { bookerId: state.member.id }, new Date('2026-10-28T04:10:00Z')).remaining, 5);
    assert.equal(quota({ bookerId: state.member.id }).used, 5, 'Repeated checks never consume quota');
});

test('guest quota checks normalize email addresses and match guest profile registrations', t => {
    const state = fixture(t);
    const now = new Date('2026-10-28T03:50:00Z');
    const guest = { title: 'Mr.', firstName: 'Visitor', lastName: 'Test', email: 'visitor@example.com' };
    assert.equal(state.db.getConfirmationEmailQuota(state.shul.id, { readerEmail: guest.email }, now).remaining, 1);
    book(state, { now, guest, readerId: undefined });
    const profile = state.db.getUserByEmail(guest.email);
    assert.equal(state.db.getConfirmationEmailQuota(state.shul.id, { readerEmail: ' VISITOR@example.com ' }, now).remaining, 0);
    assert.equal(state.db.getConfirmationEmailQuota(state.shul.id, { bookerId: profile.id }, now).remaining, 0);
    assert.equal(state.db.getConfirmationEmailQuota(state.shul.id, { readerEmail: 'different@example.com' }, now).remaining, 1);
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
    assert.match(alert.body, /Date: Saturday, November 7, 2026/);
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

test('report scheduling respects the chosen delivery day and local delivery time', () => {
    const config = { timezone: 'America/New_York', reportTime: '15:30', reportDays: [1] };
    assert.equal(isReportDue(new Date('2026-10-26T19:29:00Z'), config), false);
    assert.equal(isReportDue(new Date('2026-10-26T19:30:00Z'), config), true);
    assert.equal(isReportDue(new Date('2026-10-27T19:30:00Z'), config), false);
    assert.equal(isReportDue(new Date('2026-10-29T19:30:00Z'), config), false);
    assert.equal(isReportDue(new Date('2026-10-28T19:30:00Z'), { ...config, reportDays: [3] }), true);
    assert.equal(isReportDue(new Date('2026-10-29T19:30:00Z'), { ...config, reportDays: [3] }), false);
    assert.equal(isReportDue(new Date('2026-10-30T19:30:00Z'), { ...config, reportDays: [3] }), false);
    assert.equal(isReportDue(new Date('2026-10-31T19:30:00Z'), { ...config, reportDays: [3] }), false);
    assert.equal(isReportDue(new Date('2026-11-02T20:30:00Z'), config), true, 'After DST ends, 3:30 PM is 20:30 UTC');
    assert.equal(isReportDue(new Date('2026-10-27T01:00:00Z'), config), true, 'Local Monday is still Monday when UTC has reached Tuesday');
});

test('reports can be delivered on any selected weekday, including Sunday and Saturday', () => {
    for (let selectedDay = 0; selectedDay <= 6; selectedDay++) {
        const config = { timezone: 'America/New_York', reportTime: '15:30', reportDays: [selectedDay] };
        for (let day = 0; day <= 6; day++) {
            const now = new Date(`2026-10-${25 + day}T19:30:00Z`);
            assert.equal(isReportDue(now, config), day === selectedDay, `Selected ${selectedDay}, actual ${day}`);
        }
    }
    const sunday = { timezone: 'America/New_York', reportTime: '15:30', reportDays: [0] };
    assert.equal(isReportDue(new Date('2026-11-01T20:29:00Z'), sunday), false);
    assert.equal(isReportDue(new Date('2026-11-01T20:30:00Z'), sunday), true, 'Sunday after DST ends uses standard time');
    assert.equal(isReportDue(new Date('2026-11-02T01:00:00Z'), sunday), true, 'Local Sunday continues into UTC Monday');
});

test('legacy delivery days normalize to one day and a new selection survives reopening', t => {
    const dir = mkdtempSync(join(tmpdir(), 'gabbai-delivery-days-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const path = join(dir, 'notifications.sqlite');
    let db = openDatabase(path);
    const presets = [['daily', [0, 1, 2, 3, 4, 5, 6]], ['mon_thu', [1, 4]], ['mon_wed_fri', [1, 3, 5]]];
    const shuls = presets.map(([name]) => db.createShul({ name, settings: { hebYear: 5787 } }));
    const admin = db.createUser({ shulId: shuls[0].id, role: 'admin', firstName: 'Delivery', lastName: 'Admin', email: 'delivery@example.com' });
    db.close();
    const legacy = new DatabaseSync(path);
    try {
        for (let i = 0; i < shuls.length; i++) legacy.prepare(`INSERT INTO shul_notification_settings
            (shul_id, report_frequency, report_time, timezone) VALUES (?, ?, '15:30', 'America/Chicago')`).run(shuls[i].id, presets[i][0]);
        legacy.exec('ALTER TABLE shul_notification_settings DROP COLUMN report_days; DELETE FROM schema_migrations WHERE version >= 29');
    } finally { legacy.close(); }
    db = openDatabase(path);
    try {
        for (let i = 0; i < shuls.length; i++) {
            const config = db.getNotificationSettings(shuls[i].id);
            assert.deepEqual(config.reportDays, [presets[i][1][0]]);
            assert.equal(config.timezone, 'America/Chicago');
            assert.equal(config.reportTime, '15:30');
        }
        assert.deepEqual(db.updateNotificationSettings(admin.id, shuls[0].id, { reportDays: [6] }).reportDays, [6]);
        for (const reportDays of [[], [0, 6], [0, 0], [-1], [7], [1.5], ['0'], null])
            assert.throws(() => db.updateNotificationSettings(admin.id, shuls[0].id, { reportDays }), TypeError);
        assert.deepEqual(db.getNotificationSettings(shuls[0].id).reportDays, [6]);
    } finally { db.close(); }
    db = openDatabase(path);
    try { assert.deepEqual(db.getNotificationSettings(shuls[0].id).reportDays, [6]); }
    finally { db.close(); }
});

test('report windows cover two weeks or one to three calendar months', () => {
    const now = new Date('2026-10-27T19:00:00Z');
    assert.deepEqual(reportWindow(now, 'America/New_York', '2weeks'), { start: '2026-10-27', end: '2026-11-10' });
    assert.equal(reportWindow(now, 'America/New_York', '1month').end, '2026-11-27');
    assert.equal(reportWindow(now, 'America/New_York', '2months').end, '2026-12-27');
    assert.equal(reportWindow(new Date('2026-01-31T19:00:00Z'), 'America/New_York', '1month').end, '2026-02-28');
    for (const weeks of [2, 4, 6, 8, 10, 12]) {
        const window = reportWindow(now, 'America/New_York', `${weeks}weeks`);
        assert.equal((Date.parse(window.end) - Date.parse(window.start)) / 86400000, weeks * 7);
    }
});

test('legacy calendar-month preferences migrate to week steps without losing communication settings', t => {
    const dir = mkdtempSync(join(tmpdir(), 'gabbai-summary-windows-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const path = join(dir, 'notifications.sqlite');
    let db = openDatabase(path);
    const shul = db.createShul({ name: 'Summary Shul', settings: { hebYear: 5787 } });
    const admin = db.createUser({ shulId: shul.id, role: 'admin', firstName: 'Admin', lastName: 'Test', email: 'summary-upgrade@example.com' });
    db.updateNotificationSettings(admin.id, shul.id, { timezone: 'America/Chicago', reportTime: '14:20', reportDays: [1],
        instantAdminUserId: admin.id, dailyReports: [{ userId: admin.id, enabled: false }] });
    db.close();
    const raw = new DatabaseSync(path);
    raw.exec(`CREATE TABLE old_notification_settings AS SELECT * FROM shul_notification_settings;
        UPDATE old_notification_settings SET report_range = '3months', report_frequency = 'mon_thu';
        ALTER TABLE old_notification_settings DROP COLUMN report_days;
        DROP TABLE shul_notification_settings;
        ALTER TABLE old_notification_settings RENAME TO shul_notification_settings;
        DELETE FROM schema_migrations WHERE version >= 25;`);
    raw.close();
    db = openDatabase(path);
    try {
        const settings = db.getNotificationSettings(shul.id);
        assert.equal(settings.reportRange, '12weeks');
        assert.equal(settings.timezone, 'America/Chicago');
        assert.equal(settings.reportTime, '14:20');
        assert.deepEqual(settings.reportDays, [1]);
        assert.equal(settings.instantAdminUserId, admin.id);
        assert.equal(settings.dailyReports[0].enabled, false);
        for (const range of ['2weeks', '4weeks', '6weeks', '8weeks', '10weeks', '12weeks'])
            assert.equal(db.updateNotificationSettings(admin.id, shul.id, { reportRange: range }).reportRange, range);
    } finally { db.close(); }
});

test('worker uses the selected schedule and passes the selected window to the report builder', async t => {
    const state = fixture(t);
    state.db.updateNotificationSettings(state.admin.id, state.shul.id, { reportTime: '15:30', reportDays: [4], reportRange: '2weeks' });
    let now = new Date('2026-10-27T20:00:00Z'); // Tuesday: no report.
    const windows = [];
    const service = createNotificationService({ database: state.db, mailer: { enabled: false }, clock: () => now,
        roundupBuilder(_db, _id, _now, _zone, range) { windows.push(range); return 'Two week report'; } });
    await service.tick();
    assert.deepEqual(windows, []);
    now = new Date('2026-10-29T19:29:00Z');
    await service.tick();
    assert.deepEqual(windows, []);
    now = new Date('2026-10-29T19:30:00Z');
    await service.tick();
    await service.tick();
    assert.deepEqual(windows, ['2weeks']);
    assert.equal(state.db.listUserMessages(state.admin.id).length, 1);
    for (const input of [{ reportTime: '25:00' }, { reportDays: [7] }, { reportRange: '1year' }])
        assert.throws(() => state.db.updateNotificationSettings(state.admin.id, state.shul.id, input), TypeError);
});

test('Sunday-only summaries run on Sunday once and skip unselected days', async t => {
    const state = fixture(t);
    state.db.updateNotificationSettings(state.admin.id, state.shul.id, { reportDays: [0], reportTime: '15:30' });
    let now = new Date('2026-10-31T20:00:00Z');
    let builds = 0;
    const service = createNotificationService({ database: state.db, mailer: { enabled: false }, clock: () => now,
        roundupBuilder() { builds++; return 'Sunday summary'; } });
    await service.tick();
    assert.equal(builds, 0);
    now = new Date('2026-11-01T20:29:00Z');
    await service.tick();
    assert.equal(builds, 0);
    now = new Date('2026-11-01T20:30:00Z');
    await service.tick();
    await service.tick();
    assert.equal(builds, 1);
    assert.equal(state.db.listUserMessages(state.admin.id).length, 1);
    now = new Date('2026-11-02T21:00:00Z');
    await service.tick();
    assert.equal(builds, 1);
});

test('roundups run once per admin at 4 PM local, catch up the same day, and create inbox messages without email', async t => {
    const state = fixture(t);
    state.db.updateNotificationSettings(state.admin.id, state.shul.id, { timezone: 'America/Los_Angeles', reportDays: [2] });
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
    now = new Date('2026-11-04T01:00:00Z'); // Next scheduled Tuesday, after the delivery time.
    await service.tick();
    assert.equal(state.db.listUserMessages(state.admin.id).length, 2);
});

test('Shabbat email pause follows local Friday and Saturday boundaries, including DST changes', () => {
    for (const [start, end] of [
        ['2026-10-30T04:00:00Z', '2026-11-01T04:00:00Z'],
        ['2026-11-06T05:00:00Z', '2026-11-08T05:00:00Z'],
    ]) {
        const beginning = new Date(start);
        const ending = new Date(end);
        assert.equal(isShabbatDeliveryPaused(new Date(beginning.getTime() - 1), 'America/New_York'), false);
        assert.equal(isShabbatDeliveryPaused(beginning, 'America/New_York'), true);
        assert.equal(isShabbatDeliveryPaused(new Date(ending.getTime() - 1), 'America/New_York'), true);
        assert.equal(isShabbatDeliveryPaused(ending, 'America/New_York'), false);
    }
    const now = new Date('2026-11-08T04:59:00Z');
    assert.equal(isShabbatDeliveryPaused(now, 'America/New_York'), true, 'Still Saturday locally');
    assert.equal(isShabbatDeliveryPaused(now, 'Asia/Jerusalem'), false, 'Already Sunday locally');
});

test('confirmations, instant alerts, and Friday summaries stay queued until Sunday and deliver once', async t => {
    const state = fixture(t);
    state.db.updateNotificationSettings(state.admin.id, state.shul.id, { reportDays: [5], instantAdminUserId: state.admin.id });
    let now = new Date('2026-11-06T22:00:00Z');
    assert.equal(book(state, { now }).emailConfirmation.status, 'queued');
    const mailer = fakeMailer();
    const service = createNotificationService({ database: state.db, mailer, clock: () => now, roundupBuilder: () => 'Friday summary' });
    await service.tick();
    assert.equal(mailer.calls.length, 0);
    assert.equal(state.db.listUserMessages(state.member.id).length, 1, 'Registration confirmation is available immediately');
    assert.equal(state.db.listUserMessages(state.admin.id).length, 2, 'Instant alert and scheduled summary reach the inbox');
    now = new Date('2026-11-08T04:59:59Z');
    await service.tick();
    assert.equal(mailer.calls.length, 0);
    now = new Date('2026-11-08T05:00:00Z');
    await service.tick();
    assert.equal(mailer.calls.length, 4, 'Confirmation, alert, and both admin summaries resume');
    assert.equal(mailer.calls.filter(call => call.text === 'Friday summary').length, 2);
    await service.tick();
    assert.equal(mailer.calls.length, 4, 'Deferred emails are sent only once');
});

test('paused emails neither block another timezone nor reserve its delivery quota', async t => {
    const state = fixture(t);
    const other = state.db.createShul({ name: 'Jerusalem Shul', settings: { hebYear: 5787 } });
    const otherAdmin = state.make('JerusalemAdmin', 'admin', other.id);
    state.db.updateNotificationSettings(otherAdmin.id, other.id, { timezone: 'Asia/Jerusalem' });
    for (let i = 0; i < 99; i++) state.make(`JerusalemAdmin${i}`, 'admin', other.id);
    const now = new Date('2026-11-08T04:59:00Z');
    book(state, { now }); // First queued job belongs to a shul still on Saturday.
    state.db.recordDailyRoundup(other.id, '2026-11-08', 'Sunday summary', { now, emailEnabled: true });
    const mailer = fakeMailer();
    const service = createNotificationService({ database: state.db, mailer, clock: () => now });
    await service.tick();
    assert.equal(mailer.calls.length, 100, 'All 100 delivery slots remain available to the unpaused shul');
    assert.ok(mailer.calls.every(call => call.text === 'Sunday summary'));
    const resumed = state.db.claimNotificationEmail(new Date('2026-11-09T05:00:00Z'));
    assert.equal(resumed.to, state.member.email, 'Paused confirmation remained queued across workers and quota resets');
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

test('daily report switches control inbox and email delivery without changing instant alerts', async t => {
    const state = fixture(t);
    const now = new Date('2026-10-27T20:00:00Z');
    assert.ok(state.db.getNotificationSettings(state.shul.id).dailyReports.every(preference => preference.enabled));
    state.db.updateNotificationSettings(state.admin.id, state.shul.id, {
        reportDays: [2], instantAdminUserId: state.admin2.id, dailyReports: [{ userId: state.admin2.id, enabled: false }],
    });
    const mailer = fakeMailer();
    const service = createNotificationService({ database: state.db, mailer, clock: () => now, roundupBuilder: () => 'Daily report' });
    await service.tick();
    assert.equal(state.db.listUserMessages(state.admin.id).length, 1);
    assert.deepEqual(state.db.listUserMessages(state.admin2.id), []);
    assert.deepEqual(mailer.calls.map(call => call.to), [state.admin.email]);
    book(state, { now, emailConfirmation: false });
    await service.tick();
    assert.equal(state.db.listUserMessages(state.admin2.id)[0].subject, 'New reading registration');
    assert.equal(mailer.calls.at(-1).to, state.admin2.email);
    state.db.updateNotificationSettings(state.admin.id, state.shul.id, { dailyReports: [{ userId: state.admin2.id, enabled: true }] });
    await service.tick();
    assert.equal(state.db.listUserMessages(state.admin2.id).length, 2);
    assert.equal(mailer.calls.filter(call => call.to === state.admin2.email).length, 2);
    await service.tick();
    assert.equal(mailer.calls.length, 3, 'Turning on a report must not duplicate it for the same day');
});

test('opting out skips already queued roundup emails and preferences reject invalid recipients', async t => {
    const state = fixture(t);
    const now = new Date('2026-10-27T19:00:00Z');
    state.db.recordDailyRoundup(state.shul.id, '2026-10-27', 'Already queued report', { now, emailEnabled: true });
    state.db.updateNotificationSettings(state.admin.id, state.shul.id, { dailyReports: [{ userId: state.admin2.id, enabled: false }] });
    const mailer = fakeMailer();
    await createNotificationService({ database: state.db, mailer, clock: () => now }).tick();
    assert.deepEqual(mailer.calls.map(call => call.to), [state.admin.email]);
    assert.equal(state.db.listUserMessages(state.admin2.id).length, 1, 'Past inbox reports are retained');
    assert.throws(() => state.db.updateNotificationSettings(state.admin.id, state.shul.id, { dailyReports: [{ userId: state.member.id, enabled: true }] }), TypeError);
    assert.throws(() => state.db.updateNotificationSettings(state.admin.id, state.shul.id, { dailyReports: [{ userId: state.admin.id, enabled: 'yes' }] }), TypeError);
    assert.throws(() => state.db.updateNotificationSettings(state.member.id, state.shul.id, { dailyReports: [] }), error => error.status === 403);
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

test('roundup groups all registrations into one paragraph before the open-readings summary', t => {
    const state = fixture(t);
    const now = new Date('2026-10-27T19:00:00Z');
    const [reading, nextReading] = getShulSchedule(state.db, state.shul.id).filter(item => item.dateString >= '2026-10-27' && item.dateString <= '2027-01-27' && item.psukim[0] && item.psukim[0] !== 'null');
    state.db.registerReading(state.shul.id, { dateString: reading.dateString, desc: reading.desc, aliyah: 1, readerId: state.member.id }, () => {});
    const guest = state.make('Visitor', 'guest');
    state.db.registerReading(state.shul.id, { dateString: nextReading.dateString, desc: nextReading.desc, aliyah: 1, readerId: guest.id }, () => {});
    const report = buildReadingRoundup(state.db, state.shul.id, now, 'America/New_York');
    assert.ok(report.includes(`${formatCommunicationDate(reading.dateString)} · ${reading.desc} · Aliyah 1: Member Test`));
    assert.ok(report.includes(reading.psukim[0]));
    assert.match(report, /\d+ open \([\d, ]+\)/);
    assert.ok(report.includes('Tuesday, January 19, 2027'));
    const [header, registered, open] = report.split('\n\n');
    assert.ok(header.includes('2 registrations'));
    assert.ok(registered.startsWith('Registered readings: '));
    assert.ok(registered.includes('Member Test'));
    assert.ok(registered.includes('Visitor Test (guest)'));
    assert.ok(registered.includes(nextReading.desc));
    assert.ok(registered.includes('; '));
    assert.ok(!registered.includes('\n'));
    assert.ok(!registered.includes(' open ('));
    assert.ok(open.startsWith('Open readings: '));
    assert.ok(!open.includes('Member Test'));
    assert.ok(!open.includes('\n'));
    assert.equal(report.split('\n\n').length, 3);
});

test('roundup handles empty registered and open sections explicitly', t => {
    const state = fixture(t);
    const now = new Date('2026-10-27T19:00:00Z');
    let report = buildReadingRoundup(state.db, state.shul.id, now, 'America/New_York', '2weeks');
    assert.ok(report.includes('Registered readings: None in this date range.\n\nOpen readings: '));
    const range = reportWindow(now, 'America/New_York', '2weeks');
    const readings = getShulSchedule(state.db, state.shul.id)
        .filter(reading => reading.dateString >= range.start && reading.dateString <= range.end);
    state.db.setReadingLocks(state.shul.id, readings.map(({ dateString, desc }) => ({ dateString, desc, locked: true })));
    report = buildReadingRoundup(state.db, state.shul.id, now, 'America/New_York', '2weeks');
    assert.ok(report.includes('0 registrations · 0 vacancies'));
    assert.ok(report.endsWith('Registered readings: None in this date range.\n\nOpen readings: None in this date range.'));
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
    assert.deepEqual(policy.reportDays, [0]);
    assert.equal((await request(`/api/shuls/${state.shul.id}/notifications`)).status, 401);
    assert.equal((await request(`/api/shuls/${state.shul.id}/notifications`, memberCookie, { timezone: 'UTC' })).status, 403);
    assert.equal((await request(`/api/shuls/${state.shul.id}/notifications`, adminCookie, { timezone: 'invalid/timezone' })).status, 400);
    assert.equal((await request(`/api/shuls/${state.shul.id}/notifications`, adminCookie, { instantAdminUserId: state.member.id })).status, 400);
    assert.equal((await request(`/api/shuls/${state.shul.id}/notifications`, adminCookie, { timezone: 'Asia/Jerusalem', instantAdminUserId: state.admin2.id })).status, 200);
    assert.equal((await request(`/api/shuls/${state.shul.id}/notifications`, adminCookie, { dailyReports: [{ userId: state.admin2.id, enabled: false }] })).status, 200);
    assert.equal((await request(`/api/shuls/${state.shul.id}/notifications`, adminCookie, { reportDays: [6] })).status, 200);
    assert.deepEqual((await (await request(`/api/shuls/${state.shul.id}/notifications`, adminCookie)).json()).reportDays, [6]);
    assert.equal((await request(`/api/shuls/${state.shul.id}/notifications`, adminCookie, { reportDays: [] })).status, 400);
    assert.deepEqual((await (await request(`/api/shuls/${state.shul.id}/notification-policy`)).json()).reportDays, [6]);
    assert.equal((await (await request(`/api/shuls/${state.shul.id}/notifications`, adminCookie)).json()).dailyReports.find(preference => preference.userId === state.admin2.id).enabled, false);
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
    const quotaPath = `${base}/api/shuls/${state.shul.id}/confirmation-email-quota`;
    const checkQuota = (body, auth) => fetch(quotaPath, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Cookie: auth } : {}) },
        body: JSON.stringify(body),
    });
    let quotaResponse = await checkQuota({ registrationType: 'profile' }, memberCookie);
    assert.equal(quotaResponse.status, 200);
    assert.equal(quotaResponse.headers.get('cache-control'), 'no-store');
    assert.equal((await quotaResponse.json()).remaining, 4);
    quotaResponse = await checkQuota({ registrationType: 'guest' }, memberCookie);
    assert.equal((await quotaResponse.json()).remaining, 4, 'Member guest bookings use the same allowance');
    for (let i = 0; i < 4; i++) book(state, { now: new Date() });
    assert.equal((await (await checkQuota({ registrationType: 'profile' }, memberCookie)).json()).remaining, 0);
    assert.equal((await (await checkQuota({ registrationType: 'profile' }, adminCookie)).json()).remaining, 5);
    assert.equal((await checkQuota({ registrationType: 'profile' })).status, 401);
    assert.equal((await checkQuota({ registrationType: 'profile', userId: state.member.id }, adminCookie)).status, 400);
    assert.equal((await checkQuota({ registrationType: 'guest', guestEmail: 'bad-email' })).status, 400);
    const guestEmail = 'quota-guest@example.com';
    assert.equal((await (await checkQuota({ registrationType: 'guest', guestEmail })).json()).remaining, 1);
    book(state, { now: new Date(), readerId: undefined,
        guest: { title: 'Mr.', firstName: 'Quota', lastName: 'Guest', email: guestEmail } });
    assert.equal((await (await checkQuota({ registrationType: 'guest', guestEmail: guestEmail.toUpperCase() })).json()).remaining, 0);
});
