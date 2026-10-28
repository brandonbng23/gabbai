import { validatePicture } from '../pictures.mjs';
import { userTitles } from '../../interfaces/titles.mts';
import { DatabaseSync } from 'node:sqlite';
import { randomInt, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultShulSettings, mergeShulSettings, serializeUserSettings, validateKeys } from './settings.mjs';
import { createMessagingRepository } from './messages.mjs';
import { createNotificationRepository } from './notifications.mjs';

export const defaultDatabasePath = fileURLToPath(new URL('../../data/gabbai.sqlite', import.meta.url));
const shulFields = ['name', 'websiteUrl', 'donationUrl', 'email', 'phone', 'address'];
const userFields = ['shulId', 'firstName', 'lastName', 'hebrewName', 'email', 'phone', 'role', 'title'];

function normalizeShulCode(value) {
    const code = text(value, 'shulCode', true).toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) throw new TypeError('Enter a four-letter shul code.');
    return code;
}

// Called inside a write transaction so concurrent shul creation cannot reuse a code.
function assignShulCode(db, shulId) {
    const used = new Set(db.prepare('SELECT code FROM shul_codes').all().map(row => row.code));
    const capacity = 26 ** 4;
    const start = randomInt(capacity);
    for (let offset = 0; offset < capacity; offset++) {
        let value = (start + offset) % capacity;
        let code = '';
        for (let i = 0; i < 4; i++) {
            code = String.fromCharCode(65 + value % 26) + code;
            value = Math.floor(value / 26);
        }
        if (code !== 'DEMO' && !used.has(code)) {
            db.prepare('INSERT INTO shul_codes (shul_id, code) VALUES (?, ?)').run(shulId, code);
            return;
        }
    }
    throw new Error('All four-letter shul codes have been assigned.');
}

function text(value, name, required = false) {
    if (typeof value !== 'string' || (required && !value.trim())) {
        throw new TypeError(`${name} must be ${required ? 'a nonempty' : 'a'} string`);
    }
    return value.trim();
}

function email(value) {
    const normalized = text(value, 'email', true).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new TypeError('Invalid email');
    return normalized;
}

function shulValues(input) {
    return shulFields.map(key => text(input[key] ?? (key === 'name' ? undefined : ''), key, key === 'name'));
}

function userValues(input) {
    const role = input.role ?? 'member';
    if (!['member', 'admin', 'guest'].includes(role)) throw new TypeError('role must be member, admin, or guest');
    return [input.shulId === null ? null : text(input.shulId, 'shulId', true), text(input.firstName, 'firstName', true),
        text(input.lastName, 'lastName', true), text(input.hebrewName ?? '', 'hebrewName'),
        email(input.email), text(input.phone ?? '', 'phone'), role, text(input.title ?? '', 'title')];
}

function pictureUrl(kind, id, version) {
    return `/api/${kind}/${encodeURIComponent(id)}/picture?v=${encodeURIComponent(version)}`;
}

function decodeShul(row) {
    if (!row) return null;
    return { id: row.id, code: row.join_code, name: row.name, websiteUrl: row.website_url, donationUrl: row.donation_url,
        email: row.email, phone: row.phone, address: row.address,
        ...(row.picture_version ? { pictureUrl: pictureUrl('shuls', row.id, row.picture_version) } : {}),
        settings: JSON.parse(row.settings_json), createdAt: row.created_at, updatedAt: row.updated_at };
}

function decodeUser(row) {
    if (!row) return null;
    return { id: row.id, shulId: row.shul_id, firstName: row.first_name, lastName: row.last_name,
        hebrewName: row.hebrew_name, email: row.email, phone: row.phone, role: row.role, title: row.title,
        ...(row.picture_version ? { pictureUrl: pictureUrl('users', row.id, row.picture_version) } : {}),
        assignedReadings: JSON.parse(row.assigned_readings_json ?? '[]'),
        settings: JSON.parse(row.settings_json), createdAt: row.created_at, updatedAt: row.updated_at };
}

export function openDatabase(filename = process.env.GABBAI_DATABASE_PATH || defaultDatabasePath) {
    const path = filename === ':memory:' ? filename : resolve(filename);
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    const db = new DatabaseSync(path);
    function transaction(work) {
        db.exec('BEGIN IMMEDIATE');
        try {
            const result = work();
            db.exec('COMMIT');
            return result;
        } catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
    }
    try {
        db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
        db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) STRICT`);
        // Rebuilding users must preserve dependent settings and reader assignments.
        const rebuildUsers = (db.prepare('SELECT max(version) AS version FROM schema_migrations').get().version ?? 0) < 13;
        if (rebuildUsers) db.exec('PRAGMA foreign_keys = OFF');
        transaction(() => {
            const version = db.prepare('SELECT max(version) AS version FROM schema_migrations').get().version ?? 0;
            if (version > 22) throw new Error('Database schema is newer than this application');
            if (version < 1) {
                db.exec(readFileSync(new URL('./migrations/001_profiles.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(1);
            }
            if (version < 2) {
                db.exec(readFileSync(new URL('./migrations/002_initial_shul_versions.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(2);
            }
            if (version < 3) {
                db.exec(readFileSync(new URL('./migrations/003_reading_locks.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(3);
            }
            if (version < 4) {
                db.exec(readFileSync(new URL('./migrations/004_reading_occasions.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(4);
            }
            if (version < 5) {
                db.exec(readFileSync(new URL('./migrations/005_reading_readers.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(5);
            }
            if (version < 6) {
                db.exec(readFileSync(new URL('./migrations/006_reading_aliyah_counts.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(6);
            }
            if (version < 7) {
                db.exec(readFileSync(new URL('./migrations/007_guest_role.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(7);
                if (db.prepare('PRAGMA foreign_key_check').all().length)
                    throw new Error('Guest role migration would violate foreign keys');
            }
            if (version < 8) {
                db.exec(readFileSync(new URL('./migrations/008_profile_pictures.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(8);
            }
            if (version < 9) {
                db.exec(readFileSync(new URL('./migrations/009_user_readings.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(9);
            }
            if (version < 10) {
                db.exec(readFileSync(new URL('./migrations/010_shul_codes.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(10);
            }
            if (version < 11) {
                db.exec(readFileSync(new URL('./migrations/011_letter_shul_codes.sql', import.meta.url), 'utf8'));
                const missing = db.prepare('SELECT id FROM shuls WHERE id NOT IN (SELECT shul_id FROM shul_codes)').all();
                for (const { id } of missing) assignShulCode(db, id);
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(11);
            }
            if (version < 12) {
                db.exec(readFileSync(new URL('./migrations/012_restore_demo_code.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(12);
            }
            if (version < 13) {
                db.exec(readFileSync(new URL('./migrations/013_optional_membership.sql', import.meta.url), 'utf8'));
                if (db.prepare('PRAGMA foreign_key_check').all().length)
                    throw new Error('Membership migration would violate foreign keys');
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(13);
            }
            if (version < 14) {
                db.exec(readFileSync(new URL('./migrations/014_authentication.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(14);
            }
            if (version < 15) {
                if (!db.prepare('PRAGMA table_info(reading_readers)').all().some(column => column.name === 'registered_by_user_id'))
                    db.exec(readFileSync(new URL('./migrations/015_guest_registration_owners.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(15);
            }
            if (version < 16) {
                db.exec(readFileSync(new URL('./migrations/016_messages.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(16);
            }
            if (version < 17) {
                if (!db.prepare('PRAGMA table_info(message_recipients)').all().some(column => column.name === 'deleted_at'))
                    db.exec(readFileSync(new URL('./migrations/017_message_trash.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(17);
            }
            if (version < 18) {
                if (!db.prepare('PRAGMA table_info(shul_message_receipts)').all().some(column => column.name === 'deleted_at'))
                    db.exec(readFileSync(new URL('./migrations/018_shul_message_trash.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(18);
            }
            if (version < 19) {
                db.exec(readFileSync(new URL('./migrations/019_message_replies.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(19);
            }
            if (version < 20) {
                db.exec(readFileSync(new URL('./migrations/020_message_trash_expiration.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(20);
            }
            if (version < 21) {
                db.exec(readFileSync(new URL('./migrations/021_admin_message_trash.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(21);
            }
            if (version < 22) {
                db.exec(readFileSync(new URL('./migrations/022_registration_notifications.sql', import.meta.url), 'utf8'));
                db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(22);
            }
        });
        if (rebuildUsers) db.exec('PRAGMA foreign_keys = ON');
    } catch (error) {
        db.close();
        throw error;
    }

    const shulQuery = 'SELECT s.*, c.code AS join_code, p.settings_json, pic.version AS picture_version FROM shuls s JOIN shul_codes c ON c.shul_id = s.id JOIN shul_settings p ON p.shul_id = s.id LEFT JOIN shul_pictures pic ON pic.shul_id = s.id';
    const userQuery = `SELECT u.*, p.settings_json, pic.version AS picture_version,
        (SELECT json_group_array(json_object('dateString', reading_date, 'desc', reading_name, 'aliyah', aliyah))
            FROM (SELECT reading_date, reading_name, aliyah FROM reading_readers
                WHERE user_id = u.id AND shul_id = u.shul_id
                ORDER BY reading_date, reading_name, aliyah)) AS assigned_readings_json
        FROM users u JOIN user_settings p ON p.user_id = u.id LEFT JOIN user_pictures pic ON pic.user_id = u.id`;
    const getShul = id => decodeShul(db.prepare(`${shulQuery} WHERE s.id = ?`).get(id));
    const getUser = id => decodeUser(db.prepare(`${userQuery} WHERE u.id = ?`).get(id));
    function requireRecord(record, name) {
        if (!record) throw new Error(`${name} not found`);
        return record;
    }

    function writePicture(kind, id, png) {
        if (!['users', 'shuls'].includes(kind)) throw new TypeError('Invalid picture owner');
        if (png !== null) validatePicture(png);
        const table = kind === 'users' ? 'user_pictures' : 'shul_pictures';
        const column = kind === 'users' ? 'user_id' : 'shul_id';
        requireRecord(kind === 'users' ? getUser(id) : getShul(id), 'Profile');
        if (png === null) db.prepare(`DELETE FROM ${table} WHERE ${column} = ?`).run(id);
        else db.prepare(`INSERT INTO ${table} (${column}, png, version) VALUES (?, ?, ?)
            ON CONFLICT (${column}) DO UPDATE SET png = excluded.png, version = excluded.version`)
            .run(id, png, randomUUID());
    }

    function setReadingLocks(shulId, patches) {
        if (!Array.isArray(patches) || patches.length === 0 || patches.length > 1000) {
            throw new TypeError('Provide between 1 and 1000 reading lock changes');
        }
        const values = patches.map(patch => {
            validateKeys(patch, 'aliyahCount' in patch ? ['dateString', 'desc', 'aliyahCount'] : 'readerId' in patch ? ['dateString', 'desc', 'aliyah', 'readerId'] : 'manualOccasions' in patch ? ['dateString', 'desc', 'manualOccasions'] : ['dateString', 'desc', 'aliyah', 'locked'], 'reading adjustment');
            const { dateString, desc, locked, aliyah = 0 } = patch;
            if (typeof dateString !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)
                || !Number.isFinite(Date.parse(dateString))
                || new Date(dateString).toISOString().slice(0, 10) !== dateString) {
                throw new TypeError('Invalid reading date');
            }
            text(desc, 'reading name', true);
            if ('aliyahCount' in patch) {
                if (patch.aliyahCount !== null && (!Number.isInteger(patch.aliyahCount) || patch.aliyahCount < 1 || patch.aliyahCount > 7))
                    throw new TypeError('Choose an aliyah count from 1 to 7');
                return { count: [shulId, dateString, desc, patch.aliyahCount] };
            }
            if ('manualOccasions' in patch) {
                const labels = patch.manualOccasions;
                if (!Array.isArray(labels) || labels.length > 100 || labels.some(label =>
                    typeof label !== 'string' || !label.trim() || label !== label.trim() || label.length > 120)
                    || new Set(labels.map(label => label.toLowerCase())).size !== labels.length) {
                    throw new TypeError('Provide up to 100 unique occasions, each between 1 and 120 characters');
                }
                return { occasions: [shulId, dateString, desc, JSON.stringify(labels)] };
            }
            if (!Number.isInteger(aliyah) || aliyah < 0 || aliyah > 9) throw new TypeError('Invalid aliyah');
            if ('readerId' in patch) {
                if (aliyah < 1) throw new TypeError('A reader must be assigned to an aliyah from 1 to 9');
                if (patch.readerId !== null) {
                    const reader = typeof patch.readerId === 'string' ? getUser(patch.readerId) : null;
                    if (!reader || reader.shulId !== shulId) throw new TypeError('Choose a user from this shul');
                }
                return { reader: [shulId, dateString, desc, aliyah, patch.readerId] };
            }
            if (typeof locked !== 'boolean') throw new TypeError('locked must be a boolean');
            return [shulId, dateString, desc, aliyah, Number(locked)];
        });
        return transaction(() => {
            requireRecord(getShul(shulId), 'Shul');
            const statement = db.prepare(`INSERT INTO reading_locks (shul_id, reading_date, reading_name, aliyah, locked)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (shul_id, reading_date, reading_name, aliyah)
                DO UPDATE SET locked = excluded.locked`);
            const occasionsStatement = db.prepare(`INSERT INTO reading_occasions (shul_id, reading_date, reading_name, occasions_json)
                VALUES (?, ?, ?, ?) ON CONFLICT (shul_id, reading_date, reading_name)
                DO UPDATE SET occasions_json = excluded.occasions_json`);
            const readerStatement = db.prepare(`INSERT INTO reading_readers (shul_id, reading_date, reading_name, aliyah, user_id)
                VALUES (?, ?, ?, ?, ?) ON CONFLICT (shul_id, reading_date, reading_name, aliyah)
                DO UPDATE SET user_id = excluded.user_id, registered_by_user_id = NULL`);
            const removeReader = db.prepare(`DELETE FROM reading_readers
                WHERE shul_id = ? AND reading_date = ? AND reading_name = ? AND aliyah = ?`);
            const countStatement = db.prepare(`INSERT INTO reading_aliyah_counts (shul_id, reading_date, reading_name, aliyah_count)
                VALUES (?, ?, ?, ?) ON CONFLICT (shul_id, reading_date, reading_name)
                DO UPDATE SET aliyah_count = excluded.aliyah_count`);
            const removeCount = db.prepare('DELETE FROM reading_aliyah_counts WHERE shul_id = ? AND reading_date = ? AND reading_name = ?');
            for (const value of values) {
                if (value.count) {
                    if (value.count[3] === null) removeCount.run(...value.count.slice(0, 3));
                    else countStatement.run(...value.count);
                    continue;
                }
                if (value.reader) {
                    const readerId = value.reader[4];
                    if (readerId === null) removeReader.run(...value.reader.slice(0, 4));
                    else {
                        if (getUser(readerId)?.shulId !== shulId) throw new TypeError('Choose a user from this shul');
                        readerStatement.run(...value.reader);
                    }
                } else if (value.occasions) occasionsStatement.run(...value.occasions);
                else statement.run(...value);
            }
        });
    }

    const { recordReadingConfirmation, recordSystemNotification, ...messaging } = createMessagingRepository(db, { transaction, getUser, getShul });
    const { recordRegistrationNotifications, ...notifications } = createNotificationRepository(db, { transaction, getUser, getShul, recordSystemNotification });
    messaging.purgeExpiredMessages();
    return {
        ...messaging,
        ...notifications,
        path,
        close: () => db.close(),
        getShul,
        getPicture(kind, id) {
            if (!['users', 'shuls'].includes(kind)) throw new TypeError('Invalid picture owner');
            const table = kind === 'users' ? 'user_pictures' : 'shul_pictures';
            const column = kind === 'users' ? 'user_id' : 'shul_id';
            return db.prepare(`SELECT png, version FROM ${table} WHERE ${column} = ?`).get(id) ?? null;
        },
        setPicture(kind, id, png) {
            return transaction(() => {
                writePicture(kind, id, png);
                return kind === 'users' ? getUser(id) : getShul(id);
            });
        },
        listReadingAliyahCounts(shulId) {
            return db.prepare('SELECT reading_date, reading_name, aliyah_count FROM reading_aliyah_counts WHERE shul_id = ?')
                .all(shulId).map(row => ({ dateString: row.reading_date, desc: row.reading_name, aliyahCount: row.aliyah_count }));
        },
        listGuestRegistrations(userId) {
            return db.prepare(`SELECT r.shul_id, s.name AS shul_name, r.reading_date, r.reading_name, r.aliyah, r.user_id
                FROM reading_readers r JOIN shuls s ON s.id = r.shul_id
                JOIN users u ON u.id = r.user_id AND u.shul_id = r.shul_id
                WHERE r.registered_by_user_id = ?
                ORDER BY r.reading_date, r.reading_name, r.aliyah`).all(userId)
                .map(row => ({ shulId: row.shul_id, shulName: row.shul_name, dateString: row.reading_date,
                    desc: row.reading_name, aliyah: row.aliyah, reader: getUser(row.user_id) }));
        },
        listReadingReaders(shulId) {
            const rows = db.prepare(`SELECT r.reading_date, r.reading_name, r.aliyah, u.id, u.first_name, u.last_name, u.email, u.role, u.title, pic.version AS picture_version
                FROM reading_readers r JOIN users u ON u.id = r.user_id AND u.shul_id = r.shul_id
                LEFT JOIN user_pictures pic ON pic.user_id = u.id WHERE r.shul_id = ?
                ORDER BY r.reading_date, r.reading_name, r.aliyah`).all(shulId);
            const assignedByUser = new Map();
            for (const row of rows) {
                if (!assignedByUser.has(row.id)) assignedByUser.set(row.id, []);
                assignedByUser.get(row.id).push({ dateString: row.reading_date, desc: row.reading_name, aliyah: row.aliyah });
            }
            return rows.map(row => ({ dateString: row.reading_date, desc: row.reading_name, aliyah: row.aliyah,
                reader: { id: row.id, firstName: row.first_name, lastName: row.last_name,
                    email: row.email, role: row.role, title: row.title,
                    assignedReadings: assignedByUser.get(row.id) ?? [],
                    ...(row.picture_version ? { pictureUrl: pictureUrl('users', row.id, row.picture_version) } : {}) } }));
        },
        listReadingOccasions(shulId) {
            return db.prepare('SELECT reading_date, reading_name, occasions_json FROM reading_occasions WHERE shul_id = ?')
                .all(shulId).map(row => ({ dateString: row.reading_date, desc: row.reading_name,
                    manualOccasions: JSON.parse(row.occasions_json) }));
        },
        listReadingLocks(shulId) {
            return db.prepare('SELECT reading_date, reading_name, aliyah, locked FROM reading_locks WHERE shul_id = ?')
                .all(shulId).map(row => ({ dateString: row.reading_date, desc: row.reading_name,
                    aliyah: row.aliyah, locked: Boolean(row.locked) }));
        },
        setReadingLocks,
        setReadingLock(shulId, patch) {
            return setReadingLocks(shulId, [patch]);
        },
        getInitialShulVersion(id) {
            const row = db.prepare('SELECT * FROM shul_initial_versions WHERE shul_id = ?').get(id);
            return row ? { info: JSON.parse(row.info_json), settings: JSON.parse(row.settings_json),
                source: row.source, capturedAt: row.captured_at } : null;
        },
        getUser,
        getCredentials(value) {
            const row = db.prepare(`SELECT u.id, c.password_hash FROM users u
                LEFT JOIN user_credentials c ON c.user_id = u.id WHERE u.email = ?`).get(email(value));
            return row ? { userId: row.id, passwordHash: row.password_hash ?? null } : null;
        },
        createAccount(input, passwordHash, tokenHash, expiresAt) {
            validateKeys(input, ['shulCode', 'title', 'firstName', 'lastName', 'hebrewName', 'email', 'phone'], 'registration');
            return transaction(() => {
                const shul = db.prepare('SELECT shul_id FROM shul_codes WHERE code = ?').get(normalizeShulCode(input.shulCode));
                if (!shul) throw new TypeError('No shul matches that code. Check with your shul administrator.');
                const values = userValues({ ...input, shulId: shul.shul_id, role: 'member' });
                const id = randomUUID();
                db.prepare(`INSERT INTO users (id, shul_id, first_name, last_name, hebrew_name, email, phone, role, title)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, ...values);
                db.prepare("INSERT INTO user_settings (user_id, settings_json) VALUES (?, '{}')").run(id);
                db.prepare('INSERT INTO user_credentials (user_id, password_hash) VALUES (?, ?)').run(id, passwordHash);
                db.prepare('INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash, id, expiresAt);
                return getUser(id);
            });
        },
        setPasswordHash(userId, passwordHash, session) {
            return transaction(() => {
                requireRecord(getUser(userId), 'User');
                if (session) {
                    const current = db.prepare('SELECT password_hash FROM user_credentials WHERE user_id = ?').get(userId)?.password_hash ?? null;
                    if (current !== session.expectedHash) {
                        const error = new Error('Your password changed. Sign in again before updating it.');
                        error.status = 409;
                        throw error;
                    }
                }
                db.prepare(`INSERT INTO user_credentials (user_id, password_hash) VALUES (?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET password_hash = excluded.password_hash`).run(userId, passwordHash);
                db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
                if (session) db.prepare('INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
                    .run(session.tokenHash, userId, session.expiresAt);
            });
        },
        createSession(userId, tokenHash, expiresAt, expectedPasswordHash) {
            transaction(() => {
                if (expectedPasswordHash !== undefined
                    && db.prepare('SELECT password_hash FROM user_credentials WHERE user_id = ?').get(userId)?.password_hash !== expectedPasswordHash) {
                    const error = new Error('Email or password is incorrect.');
                    error.status = 401;
                    throw error;
                }
                db.prepare('DELETE FROM user_sessions WHERE expires_at <= ?').run(Date.now());
                db.prepare('INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash, userId, expiresAt);
            });
        },
        getSessionUserId(tokenHash) {
            return db.prepare('SELECT user_id FROM user_sessions WHERE token_hash = ? AND expires_at > ?').get(tokenHash, Date.now())?.user_id ?? null;
        },
        deleteSession(tokenHash) { db.prepare('DELETE FROM user_sessions WHERE token_hash = ?').run(tokenHash); },
        recordAuthAttempt(bucket, limit, windowMs = 15 * 60 * 1000) {
            return transaction(() => {
                const now = Date.now();
                db.prepare('DELETE FROM auth_attempts WHERE started_at < ?').run(now - windowMs);
                db.prepare(`INSERT INTO auth_attempts (bucket, started_at, attempts) VALUES (?, ?, 1)
                    ON CONFLICT(bucket) DO UPDATE SET attempts = attempts + 1`).run(bucket, now);
                return db.prepare('SELECT attempts FROM auth_attempts WHERE bucket = ?').get(bucket).attempts <= limit;
            });
        },
        getShulByCode: code => decodeShul(db.prepare(`${shulQuery} WHERE c.code = ?`).get(normalizeShulCode(code))),
        removeUnusedDemoShuls() {
            return transaction(() => {
                // Failed sample startup once left freshly created, empty shuls.
                // Only remove unchanged creation snapshots with no user data.
                if (!db.prepare("SELECT 1 FROM shul_codes WHERE code = 'DEMO'").get()) return 0;
                return db.prepare(`DELETE FROM shuls WHERE id IN (
                    SELECT s.id FROM shuls s
                    JOIN shul_codes c ON c.shul_id = s.id
                    JOIN shul_initial_versions i ON i.shul_id = s.id
                    JOIN shul_settings settings ON settings.shul_id = s.id
                    WHERE c.code <> 'DEMO' AND i.source = 'creation'
                      AND json_extract(i.info_json, '$.name') = 'Demo Shul'
                      AND json_extract(i.info_json, '$.websiteUrl') = 'https://demoshul.org'
                      AND json_extract(i.info_json, '$.email') = 'shalom@demoshul.org'
                      AND s.name = json_extract(i.info_json, '$.name')
                      AND s.website_url = json_extract(i.info_json, '$.websiteUrl')
                      AND s.donation_url = json_extract(i.info_json, '$.donationUrl')
                      AND s.email = json_extract(i.info_json, '$.email')
                      AND s.phone = json_extract(i.info_json, '$.phone')
                      AND s.address = json_extract(i.info_json, '$.address')
                      AND settings.settings_json = i.settings_json
                      AND NOT EXISTS (SELECT 1 FROM users WHERE shul_id = s.id)
                      AND NOT EXISTS (SELECT 1 FROM reading_readers WHERE shul_id = s.id)
                      AND NOT EXISTS (SELECT 1 FROM reading_locks WHERE shul_id = s.id)
                      AND NOT EXISTS (SELECT 1 FROM reading_occasions WHERE shul_id = s.id)
                      AND NOT EXISTS (SELECT 1 FROM reading_aliyah_counts WHERE shul_id = s.id)
                      AND NOT EXISTS (SELECT 1 FROM shul_pictures WHERE shul_id = s.id)
                )`).run().changes;
            });
        },
        ensureDemoShulCode(shulId) {
            return transaction(() => {
                requireRecord(getShul(shulId), 'Shul');
                db.prepare("UPDATE shul_codes SET code = 'DEMO' WHERE shul_id = ?").run(shulId);
                return getShul(shulId);
            });
        },
        getUserByEmail: value => decodeUser(db.prepare(`${userQuery} WHERE u.email = ?`).get(email(value))),
        listShuls: () => db.prepare(`${shulQuery} ORDER BY s.name, s.id`).all().map(decodeShul),
        listShulUsers: shulId => db.prepare(`${userQuery} WHERE u.shul_id = ? ORDER BY u.last_name, u.first_name, u.id`).all(shulId).map(decodeUser),
        updateShulUsers(shulId, actorId, changes) {
            return transaction(() => {
                const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
                const actor = getUser(actorId);
                if (!actor || actor.role !== 'admin' || actor.shulId !== shulId)
                    fail(403, 'Only this shul’s administrators can change its users.');
                if (!Array.isArray(changes) || changes.length === 0 || changes.length > 1000)
                    throw new TypeError('Provide between 1 and 1000 user changes.');
                const seen = new Set();
                for (const change of changes) {
                    validateKeys(change, ['userId', 'role', 'previousRole', 'profile', 'previousProfile', 'picture', 'previousPictureUrl'], 'user change');
                    if (typeof change.userId !== 'string' || seen.has(change.userId)
                        || !['member', 'admin', 'guest'].includes(change.previousRole)
                        || ('role' in change && ![null, 'member', 'admin'].includes(change.role))
                        || (!('role' in change) && !('profile' in change) && !('picture' in change)))
                        throw new TypeError('Choose a valid, unique user and action.');
                    seen.add(change.userId);
                    const target = getUser(change.userId);
                    if (!target || target.shulId !== shulId) fail(404, 'User no longer belongs to this shul.');
                    if (target.id === actorId) fail(400, 'You cannot change your own shul role or association.');
                    if (target.role !== change.previousRole) fail(409, 'A user’s role has changed. Reload the page before publishing.');
                    if ('profile' in change) {
                        if (target.role === 'admin' || change.role === null)
                            fail(400, 'Only member and guest profiles can be edited.');
                        const fields = ['title', 'firstName', 'lastName', 'hebrewName', 'email', 'phone'];
                        validateKeys(change.profile, fields, 'profile');
                        validateKeys(change.previousProfile, Object.keys(change.profile), 'previous profile');
                        if (!Object.keys(change.profile).length) throw new TypeError('Provide profile changes.');
                        for (const [key, value] of Object.entries(change.profile)) {
                            if (typeof value !== 'string' || value.length > 254
                                || typeof change.previousProfile[key] !== 'string')
                                throw new TypeError('Profile fields must be strings of at most 254 characters.');
                            if (target[key] !== change.previousProfile[key])
                                fail(409, 'A user’s profile has changed. Reload the page before publishing.');
                        }
                        if ('title' in change.profile && change.profile.title !== '' && !userTitles.includes(change.profile.title))
                            throw new TypeError('Choose a title from the list.');
                        const values = userValues({ ...target, ...change.profile });
                        db.prepare(`UPDATE users SET first_name = ?, last_name = ?, hebrew_name = ?, email = ?, phone = ?, title = ?,
                            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`)
                            .run(values[1], values[2], values[3], values[4], values[5], values[7], target.id);
                    } else if ('previousProfile' in change) throw new TypeError('Provide profile changes with their previous values.');
                    if ('picture' in change) {
                        if (target.role === 'admin' || change.role === null)
                            fail(400, 'Only member and guest pictures can be edited.');
                        if (change.previousPictureUrl !== null && typeof change.previousPictureUrl !== 'string')
                            throw new TypeError('Provide the previous picture URL or null.');
                        if ((target.pictureUrl ?? null) !== change.previousPictureUrl)
                            fail(409, 'A user’s picture has changed. Reload the page before publishing.');
                        writePicture('users', target.id, change.picture);
                    } else if ('previousPictureUrl' in change) throw new TypeError('Provide a picture change with its previous URL.');
                    if (change.role === null) {
                        if (target.role === 'admin') fail(400, 'Demote an administrator before removing them from the shul.');
                        db.prepare('DELETE FROM reading_readers WHERE shul_id = ? AND user_id = ?').run(shulId, target.id);
                        db.prepare("UPDATE users SET shul_id = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(target.id);
                    } else if ('role' in change) {
                        if (target.role === 'guest' || target.role === change.role)
                            fail(400, 'Only members can be promoted and administrators demoted.');
                        db.prepare("UPDATE users SET role = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(change.role, target.id);
                    }
                }
                return db.prepare(`${userQuery} WHERE u.shul_id = ? ORDER BY u.last_name, u.first_name, u.id`).all(shulId).map(decodeUser);
            });
        },
        getUserShul: userId => {
            const user = getUser(userId);
            return user ? getShul(user.shulId) : null;
        },
        createShul(input) {
            validateKeys(input, [...shulFields, 'settings'], 'shul');
            const values = shulValues(input);
            const settings = mergeShulSettings(defaultShulSettings(input.settings?.hebYear), input.settings ?? {});
            const id = randomUUID();
            return transaction(() => {
                db.prepare(`INSERT INTO shuls (id, name, website_url, donation_url, email, phone, address)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, ...values);
                assignShulCode(db, id);
                db.prepare('INSERT INTO shul_settings (shul_id, settings_json) VALUES (?, ?)').run(id, JSON.stringify(settings));
                const info = Object.fromEntries(shulFields.map((key, index) => [key, values[index]]));
                db.prepare(`INSERT INTO shul_initial_versions (shul_id, info_json, settings_json, source)
                    VALUES (?, ?, ?, 'creation')`).run(id, JSON.stringify(info), JSON.stringify(settings));
                return getShul(id);
            });
        },
        cancelReading(shulId, { dateString, desc, aliyah }, userId) {
            // Match ownership in the DELETE itself so a reassigned slot cannot be removed.
            return db.prepare(`DELETE FROM reading_readers
                WHERE shul_id = ? AND reading_date = ? AND reading_name = ? AND aliyah = ? AND user_id = ?`)
                .run(shulId, dateString, desc, aliyah, userId).changes > 0;
        },
        registerReading(shulId, { dateString, desc, aliyah, readerId, guest, emailConfirmation = false, emailEnabled = false, now = new Date() }, validateReading) {
            if (typeof emailConfirmation !== 'boolean') throw new TypeError('Email confirmation must be true or false.');
            return transaction(() => {
                // Validate availability while holding the write lock, before creating a guest.
                validateReading();
                let id = readerId;
                if (guest) {
                    if (!userTitles.includes(guest.title)) throw new TypeError('Choose a title from the list.');
                    const values = userValues({ ...guest, shulId, role: 'guest' });
                    const existingId = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(values[4])?.id;
                    const existing = existingId ? getUser(existingId) : null;
                    if (existing) {
                        // Email identifies a guest even if later forms use different names or omit Hebrew details.
                        if (existing.role !== 'guest' || existing.shulId !== shulId) {
                            const error = new Error('This email is associated with a member, administrator, or another shul. Register with that profile or use another email.');
                            error.status = 409;
                            throw error;
                        }
                        id = existing.id;
                        const hebrewName = Object.hasOwn(guest, 'hebrewName') ? values[3] : existing.hebrewName;
                        if (existing.firstName !== values[1] || existing.lastName !== values[2]
                            || existing.hebrewName !== hebrewName || existing.title !== values[7]) {
                            db.prepare(`UPDATE users SET first_name = ?, last_name = ?, hebrew_name = ?, title = ?,
                                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`)
                                .run(values[1], values[2], hebrewName, values[7], id);
                        }
                    } else {
                        id = randomUUID();
                        db.prepare(`INSERT INTO users (id, shul_id, first_name, last_name, hebrew_name, email, phone, role, title)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, ...values);
                        db.prepare("INSERT INTO user_settings (user_id, settings_json) VALUES (?, '{}')").run(id);
                    }
                } else if (!id || getUser(id)?.shulId !== shulId) {
                    const error = new Error('Sign in with a profile from this shul.');
                    error.status = 403;
                    throw error;
                }
                db.prepare(`INSERT INTO reading_readers (shul_id, reading_date, reading_name, aliyah, user_id, registered_by_user_id)
                    VALUES (?, ?, ?, ?, ?, ?)`).run(shulId, dateString, desc, aliyah, id, guest ? readerId ?? null : null);
                const confirmation = recordReadingConfirmation(shulId, { dateString, desc, aliyah,
                    recipientIds: guest && readerId ? [id, readerId] : [id] });
                return { emailConfirmation: recordRegistrationNotifications({ shulId, readerId: id, guest: Boolean(guest), dateString, desc, aliyah,
                    confirmation, emailConfirmation, emailEnabled, now }) };
            });
        },
        createUser(input) {
            validateKeys(input, [...userFields, 'settings', 'shulCode'], 'user');
            let shulId = input.shulId;
            if ('shulCode' in input) {
                if ('shulId' in input) throw new TypeError('Provide a shul code or shul ID, not both.');
                const shul = db.prepare('SELECT shul_id FROM shul_codes WHERE code = ?').get(normalizeShulCode(input.shulCode));
                if (!shul) throw new TypeError('No shul matches that code. Check the code and try again.');
                shulId = shul.shul_id;
            }
            const values = userValues({ ...input, shulId: text(shulId, 'shulId', true) });
            const settings = serializeUserSettings(input.settings ?? {});
            const id = randomUUID();
            return transaction(() => {
                db.prepare(`INSERT INTO users (id, shul_id, first_name, last_name, hebrew_name, email, phone, role, title)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, ...values);
                db.prepare('INSERT INTO user_settings (user_id, settings_json) VALUES (?, ?)').run(id, settings);
                return getUser(id);
            });
        },
        updateShul(id, patch) {
            validateKeys(patch, [...shulFields, 'picture'], 'shul');
            return transaction(() => {
                const current = requireRecord(getShul(id), 'Shul');
                const values = shulValues({ ...current, ...patch });
                db.prepare(`UPDATE shuls SET name = ?, website_url = ?, donation_url = ?, email = ?, phone = ?, address = ?,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`).run(...values, id);
                if ('picture' in patch) writePicture('shuls', id, patch.picture);
                return getShul(id);
            });
        },
        updateUser(id, patch) {
            validateKeys(patch, [...userFields, 'picture'], 'user');
            return transaction(() => {
                const current = requireRecord(getUser(id), 'User');
                const values = userValues({ ...current, ...patch });
                db.prepare(`UPDATE users SET shul_id = ?, first_name = ?, last_name = ?, hebrew_name = ?, email = ?, phone = ?, role = ?, title = ?,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`).run(...values, id);
                if ('picture' in patch) writePicture('users', id, patch.picture);
                return getUser(id);
            });
        },
        updateShulSettings(id, patch) {
            return transaction(() => {
                const current = requireRecord(getShul(id), 'Shul');
                const settings = mergeShulSettings(current.settings, patch);
                db.prepare(`UPDATE shul_settings SET settings_json = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE shul_id = ?`).run(JSON.stringify(settings), id);
                return getShul(id);
            });
        },
        // Replace the whole preferences object; shul settings use partial updates.
        setUserSettings(id, settings) {
            const json = serializeUserSettings(settings);
            return transaction(() => {
                requireRecord(getUser(id), 'User');
                db.prepare(`UPDATE user_settings SET settings_json = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE user_id = ?`).run(json, id);
                return getUser(id);
            });
        },
    };
}
