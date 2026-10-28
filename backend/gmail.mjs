import nodemailer from 'nodemailer';
import { createGmailOAuthTransport } from './gmailOAuth.mjs';
import { emailTemplate, emailText } from './emailTemplate.mjs';

export function createGmailMailer({ env = process.env, createTransport = nodemailer.createTransport, fetchImpl = globalThis.fetch } = {}) {
    if (env.GMAIL_ENABLED?.trim().toLowerCase() !== 'true') return { enabled: false };
    const user = env.GMAIL_USER?.trim();
    const pass = env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');
    const name = env.GMAIL_FROM_NAME?.trim() || 'Gabbai';
    const validAddress = value => typeof value === 'string' && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value);
    if (!validAddress(user)) throw new Error('Set a valid GMAIL_USER before enabling Gmail.');
    if (/[\r\n]/.test(name)) throw new Error('GMAIL_FROM_NAME must be a single line.');
    const mode = env.GMAIL_AUTH_MODE?.trim() || 'app_password';
    if (!['app_password', 'oauth2'].includes(mode)) throw new Error('GMAIL_AUTH_MODE must be app_password or oauth2.');
    const clientId = env.GMAIL_CLIENT_ID?.trim();
    const clientSecret = env.GMAIL_CLIENT_SECRET?.trim();
    const refreshToken = env.GMAIL_REFRESH_TOKEN?.trim();
    if (mode === 'app_password' && (!pass || !/^[a-zA-Z]{16}$/.test(pass))) throw new Error('Set a 16-letter GMAIL_APP_PASSWORD before enabling Gmail.');
    if (mode === 'oauth2' && (!clientId || !clientSecret || !refreshToken)) throw new Error('Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and authorize Gmail to obtain GMAIL_REFRESH_TOKEN.');
    const transport = mode === 'oauth2' ? createGmailOAuthTransport({ user, clientId, clientSecret, refreshToken, fetchImpl }) : createTransport({
        service: 'gmail', auth: { user, pass },
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000,
        disableFileAccess: true, disableUrlAccess: true,
    });
    function deliveryError(error) {
        // A received SMTP rejection is definite; timeouts and network failures are uncertain.
        const definite = error?.status === 400 || (error?.responseCode >= 400 && error.responseCode < 600);
        return Object.assign(new Error(definite ? 'Gmail rejected the email.' : 'Gmail request failed; delivery status is unknown.'), definite ? { status: 400 } : {});
    }
    return {
        enabled: true,
        async verify() {
            try { await transport.verify(); }
            catch { throw new Error('Unable to authenticate with Gmail. Check the account, credentials, and connection. For OAuth, try authorizing Gmail again.'); }
        },
        async send({ to, subject, text }) {
            if (!validAddress(to)) throw new TypeError('Provide one recipient email address.');
            if (typeof subject !== 'string' || !subject.trim() || subject.length > 200 || /[\r\n]/.test(subject)) throw new TypeError('Provide a subject of 1–200 characters without newlines.');
            if (typeof text !== 'string' || !text.trim() || text.length > 2000000) throw new TypeError('Provide email text of 1–2000000 characters.');
            let result;
            const templateOptions = { publicUrl: env.GABBAI_PUBLIC_URL };
            const message = {
                from: { name, address: user }, to, subject: subject.trim(),
                text: emailText(text, templateOptions), html: emailTemplate(subject.trim(), text, templateOptions),
            };
            try { result = await transport.sendMail(message); }
            catch (error) { throw deliveryError(error); }
            if (!result.accepted?.some(address => typeof address === 'string' && address.toLowerCase() === to.toLowerCase()) || !result.messageId) {
                throw new Error('Gmail returned an unexpected response; delivery status is unknown.');
            }
            return { status: 'accepted', id: result.messageId };
        },
    };
}
