import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shulAnalytics, readingCoverage } from '../frontend/src/shulAnalytics.ts';

const reading = (dateString, overrides = {}) => ({ dateString, desc: 'Vayeshev',
    psukim: ['Genesis 1:1-3', 'Genesis 1:4-6', 'Genesis 1:7-9', 'null', ''],
    readers: [{ id: 'reader' }, null, null, { id: 'hidden-reader' }], locked: false,
    lockedArr: [true, false, true, false, false], ...overrides });

test('coverage counts assigned locked slots, excludes hidden slots, and separates open and locked vacancies', () => {
    const counts = readingCoverage(reading('2026-11-10'));
    assert.equal(counts.assigned, 1);
    assert.equal(counts.open, 1);
    assert.equal(counts.locked, 1);
    assert.deepEqual([...counts.readerIds], ['reader']);
    const wholeLocked = readingCoverage(reading('2026-11-10', { locked: true }));
    assert.equal(wholeLocked.assigned, 1);
    assert.equal(wholeLocked.open, 0);
    assert.equal(wholeLocked.locked, 2);
});

test('analytics includes today, excludes the end boundary and history, and counts distinct scheduled readers', () => {
    const schedule = [reading('2026-11-24'), reading('2026-11-09'), reading('2026-11-10'), reading('2026-11-17')];
    const original = [...schedule];
    const stats = shulAnalytics(schedule, '2026-11-10', 2);
    assert.equal(stats.readingCount, 2);
    assert.equal(stats.readerCount, 1);
    assert.equal(stats.coverage, 50);
    assert.equal(stats.assigned, 2);
    assert.equal(stats.open, 2);
    assert.equal(stats.locked, 2);
    assert.deepEqual(stats.buckets.map(bucket => bucket.assigned), [1, 1]);
    assert.deepEqual(stats.attention.map(item => item.reading.dateString), ['2026-11-10', '2026-11-17']);
    assert.deepEqual(schedule, original);
});

test('empty or fully locked schedules do not report misleading coverage and date windows cross years', () => {
    const empty = shulAnalytics([], '2026-12-29', 2);
    assert.equal(empty.end, '2027-01-12');
    assert.equal(empty.coverage, null);
    assert.equal(empty.readerCount, 0);
    const locked = shulAnalytics([reading('2027-01-01', { readers: [], locked: true })], '2026-12-29', 2);
    assert.equal(locked.coverage, null);
    assert.equal(locked.locked, 3);
    assert.deepEqual(locked.attention, []);
});

test('named participation groups each reader’s real aliyot by reading and excludes out-of-range assignments', () => {
    const member = { id: 'member', firstName: 'Sarah', lastName: 'Cohen', role: 'member' };
    const guest = { id: 'guest', firstName: 'David', lastName: 'Levy', role: 'guest' };
    const input = [
        reading('2026-11-17', { readers: [member, guest, null, guest] }),
        reading('2026-11-10', { readers: [member, member, guest], locked: true }),
        reading('2026-11-09', { readers: [guest] }),
        reading('2026-11-24', { readers: [guest] }),
    ];
    const stats = shulAnalytics(input, '2026-11-10', 2);
    assert.equal(stats.registeredReaders.length, 2);
    assert.equal(stats.registeredReaders[0].reader.firstName, 'Sarah');
    assert.equal(stats.registeredReaders[0].aliyahCount, 3);
    assert.deepEqual(stats.registeredReaders[0].readings.map(item => [item.dateString, item.aliyot]),
        [['2026-11-10', [1, 2]], ['2026-11-17', [1]]]);
    assert.equal(stats.registeredReaders[1].reader.role, 'guest');
    assert.equal(stats.registeredReaders[1].aliyahCount, 2, 'Hidden and out-of-range slots are excluded');
    assert.equal(stats.registeredReaders.reduce((sum, reader) => sum + reader.aliyahCount, 0), stats.assigned);
});
