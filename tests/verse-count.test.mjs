import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countVerses } from '../core/verseCount.mts';
import { openDatabase } from '../backend/database/index.mjs';
import { getAssignedReadingDetails, getShulSchedule } from '../backend/schedule.mjs';

test('verse counts include both endpoints and actual chapter lengths', () => {
    assert.equal(countVerses('Numbers 28:9-28:15'), 7);
    assert.equal(countVerses('Numbers 28:9-15'), 7);
    assert.equal(countVerses('Genesis 1:31-2:3'), 4);
    assert.equal(countVerses('Genesis 1:31-3:2'), 28);
    assert.equal(countVerses('Genesis 2:3'), 1);
    assert.equal(countVerses('Genesis 1:1-6:8'), 146);
    assert.equal(countVerses('Genesis 1:31 – 2:3'), 4);
});

test('separate passages inherit the book or specify a different book', () => {
    assert.equal(countVerses('Joshua 3:5-3:7; 5:2-6:1; 6:27'), 19);
    assert.equal(countVerses('Hosea 14:2-14:10; Micah 7:18-7:20; Joel 2:15-2:27'), 25);
    assert.equal(countVerses('Ezekiel 1:1-28; 3:12'), 29);
});

test('absent, invalid, reversed and out-of-bounds references have unknown counts', () => {
    for (const reference of [undefined, null, '', 'null', 'ref', 'Genesis 5:25:6:8',
        'Genesis 1:32-2:3', 'Genesis 0:1-1:1', 'Genesis 2:0-2:3', 'Genesis 2:3-2:1',
        'Genesis 3:1-2:3', 'Genesis 50:1-51:1', 'Fake 1:1-1:3', '1:1-1:3',
        'Genesis 1:1-1:3; invalid']) {
        assert.equal(countVerses(reference), null, String(reference));
    }
});

test('assigned verse details resolve the assignment year and respect aliyah-count overrides', t => {
    const db = openDatabase(':memory:');
    t.after(() => db.close());
    const shul = db.createShul({ name: 'Verse counts', settings: { hebYear: 5788, a: 3, triennial: { tri: false } } });
    const user = db.createUser({ shulId: shul.id, firstName: 'Test', lastName: 'Reader', email: 'verses@example.com' });
    const reading = getShulSchedule(db, shul.id, 5787).find(item => item.desc === 'Bereshit');
    const assignment = { dateString: reading.dateString, desc: reading.desc, aliyah: 3 };
    db.setReadingLocks(shul.id, [{ ...assignment, readerId: user.id }]);
    let details = getAssignedReadingDetails(db, db.getUser(user.id));
    assert.deepEqual(details, [{ ...assignment, psukim: reading.psukim[2], verseCount: reading.verseCounts[2] }]);
    assert.ok(details[0].verseCount > 0);
    db.setReadingLocks(shul.id, [{ dateString: reading.dateString, desc: reading.desc, aliyahCount: 2 }]);
    const combined = getShulSchedule(db, shul.id, 5787).find(item => item.desc === reading.desc);
    assert.equal(combined.verseCounts[0], 34);
    assert.equal(combined.verseCounts[2], null);
    details = getAssignedReadingDetails(db, db.getUser(user.id));
    assert.equal(details[0].verseCount, null);
    assert.equal(details[0].psukim, null);
    db.setReadingLocks(shul.id, [{ dateString: reading.dateString, desc: reading.desc, aliyahCount: 3 }]);
    db.updateShulSettings(shul.id, { triennial: { tri: true } });
    const triennial = getAssignedReadingDetails(db, db.getUser(user.id));
    assert.equal(triennial[0].psukim, 'Genesis 2:20-2:25');
    assert.equal(triennial[0].verseCount, 6);
    const missing = getAssignedReadingDetails(db, { ...user, assignedReadings: [{ ...assignment, desc: 'Missing' }] });
    assert.deepEqual(missing, [{ ...assignment, desc: 'Missing', psukim: null, verseCount: null }]);
});
