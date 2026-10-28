import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMailgunMailer } from '../backend/mailgun.mjs';

const env = { MAILGUN_ENABLED: 'true', MAILGUN_API_KEY: 'test-only-key', MAILGUN_DOMAIN: 'mg.example.com', MAILGUN_FROM: 'Gabbai <notifications@mg.example.com>' };
const email = { to: 'reader@example.com', subject: 'Reading confirmed', text: 'Your reading is confirmed.' };

test('Mailgun is disabled by default and performs no network calls', async () => {
    const mailer = createMailgunMailer({ env: {}, fetchImpl() { assert.fail('Must not send'); } });
    assert.equal(mailer.enabled, false);
    assert.deepEqual(await mailer.send(email), { status: 'disabled' });
});

test('Mailgun validates required configuration only when enabled', () => {
    assert.throws(() => createMailgunMailer({ env: { MAILGUN_ENABLED: 'true' } }), /requires/);
    assert.throws(() => createMailgunMailer({ env: { ...env, MAILGUN_REGION: 'invalid' } }), /REGION/);
});

test('Mailgun posts one recipient with basic authentication and multipart text in either region', async () => {
    for (const region of ['us', 'eu']) {
        const mailer = createMailgunMailer({ env: { ...env, MAILGUN_REGION: region }, fetchImpl: async (url, options) => {
            assert.equal(url, `https://${region === 'eu' ? 'api.eu' : 'api'}.mailgun.net/v3/mg.example.com/messages`);
            assert.equal(options.headers.Authorization, `Basic ${Buffer.from('api:test-only-key').toString('base64')}`);
            assert.equal(options.body.get('to'), email.to);
            assert.equal(options.body.get('subject'), email.subject);
            assert.equal(options.body.get('text'), email.text);
            assert.equal(options.body.get('from'), env.MAILGUN_FROM);
            assert.ok(options.signal instanceof AbortSignal);
            return Response.json({ id: 'provider-message-id' });
        } });
        assert.deepEqual(await mailer.send(email), { status: 'accepted', id: 'provider-message-id' });
    }
});

test('Mailgun rejects multiple recipients, header injection, and blank messages before sending', async () => {
    const mailer = createMailgunMailer({ env, fetchImpl() { assert.fail('Must not send invalid input'); } });
    for (const change of [{ to: 'one@example.com,two@example.com' }, { subject: 'Hello\nBcc: another@example.com' }, { text: ' ' }]) {
        await assert.rejects(mailer.send({ ...email, ...change }), TypeError);
    }
});

test('Mailgun errors do not expose provider bodies or network error details', async () => {
    const rejected = createMailgunMailer({ env, fetchImpl: async () => new Response('private provider details', { status: 401 }) });
    await assert.rejects(rejected.send(email), error => error.message === 'Mailgun rejected the email (HTTP 401).');
    const offline = createMailgunMailer({ env, fetchImpl: async () => { throw new Error('test-only-key'); } });
    await assert.rejects(offline.send(email), error => !error.message.includes('test-only-key') && /unknown/.test(error.message));
});

test('accepted API responses are not reported as delivered and malformed responses fail explicitly', async () => {
    const mailer = createMailgunMailer({ env, fetchImpl: async () => Response.json({ message: 'queued' }) });
    await assert.rejects(mailer.send(email), /delivery status is unknown/);
});
