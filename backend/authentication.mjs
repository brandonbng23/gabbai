import { createHash, randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword } from './passwords.mjs';
import { validateKeys } from './database/settings.mjs';
import { userTitles } from '../interfaces/titles.mts';

const cookieName = 'gabbai_session';
const sessionAge = 7 * 24 * 60 * 60 * 1000;
const digest = value => createHash('sha256').update(value).digest('hex');

export function installAuthentication(app, database, { development, fallbackUserId }) {
    if (process.env.GABBAI_TRUST_PROXY === 'true') app.set('trust proxy', 1);
    app.use('/api', (req, res, next) => {
        const token = (req.headers.cookie ?? '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
        req.sessionToken = token;
        req.currentUserId = token === undefined ? fallbackUserId
            : /^[a-f0-9]{64}$/.test(token) ? database.getSessionUserId(digest(token)) : null;
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            const origin = req.get('origin');
            if ((origin && origin !== `${req.protocol}://${req.host}`) || req.get('sec-fetch-site') === 'cross-site')
                return res.status(403).json({ error: 'This request must come from Gabbai.' });
        }
        next();
    });

    function setCookie(res, value, age = sessionAge) {
        res.cookie(cookieName, value, { httpOnly: true, secure: !development, sameSite: 'lax', path: '/', maxAge: age });
    }
    function limited(req, res, scope, limit) {
        const ip = req.ip ?? '';
        if (!database.recordAuthAttempt(digest(`all:${ip}`), 100)
            || !database.recordAuthAttempt(digest(`${scope}:${ip}`), limit)) {
            res.set('Retry-After', '900');
            res.status(429).json({ error: 'Too many attempts. Please try again in 15 minutes.' });
            return true;
        }
        return false;
    }
    function revokePrevious(req) {
        if (req.sessionToken) database.deleteSession(digest(req.sessionToken));
    }
    function failure(error, res, next) {
        if (error instanceof TypeError) return res.status(400).json({ error: error.message });
        if (error.status) return res.status(error.status).json({ error: error.message });
        if (error.message?.includes('UNIQUE constraint failed: users.email'))
            return res.status(409).json({ error: 'This email already has a profile. Sign in, or contact your shul administrator if you haven’t set up sign-in yet.' });
        return next(error);
    }

    app.post('/api/auth/register', async (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        if (limited(req, res, 'register', 5)) return;
        try {
            validateKeys(req.body, ['title', 'firstName', 'lastName', 'hebrewName', 'phone', 'email', 'password', 'shulCode'], 'registration');
            for (const [key, value] of Object.entries(req.body)) {
                if (typeof value !== 'string' || value.length > (key === 'password' ? 128 : 254))
                    throw new TypeError('Enter valid registration details.');
            }
            if (!userTitles.includes(req.body.title)) throw new TypeError('Choose a title from the list.');
            // Check profile/code validity before performing the password derivation.
            if (!database.getShulByCode(req.body.shulCode)) throw new TypeError('No shul matches that code.');
            const { password, ...profile } = req.body;
            const passwordHash = await hashPassword(password);
            const token = randomBytes(32).toString('hex');
            const user = database.createAccount(profile, passwordHash, digest(token), Date.now() + sessionAge);
            revokePrevious(req);
            setCookie(res, token);
            return res.status(201).json(user);
        } catch (error) { return failure(error, res, next); }
    });

    app.post('/api/auth/signin', async (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        if (limited(req, res, 'signin', 20)) return;
        try {
            validateKeys(req.body, ['email', 'password'], 'sign-in');
            const { email, password } = req.body;
            if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || password.length < 1 || password.length > 128)
                throw new TypeError('Enter your email and password.');
            const credentials = database.getCredentials(email);
            const matches = await verifyPassword(password, credentials?.passwordHash);
            if (!matches) return res.status(401).json({ error: 'Email or password is incorrect.' });
            const token = randomBytes(32).toString('hex');
            database.createSession(credentials.userId, digest(token), Date.now() + sessionAge, credentials.passwordHash);
            revokePrevious(req);
            setCookie(res, token);
            return res.json(database.getUser(credentials.userId));
        } catch (error) { return failure(error, res, next); }
    });

    app.post('/api/auth/signout', (req, res) => {
        res.set('Cache-Control', 'no-store');
        revokePrevious(req);
        // An explicit sign-out also suppresses the opt-in development/preview identity.
        setCookie(res, 'signed-out');
        return res.status(204).end();
    });

    app.get('/api/auth/password', (req, res) => {
        res.set('Cache-Control', 'no-store');
        const user = req.currentUserId ? database.getUser(req.currentUserId) : null;
        if (!user) return res.status(401).json({ error: 'Sign in to manage your password.' });
        return res.json({ configured: Boolean(database.getCredentials(user.email)?.passwordHash) });
    });

    app.post('/api/auth/password', async (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        const user = req.currentUserId ? database.getUser(req.currentUserId) : null;
        if (!user) return res.status(401).json({ error: 'Sign in to manage your password.' });
        if (limited(req, res, 'password', 10)) return;
        try {
            validateKeys(req.body, ['currentPassword', 'password'], 'password');
            const credentials = database.getCredentials(user.email);
            if (credentials.passwordHash) {
                const current = req.body.currentPassword;
                if (typeof current !== 'string' || current.length < 1 || current.length > 128
                    || !await verifyPassword(current, credentials.passwordHash))
                    return res.status(401).json({ error: 'Your current password is incorrect.' });
            }
            const passwordHash = await hashPassword(req.body.password);
            const token = randomBytes(32).toString('hex');
            database.setPasswordHash(user.id, passwordHash, { expectedHash: credentials.passwordHash,
                tokenHash: digest(token), expiresAt: Date.now() + sessionAge });
            setCookie(res, token);
            return res.json({ saved: true });
        } catch (error) { return failure(error, res, next); }
    });
}
