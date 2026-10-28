import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { openDatabase } from '../backend/database/index.mjs';

const samples = [
    { kind: 'confirmation', subject: 'Welcome to your inbox',
        body: 'This is a sample message from The Gabbai Team. Reading confirmations and invitations will appear here.' },
    { kind: 'reading_invitation', subject: 'Readers needed this Shabbat',
        body: 'There are opportunities to read with your shul. Visit the schedule to find an available reading. This is a sample invitation.' },
    { kind: 'message', subject: 'A message from your shul',
        body: 'Thank you for being part of our community! This sample message shows how a note from your shul appears in your inbox.' },
    { kind: 'confirmation', subject: 'Sample reading confirmation',
        body: 'This is an example of a registration confirmation. No reading has been booked by this sample message.' },
    { kind: 'message', subject: 'Looking ahead to upcoming readings',
        body: 'Take a look at the upcoming schedule and consider signing up. This is a sample note from your shul.' },
];

// Explicit sample-data utility. The command below targets only the local dev database.
export function seedSampleMessages(filename) {
    const database = openDatabase(filename);
    database.close();
    const db = new DatabaseSync(filename);
    let messagesAdded = 0;
    try {
        db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE');
        const users = db.prepare('SELECT id, shul_id FROM users WHERE shul_id IS NOT NULL ORDER BY id').all();
        const findAdmin = db.prepare("SELECT id FROM users WHERE shul_id = ? AND role = 'admin' ORDER BY id LIMIT 1");
        const insert = db.prepare(`INSERT INTO messages
            (id, shul_id, sender_type, actor_user_id, kind, subject, body, idempotency_key, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(idempotency_key) DO NOTHING`);
        const deliver = db.prepare('INSERT INTO message_recipients (message_id, user_id, read_at) VALUES (?, ?, ?)');
        const now = Date.now();
        for (const user of users) {
            // Stable across restarts and profile changes, varying from three to five.
            const count = 3 + [...user.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
            const admin = findAdmin.get(user.shul_id);
            for (let index = 0; index < count; index++) {
                const sample = samples[index];
                const fromShul = sample.kind === 'message' && Boolean(admin);
                const id = randomUUID();
                const sentAt = new Date(now - (index + 1) * 6 * 60 * 60 * 1000).toISOString();
                const result = insert.run(id, user.shul_id, fromShul ? 'shul' : 'system', fromShul ? admin.id : null,
                    fromShul ? 'message' : sample.kind === 'message' ? 'reading_invitation' : sample.kind,
                    sample.subject, sample.body, `sample-messages:v1:${user.id}:${index}`, sentAt);
                if (!result.changes) continue;
                deliver.run(id, user.id, index === 0 ? sentAt : null);
                messagesAdded++;
            }
        }
        db.exec('COMMIT');
        return { users: users.length, messagesAdded };
    } catch (error) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw error;
    } finally {
        db.close();
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const filename = fileURLToPath(new URL('../data/gabbai.dev.sqlite', import.meta.url));
    const result = seedSampleMessages(filename);
    console.log(`Added ${result.messagesAdded} sample messages for ${result.users} users in ${filename}.`);
}
