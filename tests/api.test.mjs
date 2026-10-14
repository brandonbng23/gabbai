import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../backend/app.mjs';
import { openDatabase } from '../backend/database/index.mjs';

async function setup(t, development) {
    const db = openDatabase(':memory:');
    const shul = db.createShul({ name: 'API Shul', settings: { hebYear: 5788, il: true, a: 3 } });
    const user = db.createUser({ shulId: shul.id, firstName: 'Test', lastName: 'User', email: 'test@example.com', settings: { language: 'en' } });
    const app = createApp(db, { development, devUserId: user.id });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        db.close();
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    return { shul, user, db, request: path => fetch(base + path) };
}

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
});

test('production never exposes development user profiles or member lists', async t => {
    const { request, shul, user } = await setup(t, false);
    assert.equal((await request('/api/me')).status, 401);
    assert.equal((await request(`/api/users/${user.id}`)).status, 404);
    assert.equal((await request(`/api/shuls/${shul.id}/users`)).status, 404);
});
