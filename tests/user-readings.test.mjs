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

test('reading-name search is case insensitive, trims whitespace, and combines with date filters', () => {
    assert.deepEqual(selectUserReadings(readings, 'all', '2026-10-23', ' TOMORROW '), [readings[4], readings[0]]);
    assert.deepEqual(selectUserReadings(readings, 'completed', '2026-10-23', 'tomorrow'), []);
    assert.deepEqual(selectUserReadings(readings, 'all', '2026-10-23', 'missing'), []);
});

test('guest filter selects only guest bookings while All includes profile and guest readings', () => {
    const guest = { ...readings[0], registrationType: 'guest', shulId: 'guest-shul' };
    const combined = [...readings, guest];
    assert.deepEqual(selectUserReadings(combined, 'guest', '2026-10-23'), [guest]);
    assert.equal(selectUserReadings(combined, 'all', '2026-10-23').length, 6);
    assert.deepEqual(selectUserReadings(combined, 'guest', '2026-10-23', 'yesterday'), []);
    assert.equal(readings.length, 5, 'Guest bookings are never added to profile assignments');
});
