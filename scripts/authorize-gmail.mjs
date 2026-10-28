import { createServer } from 'node:http';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { beginGmailAuthorization, exchangeGmailAuthorization } from '../backend/gmailOAuth.mjs';

const envPath = new URL('../.env', import.meta.url);

async function authorize() {
    const clientId = process.env.GMAIL_CLIENT_ID?.trim();
    const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim();
    const user = process.argv[2]?.trim() || process.env.GMAIL_USER?.trim();
    if (!clientId || !clientSecret) throw new Error('Add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET to .env first. Use a Desktop app OAuth client.');
    if (!user || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(user)) throw new Error('Pass the Gmail address to authorize as the command argument.');
    const server = createServer();
    let timer;
    try {
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', resolve);
        });
        const redirectUri = `http://127.0.0.1:${server.address().port}/oauth2/callback`;
        const flow = beginGmailAuthorization({ clientId, redirectUri, user });
        console.log(`Open this URL in your browser and sign in as ${user}:\n\n${flow.url}\n`);
        console.log('Waiting up to five minutes. Existing sender settings change only after authorization succeeds.');
        await new Promise((resolve, reject) => {
            let processing = false;
            timer = setTimeout(() => reject(new Error('Authorization timed out. Run the command again.')), 300000);
            server.on('request', async (request, response) => {
                response.setHeader('Content-Type', 'text/plain; charset=utf-8');
                response.setHeader('Cache-Control', 'no-store');
                response.setHeader('Referrer-Policy', 'no-referrer');
                const url = new URL(request.url, redirectUri);
                if (request.method !== 'GET' || url.pathname !== '/oauth2/callback') { response.writeHead(404).end('Not found.'); return; }
                if (url.searchParams.get('state') !== flow.state) { response.writeHead(403).end('Invalid authorization state.'); return; }
                if (processing) { response.writeHead(409).end('Authorization is already processing.'); return; }
                processing = true;
                try {
                    if (url.searchParams.has('error')) throw new Error('Google authorization was declined. Run the command again to retry.');
                    const refreshToken = await exchangeGmailAuthorization({
                        code: url.searchParams.get('code'), state: url.searchParams.get('state'), expectedState: flow.state,
                        verifier: flow.verifier, clientId, clientSecret, redirectUri, user,
                    });
                    let contents = await readFile(envPath, 'utf8');
                    const updates = { GMAIL_AUTH_MODE: 'oauth2', GMAIL_USER: user, GMAIL_REFRESH_TOKEN: refreshToken, GMAIL_ENABLED: 'true', GMAIL_APP_PASSWORD: '' };
                    for (const [key, value] of Object.entries(updates)) {
                        const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, 'gm');
                        const line = `${key}=${JSON.stringify(value)}`;
                        contents = pattern.test(contents) ? contents.replace(pattern, () => line) : `${contents.trimEnd()}\n${line}\n`;
                    }
                    await chmod(envPath, 0o600);
                    await writeFile(envPath, contents);
                    response.end('Gmail connected. You can close this tab and return to your terminal.');
                    console.log(`Gmail OAuth configured for ${user}. Tokens were saved privately in .env. No email was sent.`);
                    resolve();
                } catch (error) {
                    response.writeHead(400).end('Gmail connection failed. Return to your terminal for details.');
                    reject(error);
                }
            });
        });
    } finally {
        clearTimeout(timer);
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
}

try { await authorize(); }
catch (error) { console.error(error.message); process.exitCode = 1; }
