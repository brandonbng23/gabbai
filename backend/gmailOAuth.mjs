import { createHash, randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';

const sendScope = 'https://www.googleapis.com/auth/gmail.send';

async function googleJson(url, options, fetchImpl) {
    let response;
    try { response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(10000) }); }
    catch { throw new Error('Unable to contact Google. Please try again.'); }
    if (!response.ok) throw Object.assign(new Error('Google rejected the request. Check Gmail API access and OAuth credentials.'), {
        status: response.status >= 400 && response.status < 500 ? 400 : undefined,
    });
    const result = await response.json().catch(() => null);
    if (!result || typeof result !== 'object') throw new Error('Google returned an unexpected response.');
    return result;
}

export function beginGmailAuthorization({ clientId, redirectUri, user }) {
    const verifier = randomBytes(32).toString('base64url');
    const state = randomBytes(32).toString('base64url');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
        client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
        scope: `${sendScope} openid email`, access_type: 'offline', prompt: 'consent select_account',
        login_hint: user, state, code_challenge_method: 'S256',
        code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    }).toString();
    return { url: url.toString(), verifier, state };
}

async function gmailIdentity(accessToken, user, fetchImpl) {
    const identity = await googleJson('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    }, fetchImpl);
    if (identity.email_verified !== true || typeof identity.email !== 'string' || identity.email.toLowerCase() !== user.toLowerCase()) {
        throw new Error('The Google account does not match the requested Gmail sender. Authorize the intended account.');
    }
}

export async function exchangeGmailAuthorization({ code, state, expectedState, verifier, clientId, clientSecret, redirectUri, user, fetchImpl = globalThis.fetch }) {
    if (!state || state !== expectedState || !code) throw new Error('Invalid OAuth callback. Restart Gmail authorization.');
    const token = await googleJson('https://oauth2.googleapis.com/token', {
        method: 'POST', body: new URLSearchParams({
            code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri,
            grant_type: 'authorization_code', code_verifier: verifier,
        }),
    }, fetchImpl);
    if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('Google did not return an access token. Restart Gmail authorization.');
    if (typeof token.scope !== 'string' || !token.scope.split(/\s+/).includes(sendScope)) {
        throw new Error('Gmail sending permission was not granted. Restart authorization and select the permission to send email on your behalf.');
    }
    if (typeof token.refresh_token !== 'string' || !token.refresh_token) {
        throw new Error('Google did not return a refresh token. Remove Gabbai from the sender account’s Google third-party connections, then restart Gmail authorization.');
    }
    await gmailIdentity(token.access_token, user, fetchImpl);
    return token.refresh_token;
}

export function createGmailOAuthTransport({ user, clientId, clientSecret, refreshToken, fetchImpl = globalThis.fetch }) {
    const composer = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows', disableFileAccess: true, disableUrlAccess: true });
    let accessToken;
    let expiresAt = 0;
    async function authenticate() {
        if (accessToken && Date.now() < expiresAt) return accessToken;
        const token = await googleJson('https://oauth2.googleapis.com/token', {
            method: 'POST', body: new URLSearchParams({
                client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token',
            }),
        }, fetchImpl);
        if (typeof token.access_token !== 'string' || !Number.isFinite(token.expires_in) || token.expires_in <= 0) {
            throw new Error('Google did not return a valid access token. Reauthorize Gmail.');
        }
        await gmailIdentity(token.access_token, user, fetchImpl);
        accessToken = token.access_token;
        expiresAt = Date.now() + Math.max(0, token.expires_in - 60) * 1000;
        return accessToken;
    }
    return {
        verify: authenticate,
        async sendMail(message) {
            const token = await authenticate();
            const mime = await composer.sendMail(message);
            const result = await googleJson('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
                method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ raw: mime.message.toString('base64url') }),
            }, fetchImpl);
            if (typeof result.id !== 'string' || !result.id) throw new Error('Google returned an unexpected sending response; delivery status is unknown.');
            return { accepted: [message.to], messageId: result.id };
        },
    };
}
