import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasStarredAliyah } from '../frontend/src/scheduleFilters.ts';

const reading = { dateString: '2026-10-10', desc: 'Bereshit', psukim: ['Genesis 1:1-1:5', 'Genesis 1:6-1:8', 'null'] };
const star = { shulId: 'my-shul', shulName: 'My Shul', dateString: reading.dateString, desc: reading.desc, aliyah: 2 };

test('a parsha matches when any of its visible aliyot is starred', () => {
    const snapshot = structuredClone(reading);
    assert.equal(hasStarredAliyah(reading, [star], 'my-shul'), true);
    assert.equal(hasStarredAliyah(reading, [star, { ...star, aliyah: 1 }], 'my-shul'), true);
    assert.deepEqual(reading, snapshot, 'Matching keeps every aliyah on the parsha card');
    assert.equal(hasStarredAliyah(reading, [], 'my-shul'), false, 'Unstarring the final aliyah removes the match');
    assert.equal(hasStarredAliyah(reading, undefined, 'my-shul'), false);
});

test('starred filtering distinguishes the shul, date, and reading name', () => {
    for (const patch of [{ shulId: 'another-shul' }, { dateString: '2027-10-30' }, { desc: 'Noach' }])
        assert.equal(hasStarredAliyah(reading, [{ ...star, ...patch }], 'my-shul'), false);
    assert.equal(hasStarredAliyah(reading, [star]), false);
});

test('hidden or missing aliyot do not keep a parsha in starred results', () => {
    for (const aliyah of [0, 3, 4, 10, 1.5])
        assert.equal(hasStarredAliyah(reading, [{ ...star, aliyah }], 'my-shul'), false);
    for (const passage of ['', '   ', 'null'])
        assert.equal(hasStarredAliyah({ ...reading, psukim: [passage] }, [{ ...star, aliyah: 1 }], 'my-shul'), false);
});
