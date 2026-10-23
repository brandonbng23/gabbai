import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createApp } from '../backend/app.mjs';
import { openDatabase } from '../backend/database/index.mjs';
import { hashPassword, verifyPassword } from '../backend/passwords.mjs';

const password = 'Correct horse 2026!';
const digest = value => createHash('sha256').update(value).digest('hex');
const cookie = response => response.headers.getSetCookie()[0]?.split(';')[0];
const json = (body, session, headers = {}) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(session ? { Cookie: session } : {}), ...headers }, body: JSON.stringify(body) });
async function setup(t, options = {}) {
    const db = openDatabase(':memory:');
    const shul = db.createShul({ name: 'Auth shul', settings: { hebYear: 5788 } });
    let actor;
    if (options.fallback) actor = db.createUser({ shulId: shul.id, firstName: 'Existing', lastName: 'Admin', email: 'existing@example.com', role: 'admin' });
    const app = createApp(db, { development: options.production ? false : true, preview: false, devUserId: actor?.id ?? '' });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
    const base = `http://127.0.0.1:${server.address().port}`;
    return { db, shul, actor, base, request: (path, options) => fetch(base + path, options),
        details: { shulCode: shul.code.toLowerCase(), title: 'Mr.', firstName: 'New', lastName: 'Member', email: 'new@example.com', password } };
}

test('registration uses shul codes, creates only members, and establishes a private session', async t => {
    const { db, shul, request, details } = await setup(t);
    assert.equal((await request('/api/me')).status, 401);
    for (const invalid of [{ ...details, shulCode: 'BAD' }, { ...details, password: 'short' }, { ...details, role: 'admin' }]) {
        assert.equal((await request('/api/auth/register', json(invalid))).status, 400);
        assert.equal(db.listShulUsers(shul.id).length, 0);
    }
    const response = await request('/api/auth/register', json(details));
    assert.equal(response.status, 201);
    const user = await response.json();
    assert.equal(user.shulId, shul.id);
    assert.equal(user.role, 'member');
    assert.deepEqual(user.assignedReadings, []);
    assert.ok(!JSON.stringify(user).includes('password'));
    const session = cookie(response);
    assert.match(response.headers.get('set-cookie'), /HttpOnly/);
    assert.match(response.headers.get('set-cookie'), /SameSite=Lax/);
    assert.equal((await (await request('/api/me', { headers: { Cookie: session } })).json()).id, user.id);
    assert.equal((await request(`/api/shuls/${shul.id}/users`, { headers: { Cookie: session } })).status, 403);
    const token = session.split('=')[1];
    assert.equal(db.getSessionUserId(digest(token)), user.id);
    assert.equal(db.getSessionUserId(token), null, 'Raw tokens are never stored as session keys');
    const credentials = db.getCredentials(details.email);
    assert.notEqual(credentials.passwordHash, password);
    assert.equal(await verifyPassword(password, credentials.passwordHash), true);
    assert.equal((await request('/api/me', { headers: { Cookie: `gabbai_session=${digest(token)}` } })).status, 401);
    assert.equal((await request('/api/auth/register', json(details))).status, 409);
    assert.equal(db.listShulUsers(shul.id).length, 1);
    assert.equal((await request('/signin')).status, 200);
    assert.equal((await request('/signup')).status, 200);
});

test('sign-in normalizes email, rotates sessions, rejects bad passwords, and sign-out revokes access', async t => {
    const { request, details } = await setup(t, { production: true });
    const registered = await request('/api/auth/register', json(details));
    const original = cookie(registered);
    assert.match(registered.headers.get('set-cookie'), /Secure/);
    for (const email of [details.email, 'missing@example.com']) {
        const failed = await request('/api/auth/signin', json({ email, password: 'incorrect password' }));
        assert.equal(failed.status, 401);
        assert.deepEqual(await failed.json(), { error: 'Email or password is incorrect.' });
    }
    const signed = await request('/api/auth/signin', json({ email: ' NEW@EXAMPLE.COM ', password }, original));
    assert.equal(signed.status, 200);
    const session = cookie(signed);
    assert.notEqual(session, original);
    assert.equal((await request('/api/me', { headers: { Cookie: original } })).status, 401);
    assert.equal((await request('/api/me', { headers: { Cookie: session } })).status, 200);
    const out = await request('/api/auth/signout', json({}, session));
    assert.equal(out.status, 204);
    assert.equal((await request('/api/me', { headers: { Cookie: session } })).status, 401);
    assert.equal((await request('/api/me', { headers: { Cookie: cookie(out) } })).status, 401);
});

test('real sessions override development identity and invalid cookies never fall back to an admin', async t => {
    const { actor, request, details } = await setup(t, { fallback: true });
    assert.equal((await (await request('/api/me')).json()).id, actor.id);
    const registered = await request('/api/auth/register', json(details));
    const member = await registered.json();
    const response = await request('/api/me', { headers: { Cookie: cookie(registered) } });
    assert.equal((await response.json()).id, member.id);
    assert.equal((await request('/api/me', { headers: { Cookie: 'gabbai_session=invalid' } })).status, 401);
});

test('existing guest/member profiles cannot be claimed through registration', async t => {
    const { db, shul, request, details } = await setup(t);
    const guest = db.createUser({ shulId: shul.id, firstName: 'Guest', lastName: 'Reader', email: details.email, role: 'guest' });
    assert.equal((await request('/api/auth/register', json(details))).status, 409);
    assert.deepEqual(db.getUser(guest.id), guest);
    assert.equal(db.getCredentials(guest.email).passwordHash, null);
    assert.equal((await request('/api/auth/signin', json({ email: guest.email, password }))).status, 401);
});

test('cross-site writes are rejected and auth attempts are rate-limited', async t => {
    const { db, request, details, base } = await setup(t);
    const registered = await request('/api/auth/register', json(details));
    const session = cookie(registered);
    assert.equal((await request('/api/auth/signout', json({}, session, { Origin: 'https://other.example' }))).status, 403);
    assert.equal((await request('/api/auth/signin', json({ email: details.email, password }, undefined, { 'Sec-Fetch-Site': 'cross-site' }))).status, 403);
    assert.equal((await request('/api/me', { headers: { Cookie: session } })).status, 200);
    assert.equal((await request('/api/auth/signout', json({}, session, { Origin: base }))).status, 204);
    for (let i = 0; i < 20; i++) db.recordAuthAttempt(digest('signin:127.0.0.1'), 20);
    const limited = await request('/api/auth/signin', json({ email: details.email, password }));
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('retry-after'), '900');
});

test('existing authenticated accounts can set passwords, and changing one revokes other sessions', async t => {
    const { db, actor, request } = await setup(t, { fallback: true });
    assert.deepEqual(await (await request('/api/auth/password')).json(), { configured: false });
    const setupResponse = await request('/api/auth/password', json({ password }));
    assert.equal(setupResponse.status, 200);
    const first = cookie(setupResponse);
    const login = await request('/api/auth/signin', json({ email: actor.email, password }));
    const second = cookie(login);
    assert.equal((await request('/api/auth/password', json({ password: 'New password 2026!', currentPassword: 'wrong' }, first))).status, 401);
    assert.equal((await request('/api/me', { headers: { Cookie: second } })).status, 200);
    const changed = await request('/api/auth/password', json({ password: 'New password 2026!', currentPassword: password }, first));
    assert.equal(changed.status, 200);
    const third = cookie(changed);
    assert.equal((await request('/api/me', { headers: { Cookie: first } })).status, 401);
    assert.equal((await request('/api/me', { headers: { Cookie: second } })).status, 401);
    assert.equal((await (await request('/api/me', { headers: { Cookie: third } })).json()).role, 'admin');
    assert.equal(db.getUser(actor.id).role, 'admin');
    assert.equal((await request('/api/auth/signin', json({ email: actor.email, password }))).status, 401);
    assert.equal((await request('/api/auth/signin', json({ email: actor.email, password: 'New password 2026!' }))).status, 200);
    const signedOut = await request('/api/auth/signout', json({}, third));
    assert.equal((await request('/api/me', { headers: { Cookie: cookie(signedOut) } })).status, 401, 'Sign-out suppresses development fallback');
});

test('password hashes and sessions survive reopening, and expired sessions are rejected', async t => {
    const directory = mkdtempSync(join(tmpdir(), 'gabbai-auth-'));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const path = join(directory, 'auth.sqlite');
    let db = openDatabase(path);
    const hash = await hashPassword(password);
    let user;
    try {
        const shul = db.createShul({ name: 'Persisted auth', settings: { hebYear: 5788 } });
        user = db.createAccount({ shulCode: shul.code, title: 'Mr.', firstName: 'Saved', lastName: 'User', email: 'saved@example.com' }, hash, digest('session'), Date.now() + 60000);
        db.createSession(user.id, digest('expired'), Date.now() - 1);
    } finally { db.close(); }
    db = openDatabase(path);
    try {
        assert.equal(db.getCredentials(user.email).passwordHash, hash);
        assert.equal(db.getSessionUserId(digest('session')), user.id);
        assert.equal(db.getSessionUserId(digest('expired')), null);
        assert.equal(await verifyPassword(password, hash), true);
        assert.equal(await verifyPassword('wrong', hash), false);
        db.setPasswordHash(user.id, await hashPassword('Updated account password!'));
        assert.throws(() => db.createSession(user.id, digest('stale'), Date.now() + 60000, hash), /Email or password/);
        assert.equal(db.getSessionUserId(digest('stale')), null, 'A concurrent password change blocks sign-in using the old hash');
        assert.notEqual(await hashPassword(password), hash, 'Each hash uses a fresh salt');
    } finally { db.close(); }
});
