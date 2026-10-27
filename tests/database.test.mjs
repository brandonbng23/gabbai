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

test('guest email unifies reading registrations across dates and survives reopening', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-guest-email-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'guests.sqlite');
    let db = openDatabase(path);
    let shul;
    let visitor;
    const first = { dateString: '2026-10-10', desc: 'Bereshit', aliyah: 1 };
    const second = { dateString: '2026-10-17', desc: 'Noach', aliyah: 2 };
    try {
        shul = db.createShul({ name: 'Guest readings', settings: { hebYear: 5787 } });
        db.registerReading(shul.id, { ...first, guest: { title: 'Mr.', firstName: 'Josh', lastName: 'Cohen', hebrewName: 'Yehoshua', email: 'josh@example.com' } }, () => {});
        visitor = db.getUserByEmail('josh@example.com');
        db.registerReading(shul.id, { ...second, guest: { title: 'Dr.', firstName: 'Joshua', lastName: 'Kohen', email: ' JOSH@EXAMPLE.COM ' } }, () => {});
        assert.equal(db.listShulUsers(shul.id).length, 1);
        assert.ok(db.listReadingReaders(shul.id).every(item => item.reader.id === visitor.id));
        const foreign = db.createShul({ name: 'Other shul', settings: { hebYear: 5787 } });
        assert.throws(() => db.registerReading(foreign.id, { ...first, guest: { title: 'Mr.', ...guest(shul.id) } }, () => {}), /another shul/);
        assert.deepEqual(db.listReadingReaders(foreign.id), []);
    } finally { db.close(); }
    db = openDatabase(path);
    try {
        const saved = db.getUserByEmail('JOSH@example.com');
        assert.equal(saved.id, visitor.id);
        assert.equal(saved.firstName, 'Joshua');
        assert.equal(saved.lastName, 'Kohen');
        assert.equal(saved.title, 'Dr.');
        assert.equal(saved.hebrewName, visitor.hebrewName);
        assert.deepEqual(saved.assignedReadings, [first, second]);
        assert.throws(() => db.registerReading(shul.id, { ...first, guest: { title: 'Rabbi', firstName: 'Must not save', lastName: 'Failed', hebrewName: '', email: saved.email } }, () => {}), /UNIQUE/);
        assert.deepEqual(db.getUser(saved.id), saved, 'Failed assignment rolls back profile changes');
        const third = { dateString: '2026-10-24', desc: 'Lech-Lecha', aliyah: 1 };
        db.registerReading(shul.id, { ...third, guest: { title: 'Dr.', firstName: 'Joshua', lastName: 'Kohen', hebrewName: '', email: saved.email } }, () => {});
        assert.equal(db.getUser(saved.id).hebrewName, '', 'An explicitly blank Hebrew name replaces the saved name');
        assert.equal(db.getUser(saved.id).assignedReadings.length, 3);
    } finally { db.close(); }
});

test('guest booking attribution migrates and survives reopening without altering profile assignments', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-guest-owners-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'guests.sqlite');
    let db = openDatabase(path);
    const shul = db.createShul({ name: 'Guest owners', settings: { hebYear: 5787 } });
    const actor = db.createUser({ shulId: shul.id, firstName: 'Booking', lastName: 'Owner', email: 'owner@example.com' });
    const first = { dateString: '2026-10-10', desc: 'Bereshit', aliyah: 1 };
    const details = { title: 'Mr.', firstName: 'Guest', lastName: 'Reader', email: 'guest-owner-test@example.com' };
    db.registerReading(shul.id, { ...first, guest: details }, () => {});
    db.close();
    const old = new DatabaseSync(path);
    old.exec('DROP INDEX reading_readers_registered_by; ALTER TABLE reading_readers DROP COLUMN registered_by_user_id; DELETE FROM schema_migrations WHERE version >= 15');
    old.close();
    db = openDatabase(path);
    try {
        assert.equal(db.listReadingReaders(shul.id).length, 1);
        assert.deepEqual(db.listGuestRegistrations(actor.id), [], 'Legacy anonymous registrations cannot be attributed by email');
        db.registerReading(shul.id, { ...first, aliyah: 2, guest: details, readerId: actor.id }, () => {});
        assert.deepEqual(db.getUser(actor.id).assignedReadings, []);
    } finally { db.close(); }
    db = openDatabase(path);
    try {
        const saved = db.listGuestRegistrations(actor.id);
        assert.equal(saved.length, 1);
        assert.equal(saved[0].aliyah, 2);
        assert.equal(saved[0].reader.email, details.email);
        assert.deepEqual(db.getUser(actor.id).assignedReadings, []);
        db.setReadingLocks(shul.id, [{ ...first, aliyah: 2, readerId: actor.id }]);
        assert.deepEqual(db.listGuestRegistrations(actor.id), []);
    } finally { db.close(); }
});

test('optional membership migration preserves profiles and discarded accounts survive reopening', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-membership-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'membership.sqlite');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    let db = openDatabase(path);
    let shul;
    let actor;
    let target;
    try {
        shul = db.createShul({ name: 'Membership', settings: { hebYear: 5787 } });
        actor = db.createUser({ ...guest(shul.id), email: 'admin@example.com', role: 'admin' });
        target = db.createUser({ ...guest(shul.id), settings: { language: 'he' } });
        db.setPicture('users', target.id, png);
        db.setReadingLocks(shul.id, [{ dateString: '2026-10-10', desc: 'Bereshit', aliyah: 1, readerId: target.id }]);
        target = db.getUser(target.id);
    } finally { db.close(); }
    const legacy = new DatabaseSync(path);
    try {
        legacy.exec('PRAGMA foreign_keys = OFF');
        legacy.exec(readFileSync(new URL('../backend/database/migrations/007_guest_role.sql', import.meta.url), 'utf8'));
        legacy.exec('DROP TABLE IF EXISTS auth_attempts; DROP TABLE IF EXISTS user_sessions; DROP TABLE IF EXISTS user_credentials; DELETE FROM schema_migrations WHERE version >= 13');
    } finally { legacy.close(); }
    db = openDatabase(path);
    try {
        assert.deepEqual(db.getUser(target.id), target);
        assert.deepEqual(Buffer.from(db.getPicture('users', target.id).png), png);
        db.updateShulUsers(shul.id, actor.id, [{ userId: target.id, previousRole: 'member', role: null }]);
    } finally { db.close(); }
    db = openDatabase(path);
    try {
        const saved = db.getUser(target.id);
        assert.equal(saved.shulId, null);
        assert.deepEqual(saved.assignedReadings, []);
        assert.deepEqual(saved.settings, target.settings);
        assert.equal(saved.pictureUrl, target.pictureUrl);
        assert.equal(saved.email, target.email);
        assert.deepEqual(db.listReadingReaders(shul.id), []);
        assert.equal(db.updateUser(target.id, { phone: '555-0100' }).phone, '555-0100');
        assert.throws(() => db.createUser({ ...guest('missing'), email: 'orphan@example.com' }), /FOREIGN KEY/);
    } finally { db.close(); }
});

test('shul codes are unique and user creation resolves membership from the code', t => {
    const { db, shul } = setup(t);
    const shuls = [shul, ...Array.from({ length: 100 }, (_, i) => db.createShul({ name: `Shul ${i}`, settings: { hebYear: 5787 } }))];
    assert.ok(shuls.every(item => /^[A-Z]{4}$/.test(item.code)));
    assert.ok(shuls.every(item => item.code !== 'DEMO'));
    assert.equal(new Set(shuls.map(item => item.code)).size, shuls.length);
    const { shulId: _shulId, ...details } = guest(shul.id);
    const user = db.createUser({ ...details, shulCode: ` ${shul.code.toLowerCase()} ` });
    assert.equal(user.shulId, shul.id);
    assert.equal(user.role, 'member');
    assert.deepEqual(user.assignedReadings, []);
    assert.throws(() => db.createUser({ ...details, email: 'other@example.com', shulId: shuls[1].id, shulCode: shul.code }), TypeError);
    for (const code of [1234, '', 'ABC', 'ABCDE', '1234', '12AB', null, 'DEMO']) {
        assert.throws(() => db.createUser({ ...details, email: 'other@example.com', shulCode: code }), TypeError);
    }
    assert.equal(db.getUserByEmail('other@example.com'), null);
    assert.equal(db.getShulByCode(shul.code).id, shul.id);
    assert.equal(db.updateShul(shul.id, { name: 'Renamed' }).code, shul.code);
    assert.throws(() => db.updateShul(shul.id, { code: '1234' }), TypeError);
});

test('DEMO is reserved for the demo shul and supports code-based membership', t => {
    const { db, shul } = setup(t);
    const demo = ensureDemoUser(db);
    assert.equal(db.getShul(demo.shulId).code, 'DEMO');
    assert.equal(db.getShulByCode(' demo ').id, demo.shulId);
    const { shulId: _shulId, ...details } = guest(shul.id);
    assert.equal(db.createUser({ ...details, shulCode: 'demo' }).shulId, demo.shulId);
    ensureDemoUser(db);
    assert.equal(db.getShul(demo.shulId).code, 'DEMO');
    assert.match(db.getShul(shul.id).code, /^[A-Z]{4}$/);
});

test('code migration backfills existing shuls and preserves letter codes across reopening', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-codes-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'codes.sqlite');
    let db = openDatabase(path);
    let shul;
    let demo;
    try {
        shul = db.createShul({ name: 'Existing shul', settings: { hebYear: 5787 } });
        demo = ensureDemoUser(db);
    } finally { db.close(); }
    const legacy = new DatabaseSync(path);
    try {
        legacy.exec('DROP TABLE shul_codes; DROP TABLE IF EXISTS auth_attempts; DROP TABLE IF EXISTS user_sessions; DROP TABLE IF EXISTS user_credentials; DELETE FROM schema_migrations WHERE version >= 10;');
    } finally { legacy.close(); }
    db = openDatabase(path);
    try {
        assert.match(db.getShul(shul.id).code, /^[A-Z]{4}$/);
        assert.equal(db.getShul(demo.shulId).code, 'DEMO');
    } finally { db.close(); }
    const raw = new DatabaseSync(path);
    try {
        raw.prepare('UPDATE shul_codes SET code = ? WHERE shul_id = ?').run('AABC', shul.id);
        assert.throws(() => raw.prepare('UPDATE shul_codes SET code = ? WHERE shul_id = ?').run('AABC', demo.shulId), /UNIQUE/);
        assert.throws(() => raw.prepare('UPDATE shul_codes SET code = ? WHERE shul_id = ?').run('ABC1', shul.id), /CHECK/);
    } finally { raw.close(); }
    db = openDatabase(path);
    try {
        assert.equal(db.getShul(shul.id).code, 'AABC');
        assert.equal(db.getShul(demo.shulId).code, 'DEMO');
        const { shulId: _shulId, ...details } = guest(shul.id);
        assert.equal(db.createUser({ ...details, shulCode: 'AABC' }).shulId, shul.id);
    } finally { db.close(); }
});

test('numeric shul codes migrate to letters while retaining DEMO and membership', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-numeric-codes-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'codes.sqlite');
    let db = openDatabase(path);
    let shul;
    let user;
    let demo;
    try {
        shul = db.createShul({ name: 'Numeric shul', settings: { hebYear: 5787 } });
        user = db.createUser(guest(shul.id));
        demo = ensureDemoUser(db);
    } finally { db.close(); }
    const raw = new DatabaseSync(path);
    try {
        raw.exec('DROP TABLE shul_codes; DROP TABLE IF EXISTS auth_attempts; DROP TABLE IF EXISTS user_sessions; DROP TABLE IF EXISTS user_credentials; DELETE FROM schema_migrations WHERE version >= 11;');
        raw.exec(readFileSync(new URL('../backend/database/migrations/010_shul_codes.sql', import.meta.url), 'utf8'));
        raw.prepare('INSERT INTO shul_codes (shul_id, code) VALUES (?, ?)').run(shul.id, '0123');
    } finally { raw.close(); }
    db = openDatabase(path);
    try {
        assert.match(db.getShul(shul.id).code, /^[A-Z]{4}$/);
        assert.equal(db.getShul(demo.shulId).code, 'DEMO');
        assert.equal(db.getUser(user.id).shulId, shul.id);
        assert.throws(() => db.getShulByCode('0123'), TypeError);
    } finally { db.close(); }
});

test('demo code repair preserves edited user profiles and unrelated shul codes', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-demo-code-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'demo.sqlite');
    let db = openDatabase(path);
    let demo;
    let edited;
    let other;
    try {
        demo = ensureDemoUser(db);
        edited = db.updateUser(demo.id, { email: 'edited@example.com', firstName: 'Edited' });
        db.updateShul(demo.shulId, { name: 'Edited congregation' });
        other = db.createShul({ name: 'Other', settings: { hebYear: 5787 } });
    } finally { db.close(); }
    const raw = new DatabaseSync(path);
    try {
        const codes = new Set(raw.prepare('SELECT code FROM shul_codes').all().map(row => row.code));
        const wrong = ['WTUL', 'TEST', 'ABCD'].find(code => !codes.has(code));
        raw.prepare('UPDATE shul_codes SET code = ? WHERE shul_id = ?').run(wrong, demo.shulId);
        raw.exec('DROP TABLE IF EXISTS auth_attempts; DROP TABLE IF EXISTS user_sessions; DROP TABLE IF EXISTS user_credentials; DELETE FROM schema_migrations WHERE version >= 12');
    } finally { raw.close(); }
    db = openDatabase(path);
    try {
        assert.equal(db.getShul(demo.shulId).code, 'DEMO');
        assert.equal(db.getShul(demo.shulId).name, 'Edited congregation');
        assert.deepEqual(db.getUser(demo.id), edited);
        assert.equal(db.getShul(other.id).code, other.code);
    } finally { db.close(); }
    db = openDatabase(path);
    try { assert.equal(db.getShul(demo.shulId).code, 'DEMO'); }
    finally { db.close(); }
});

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
    let code;
    try {
        code = db.getShul('legacy').code;
        assert.match(code, /^[A-Z]{4}$/);
        initial = db.getInitialShulVersion('legacy');
        assert.equal(initial.source, 'migration');
        assert.equal(initial.info.name, 'Earliest available');
        db.updateShul('legacy', { name: 'Later change' });
    } finally { db.close(); }
    db = openDatabase(path);
    try {
        assert.deepEqual(db.getInitialShulVersion('legacy'), initial);
        assert.equal(db.getShul('legacy').code, code);
    }
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

test('demo startup removes only unused duplicates left by failed seeding', t => {
    const { db, shul: unrelated } = setup(t);
    const demo = ensureDemoUser(db);
    const canonical = db.getShul(demo.shulId);
    const snapshot = db.getInitialShulVersion(demo.shulId);
    const profile = { ...snapshot.info, settings: canonical.settings };
    const empty = db.createShul(profile);
    const secondEmpty = db.createShul(profile);
    const populated = db.createShul(profile);
    const member = db.createUser({ ...guest(populated.id) });
    const customized = db.createShul(profile);
    db.updateShulSettings(customized.id, { a: 4 });
    const renamed = db.createShul(profile);
    db.updateShul(renamed.id, { name: 'A real congregation' });
    const withLocks = db.createShul(profile);
    db.setReadingLocks(withLocks.id, [{ dateString: '2026-10-10', desc: 'Bereshit', aliyah: 1, locked: true }]);
    assert.equal(ensureDemoUser(db).id, demo.id);
    assert.equal(db.getShul(empty.id), null);
    assert.equal(db.getShul(secondEmpty.id), null);
    assert.deepEqual(db.getShul(demo.shulId), canonical);
    for (const shul of [unrelated, populated, customized, renamed, withLocks]) assert.ok(db.getShul(shul.id));
    assert.equal(db.getUser(member.id).shulId, populated.id);
    assert.equal(db.removeUnusedDemoShuls(), 0);
});

test('demo startup reuses its shul and edited account after an email change', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-demo-restart-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const filename = join(directory, 'demo.sqlite');
    let db = openDatabase(filename);
    let demo;
    let edited;
    let unrelated;
    try {
        demo = ensureDemoUser(db);
        edited = db.updateUser(demo.id, { email: 'edited@example.com', firstName: 'Edited', title: 'Dr.' });
        db.setUserSettings(demo.id, { language: 'he' });
        const other = db.createShul({ name: 'Unrelated shul', settings: { hebYear: 5787 } });
        unrelated = db.createUser({ shulId: other.id, firstName: 'Unrelated', lastName: 'User', email: 'demo@example.com' });
    } finally { db.close(); }
    db = openDatabase(filename);
    try {
        for (let restart = 0; restart < 2; restart++) {
            const recovered = ensureDemoUser(db);
            assert.equal(recovered.id, demo.id);
            assert.equal(recovered.shulId, demo.shulId);
            assert.equal(recovered.email, edited.email);
            assert.equal(recovered.firstName, edited.firstName);
            assert.equal(recovered.title, edited.title);
            assert.deepEqual(recovered.settings, { language: 'he' });
            assert.equal(db.getShul(demo.shulId).code, 'DEMO');
            assert.equal(db.listShuls().length, 2);
            assert.equal(db.listShulUsers(demo.shulId).length, 1);
            assert.deepEqual(db.getUser(unrelated.id), unrelated);
        }
    } finally { db.close(); }
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
    const withoutCountMetadata = readings => readings.map(({ aliyahCount, defaultAliyahCount, aliyahCountOverride, aliyahOptions, ...reading }) => reading);
    assert.deepEqual(withoutCountMetadata(getShulSchedule(db, shul.id)), new Schedule(expected, 5787).getScheduleData());
    expected.setHebYear(5788);
    assert.deepEqual(withoutCountMetadata(getShulSchedule(db, shul.id, 5788)), new Schedule(expected, 5788).getScheduleData());
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

test('reader assignments survive reopening and preserve original maftir slot', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-readers-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'db.sqlite');
    let db = openDatabase(path);
    let shul, reader;
    const key = { dateString: '2026-10-10', desc: 'Bereshit', aliyah: 8 };
    try {
        shul = db.createShul({ name: 'Readers', settings: { hebYear: 5787 } });
        reader = db.createUser(guest(shul.id));
        db.setReadingLocks(shul.id, [{ ...key, readerId: reader.id }]);
    } finally { db.close(); }
    db = openDatabase(path);
    try {
        const [saved] = db.listReadingReaders(shul.id);
        assert.equal(saved.aliyah, 8);
        assert.equal(saved.reader.id, reader.id);
        assert.equal(saved.reader.firstName, reader.firstName);
        db.setReadingLocks(shul.id, [{ ...key, readerId: null }]);
        assert.deepEqual(db.listReadingReaders(shul.id), []);
    } finally { db.close(); }
});

test('reading count overrides survive reopening and can return to the schedule rule', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-counts-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'db.sqlite');
    let db = openDatabase(path);
    let shul;
    const key = { dateString: '2026-10-10', desc: 'Bereshit' };
    try {
        shul = db.createShul({ name: 'Counts', settings: { hebYear: 5787, a: 3 } });
        db.setReadingLocks(shul.id, [{ ...key, aliyahCount: 5 }]);
        assert.throws(() => db.setReadingLocks(shul.id, [{ ...key, aliyahCount: 2 }, { ...key, aliyahCount: 8 }]), TypeError);
    } finally { db.close(); }
    db = openDatabase(path);
    try {
        assert.deepEqual(db.listReadingAliyahCounts(shul.id), [{ ...key, aliyahCount: 5 }]);
        assert.equal(getShulSchedule(db, shul.id).find(reading => reading.desc === key.desc).aliyahCount, 5);
        db.setReadingLocks(shul.id, [{ ...key, aliyahCount: null }]);
        assert.equal(getShulSchedule(db, shul.id).find(reading => reading.desc === key.desc).aliyahCount, 3);
    } finally { db.close(); }
});

test('guest profiles use registration fields and support role changes', t => {
    const { db, shul } = setup(t);
    const profile = db.createUser({ ...guest(shul.id), role: 'guest', hebrewName: 'Yehoshua ben Shlomo' });
    assert.equal(profile.role, 'guest');
    assert.equal(profile.hebrewName, 'Yehoshua ben Shlomo');
    assert.equal(profile.phone, '');
    assert.equal(profile.title, '');
    assert.equal(db.listShulUsers(shul.id).find(user => user.id === profile.id).role, 'guest');
    assert.equal(db.updateUser(profile.id, { role: 'member' }).role, 'member');
    assert.equal(db.updateUser(profile.id, { role: 'guest' }).role, 'guest');
    for (const field of ['firstName', 'lastName', 'email']) {
        assert.throws(() => db.updateUser(profile.id, { [field]: '' }), TypeError);
    }
});

test('guest role migration preserves existing users, settings, assignments and constraints', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-guest-migration-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'db.sqlite');
    const legacy = new DatabaseSync(path);
    legacy.exec('PRAGMA foreign_keys = ON; CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY)');
    for (const name of ['001_profiles', '002_initial_shul_versions', '003_reading_locks', '004_reading_occasions', '005_reading_readers', '006_reading_aliyah_counts']) {
        legacy.exec(readFileSync(new URL(`../backend/database/migrations/${name}.sql`, import.meta.url), 'utf8'));
    }
    legacy.exec(`INSERT INTO schema_migrations VALUES (6);
        INSERT INTO shuls (id, name) VALUES ('legacy-shul', 'Legacy');
        INSERT INTO shul_settings (shul_id, settings_json) VALUES ('legacy-shul', '{}');
        INSERT INTO users (id, shul_id, first_name, last_name, email, role) VALUES ('legacy-user', 'legacy-shul', 'Josh', 'Cohen', 'legacy@example.com', 'admin');
        INSERT INTO user_settings (user_id, settings_json) VALUES ('legacy-user', '{"language":"he"}');
        INSERT INTO reading_readers VALUES ('legacy-shul', '2026-10-10', 'Bereshit', 1, 'legacy-user');`);
    legacy.close();
    let db = openDatabase(path);
    try {
        const user = db.getUser('legacy-user');
        assert.equal(user.role, 'admin');
        assert.deepEqual(user.settings, { language: 'he' });
        assert.equal(db.listReadingReaders('legacy-shul')[0].reader.id, user.id);
        db.updateUser(user.id, { role: 'guest' });
        assert.throws(() => db.createUser({ ...guest('missing'), email: 'missing@example.com', role: 'guest' }), /FOREIGN KEY/);
        assert.throws(() => db.createUser({ ...guest('legacy-shul'), email: user.email, role: 'guest' }), /UNIQUE/);
    } finally { db.close(); }
    db = openDatabase(path);
    try {
        assert.equal(db.getUser('legacy-user').role, 'guest');
        assert.equal(db.listReadingReaders('legacy-shul')[0].reader.role, 'guest');
        assert.deepEqual(db.getUser('legacy-user').settings, { language: 'he' });
    } finally { db.close(); }
});

test('demo profile enrichment fills missing sample fields and preserves existing and unrelated details', t => {
    const { db, shul: unrelated } = setup(t);
    const demo = ensureDemoUser(db);
    assert.equal(demo.title, 'Mr.');
    assert.equal(demo.hebrewName, 'Moshe ben Avraham');
    assert.equal(demo.phone, '(202) 555-0100');
    const sample = db.createUser({ shulId: demo.shulId, firstName: 'David', lastName: 'Cohen',
        email: 'david.cohen@example.com', title: 'Mr.' });
    const edited = db.createUser({ shulId: demo.shulId, firstName: 'Sarah', lastName: 'Levy',
        email: 'sarah.levy@example.com', title: 'Dr.', hebrewName: 'Saved Hebrew name', phone: '(202) 555-0199' });
    const outsider = db.createUser({ shulId: unrelated.id, firstName: 'Daniel', lastName: 'Goldberg',
        email: 'daniel.goldberg@example.com' });
    ensureDemoUser(db);
    const populated = db.getUser(sample.id);
    assert.equal(populated.hebrewName, 'David ben Avraham');
    assert.equal(populated.phone, '(202) 555-0101');
    assert.deepEqual(db.getUser(edited.id), edited);
    assert.deepEqual(db.getUser(outsider.id), outsider);
    ensureDemoUser(db);
    assert.deepEqual(db.getUser(sample.id), populated);
});

test('user and shul picture bytes survive reopening and can be removed independently', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-pictures-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'db.sqlite');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    let db = openDatabase(path);
    let user;
    let shul;
    try {
        shul = db.createShul({ name: 'Pictures', settings: { hebYear: 5787 } });
        user = db.createUser(guest(shul.id));
        db.setPicture('users', user.id, png);
        db.setPicture('shuls', shul.id, png);
        assert.throws(() => db.setPicture('users', user.id, Buffer.from('invalid')), TypeError);
    } finally { db.close(); }
    db = openDatabase(path);
    try {
        assert.ok(db.getUser(user.id).pictureUrl);
        assert.ok(db.getShul(shul.id).pictureUrl);
        assert.deepEqual(Buffer.from(db.getPicture('users', user.id).png), png);
        assert.deepEqual(Buffer.from(db.getPicture('shuls', shul.id).png), png);
        db.setPicture('users', user.id, null);
        assert.equal(db.getUser(user.id).pictureUrl, undefined);
        assert.ok(db.getShul(shul.id).pictureUrl);
    } finally { db.close(); }
});

test('user reading associations follow assignments, survive reopening and stay within current membership', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-user-readings-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'db.sqlite');
    let db = openDatabase(path);
    let shul;
    let reader;
    let replacement;
    const first = { dateString: '2026-10-10', desc: 'Bereshit', aliyah: 1 };
    const maftir = { ...first, aliyah: 8 };
    const later = { dateString: '2026-10-17', desc: 'Noach', aliyah: 9 };
    try {
        shul = db.createShul({ name: 'User readings', settings: { hebYear: 5787 } });
        reader = db.createUser({ ...guest(shul.id), role: 'guest' });
        replacement = db.createUser({ ...guest(shul.id), email: 'replacement@example.com' });
        assert.deepEqual(reader.assignedReadings, []);
        db.setReadingLocks(shul.id, [later, maftir, first].map(reading => ({ ...reading, readerId: reader.id })));
        assert.deepEqual(db.getUser(reader.id).assignedReadings, [first, maftir, later]);
        assert.deepEqual(db.getUserByEmail(reader.email).assignedReadings, [first, maftir, later]);
        assert.deepEqual(db.listShulUsers(shul.id).find(user => user.id === reader.id).assignedReadings, [first, maftir, later]);
        assert.deepEqual(db.getUser(replacement.id).assignedReadings, []);
        assert.throws(() => db.updateUser(reader.id, { assignedReadings: [] }), TypeError);
    } finally { db.close(); }
    db = openDatabase(path);
    try {
        assert.deepEqual(db.getUser(reader.id).assignedReadings, [first, maftir, later]);
        db.setReadingLocks(shul.id, [{ ...maftir, readerId: replacement.id }, { ...first, readerId: null }]);
        assert.deepEqual(db.getUser(reader.id).assignedReadings, [later]);
        assert.deepEqual(db.getUser(replacement.id).assignedReadings, [maftir]);
        const other = db.createShul({ name: 'New membership', settings: { hebYear: 5787 } });
        db.updateUser(replacement.id, { shulId: other.id });
        assert.deepEqual(db.getUser(replacement.id).assignedReadings, []);
    } finally { db.close(); }
});
