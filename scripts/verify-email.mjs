import { createGmailMailer } from '../backend/gmail.mjs';
import { loadEnvironment } from '../backend/environment.mjs';

try {
    loadEnvironment();
    if (process.env.GABBAI_PREVIEW_MODE?.trim().toLowerCase() === 'true')
        throw new Error('Email delivery is disabled in preview mode. Set GABBAI_PREVIEW_MODE=false on your production service.');
    const mailer = createGmailMailer();
    if (!mailer.enabled) throw new Error('Set GMAIL_ENABLED=true to verify Gmail.');
    await mailer.verify();
    console.log('Gmail authentication succeeded. No email was sent.');
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
