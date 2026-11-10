import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../backend/database/index.mjs';
import { createApp } from '../backend/app.mjs';

const input = { name: 'Dinner', date: '2026-12-04', time: '18:30', location: 'Hall',
    registrationLink: 'https://example.com/register?event=dinner', details: '' };
function fixture(db) {
    const shul = db.createShul({ name: 'Click Shul', donationUrl: 'https://example.com/donate', settings: { hebYear: 5787 } });
    const admin = db.createUser({ shulId: shul.id, firstName: 'Admin', lastName: 'Test', email: 'admin@example.com', role: 'admin' });
    const event = db.createShulEvent(shul.id, admin.id, input);
    return { shul, admin, event };
}

test('upgrading an existing event database preserves events and starts counters at zero', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-link-migration-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'events.sqlite');
    let db = openDatabase(path);
    const { shul, admin, event } = fixture(db);
    db.close();
    const legacy = new DatabaseSync(path);
    legacy.exec('ALTER TABLE shul_events DROP COLUMN registration_clicks');
    legacy.exec('DROP TABLE shul_link_clicks');
    legacy.exec('DELETE FROM schema_migrations WHERE version = 33');
    legacy.close();
    db = openDatabase(path);
    try {
        assert.deepEqual(db.listShulEvents(shul.id), [event]);
        assert.equal(db.getShulLinkAnalytics(shul.id, admin.id, '2026-12-01').eventRegistrationByEvent[event.id], 0);
        db.eventRegistrationDestination(shul.id, event.id);
        assert.equal(db.getShulLinkAnalytics(shul.id, admin.id, '2026-12-01').eventRegistrationClicks, 1);
    } finally { db.close(); }
});

test('persistent shul and event counts survive edits, reopening, and event deletion', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-link-analytics-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'clicks.sqlite');
    let db = openDatabase(path);
    const { shul, admin, event } = fixture(db);
    const stats = () => db.getShulLinkAnalytics(shul.id, admin.id, '2026-12-04');
    assert.deepEqual(stats(), { currentEventCount: 1, eventRegistrationClicks: 0, donationClicks: 0, eventRegistrationByEvent: { [event.id]: 0 } });
    db.createShulEvent(shul.id, admin.id, { ...input, date: '2026-12-03' });
    db.createShulEvent(shul.id, admin.id, { ...input, date: '2026-12-05' });
    assert.equal(stats().currentEventCount, 2, 'Includes today and future events, excludes past events');
    assert.equal(db.eventRegistrationDestination(shul.id, event.id), input.registrationLink);
    db.eventRegistrationDestination(shul.id, event.id);
    assert.equal(db.donationDestination(shul.id), shul.donationUrl);
    db.updateShulEvent(shul.id, admin.id, event.id, { ...input, name: 'Renamed' });
    assert.equal(stats().eventRegistrationByEvent[event.id], 2);
    db.close();
    db = openDatabase(path);
    try {
        assert.equal(stats().donationClicks, 1);
        assert.equal(stats().eventRegistrationClicks, 2);
        assert.equal(stats().eventRegistrationByEvent[event.id], 2);
        db.deleteShulEvent(shul.id, admin.id, event.id);
        assert.equal(stats().eventRegistrationClicks, 0, 'Deleted events are excluded from the current event total');
        assert.equal(stats().eventRegistrationByEvent[event.id], undefined);
        assert.throws(() => db.eventRegistrationDestination(shul.id, event.id), error => error.status === 404);
        assert.equal(stats().eventRegistrationClicks, 0, 'Unavailable links do not increment totals');
    } finally { db.close(); }
});

test('registration click total includes only current events while retaining past per-event counts', t => {
    const db = openDatabase(':memory:');
    t.after(() => db.close());
    const { shul, admin, event } = fixture(db);
    const past = db.createShulEvent(shul.id, admin.id, { ...input, date: '2026-12-03' });
    const future = db.createShulEvent(shul.id, admin.id, { ...input, date: '2026-12-05' });
    for (const item of [past, event, future]) db.eventRegistrationDestination(shul.id, item.id);
    const stats = db.getShulLinkAnalytics(shul.id, admin.id, '2026-12-04');
    assert.equal(stats.currentEventCount, 2);
    assert.equal(stats.eventRegistrationClicks, 2);
    assert.equal(stats.eventRegistrationByEvent[past.id], 1);
    assert.equal(db.getShulLinkAnalytics(shul.id, admin.id, '2026-12-05').eventRegistrationClicks, 1);
    assert.equal(db.getShulLinkAnalytics(shul.id, admin.id, '2026-12-06').eventRegistrationClicks, 0);
});

test('public tracked redirects count GET opens, skip HEAD/prefetch, and keep analytics private', async t => {
    const db = openDatabase(':memory:');
    const { shul, admin, event } = fixture(db);
    const member = db.createUser({ shulId: shul.id, firstName: 'Member', lastName: 'Test', email: 'member@example.com' });
    const other = db.createShul({ name: 'Other', settings: { hebYear: 5787 } });
    const otherEvent = db.createShulEvent(other.id, db.createUser({ shulId: other.id, firstName: 'Other', lastName: 'Admin', email: 'other@example.com', role: 'admin' }).id, input);
    const server = createApp(db, { development: true, devUserId: member.id, preview: false }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
    const base = `http://127.0.0.1:${server.address().port}/api/shuls/${shul.id}`;
    const follow = (suffix, options = {}) => fetch(base + suffix, { redirect: 'manual', ...options });
    const eventPath = `/events/${event.id}/register`;
    const response = await follow(eventPath, { headers: { Cookie: 'gabbai_session=' } });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), input.registrationLink);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await follow(eventPath, { method: 'HEAD' })).status, 302);
    await follow(eventPath, { headers: { 'Sec-Purpose': 'prefetch' } });
    await follow(eventPath, { headers: { Purpose: 'prefetch' } });
    assert.equal((await follow('/donate')).headers.get('location'), shul.donationUrl);
    assert.equal((await follow(`/events/${otherEvent.id}/register`)).status, 404);
    assert.equal((await follow('/analytics/links', { headers: { Cookie: 'gabbai_session=' } })).status, 401);
    assert.equal((await follow('/analytics/links')).status, 403);
    db.updateUser(member.id, { role: 'admin' });
    const statsResponse = await follow('/analytics/links');
    assert.equal(statsResponse.status, 200);
    assert.equal(statsResponse.headers.get('cache-control'), 'no-store');
    const stats = await statsResponse.json();
    assert.equal(stats.eventRegistrationClicks, 1);
    assert.equal(stats.donationClicks, 1);
    assert.equal(stats.eventRegistrationByEvent[event.id], 1);
    assert.equal((await fetch(base.replace(shul.id, other.id) + '/analytics/links')).status, 403);
    assert.throws(() => db.getShulLinkAnalytics(other.id, admin.id, '2026-12-01'), error => error.status === 403);
    assert.deepEqual(await (await follow('/events')).json(), [event], 'Public event data does not expose private counters');
    db.updateShul(shul.id, { donationUrl: '' });
    assert.equal((await follow('/donate')).status, 404);
    db.updateShulEvent(shul.id, admin.id, event.id, { ...input, registrationLink: '' });
    assert.equal((await follow(eventPath)).status, 404);
    assert.equal(db.getShulLinkAnalytics(shul.id, admin.id, '2026-12-01').donationClicks, 1);
});
