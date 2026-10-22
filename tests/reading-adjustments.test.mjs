import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reorderManualOccasions, pendingReadingLocks, pendingReadingOccasions, previewReadingLocks, stageReadingLock, stageReadingOccasions } from '../frontend/src/readingAdjustments.ts';

const reading = {
    id: 1, manualOccasions: [], dateString: '2026-10-10', desc: 'Bereshit', locked: false,
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

test('manual occasion drafts preview, deduplicate the log, revert, and keep saved data intact', () => {
    let draft = stageReadingOccasions({}, reading, ['Bar Mitzvah']);
    assert.deepEqual(reading.manualOccasions, []);
    assert.deepEqual(previewReadingLocks(reading, {}, draft).manualOccasions, ['Bar Mitzvah']);
    draft = stageReadingOccasions(draft, reading, ['Bar Mitzvah', 'Anniversary']);
    assert.equal(pendingReadingOccasions(draft, [reading]).length, 1);
    const saved = { ...reading, manualOccasions: ['Bar Mitzvah', 'Anniversary'] };
    assert.equal(pendingReadingOccasions(draft, [saved]).length, 0);
    assert.deepEqual(stageReadingOccasions(draft, reading, []), {});
    assert.deepEqual(previewReadingLocks(reading, {}, {}).manualOccasions, []);
});

test('manual occasion reordering preserves labels and publishes only a changed order', () => {
    const saved = { ...reading, manualOccasions: ['First', 'Second', 'Third'] };
    const reordered = reorderManualOccasions(saved.manualOccasions, 'First', 'Third');
    assert.deepEqual(reordered, ['Second', 'Third', 'First']);
    assert.deepEqual(saved.manualOccasions, ['First', 'Second', 'Third']);
    const draft = stageReadingOccasions({}, saved, reordered);
    assert.equal(pendingReadingOccasions(draft, [saved]).length, 1);
    assert.deepEqual(previewReadingLocks(saved, {}, draft).manualOccasions, reordered);
    const restored = reorderManualOccasions(reordered, 'First', 'Second');
    assert.deepEqual(stageReadingOccasions(draft, saved, restored), {});
    assert.equal(reorderManualOccasions(reordered, 'Built-in', 'First'), reordered);
    assert.equal(reorderManualOccasions(reordered, 'First', 'First'), reordered);
});
