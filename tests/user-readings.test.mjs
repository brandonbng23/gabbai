import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectUserReadings } from '../frontend/src/userReadings.ts';

const readings = [
    { dateString: '2026-10-24', desc: 'Tomorrow', aliyah: 2 },
    { dateString: '2026-10-22', desc: 'Yesterday', aliyah: 1 },
    { dateString: '2026-10-23', desc: 'Today', aliyah: 1 },
    { dateString: '2026-10-20', desc: 'Earlier', aliyah: 1 },
    { dateString: '2026-10-24', desc: 'Tomorrow', aliyah: 1 },
];

test('upcoming readings include today and sort by date and aliyah', () => {
    assert.deepEqual(selectUserReadings(readings, 'upcoming', '2026-10-23'), [readings[2], readings[4], readings[0]]);
});

test('completed readings exclude today and show the most recent first', () => {
    assert.deepEqual(selectUserReadings(readings, 'completed', '2026-10-23'), [readings[1], readings[3]]);
});

test('all readings retain their data and filtering does not reorder the original array', () => {
    const snapshot = structuredClone(readings);
    assert.equal(selectUserReadings(readings, 'all', '2026-10-23').length, 5);
    assert.deepEqual(readings, snapshot);
    assert.deepEqual(selectUserReadings([], 'upcoming', '2026-10-23'), []);
});
