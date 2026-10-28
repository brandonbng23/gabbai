import { createGmailMailer } from '../backend/gmail.mjs';

try {
    const mailer = createGmailMailer();
    if (!mailer.enabled) throw new Error('Set GMAIL_ENABLED=true to verify Gmail.');
    await mailer.verify();
    console.log('Gmail authentication succeeded. No email was sent.');
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
