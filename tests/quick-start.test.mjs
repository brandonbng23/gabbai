import test from 'node:test';
import assert from 'node:assert/strict';
import { availableAliyot, upcomingAvailableReadings } from '../frontend/src/quickStartReadings.ts';

const reading = (dateString, overrides = {}) => ({ dateString, desc: dateString,
    psukim: ['Genesis 1:1-3', 'Genesis 1:4-6', 'null', ''], readers: [null, null, null, null],
    locked: false, lockedArr: [false, false, false, false], ...overrides });

test('Quick Start only counts unassigned, unlocked slots with a real passage', () => {
    assert.deepEqual(availableAliyot(reading('2026-10-31', { readers: [{ id: 'reader' }, null] })), [2]);
    assert.deepEqual(availableAliyot(reading('2026-10-31', { lockedArr: [true, false] })), [2]);
    assert.deepEqual(availableAliyot(reading('2026-10-31', { locked: true })), []);
});

test('Quick Start selects the three nearest open readings, includes today, and leaves the schedule order intact', () => {
    const input = [reading('2026-11-21'), reading('2026-10-28'), reading('2026-10-31', { locked: true }),
        reading('2026-11-14'), reading('2026-11-07'), reading('2026-10-29'), reading('2026-10-30', { readers: [{}, {}] })];
    const original = [...input];
    assert.deepEqual(upcomingAvailableReadings(input, '2026-10-29').map(item => item.dateString), ['2026-10-29', '2026-11-07', '2026-11-14']);
    assert.deepEqual(input, original);
});

test('Quick Start returns only available matches when fewer than three exist', () => {
    assert.equal(upcomingAvailableReadings([reading('2026-10-31')], '2026-10-29').length, 1);
    assert.deepEqual(upcomingAvailableReadings([reading('2026-10-28'), reading('2026-10-31', { locked: true })], '2026-10-29'), []);
});
