import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pendingReadingLocks, previewReadingLocks, stageReadingLock } from '../frontend/src/readingAdjustments.ts';

const reading = {
    id: 1, dateString: '2026-10-10', desc: 'Bereshit', locked: false,
    lockedArr: Array(9).fill(false), psukim: ['one', 'two', 'three', 'null', 'null', 'null', 'null', 'maftir', 'haftarah'],
};

test('draft locks preview immediately without mutating the saved schedule', () => {
    const draft = stageReadingLock({}, reading, true, 8);
    const preview = previewReadingLocks(reading, draft);
    assert.equal(preview.lockedArr[7], true);
    assert.equal(preview.lockedArr[3], false);
    assert.ok(reading.lockedArr.every(value => !value));
    assert.equal(pendingReadingLocks(draft, [reading]).length, 1);
    assert.deepEqual(previewReadingLocks(reading, {}), reading);
});

test('each lock appears once and returning to its saved value removes the change', () => {
    let draft = stageReadingLock({}, reading, true, 1);
    draft = stageReadingLock(draft, reading, true, 1);
    assert.equal(Object.keys(draft).length, 1);
    draft = stageReadingLock(draft, reading, false, 1);
    assert.deepEqual(draft, {});
});

test('whole-reading and individual draft locks stay independent across multiple readings', () => {
    const other = { ...reading, id: 2, dateString: '2026-10-17', desc: 'Noach' };
    let draft = stageReadingLock({}, reading, true, 8);
    draft = stageReadingLock(draft, reading, true);
    draft = stageReadingLock(draft, other, true, 1);
    draft = stageReadingLock(draft, reading, false);
    const preview = previewReadingLocks(reading, draft);
    assert.equal(preview.locked, false);
    assert.equal(preview.lockedArr[7], true);
    assert.equal(preview.lockedArr[0], false);
    assert.equal(previewReadingLocks(other, draft).lockedArr[0], true);
    assert.equal(pendingReadingLocks(draft, [reading, other]).length, 2);
});

test('published values become the new baseline while missing readings remain pending for validation', () => {
    const draft = stageReadingLock({}, reading, true, 1);
    const saved = { ...reading, lockedArr: [true, ...reading.lockedArr.slice(1)] };
    assert.deepEqual(pendingReadingLocks(draft, [saved]), []);
    assert.equal(pendingReadingLocks(draft, []).length, 1);
    const undo = stageReadingLock({}, saved, false, 1);
    assert.equal(previewReadingLocks(saved, undo).lockedArr[0], false);
});
