import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { openDatabase } from '../backend/database/index.mjs';
import { createApp } from '../backend/app.mjs';

const portion = { portion: 'Vayeshev', occasion: 'B’nai mitzvah' };
const profile = { firstName: 'Reader', lastName: 'Test', email: 'reader@example.com' };

test('significant portions survive reopening and changes preserve unrelated preferences', t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-portions-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'preferences.sqlite');
    let db = openDatabase(path);
    let id;
    try {
        const shul = db.createShul({ name: 'Test Shul', settings: { hebYear: 5787 } });
        id = db.createUser({ ...profile, shulId: shul.id, settings: { language: 'he' } }).id;
        db.updateUser(id, { shulId: null });
        db.setSignificantPortions(id, [portion, { portion: 'Genesis 12:1–9', occasion: 'Family anniversary' }]);
    } finally { db.close(); }
    db = openDatabase(path);
    try {
        assert.equal(db.getUser(id).settings.significantPortions.length, 2);
        assert.deepEqual(db.getUser(id).settings.significantPortions[0], portion);
        assert.equal(db.getUser(id).settings.language, 'he');
        for (const invalid of [null, {}, [null], [{ portion: '', occasion: '' }], [{ ...portion, portion: 'x'.repeat(101) }],
            [{ ...portion, occasion: 'x'.repeat(201) }], [{ ...portion, userId: 'other' }], Array(21).fill(portion)]) {
            assert.throws(() => db.setSignificantPortions(id, invalid), TypeError);
            assert.equal(db.getUser(id).settings.significantPortions.length, 2, 'Invalid writes preserve the saved list');
        }
        db.setSignificantPortions(id, []);
        assert.deepEqual(db.getUser(id).settings, { language: 'he', significantPortions: [] });
    } finally { db.close(); }
});

async function server(t, development) {
    const db = openDatabase(':memory:');
    const shul = db.createShul({ name: 'Test Shul', settings: { hebYear: 5787 } });
    const user = db.createUser({ ...profile, shulId: shul.id });
    const app = createApp(db, { development, devUserId: user.id, preview: false });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        db.close();
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    return { db, user, request: (path, options) => fetch(base + path, options) };
}

const patch = body => ({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('significant portion API saves only the current user preferences and rejects invalid requests', async t => {
    const { db, user, request } = await server(t, true);
    const other = db.createUser({ ...profile, shulId: user.shulId, email: 'other@example.com' });
    const response = await request('/api/me/significant-portions', patch({ portions: [portion] }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await response.json()).settings.significantPortions, [portion]);
    assert.deepEqual((await (await request('/api/me')).json()).settings.significantPortions, [portion]);
    const publicProfile = await (await request(`/api/users/${user.id}`)).json();
    assert.equal(publicProfile.settings, undefined, 'Personal portions are omitted from public profiles');
    for (const body of [{ portions: [portion], userId: other.id }, { portions: [{ portion: '', occasion: '' }] }, {}]) {
        assert.equal((await request('/api/me/significant-portions', patch(body))).status, 400);
    }
    assert.deepEqual(db.getUser(user.id).settings.significantPortions, [portion]);
    assert.deepEqual(db.getUser(other.id).settings, {});
    assert.equal((await request('/api/me/significant-portions', patch({ portions: [] }))).status, 200);
    assert.deepEqual(db.getUser(user.id).settings.significantPortions, []);
});

test('significant portion API requires a signed-in identity', async t => {
    const { db, user, request } = await server(t, false);
    assert.equal((await request('/api/me/significant-portions', patch({ portions: [portion] }))).status, 401);
    assert.deepEqual(db.getUser(user.id).settings, {});
});
