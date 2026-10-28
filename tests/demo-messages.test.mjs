import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../backend/database/index.mjs';
import { seedSampleMessages } from '../scripts/seed-messages.mjs';

test('sample messages populate every affiliated profile with 3–5 messages and preserve data on reruns', t => {
    const dir = mkdtempSync(join(tmpdir(), 'gabbai-sample-messages-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const path = join(dir, 'dev.sqlite');
    const db = openDatabase(path);
    t.after(() => db.close());
    const shul = db.createShul({ name: 'Demo', settings: { hebYear: 5787 } });
    const otherShul = db.createShul({ name: 'No admin yet', settings: { hebYear: 5787 } });
    const profiles = ['admin', 'member', 'guest', 'member'].map((role, index) => db.createUser({
        shulId: index === 3 ? otherShul.id : shul.id, role,
        firstName: `Sample${index}`, lastName: 'User', email: `sample${index}@example.com`,
    }));
    const realMessage = db.sendSystemMessage(shul.id, { kind: 'reading_invitation', subject: 'Existing message',
        body: 'Preserve this message.', recipientIds: [profiles[1].id], idempotencyKey: 'existing' });
    const result = seedSampleMessages(path);
    assert.equal(result.users, profiles.length);
    let expectedAdded = 0;
    for (const profile of profiles) {
        const expectedCount = 3 + [...profile.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
        const samples = db.listUserMessages(profile.id).filter(item => item.id !== realMessage.id);
        assert.equal(samples.length, expectedCount);
        expectedAdded += expectedCount;
        assert.equal(samples.filter(item => item.readAt).length, 1);
        assert.ok(samples.some(item => !item.readAt));
        assert.equal(new Set(samples.map(item => item.sendAt)).size, expectedCount);
        assert.deepEqual(db.getUser(profile.id).assignedReadings, [], 'Sample confirmations never book readings');
        if (profile.shulId === shul.id) assert.ok(samples.some(item => item.sender.type === 'shul'));
    }
    assert.equal(result.messagesAdded, expectedAdded);
    const unread = db.listUserMessages(profiles[1].id).find(item => !item.readAt);
    db.markUserMessageRead(profiles[1].id, unread.id);
    const before = profiles.map(profile => db.listUserMessages(profile.id));
    assert.deepEqual(seedSampleMessages(path), { users: profiles.length, messagesAdded: 0 });
    assert.deepEqual(profiles.map(profile => db.listUserMessages(profile.id)), before);
    assert.ok(db.listUserMessages(profiles[1].id).some(item => item.id === realMessage.id));
});
