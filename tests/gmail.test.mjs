import test from 'node:test';
import assert from 'node:assert/strict';
import { createGmailMailer } from '../backend/gmail.mjs';

const env = { GMAIL_ENABLED: 'true', GMAIL_USER: 'gabbai@gmail.com', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' };
const email = { to: 'reader@example.com', subject: 'Confirmation', text: 'Your reading is registered.' };

test('Gmail stays disconnected when disabled and validates configuration only when enabled', () => {
    assert.equal(createGmailMailer({ env: {}, createTransport() { assert.fail('Must not connect'); } }).enabled, false);
    assert.throws(() => createGmailMailer({ env: { GMAIL_ENABLED: 'true' } }), /GMAIL_USER/);
    assert.throws(() => createGmailMailer({ env: { ...env, GMAIL_USER: 'bad\r\naddress' } }), /GMAIL_USER/);
    assert.throws(() => createGmailMailer({ env: { ...env, GMAIL_FROM_NAME: 'Bad\nname' } }), /single line/);
});

test('Gmail uses secure service settings, normalizes the app password, and verifies without sending', async () => {
    let verified = false;
    const mailer = createGmailMailer({ env, createTransport(options) {
        assert.equal(options.service, 'gmail');
        assert.deepEqual(options.auth, { user: env.GMAIL_USER, pass: 'abcdefghijklmnop' });
        assert.equal(options.disableFileAccess, true);
        assert.equal(options.disableUrlAccess, true);
        return { async verify() { verified = true; }, sendMail() { assert.fail('Verification must not send'); } };
    } });
    await mailer.verify();
    assert.equal(verified, true);
});

test('Gmail sends to one recipient from the authenticated account and reports acceptance', async () => {
    const mailer = createGmailMailer({ env, createTransport: () => ({ async sendMail(message) {
        assert.deepEqual(message, { ...email, from: { name: 'Gabbai', address: env.GMAIL_USER } });
        return { accepted: [email.to], messageId: 'message-id' };
    } }) });
    assert.deepEqual(await mailer.send(email), { status: 'accepted', id: 'message-id' });
    await assert.rejects(mailer.send({ ...email, to: 'one@example.com,two@example.com' }), /one recipient/);
    await assert.rejects(mailer.send({ ...email, subject: 'Header\ninjection' }), /without newlines/);
    await assert.rejects(mailer.send({ ...email, text: '' }), /email text/);
});

test('SMTP rejections release quota while uncertain outcomes retain it without leaking credentials', async () => {
    for (const responseCode of [450, 535, 550, undefined]) {
        const mailer = createGmailMailer({ env, createTransport: () => ({ async sendMail() {
            throw Object.assign(new Error('secret credentials and recipient details'), { responseCode });
        } }) });
        await assert.rejects(mailer.send(email), error => {
            assert.equal(error.status, responseCode ? 400 : undefined);
            assert.doesNotMatch(error.message, /secret|credentials|recipient/);
            return true;
        });
    }
});

test('Unexpected success responses are uncertain and verification errors are sanitized', async () => {
    const mailer = createGmailMailer({ env, createTransport: () => ({
        async sendMail() { return { accepted: [], messageId: 'id' }; },
        async verify() { throw new Error('secret'); },
    }) });
    await assert.rejects(mailer.send(email), /status is unknown/);
    await assert.rejects(mailer.verify(), error => !error.message.includes('secret'));
});
