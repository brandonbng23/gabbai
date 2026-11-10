import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createApp } from '../backend/app.mjs';
import { openDatabase } from '../backend/database/index.mjs';
import { getShulSchedule } from '../backend/schedule.mjs';
import { ALIYAH_NOTE_MAX_LENGTH, validateAliyahNote } from '../interfaces/readingNote.mts';

async function setup(t) {
    const db = openDatabase(':memory:');
    const shul = db.createShul({ name: 'Notes', settings: { hebYear: 5788, il: true, a: 3 } });
    const otherShul = db.createShul({ name: 'Other notes', settings: { hebYear: 5788 } });
    const users = ['admin', 'member', 'foreign'].map(role => db.createUser({
        shulId: role === 'foreign' ? otherShul.id : shul.id, firstName: role, lastName: 'User',
        role: role === 'member' ? 'member' : 'admin', email: `${role}@example.com`,
    }));
    const cookies = users.map((user, index) => {
        const token = String(index + 1).repeat(64);
        db.createSession(user.id, createHash('sha256').update(token).digest('hex'), Date.now() + 120_000);
        return `gabbai_session=${token}`;
    });
    const server = createApp(db, { development: false, preview: false }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        db.close();
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (path, method = 'GET', body, cookie = cookies[0]) => fetch(base + path, {
        method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const reading = getShulSchedule(db, shul.id).find(item => item.psukim[0] && item.psukim[0] !== 'null'
        && item.psukim.some(value => !value || value === 'null'));
    const target = { dateString: reading.dateString, desc: reading.desc, aliyah: 1 };
    return { db, shul, otherShul, cookies, request, reading, target, path: `/api/shuls/${shul.id}/readings/locks` };
}

test('aliyah notes have one shared 120-character, single-line limit and can be cleared', () => {
    assert.equal(ALIYAH_NOTE_MAX_LENGTH, 120);
    assert.equal(validateAliyahNote('x'.repeat(120)).length, 120);
    assert.equal(validateAliyahNote('  Use special tune.  '), 'Use special tune.');
    assert.equal(validateAliyahNote('   '), '');
    for (const invalid of ['x'.repeat(121), 'one\ntwo', 'one\rtwo', 'one\u2028two', 'one\u2029two', null, 5, {}])
        assert.throws(() => validateAliyahNote(invalid), TypeError);
});

test('notes persist by shul, date, reading and aliyah, and invalid batches do not partially save', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-aliyah-notes-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'notes.sqlite');
    let db = openDatabase(path);
    const shul = db.createShul({ name: 'Saved notes', settings: { hebYear: 5788 } });
    const other = db.createShul({ name: 'Other notes', settings: { hebYear: 5788 } });
    const target = { dateString: '2027-10-03', desc: 'Rosh Hashana II', aliyah: 1 };
    db.setReadingLocks(shul.id, [{ ...target, note: 'Special tune.' }, { ...target, aliyah: 8, note: 'Second scroll.' }]);
    db.setReadingLocks(other.id, [{ ...target, note: 'Other shul.' }]);
    assert.throws(() => db.setReadingLocks(shul.id, [{ ...target, locked: true }, { ...target, note: 'x'.repeat(121) }]), TypeError);
    assert.deepEqual(db.listReadingLocks(shul.id), []);
    assert.throws(() => db.setReadingLocks(shul.id, [{ ...target, aliyah: 0, note: 'Whole reading' }]), TypeError);
    db.close();
    db = openDatabase(path);
    try {
        assert.equal(db.listReadingNotes(shul.id).length, 2);
        assert.equal(db.listReadingNotes(other.id)[0].note, 'Other shul.');
        const reading = getShulSchedule(db, shul.id).find(item => item.dateString === target.dateString && item.desc === target.desc);
        assert.equal(reading.aliyahNotes[0], 'Special tune.');
        assert.equal(reading.aliyahNotes[1], '');
        assert.equal(reading.aliyahNotes[7], 'Second scroll.');
        db.setReadingLocks(shul.id, [{ ...target, note: '' }]);
        assert.equal(db.listReadingNotes(shul.id).length, 1);
        assert.equal(db.listReadingNotes(shul.id)[0].aliyah, 8);
    } finally { db.close(); }
});

test('the longer-note migration preserves existing notes and allows 120 characters after reopening', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-longer-notes-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'notes.sqlite');
    let db = openDatabase(path);
    const shul = db.createShul({ name: 'Migrated notes', settings: { hebYear: 5788 } });
    const target = { dateString: '2027-10-03', desc: 'Rosh Hashana II', aliyah: 1 };
    db.setReadingLocks(shul.id, [{ ...target, note: 'Existing note.' }]);
    db.close();
    const legacy = new DatabaseSync(path);
    try {
        legacy.exec('ALTER TABLE reading_aliyah_notes RENAME TO saved_notes');
        legacy.exec(readFileSync(new URL('../backend/database/migrations/027_aliyah_notes.sql', import.meta.url), 'utf8'));
        legacy.exec('INSERT INTO reading_aliyah_notes SELECT * FROM saved_notes; DROP TABLE saved_notes; DELETE FROM schema_migrations WHERE version = 28');
    } finally { legacy.close(); }
    db = openDatabase(path);
    try {
        assert.equal(db.listReadingNotes(shul.id)[0].note, 'Existing note.');
        db.setReadingLocks(shul.id, [{ ...target, note: 'x'.repeat(120) }]);
    } finally { db.close(); }
    db = openDatabase(path);
    try { assert.equal(db.listReadingNotes(shul.id)[0].note.length, 120); }
    finally { db.close(); }
});

test('admins publish, update and remove public notes alongside other reading adjustments', async t => {
    const { db, shul, otherShul, request, target, path } = await setup(t);
    let response = await request(path, 'PATCH', { changes: [{ ...target, locked: true }, { ...target, note: '  Special tune.  ' }] });
    assert.equal(response.status, 200);
    let updated = await response.json();
    assert.equal(updated[0].aliyahNotes[0], 'Special tune.');
    assert.equal(updated[0].lockedArr[0], true);
    response = await request(`/api/schedule?shul=${shul.id}`, 'GET', undefined, '');
    assert.equal(response.status, 200);
    const schedule = await response.json();
    const reading = schedule.find(item => item.dateString === target.dateString && item.desc === target.desc);
    assert.equal(reading.aliyahNotes[0], 'Special tune.');
    assert.equal(reading.aliyahNotes[1], '');
    assert.deepEqual(db.listReadingNotes(otherShul.id), []);
    response = await request(path, 'PATCH', { changes: [{ ...target, note: 'x'.repeat(120) }] });
    assert.equal(response.status, 200, 'Notes remain editable when the aliyah is locked');
    updated = await response.json();
    assert.equal(updated[0].aliyahNotes[0].length, 120);
    assert.equal((await request(path, 'PATCH', { changes: [{ ...target, note: '' }] })).status, 200);
    assert.deepEqual(db.listReadingNotes(shul.id), []);
    assert.equal(db.listReadingLocks(shul.id)[0].locked, true, 'Clearing a note leaves other adjustments unchanged');
});

test('note publishing enforces admin ownership, valid slots, length and atomic batches', async t => {
    const { db, shul, request, target, reading, cookies, path } = await setup(t);
    const body = { changes: [{ ...target, note: 'Note' }] };
    assert.equal((await request(path, 'PATCH', body, '')).status, 401);
    for (const cookie of cookies.slice(1)) assert.equal((await request(path, 'PATCH', body, cookie)).status, 403);
    for (const note of ['x'.repeat(121), 'one\ntwo', 1, null]) {
        assert.equal((await request(path, 'PATCH', { changes: [{ ...target, locked: true }, { ...target, note }] })).status, 400);
        assert.deepEqual(db.listReadingNotes(shul.id), []);
        assert.deepEqual(db.listReadingLocks(shul.id), []);
    }
    for (const aliyah of [undefined, 0, 10, reading.psukim.findIndex(value => !value || value === 'null') + 1])
        assert.equal((await request(path, 'PATCH', { changes: [{ ...target, aliyah, note: 'Note' }] })).status, 400);
    assert.equal((await request(path, 'PATCH', { changes: [...body.changes, ...body.changes] })).status, 400);
    assert.equal((await request(path, 'PATCH', { changes: [{ ...target, desc: 'Missing reading', note: 'Note' }] })).status, 404);
    assert.deepEqual(db.listReadingNotes(shul.id), []);
});
