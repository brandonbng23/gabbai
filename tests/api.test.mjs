import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../backend/app.mjs';
import { openDatabase } from '../backend/database/index.mjs';

async function setup(t, development, options = {}) {
    const db = openDatabase(':memory:');
    const shul = db.createShul({ name: 'API Shul', settings: { hebYear: 5788, il: true, a: 3 } });
    const user = db.createUser({ shulId: shul.id, firstName: 'Test', lastName: 'User', email: 'test@example.com', settings: { language: 'en' } });
    const app = createApp(db, { development, devUserId: user.id, preview: false, ...options });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        db.close();
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    return { shul, user, db, request: (path, options) => fetch(base + path, options) };
}

const patchShul = body => ({
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

test('shul admins can save contact information without changing reading settings', async t => {
    const { request, shul, user, db } = await setup(t, true);
    db.updateUser(user.id, { role: 'admin' });
    const changes = {
        name: 'Updated Shul', address: '123 Main St', phone: '555-1234',
        email: 'office@example.com', websiteUrl: 'https://example.com', donationUrl: 'https://example.com/donate',
    };
    const response = await request(`/api/shuls/${shul.id}`, patchShul(changes));
    assert.equal(response.status, 200);
    const saved = await response.json();
    for (const [key, value] of Object.entries(changes)) assert.equal(saved[key], value);
    assert.deepEqual(saved.settings, shul.settings);
    assert.deepEqual(db.getShul(shul.id), saved);
    assert.deepEqual(await (await request(`/api/shuls/${shul.id}`)).json(), saved);
    const cleared = await request(`/api/shuls/${shul.id}`, patchShul({ phone: '' }));
    assert.equal(cleared.status, 200);
    assert.equal(db.getShul(shul.id).phone, '');
    assert.equal(db.getShul(shul.id).name, changes.name);
});

test('shul updates reject members and administrators from other shuls', async t => {
    const { request, shul, user, db } = await setup(t, true);
    assert.equal((await request(`/api/shuls/${shul.id}`, patchShul({ name: 'Forbidden' }))).status, 403);
    db.updateUser(user.id, { role: 'admin' });
    const other = db.createShul({ name: 'Other Shul', settings: { hebYear: 5787 } });
    assert.equal((await request(`/api/shuls/${other.id}`, patchShul({ name: 'Forbidden' }))).status, 403);
    assert.deepEqual(db.getShul(shul.id), shul);
    assert.deepEqual(db.getShul(other.id), other);
});

test('shul updates require a current identity and reject invalid fields atomically', async t => {
    const production = await setup(t, false);
    assert.equal((await production.request(`/api/shuls/${production.shul.id}`, patchShul({ name: 'Forbidden' }))).status, 401);
    assert.deepEqual(production.db.getShul(production.shul.id), production.shul);
    const { request, shul, user, db } = await setup(t, true);
    db.updateUser(user.id, { role: 'admin' });
    for (const body of [{ name: ' ' }, { phone: 123 }, { name: 'Changed', settings: {} }, null, []]) {
        const response = await request(`/api/shuls/${shul.id}`, patchShul(body));
        assert.equal(response.status, 400);
        assert.deepEqual(db.getShul(shul.id), shul);
    }
});

test('frontend APIs return saved profiles and shul schedules', async t => {
    const { request, shul, user, db } = await setup(t, true);
    assert.deepEqual(await (await request('/api/shuls')).json(), [{ id: shul.id, name: shul.name }]);
    const profile = await (await request(`/api/shuls/${shul.id}`)).json();
    assert.equal(profile.settings.hebYear, 5788);
    assert.equal(profile.settings.il, true);
    const me = await request('/api/me');
    assert.equal(me.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await me.json(), user);
    const readings = await (await request(`/api/schedule?shul=${shul.id}`)).json();
    assert.ok(readings.length > 0);
    assert.ok(readings.every(reading => reading.hDate.includes('5788')));
    db.updateShulSettings(shul.id, { hebYear: 5787 });
    const updated = await (await request(`/api/schedule?shul=${shul.id}`)).json();
    assert.ok(updated.every(reading => reading.hDate.includes('5787')));
    assert.equal((await request('/api/shuls/missing')).status, 404);
    assert.equal((await request('/api/schedule?shul=missing')).status, 404);
    assert.equal((await request('/api/schedule?year=invalid')).status, 400);
    assert.equal((await request(`/registration?shul=${shul.id}&parsha=1&aliyah=1`)).status, 200);
    assert.equal((await request(`/shul?shul=${shul.id}`)).status, 200);
    assert.equal((await request('/shulSettings')).status, 200);
    assert.equal((await request('/shulSettings/')).status, 200);
});

test('production never exposes development user profiles or member lists', async t => {
    const { request, shul, user } = await setup(t, false);
    assert.equal((await request('/api/me')).status, 401);
    assert.equal((await request(`/api/users/${user.id}`)).status, 404);
    assert.equal((await request(`/api/shuls/${shul.id}/users`)).status, 404);
});

test('explicit preview mode works with production NODE_ENV and selects only the demo identity', async t => {
    const { request, user, db } = await setup(t, false, { preview: true });
    const response = await request('/api/me');
    assert.equal(response.status, 200);
    const demo = await response.json();
    assert.equal(demo.email, 'demo@example.com');
    assert.equal(demo.role, 'admin');
    assert.notEqual(demo.id, user.id);
    assert.notEqual(demo.shulId, user.shulId);
    const shul = await (await request(`/api/shuls/${demo.shulId}`)).json();
    assert.equal(shul.name, 'Demo Shul');
    const readings = await (await request(`/api/schedule?shul=${demo.shulId}`)).json();
    assert.ok(readings.length > 0);
    assert.ok(readings.every(reading => reading.hDate.includes('5787')));
    db.updateShulSettings(demo.shulId, { a: 3 });
    createApp(db, { development: false, preview: true });
    assert.equal(db.getUserByEmail('demo@example.com').id, demo.id);
    assert.equal(db.getShul(demo.shulId).settings.a, 3);
    assert.equal(db.listShuls().length, 2);
    assert.equal(db.listShulUsers(demo.shulId).length, 1);
});

test('preview startup recreates its sample data in an empty database', t => {
    for (let restart = 0; restart < 2; restart++) {
        const db = openDatabase(':memory:');
        try {
            createApp(db, { development: false, preview: true });
            const demo = db.getUserByEmail('demo@example.com');
            assert.ok(demo);
            assert.equal(db.getShul(demo.shulId).name, 'Demo Shul');
            assert.equal(db.listShuls().length, 1);
        } finally {
            db.close();
        }
    }
});
