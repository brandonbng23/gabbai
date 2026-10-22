import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../backend/database/index.mjs';
import { ensureDemoUser } from '../backend/database/demo.mjs';
import { settingsForSchedule } from '../backend/database/settings.mjs';
import { getShulSchedule } from '../backend/schedule.mjs';
import { Schedule } from '../core/schedule.mts';
import { Settings } from '../core/settings.mts';

function setup(t) {
    const db = openDatabase(':memory:');
    t.after(() => db.close());
    const shul = db.createShul({ name: 'Example Shul', settings: { hebYear: 5787 } });
    return { db, shul };
}

const guest = shulId => ({ shulId, firstName: 'Josh', lastName: 'Cohen', email: 'josh@example.com' });

test('reading locks survive reopening and remain tied to their shul, date, and original slot', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-locks-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'locks.sqlite');
    let db = openDatabase(path);
    let shul;
    let other;
    const key = { dateString: '2026-10-10', desc: 'Bereshit' };
    try {
        shul = db.createShul({ name: 'Locks', settings: { hebYear: 5787 } });
        other = db.createShul({ name: 'Other', settings: { hebYear: 5787 } });
        db.setReadingLock(shul.id, { ...key, locked: true });
        db.setReadingLock(shul.id, { ...key, aliyah: 8, locked: true });
        db.setReadingLock(shul.id, { ...key, locked: false });
        for (const invalid of [{ ...key, locked: 1 }, { ...key, locked: true, aliyah: 10 },
            { ...key, dateString: '2026-02-30', locked: true }]) {
            assert.throws(() => db.setReadingLock(shul.id, invalid), TypeError);
        }
    } finally { db.close(); }
    db = openDatabase(path);
    try {
        assert.deepEqual(db.listReadingLocks(other.id), []);
        const locks = db.listReadingLocks(shul.id);
        assert.equal(locks.length, 2);
        assert.equal(locks.find(lock => lock.aliyah === 0).locked, false);
        assert.equal(locks.find(lock => lock.aliyah === 8).locked, true);
        assert.ok(locks.every(lock => lock.dateString === key.dateString && lock.desc === key.desc));
    } finally { db.close(); }
});

test('first saved shul versions survive edits, reopening, and repeated migrations', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-initial-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'shul.sqlite');
    let db = openDatabase(path);
    let shul;
    let initial;
    try {
        shul = db.createShul({ name: 'Original Shul', address: 'First address', settings: { hebYear: 5787, a: 3 } });
        initial = db.getInitialShulVersion(shul.id);
        assert.equal(initial.source, 'creation');
        assert.equal(initial.info.name, 'Original Shul');
        assert.deepEqual(initial.settings, shul.settings);
        db.updateShul(shul.id, { name: 'New name', address: 'New address' });
        db.updateShulSettings(shul.id, { a: 7, yontifs: { rh2: false } });
        assert.deepEqual(db.getInitialShulVersion(shul.id), initial);
    } finally { db.close(); }
    db = openDatabase(path);
    try {
        assert.deepEqual(db.getInitialShulVersion(shul.id), initial);
        assert.equal(db.getShul(shul.id).name, 'New name');
        assert.equal(db.getInitialShulVersion('missing'), null);
    } finally { db.close(); }
});

test('legacy shuls retain their earliest available version without inventing history', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-legacy-initial-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'legacy.sqlite');
    const legacy = new DatabaseSync(path);
    const settings = JSON.stringify(new Settings(5787));
    legacy.exec(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY);
        INSERT INTO schema_migrations VALUES (1);`);
    legacy.exec(readFileSync(new URL('../backend/database/migrations/001_profiles.sql', import.meta.url), 'utf8'));
    legacy.prepare('INSERT INTO shuls (id, name) VALUES (?, ?)').run('legacy', 'Earliest available');
    legacy.prepare('INSERT INTO shul_settings (shul_id, settings_json) VALUES (?, ?)').run('legacy', settings);
    legacy.close();
    let db = openDatabase(path);
    let initial;
    try {
        initial = db.getInitialShulVersion('legacy');
        assert.equal(initial.source, 'migration');
        assert.equal(initial.info.name, 'Earliest available');
        db.updateShul('legacy', { name: 'Later change' });
    } finally { db.close(); }
    db = openDatabase(path);
    try { assert.deepEqual(db.getInitialShulVersion('legacy'), initial); }
    finally { db.close(); }
});

test('demo startup refreshes existing shul information while preserving settings and memberships', t => {
    const { db, shul: unrelated } = setup(t);
    const demo = ensureDemoUser(db);
    const expected = db.getShul(demo.shulId);
    db.updateShul(demo.shulId, {
        name: 'Old Demo Name', websiteUrl: '', donationUrl: '', email: '', phone: '', address: '',
    });
    db.updateShulSettings(demo.shulId, { hebYear: 5788, a: 3, il: true });
    db.setUserSettings(demo.id, { language: 'he' });
    db.updateUser(demo.id, { role: 'member' });
    const savedSettings = db.getShul(demo.shulId).settings;
    assert.equal(ensureDemoUser(db).id, demo.id);
    assert.equal(db.getUser(demo.id).role, 'admin');
    const refreshed = db.getShul(demo.shulId);
    for (const field of ['name', 'websiteUrl', 'donationUrl', 'email', 'phone', 'address']) {
        assert.equal(refreshed[field], expected[field]);
    }
    assert.deepEqual(refreshed.settings, savedSettings);
    assert.deepEqual(db.getUser(demo.id).settings, { language: 'he' });
    assert.equal(db.getUserShul(demo.id).id, demo.shulId);
    assert.deepEqual(db.getShul(unrelated.id), unrelated);
    assert.equal(db.listShuls().length, 2);
    assert.equal(db.listShulUsers(demo.shulId).length, 1);
    ensureDemoUser(db);
    assert.deepEqual(db.getShul(demo.shulId), refreshed);
});

test('profiles, membership, and independent preferences survive reopening and migration reruns', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-database-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const filename = join(directory, 'database.sqlite');
    let db = openDatabase(filename);
    try {
        const shul = db.createShul({ name: 'Example Shul', websiteUrl: 'https://example.com', settings: { hebYear: 5787 } });
        const user = db.createUser({ ...guest(shul.id), hebrewName: 'Yehoshua', settings: { notifications: { email: true } } });
        db.updateShulSettings(shul.id, { il: true, yontifs: { rh2: false } });
        db.setUserSettings(user.id, { notifications: { email: false } });
        db.close();
        db = openDatabase(filename);
        assert.equal(db.getUser(user.id).hebrewName, 'Yehoshua');
        assert.deepEqual(db.getUser(user.id).settings, { notifications: { email: false } });
        assert.equal(db.getUserShul(user.id).id, shul.id);
        assert.deepEqual(db.listShulUsers(shul.id).map(u => u.id), [user.id]);
        assert.equal(db.getShul(shul.id).settings.il, true);
        assert.equal(db.getShul(shul.id).settings.yontifs.rh2, false);
        assert.equal(db.getShul(shul.id).settings.yontifs.rh1, true);
        assert.equal(db.listShuls().length, 1);
    } finally {
        db.close();
    }
});

test('membership has one source and transfers preserve user preferences', t => {
    const { db, shul } = setup(t);
    const second = db.createShul({ name: 'Second Shul', settings: { hebYear: 5788 } });
    const user = db.createUser({ ...guest(shul.id), role: 'admin', title: 'Gabbai', settings: { language: 'he' } });
    assert.equal(db.listShulUsers(second.id).length, 0);
    db.updateUser(user.id, { shulId: second.id, role: 'member', title: '' });
    assert.equal(db.listShulUsers(shul.id).length, 0);
    assert.equal(db.listShulUsers(second.id)[0].id, user.id);
    assert.deepEqual(db.getUser(user.id).settings, { language: 'he' });
    assert.equal(db.getUserShul(user.id).settings.hebYear, 5788);
});

test('email uniqueness is case insensitive and failed membership changes leave data intact', t => {
    const { db, shul } = setup(t);
    const user = db.createUser(guest(shul.id));
    assert.throws(() => db.createUser({ ...guest(shul.id), email: 'JOSH@EXAMPLE.COM' }), /UNIQUE/);
    assert.throws(() => db.createUser({ ...guest('missing'), email: 'other@example.com' }), /FOREIGN KEY/);
    assert.throws(() => db.updateUser(user.id, { shulId: 'missing', firstName: 'Changed' }), /FOREIGN KEY/);
    assert.equal(db.getUser(user.id).firstName, 'Josh');
    assert.equal(db.getUser(user.id).shulId, shul.id);
    assert.equal(db.getUserByEmail('JOSH@EXAMPLE.COM').id, user.id);
    assert.equal(db.listShulUsers(shul.id).length, 1);
});

test('settings validation rejects unknown fields, bad types, and conflicting maftir patterns', t => {
    const { db, shul } = setup(t);
    const original = db.getShul(shul.id).settings;
    for (const patch of [{ a: 8 }, { hebYear: 0 }, { il: 'true' }, { yontifs: { typo: true } },
        { yontifs: null }, { triennial: { triMaftir: true } }, { unknown: true }]) {
        assert.throws(() => db.updateShulSettings(shul.id, patch), TypeError);
        assert.deepEqual(db.getShul(shul.id).settings, original);
    }
    db.updateShulSettings(shul.id, { triennial: { triMaftir: true, tradMaftir: false } });
    assert.equal(settingsForSchedule(db.getShul(shul.id).settings).getMaftir(), 'tri');
});

test('profile validation and settings isolation prevent unintended changes', t => {
    const { db, shul } = setup(t);
    assert.throws(() => db.createUser({ ...guest(shul.id), email: 'invalid' }), /Invalid email/);
    assert.throws(() => db.createUser({ ...guest(shul.id), role: 'owner' }), /role/);
    assert.throws(() => db.createShul({ name: 'Missing year' }), /hebYear/);
    const user = db.createUser(guest(shul.id));
    assert.throws(() => db.updateUser(user.id, { settings: {} }), /Unknown/);
    assert.throws(() => db.setUserSettings(user.id, []), /plain object/);
    assert.throws(() => db.setUserSettings(user.id, { value: undefined }), /JSON values/);
    assert.throws(() => db.setUserSettings('missing', {}), /not found/);
    db.updateUser(user.id, { firstName: 'Joseph' });
    db.updateShul(shul.id, { name: 'Renamed Shul' });
    assert.equal(db.getUser(user.id).firstName, 'Joseph');
    assert.deepEqual(db.getUser(user.id).settings, {});
    assert.equal(db.getShul(shul.id).name, 'Renamed Shul');
    assert.equal(db.getShul(shul.id).settings.hebYear, 5787);
});

test('SQL constraints reject orphan settings, duplicate settings, and deleting a populated shul', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-constraints-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const filename = join(directory, 'database.sqlite');
    const db = openDatabase(filename);
    t.after(() => db.close());
    const shul = db.createShul({ name: 'Example Shul', settings: { hebYear: 5787 } });
    const user = db.createUser(guest(shul.id));
    const raw = new DatabaseSync(filename);
    try {
        raw.exec('PRAGMA foreign_keys = ON');
        assert.throws(() => raw.prepare('INSERT INTO user_settings VALUES (?, ?, CURRENT_TIMESTAMP)').run('missing', '{}'), /FOREIGN KEY/);
        assert.throws(() => raw.prepare('INSERT INTO user_settings VALUES (?, ?, CURRENT_TIMESTAMP)').run(user.id, '{}'), /UNIQUE/);
        assert.throws(() => raw.prepare('DELETE FROM shuls WHERE id = ?').run(shul.id), /FOREIGN KEY/);
        assert.throws(() => raw.prepare('UPDATE user_settings SET settings_json = ? WHERE user_id = ?').run('[]', user.id), /CHECK/);
        raw.prepare('DELETE FROM users WHERE id = ?').run(user.id);
        assert.equal(raw.prepare('SELECT count(*) AS count FROM user_settings').get().count, 0);
    } finally {
        raw.close();
    }
});

test('schedule generation uses the saved shul settings and an optional year override', t => {
    const { db, shul } = setup(t);
    db.updateShulSettings(shul.id, { il: true, a: 3 });
    const expected = new Settings(5787);
    expected.setIL(true);
    expected.setAliyotCount(3);
    assert.deepEqual(getShulSchedule(db, shul.id), new Schedule(expected, 5787).getScheduleData());
    expected.setHebYear(5788);
    assert.deepEqual(getShulSchedule(db, shul.id, 5788), new Schedule(expected, 5788).getScheduleData());
    assert.equal(db.getShul(shul.id).settings.hebYear, 5787);
    assert.throws(() => getShulSchedule(db, 'missing'), /not found/);
});

test('manual occasions persist across reopening and invalid mixed publications do not partially write', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-occasions-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'db.sqlite');
    let db = openDatabase(path);
    let shul;
    const key = { dateString: '2026-10-10', desc: 'Bereshit' };
    try {
        shul = db.createShul({ name: 'Occasions', settings: { hebYear: 5787 } });
        db.setReadingLocks(shul.id, [{ ...key, manualOccasions: ['Birthday'] }]);
        assert.throws(() => db.setReadingLocks(shul.id, [{ ...key, locked: true },
            { ...key, manualOccasions: ['Invalid', 'invalid'] }]), TypeError);
        assert.deepEqual(db.listReadingLocks(shul.id), []);
    } finally { db.close(); }
    db = openDatabase(path);
    try {
        assert.deepEqual(db.listReadingOccasions(shul.id), [{ ...key, manualOccasions: ['Birthday'] }]);
    } finally { db.close(); }
});
