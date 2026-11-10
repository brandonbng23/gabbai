import assert from 'node:assert/strict';
import { test } from 'node:test';
import { occasionChangeLog, stageReadingCount, pendingReadingCounts, stageReadingReader, pendingReadingReaders, reorderManualOccasions, pendingReadingLocks, pendingReadingOccasions, previewReadingLocks, stageReadingLock, stageReadingOccasions, stageReadingNote, pendingReadingNotes, stageAliyahNotes, editReadingNote, toggleNoteApplication, readingNoteKey, noteChangeLog } from '../frontend/src/readingAdjustments.ts';

const reading = {
    id: 1, readers: Array(9).fill(null), manualOccasions: [], dateString: '2026-10-10', desc: 'Bereshit', locked: false,
    lockedArr: Array(9).fill(false), psukim: ['one', 'two', 'three', 'null', 'null', 'null', 'null', 'maftir', 'haftarah'],
};

test('guest reader drafts preview as guests and publish their full profile even with a null reader ID', () => {
    const guest = { title: 'Mr.', firstName: 'Guest', lastName: 'Reader', hebrewName: 'Moshe', email: 'guest@example.com', phone: '555-0100' };
    const pending = { id: 'pending-guest', ...guest, role: 'guest', assignedReadings: [] };
    const draft = { dateString: reading.dateString, desc: reading.desc, aliyah: 1, readerId: null, guest, reader: pending };
    const drafts = { [JSON.stringify([reading.dateString, reading.desc, 1])]: draft };
    assert.equal(previewReadingLocks(reading, {}, {}, drafts).readers[0], pending);
    assert.deepEqual(pendingReadingReaders(drafts, [reading]), [{ dateString: reading.dateString, desc: reading.desc, aliyah: 1, readerId: null, guest }]);
    assert.deepEqual(stageReadingReader(drafts, reading, 1, null), {}, 'Removing an unpublished guest cancels its draft');
});

test('note drafts preview independently, preserve typed spaces, and revert to saved notes', () => {
    const saved = { ...reading, aliyahNotes: ['Saved note', ...Array(8).fill('')] };
    let drafts = stageReadingNote({}, saved, 1, 'Use special ');
    const preview = previewReadingLocks(saved, {}, {}, {}, {}, drafts);
    assert.equal(preview.aliyahNotes[0], 'Use special ');
    assert.equal(saved.aliyahNotes[0], 'Saved note');
    assert.equal(pendingReadingNotes(drafts, [saved])[0].note, 'Use special');
    drafts = stageReadingNote(drafts, saved, 1, 'Saved note');
    assert.deepEqual(drafts, {});
    drafts = stageReadingNote({}, saved, 1, '');
    assert.equal(pendingReadingNotes(drafts, [saved])[0].note, '');
    const other = { ...saved, desc: 'Noach' };
    assert.deepEqual(previewReadingLocks(other, {}, {}, {}, {}, drafts), other);
    assert.deepEqual(pendingReadingNotes(stageReadingNote({}, saved, 2, '  '), [saved]), []);
    assert.equal(pendingReadingNotes(drafts, []).length, 1, 'Missing readings retain drafts for server validation');
});

test('applying a note to an aliyah stages only matching visible slots and preserves other drafts', () => {
    const saved = { ...reading, aliyahNotes: ['First note', 'Old second note', ...Array(7).fill('')] };
    const other = { ...reading, desc: 'Noach', psukim: ['one', 'null', ...Array(7).fill('null')] };
    const initial = stageReadingNote({}, saved, 1, 'Unrelated draft');
    const snapshot = structuredClone(saved);
    const notes = stageAliyahNotes(initial, [saved, other], 2, ' New note ');
    assert.equal(previewReadingLocks(saved, {}, {}, {}, {}, notes).aliyahNotes[1], 'New note');
    assert.equal(previewReadingLocks(saved, {}, {}, {}, {}, notes).aliyahNotes[0], 'Unrelated draft');
    assert.equal(pendingReadingNotes(notes, [saved, other]).length, 2);
    assert.deepEqual(saved, snapshot);
    assert.deepEqual(initial, stageReadingNote({}, saved, 1, 'Unrelated draft'));
    assert.equal(stageAliyahNotes(initial, [saved], 2, '   '), initial);
});

test('applying a note to all respects pending aliyah-count changes', () => {
    const saved = { ...reading, defaultAliyahCount: 1, aliyahCount: 1,
        psukim: ['Genesis 1:1-1:5', 'null'],
        aliyahOptions: [['Genesis 1:1-1:5', 'null'], ['Genesis 1:1-1:5', 'Genesis 1:6-1:10']] };
    const counts = stageReadingCount({}, saved, 2);
    const notes = stageAliyahNotes({}, [saved], 2, 'Second aliyah note', counts);
    assert.equal(pendingReadingNotes(notes, [saved])[0].aliyah, 2);
    const preview = previewReadingLocks(saved, {}, {}, {}, counts, notes);
    assert.equal(preview.aliyahNotes[1], 'Second aliyah note');
});

test('toggling all matching aliyot back to one restores previous drafts and keeps the source note', () => {
    const other = { ...reading, desc: 'Noach', aliyahNotes: ['Saved elsewhere', ...Array(8).fill('')] };
    let state = { drafts: {}, applications: {} };
    state = editReadingNote(state, reading, 1, 'Shared note');
    state = editReadingNote(state, other, 1, 'Earlier unsaved note');
    state = toggleNoteApplication(state, [reading, other], reading, 1, 'Shared note', 'aliyah');
    assert.equal(state.applications[readingNoteKey(reading, 1)].scope, 'aliyah');
    assert.equal(previewReadingLocks(other, {}, {}, {}, {}, state.drafts).aliyahNotes[0], 'Shared note');
    state = toggleNoteApplication(state, [reading, other], reading, 1, 'Shared note', 'aliyah');
    assert.deepEqual(state.applications, {});
    assert.equal(previewReadingLocks(reading, {}, {}, {}, {}, state.drafts).aliyahNotes[0], 'Shared note');
    assert.equal(previewReadingLocks(other, {}, {}, {}, {}, state.drafts).aliyahNotes[0], 'Earlier unsaved note');
    assert.equal(other.aliyahNotes[0], 'Saved elsewhere');
});

test('applying to a parsha affects only its visible aliyot on that date and reverses cleanly', () => {
    const otherDate = { ...reading, dateString: '2026-10-17' };
    let state = editReadingNote({ drafts: {}, applications: {} }, reading, 1, 'Parsha note');
    state = toggleNoteApplication(state, [reading, otherDate], reading, 1, 'Parsha note', 'parsha');
    assert.equal(state.applications[readingNoteKey(reading, 1)].scope, 'parsha');
    assert.deepEqual(pendingReadingNotes(state.drafts, [reading, otherDate]).map(change => change.aliyah), [1, 2, 3, 8, 9]);
    assert.ok(pendingReadingNotes(state.drafts, [reading, otherDate]).every(change => change.dateString === reading.dateString));
    state = toggleNoteApplication(state, [reading, otherDate], reading, 1, 'Parsha note', 'parsha');
    assert.equal(pendingReadingNotes(state.drafts, [reading, otherDate]).length, 1);
    assert.equal(pendingReadingNotes(state.drafts, [reading, otherDate])[0].aliyah, 1);
});

test('switching bulk scopes restores the old scope before applying the new one', () => {
    const other = { ...reading, desc: 'Noach' };
    let state = editReadingNote({ drafts: {}, applications: {} }, reading, 1, 'Scoped note');
    state = toggleNoteApplication(state, [reading, other], reading, 1, 'Scoped note', 'aliyah');
    state = toggleNoteApplication(state, [reading, other], reading, 1, 'Scoped note', 'parsha');
    const pending = pendingReadingNotes(state.drafts, [reading, other]);
    assert.equal(pending.length, 5);
    assert.ok(pending.every(change => change.desc === reading.desc));
    assert.equal(state.applications[readingNoteKey(reading, 1)].scope, 'parsha');
});

test('returning to one aliyah preserves later individual edits to other notes', () => {
    const other = { ...reading, desc: 'Noach' };
    let state = editReadingNote({ drafts: {}, applications: {} }, reading, 1, 'Shared note');
    state = toggleNoteApplication(state, [reading, other], reading, 1, 'Shared note', 'aliyah');
    state = editReadingNote(state, other, 1, 'Later individual edit');
    state = toggleNoteApplication(state, [reading, other], reading, 1, 'Shared note', 'aliyah');
    assert.equal(previewReadingLocks(other, {}, {}, {}, {}, state.drafts).aliyahNotes[0], 'Later individual edit');
});

test('editing the source of a bulk note returns it to an individual note', () => {
    const other = { ...reading, desc: 'Noach' };
    let state = editReadingNote({ drafts: {}, applications: {} }, reading, 1, 'Shared note');
    state = toggleNoteApplication(state, [reading, other], reading, 1, 'Shared note', 'aliyah');
    state = editReadingNote(state, reading, 1, 'Changed source');
    assert.deepEqual(state.applications, {});
    assert.deepEqual(pendingReadingNotes(state.drafts, [reading, other]), [
        { dateString: reading.dateString, desc: reading.desc, aliyah: 1, note: 'Changed source' },
    ]);
});

test('overlapping bulk applications can be undone without restoring an already removed scope', () => {
    const other = { ...reading, desc: 'Noach' };
    let state = editReadingNote({ drafts: {}, applications: {} }, reading, 1, 'Global note');
    state = toggleNoteApplication(state, [reading, other], reading, 1, 'Global note', 'aliyah');
    state = editReadingNote(state, other, 2, 'Parsha note');
    state = toggleNoteApplication(state, [reading, other], other, 2, 'Parsha note', 'parsha');
    state = toggleNoteApplication(state, [reading, other], reading, 1, 'Global note', 'aliyah');
    assert.equal(previewReadingLocks(other, {}, {}, {}, {}, state.drafts).aliyahNotes[0], 'Parsha note');
    state = toggleNoteApplication(state, [reading, other], other, 2, 'Parsha note', 'parsha');
    const pending = pendingReadingNotes(state.drafts, [reading, other]);
    assert.equal(pending.length, 2);
    assert.ok(pending.some(change => change.desc === reading.desc && change.aliyah === 1 && change.note === 'Global note'));
    assert.ok(pending.some(change => change.desc === other.desc && change.aliyah === 2 && change.note === 'Parsha note'));
});

test('overlapping scopes with the same text retain the later scope until it is undone', () => {
    const other = { ...reading, desc: 'Noach' };
    let state = editReadingNote({ drafts: {}, applications: {} }, reading, 1, 'Same note');
    state = toggleNoteApplication(state, [reading, other], reading, 1, 'Same note', 'aliyah');
    state = editReadingNote(state, other, 2, 'Same note');
    state = toggleNoteApplication(state, [reading, other], other, 2, 'Same note', 'parsha');
    state = toggleNoteApplication(state, [reading, other], reading, 1, 'Same note', 'aliyah');
    assert.equal(previewReadingLocks(other, {}, {}, {}, {}, state.drafts).aliyahNotes[0], 'Same note');
    state = toggleNoteApplication(state, [reading, other], other, 2, 'Same note', 'parsha');
    assert.equal(pendingReadingNotes(state.drafts, [reading, other]).length, 2);
});

test('bulk note changes produce one summary and reverting restores individual entries', () => {
    const other = { ...reading, desc: 'Noach' };
    let state = editReadingNote({ drafts: {}, applications: {} }, reading, 1, 'Shared note');
    state = toggleNoteApplication(state, [reading, other], reading, 1, 'Shared note', 'aliyah');
    assert.deepEqual(noteChangeLog(state, [reading, other]), [
        'Set the note for Rishon across the current schedule to “Shared note” (2 aliyot changed).',
    ]);
    state = toggleNoteApplication(state, [reading, other], reading, 1, 'Shared note', 'aliyah');
    assert.deepEqual(noteChangeLog(state, [reading, other]), [
        'Set the note for Rishon of Bereshit (2026-10-10) to “Shared note”.',
    ]);
});

test('parsha bulk summaries count only changed notes and keep later edits separate', () => {
    const saved = { ...reading, gregDate: 'October 10, 2026', aliyahNotes: ['Parsha note', ...Array(8).fill('')] };
    let state = toggleNoteApplication({ drafts: {}, applications: {} }, [saved], saved, 1, 'Parsha note', 'parsha');
    assert.deepEqual(noteChangeLog(state, [saved]), [
        'Set the note for all aliyot of Bereshit (October 10, 2026) to “Parsha note” (4 aliyot changed).',
    ]);
    state = editReadingNote(state, saved, 2, 'Individual exception');
    assert.deepEqual(noteChangeLog(state, [saved]), [
        'Set the note for all aliyot of Bereshit (October 10, 2026) to “Parsha note” (3 aliyot changed).',
        'Set the note for Sheni of Bereshit (October 10, 2026) to “Individual exception”.',
    ]);
    assert.deepEqual(noteChangeLog({ drafts: {}, applications: state.applications }, [saved]), []);
});

test('overlapping bulk note summaries count each pending change once', () => {
    const other = { ...reading, desc: 'Noach' };
    let state = toggleNoteApplication({ drafts: {}, applications: {} }, [reading, other], reading, 1, 'Global note', 'aliyah');
    state = editReadingNote(state, other, 2, 'Parsha note');
    state = toggleNoteApplication(state, [reading, other], other, 2, 'Parsha note', 'parsha');
    assert.deepEqual(noteChangeLog(state, [reading, other]), [
        'Set the note for Rishon across the current schedule to “Global note” (1 aliyah changed).',
        'Set the note for all aliyot of Noach (2026-10-10) to “Parsha note” (5 aliyot changed).',
    ]);
});

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

test('reader drafts assign original slots, replace and revert without mutating saved assignments', () => {
    const reader = { id: 'one', firstName: 'Josh', lastName: 'Cohen', email: 'one@example.com', role: 'member', title: 'Mr.', assignedReadings: [] };
    const other = { ...reader, id: 'two', firstName: 'David' };
    let draft = stageReadingReader({}, reading, 8, reader);
    let preview = previewReadingLocks(reading, {}, {}, draft);
    assert.equal(preview.readers[7].id, reader.id);
    assert.equal(preview.readers[0], null);
    assert.ok(reading.readers.every(item => item === null));
    draft = stageReadingReader(draft, reading, 8, other);
    assert.equal(pendingReadingReaders(draft, [reading]).length, 1);
    assert.deepEqual(pendingReadingReaders(draft, [reading])[0], {
        dateString: reading.dateString, desc: reading.desc, aliyah: 8, readerId: other.id,
    });
    assert.deepEqual(stageReadingReader(draft, reading, 8, null), {});
    const saved = { ...reading, readers: [...reading.readers] };
    saved.readers[7] = other;
    assert.deepEqual(pendingReadingReaders(draft, [saved]), []);
    const removal = stageReadingReader({}, saved, 8, null);
    assert.equal(previewReadingLocks(saved, {}, {}, removal).readers[7], null);
    assert.equal(pendingReadingReaders(removal, [saved])[0].readerId, null);
});

test('count drafts preview only their reading and reset independently of the schedule rule', () => {
    const saved = { ...reading, aliyahCount: 3, defaultAliyahCount: 3, aliyahCountOverride: null,
        aliyahOptions: Array.from({ length: 7 }, (_, index) => Array.from({ length: 9 }, (_, slot) => slot < 7 && slot > index ? 'null' : `verses ${slot}`)) };
    const other = { ...saved, desc: 'Noach' };
    const drafts = stageReadingCount({}, saved, 6);
    const preview = previewReadingLocks(saved, {}, {}, {}, drafts);
    assert.equal(preview.aliyahCount, 6);
    assert.equal(preview.psukim[5], 'verses 5');
    assert.equal(preview.psukim[6], 'null');
    assert.equal(saved.aliyahCount, 3);
    assert.equal(previewReadingLocks(other, {}, {}, {}, drafts).aliyahCount, 3);
    assert.equal(pendingReadingCounts(drafts, [saved]).length, 1);
    assert.deepEqual(stageReadingCount(drafts, saved, null), {});
    const overridden = { ...saved, aliyahCount: 6, aliyahCountOverride: 6 };
    const reset = stageReadingCount({}, overridden, null);
    assert.equal(previewReadingLocks(overridden, {}, {}, {}, reset).aliyahCount, 3);
    assert.equal(pendingReadingCounts(reset, [overridden])[0].aliyahCount, null);
});


test('aliyah count previews recalculate verse counts without changing the saved counts', () => {
    const saved = { ...reading, aliyahCount: 2, defaultAliyahCount: 2, aliyahCountOverride: null,
        psukim: ['Genesis 1:1-1:5', 'Genesis 1:6-1:10'], verseCounts: [5, 5],
        aliyahOptions: [['Genesis 1:1-1:10', 'null'], ['Genesis 1:1-1:5', 'Genesis 1:6-1:10']] };
    const drafts = stageReadingCount({}, saved, 1);
    const preview = previewReadingLocks(saved, {}, {}, {}, drafts);
    assert.deepEqual(preview.verseCounts, [10, null]);
    assert.deepEqual(saved.verseCounts, [5, 5]);
});

test('occasion log reflects net additions and removals and clears when edits are undone', () => {
    const saved = { ...reading, gregDate: 'October 10, 2026', occassions: ['Shabbat'], manualOccasions: ['Birthday'] };
    const target = 'Bereshit (October 10, 2026)';
    let drafts = stageReadingOccasions({}, saved, ['Birthday', 'Anniversary']);
    assert.deepEqual(occasionChangeLog(drafts, [saved]), [`Add “Anniversary” to ${target}.`]);
    drafts = stageReadingOccasions(drafts, saved, ['Anniversary']);
    assert.deepEqual(occasionChangeLog(drafts, [saved]), [`Add “Anniversary” to ${target}.`, `Remove “Birthday” from ${target}.`]);
    drafts = stageReadingOccasions(drafts, saved, []);
    assert.deepEqual(occasionChangeLog(drafts, [saved]), [`Remove “Birthday” from ${target}.`]);
    drafts = stageReadingOccasions(drafts, saved, ['Birthday']);
    assert.deepEqual(occasionChangeLog(drafts, [saved]), []);
    assert.deepEqual(occasionChangeLog({}, [saved]), []);
    assert.deepEqual(saved.occassions, ['Shabbat']);
    assert.deepEqual(saved.manualOccasions, ['Birthday']);
});

test('occasion log shows the final reordered list and clears after publishing', () => {
    const saved = { ...reading, manualOccasions: ['First', 'Second', 'Third'] };
    const drafts = stageReadingOccasions({}, saved, ['Second', 'New', 'First']);
    assert.deepEqual(occasionChangeLog(drafts, [saved]), [
        'Reorder manually added occasions for Bereshit (2026-10-10): “Second”, “New”, “First”.',
        'Add “New” to Bereshit (2026-10-10).',
        'Remove “Third” from Bereshit (2026-10-10).',
    ]);
    const published = { ...saved, manualOccasions: ['Second', 'New', 'First'] };
    assert.deepEqual(occasionChangeLog(drafts, [published]), []);
    assert.deepEqual(occasionChangeLog(stageReadingOccasions(drafts, saved, saved.manualOccasions), [saved]), []);
});

test('occasion log separates dates and retains missing readings for publish validation', () => {
    const later = { ...reading, dateString: '2027-10-30', manualOccasions: ['Existing'] };
    let drafts = stageReadingOccasions({}, reading, ['New']);
    drafts = stageReadingOccasions(drafts, later, []);
    assert.deepEqual(occasionChangeLog(drafts, [reading, later]), [
        'Add “New” to Bereshit (2026-10-10).',
        'Remove “Existing” from Bereshit (2027-10-30).',
    ]);
    assert.deepEqual(occasionChangeLog(drafts, []), [
        'Set manually added occasions for Bereshit (2026-10-10) to “New”.',
        'Set manually added occasions for Bereshit (2027-10-30) to none.',
    ]);
    assert.equal(pendingReadingOccasions(drafts, []).length, 2);
});
