import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { monthBounds, monthlyEngagement, previousMonth } from '../core/monthlyEngagement.mts';
import { compareEngagementMonths } from '../backend/analytics.mjs';
import { openDatabase } from '../backend/database/index.mjs';
import { createApp } from '../backend/app.mjs';

const reader = { id: 'reader', role: 'member' }, guest = { id: 'guest', role: 'guest' };
const reading = (dateString, readers = [reader, null, null, guest]) => ({ dateString, desc: 'Reading',
    psukim: ['Genesis 1:1-3', 'Genesis 1:4-6', 'Genesis 1:7-9', 'null'], readers,
    locked: false, lockedArr: [true, false, true, false] });

test('calendar month defaults cross January correctly and month boundaries handle leap years', () => {
    assert.equal(previousMonth('2026-11'), '2026-10');
    assert.equal(previousMonth('2026-01'), '2025-12');
    assert.deepEqual(monthBounds('2024-02'), { start: '2024-02-01', end: '2024-03-01', last: '2024-02-29' });
    for (const month of ['2026-00', '2026-13', '2026-1', '0000-01', '', undefined, ['2026-01']]) {
        assert.throws(() => monthBounds(month), TypeError);
    }
});

test('monthly engagement groups saved assignments by reading month, counts distinct guests, and excludes locked vacancies', () => {
    const schedule = [reading('2024-01-31'), reading('2024-02-01', [reader, guest, null]),
        reading('2024-02-29', [reader, reader, null]), reading('2024-03-01')];
    const stats = monthlyEngagement([...schedule, schedule[1]], '2024-02');
    assert.equal(stats.readings, 2, 'Repeated schedule records are counted only once');
    assert.equal(stats.assigned, 4);
    assert.equal(stats.readers, 2);
    assert.equal(stats.guestReaders, 1);
    assert.equal(stats.locked, 2);
    assert.equal(stats.open, 0);
    assert.equal(stats.coverage, 100);
    assert.equal(monthlyEngagement(schedule, '2023-02').coverage, null);
    const emptyLocked = { ...reading('2024-02-01'), readers: [], locked: true };
    assert.equal(monthlyEngagement([emptyLocked], '2024-02').coverage, null);
});

test('comparisons fetch both Hebrew years when a Gregorian month crosses Rosh Hashana and share year loads', () => {
    const loaded = [];
    const result = compareEngagementMonths('2026-09', '2026-10', year => {
        loaded.push(year);
        return year === 5786 ? [reading('2026-09-01')] : [reading('2026-09-30'), reading('2026-10-01')];
    });
    assert.deepEqual(loaded, [5786, 5787]);
    assert.equal(result.first.assigned, 2);
    assert.equal(result.second.assigned, 1);
    assert.equal(result.first.month, '2026-09');
    const same = compareEngagementMonths('2026-11', '2026-11', () => [reading('2026-11-01')]);
    assert.deepEqual(same.first, same.second);
});

test('monthly comparison API requires the owning admin and returns actual saved assignments', async t => {
    const db = openDatabase(':memory:');
    const shul = db.createShul({ name: 'Monthly Shul', settings: { hebYear: 5787 } });
    const user = db.createUser({ shulId: shul.id, firstName: 'Reader', lastName: 'Test', email: 'reader@example.com' });
    db.registerReading(shul.id, { dateString: '2026-11-14', desc: 'Toldot', aliyah: 1, readerId: user.id }, () => {});
    const app = createApp(db, { development: true, devUserId: user.id, preview: false });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
    const url = `http://127.0.0.1:${server.address().port}/api/shuls/${shul.id}/analytics/monthly`;
    const query = '?first=2026-11&second=2026-10';
    assert.equal((await fetch(url + query, { headers: { Cookie: 'gabbai_session=' } })).status, 401);
    assert.equal((await fetch(url + query)).status, 403);
    db.updateUser(user.id, { role: 'admin' });
    assert.equal((await fetch(url + '?first=2026-13&second=2026-10')).status, 400);
    const response = await fetch(url + query);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const stats = await response.json();
    assert.equal(stats.first.assigned, 1);
    assert.equal(stats.first.readers, 1);
    assert.equal(stats.second.assigned, 0);
    assert.ok(stats.first.open > 0);
    const other = db.createShul({ name: 'Other', settings: { hebYear: 5787 } });
    assert.equal((await fetch(url.replace(shul.id, other.id) + query)).status, 403);
});
