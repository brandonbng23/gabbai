import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { beginGmailAuthorization, exchangeGmailAuthorization } from '../backend/gmailOAuth.mjs';
import { createGmailMailer } from '../backend/gmail.mjs';

const user = 'teamgabbai@gmail.com';
const sendScope = 'https://www.googleapis.com/auth/gmail.send';
const env = { GMAIL_ENABLED: 'true', GMAIL_AUTH_MODE: 'oauth2', GMAIL_USER: user,
    GMAIL_CLIENT_ID: 'client', GMAIL_CLIENT_SECRET: 'secret', GMAIL_REFRESH_TOKEN: 'refresh' };
const identity = { email: user, email_verified: true };
const exchange = { code: 'code', state: 'state', expectedState: 'state', verifier: 'verifier',
    clientId: 'client', clientSecret: 'secret', redirectUri: 'http://127.0.0.1:12345/oauth2/callback', user };

test('OAuth requests offline send-only Gmail access with random state and PKCE', () => {
    const first = beginGmailAuthorization({ clientId: 'client', redirectUri: exchange.redirectUri, user });
    const second = beginGmailAuthorization({ clientId: 'client', redirectUri: exchange.redirectUri, user });
    const url = new URL(first.url);
    assert.notEqual(first.state, second.state);
    assert.notEqual(first.verifier, second.verifier);
    assert.equal(url.searchParams.get('state'), first.state);
    assert.equal(url.searchParams.get('access_type'), 'offline');
    assert.equal(url.searchParams.get('login_hint'), user);
    assert.equal(url.searchParams.get('scope'), `${sendScope} openid email`);
    assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(first.verifier).digest('base64url'));
});

test('OAuth rejects mismatched state before any network call', async () => {
    await assert.rejects(exchangeGmailAuthorization({ ...exchange, state: 'wrong', fetchImpl() { assert.fail('Must not exchange'); } }), /Invalid OAuth callback/);
});

test('OAuth exchanges the code with PKCE and verifies the selected account before returning a refresh token', async () => {
    const refresh = await exchangeGmailAuthorization({ ...exchange, fetchImpl: async (url, options) => {
        if (url.endsWith('/token')) {
            assert.equal(options.body.get('code_verifier'), exchange.verifier);
            assert.equal(options.body.get('redirect_uri'), exchange.redirectUri);
            return Response.json({ access_token: 'access', refresh_token: 'refresh', scope: sendScope });
        }
        assert.equal(options.headers.Authorization, 'Bearer access');
        return Response.json(identity);
    } });
    assert.equal(refresh, 'refresh');
});

test('OAuth refuses missing offline permission, missing send scope, and the wrong or unverified account', async () => {
    for (const [token, message] of [
        [{ access_token: 'access', scope: sendScope }, /did not return a refresh token/],
        [{ access_token: 'access', refresh_token: 'refresh', scope: 'openid email' }, /sending permission was not granted/],
        [{ refresh_token: 'refresh', scope: sendScope }, /did not return an access token/],
    ]) {
        await assert.rejects(exchangeGmailAuthorization({ ...exchange, fetchImpl: async () => Response.json(token) }), message);
    }
    for (const profile of [{ email: 'other@gmail.com', email_verified: true }, { email: user, email_verified: false }]) {
        await assert.rejects(exchangeGmailAuthorization({ ...exchange, fetchImpl: async url => Response.json(url.endsWith('/token')
            ? { access_token: 'access', refresh_token: 'refresh', scope: sendScope } : profile) }), /does not match/);
    }
});

test('OAuth refreshes credentials and verifies identity without sending, then sends MIME through Gmail API', async () => {
    let refreshes = 0;
    let sends = 0;
    const mailer = createGmailMailer({ env, fetchImpl: async (url, options) => {
        if (url.endsWith('/token')) {
            refreshes++;
            assert.equal(options.body.get('refresh_token'), 'refresh');
            return Response.json({ access_token: 'access', expires_in: 3600 });
        }
        if (url.endsWith('/userinfo')) return Response.json(identity);
        assert.equal(url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
        assert.equal(options.headers.Authorization, 'Bearer access');
        const mime = Buffer.from(JSON.parse(options.body).raw, 'base64url').toString();
        assert.match(mime, /From: Gabbai <teamgabbai@gmail.com>/);
        assert.match(mime, /To: reader@example.com/);
        assert.match(mime, /Subject: Registration/);
        assert.match(mime, /Your reading is registered/);
        assert.match(mime, /multipart\/alternative/);
        assert.match(mime, /Content-Type: text\/plain/);
        assert.match(mime, /Content-Type: text\/html/);
        sends++;
        return Response.json({ id: `gmail-${sends}` });
    } });
    await mailer.verify();
    assert.equal(sends, 0);
    assert.deepEqual(await mailer.send({ to: 'reader@example.com', subject: 'Registration', text: 'Your reading is registered.' }), { status: 'accepted', id: 'gmail-1' });
    assert.equal(refreshes, 1);
});

test('OAuth delivery distinguishes API rejections from uncertain sends and sanitizes errors', async () => {
    for (const status of [403, 429, 500, 200, 'network']) {
        const mailer = createGmailMailer({ env, fetchImpl: async url => {
            if (url.endsWith('/token')) return Response.json({ access_token: 'access', expires_in: 3600 });
            if (url.endsWith('/userinfo')) return Response.json(identity);
            if (status === 'network') throw new Error('secret token');
            return Response.json({ private: 'secret token' }, { status });
        } });
        await assert.rejects(mailer.send({ to: 'reader@example.com', subject: 'Registration', text: 'Registered' }), error => {
            assert.equal(error.status, status === 403 || status === 429 ? 400 : undefined);
            assert.doesNotMatch(error.message, /secret token/);
            return true;
        });
    }
});

test('OAuth requires its own credentials rather than silently falling back to an app password', () => {
    assert.throws(() => createGmailMailer({ env: { ...env, GMAIL_REFRESH_TOKEN: '', GMAIL_APP_PASSWORD: 'abcdefghijklmnop' } }), /GMAIL_REFRESH_TOKEN/);
    assert.throws(() => createGmailMailer({ env: { ...env, GMAIL_AUTH_MODE: 'invalid' } }), /GMAIL_AUTH_MODE/);
});
