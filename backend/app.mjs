import express from "express";
import { installAuthentication } from './authentication.mjs';
import { installMessaging } from './messages.mjs';
import { createMailgunMailer } from './mailgun.mjs';
import { createNotificationService, installNotificationRoutes } from './notifications.mjs';
import { fileURLToPath } from "node:url";
import { getAssignedReadingDetails, getGuestReadingDetails, getSchedule, getShulSchedule } from "./schedule.mjs";
import { openDatabase } from "./database/index.mjs";
import { ensureDemoUser } from "./database/demo.mjs";
import { validateKeys } from "./database/settings.mjs";
import { decodePicture, maxPictureBytes } from './pictures.mjs';
import { userTitles } from '../interfaces/titles.mts';

export function createApp(database, {
    development = process.env.NODE_ENV === "development",
    devUserId = process.env.GABBAI_DEV_USER_ID,
    preview = process.env.GABBAI_PREVIEW_MODE?.trim().toLowerCase() === "true",
} = {}) {
    database ??= openDatabase(process.env.GABBAI_DATABASE_PATH || (preview
        ? fileURLToPath(new URL('../data/gabbai.preview.sqlite', import.meta.url))
        : undefined));
    const fallbackUserId = preview ? ensureDemoUser(database).id : development ? devUserId : undefined;
    const app = express();
    app.locals.database = database;
    app.locals.mailer = createMailgunMailer();

    app.use(express.json({ limit: '2mb' }));
    installAuthentication(app, database, { development, preview, fallbackUserId });
    installMessaging(app, database);
    installNotificationRoutes(app, database, { emailEnabled: () => app.locals.mailer.enabled && !preview });
    app.locals.notifications = createNotificationService({ database, mailer: app.locals.mailer, preview });

    app.get('/api/system/picture', (_req, res) => {
        res.sendFile(fileURLToPath(new URL('../frontend/src/Assets/favicon.png', import.meta.url)), {
            headers: { 'Cache-Control': 'public, max-age=3600' },
        });
    });

    function savePicture(req, res, next, kind) {
        res.set('Cache-Control', 'no-store');
        const user = req.currentUserId ? database.getUser(req.currentUserId) : null;
        if (!user) return res.status(401).json({ error: 'Sign in to change a picture.' });
        const id = kind === 'users' ? user.id : req.params.id;
        if (kind === 'shuls' && (user.role !== 'admin' || user.shulId !== id))
            return res.status(403).json({ error: 'Only this shul’s administrators can change its picture.' });
        if (kind === 'shuls' && !database.getShul(id)) return res.status(404).json({ error: 'Shul not found.' });
        try {
            if (req.method !== 'DELETE' && !req.is('image/png'))
                return res.status(415).json({ error: 'Upload a PNG picture.' });
            return res.json(database.setPicture(kind, id, req.method === 'DELETE' ? null : req.body));
        } catch (error) {
            if (error instanceof TypeError) return res.status(400).json({ error: error.message });
            return next(error);
        }
    }
    const readPicture = express.raw({ type: 'image/png', limit: maxPictureBytes });
    app.put('/api/me/picture', readPicture, (req, res, next) => savePicture(req, res, next, 'users'));
    app.delete('/api/me/picture', (req, res, next) => savePicture(req, res, next, 'users'));
    app.put('/api/shuls/:id/picture', readPicture, (req, res, next) => savePicture(req, res, next, 'shuls'));
    app.delete('/api/shuls/:id/picture', (req, res, next) => savePicture(req, res, next, 'shuls'));
    app.get(['/api/users/:id/picture', '/api/shuls/:id/picture'], (req, res) => {
        const kind = req.path.startsWith('/api/users/') ? 'users' : 'shuls';
        const picture = database.getPicture(kind, req.params.id);
        if (!picture || (req.query.v && req.query.v !== picture.version))
            return res.status(404).json({ error: 'Picture not found.' });
        res.set('Cache-Control', req.query.v ? 'public, max-age=31536000, immutable' : 'no-cache');
        res.set('X-Content-Type-Options', 'nosniff');
        return res.type('png').send(Buffer.from(picture.png));
    });

    app.get("/api/shuls", (_req, res) => {
        res.json(app.locals.database.listShuls().map(({ id, name }) => ({ id, name })));
    });

    app.get('/api/shuls/search', (req, res) => {
        if (typeof req.query.q !== 'string' || req.query.q.trim().length < 2 || req.query.q.length > 100)
            return res.status(400).json({ error: 'Search with 2–100 characters.' });
        const terms = req.query.q.trim().toLocaleLowerCase().split(/\s+/);
        const matches = database.listShuls().filter(shul => {
            const description = `${shul.name} ${shul.address}`.toLocaleLowerCase();
            return terms.every(term => description.includes(term));
        });
        return res.json(matches.slice(0, 20).map(({ id, name, address, code }) => ({ id, name, address, code })));
    });

    app.get('/api/shuls/by-code/:code', (req, res, next) => {
        try {
            const shul = database.getShulByCode(req.params.code);
            if (!shul) return res.status(404).json({ error: 'No shul matches that code.' });
            return res.json({ id: shul.id, name: shul.name });
        } catch (error) {
            if (error instanceof TypeError) return res.status(400).json({ error: error.message });
            return next(error);
        }
    });

    app.get("/api/shuls/:id", (req, res) => {
        const shul = app.locals.database.getShul(req.params.id);
        if (!shul) return res.status(404).json({ error: "Shul not found" });
        return res.json(shul);
    });

    app.post("/api/shuls/:id/readings/register", (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        try {
            validateKeys(req.body, ['dateString', 'desc', 'aliyah', 'guest', 'emailConfirmation'], 'registration');
            const { dateString, desc, aliyah, guest, emailConfirmation = false } = req.body;
            if (typeof emailConfirmation !== 'boolean') throw new TypeError('Email confirmation must be true or false.');
            if (typeof dateString !== 'string' || typeof desc !== 'string'
                || !Number.isInteger(aliyah) || aliyah < 1 || aliyah > 9)
                return res.status(400).json({ error: 'Choose a reading and aliyah from 1 to 9.' });
            if (!database.getShul(req.params.id)) return res.status(404).json({ error: 'Shul not found' });
            if ('guest' in req.body) {
                validateKeys(guest, ['title', 'firstName', 'lastName', 'hebrewName', 'email'], 'guest');
                for (const [key, value] of Object.entries(guest)) {
                    if (typeof value !== 'string' || value.length > 254)
                        throw new TypeError(`${key} must be a string of at most 254 characters`);
                }
            }
            const user = req.currentUserId ? database.getUser(req.currentUserId) : null;
            if (!('guest' in req.body) && !user)
                return res.status(401).json({ error: 'Sign in or register as a guest.' });
            const result = database.registerReading(req.params.id, { dateString, desc, aliyah, guest, emailConfirmation,
                emailEnabled: app.locals.mailer.enabled && !preview,
                readerId: guest ? req.sessionUserId ?? undefined : user?.id }, () => {
                const reading = getShulSchedule(database, req.params.id)
                    .find(item => item.dateString === dateString && item.desc === desc);
                const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
                if (!reading) fail(404, 'Reading not found in this shul’s current schedule.');
                if (!reading.psukim[aliyah - 1] || reading.psukim[aliyah - 1] === 'null')
                    fail(400, 'This aliyah is not part of the reading.');
                if (reading.locked || reading.lockedArr[aliyah - 1]) fail(409, 'This aliyah is locked.');
                if (reading.readers[aliyah - 1]) fail(409, 'Another reader has already registered for this aliyah.');
            });
            // Registration clients only need confirmation, not other readers' profiles.
            res.status(201).json({ registered: true, ...('emailConfirmation' in req.body ? result : {}) });
            app.locals.notifications.wake();
        } catch (error) {
            if (error instanceof TypeError) return res.status(400).json({ error: error.message });
            if (error.status) return res.status(error.status).json({ error: error.message });
            return next(error);
        }
    });

    app.delete('/api/shuls/:id/readings/register', (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        const user = req.currentUserId ? database.getUser(req.currentUserId) : null;
        if (!user) return res.status(401).json({ error: 'Sign in to cancel your reading.' });
        if (user.shulId !== req.params.id)
            return res.status(403).json({ error: 'You can only cancel your own readings in your shul.' });
        try {
            validateKeys(req.body, ['dateString', 'desc', 'aliyah'], 'cancellation');
            const { dateString, desc, aliyah } = req.body;
            if (typeof dateString !== 'string' || typeof desc !== 'string'
                || !Number.isInteger(aliyah) || aliyah < 1 || aliyah > 9)
                return res.status(400).json({ error: 'Choose a reading and aliyah from 1 to 9.' });
            if (!database.cancelReading(req.params.id, { dateString, desc, aliyah }, user.id))
                return res.status(409).json({ error: 'This aliyah is no longer assigned to you. Refresh the schedule.' });
            return res.json({ cancelled: true });
        } catch (error) {
            if (error instanceof TypeError) return res.status(400).json({ error: error.message });
            return next(error);
        }
    });

    app.get("/api/shuls/:id/users", (req, res) => {
        res.set("Cache-Control", "no-store");
        const user = req.currentUserId ? app.locals.database.getUser(req.currentUserId) : null;
        if (!user) return res.status(401).json({ error: "Sign in to view shul users" });
        if (user.role !== 'admin' || user.shulId !== req.params.id) {
            return res.status(403).json({ error: "Only this shul's administrators can view its users" });
        }
        if (!app.locals.database.getShul(req.params.id)) return res.status(404).json({ error: "Shul not found" });
        return res.json(app.locals.database.listShulUsers(req.params.id).map(
            ({ id, firstName, lastName, email, role, title, pictureUrl, assignedReadings }) => ({ id, firstName, lastName, email, role, title, assignedReadings, ...(pictureUrl ? { pictureUrl } : {}) })
        ));
    });

    app.get('/api/shuls/:id/users/:userId/profile', (req, res) => {
        res.set('Cache-Control', 'no-store');
        const actor = req.currentUserId ? database.getUser(req.currentUserId) : null;
        if (!actor) return res.status(401).json({ error: 'Sign in to edit shul users.' });
        if (actor.role !== 'admin' || actor.shulId !== req.params.id)
            return res.status(403).json({ error: 'Only this shul’s administrators can edit its users.' });
        const target = database.getUser(req.params.userId);
        if (!target || target.shulId !== req.params.id) return res.status(404).json({ error: 'User not found.' });
        if (target.role === 'admin') return res.status(403).json({ error: 'Administrators edit their own profile in My Preferences.' });
        const { title, firstName, lastName, hebrewName, email, phone } = target;
        return res.json({ title, firstName, lastName, hebrewName, email, phone });
    });

    app.patch('/api/shuls/:id/users', (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        const actor = req.currentUserId ? database.getUser(req.currentUserId) : null;
        if (!actor) return res.status(401).json({ error: 'Sign in to change shul users.' });
        try {
            validateKeys(req.body, ['changes'], 'user changes');
            if (!Array.isArray(req.body.changes) || !req.body.changes.length || req.body.changes.length > 1000)
                throw new TypeError('Provide between 1 and 1000 user changes.');
            const changes = req.body.changes.map(change => {
                validateKeys(change, ['userId', 'role', 'previousRole', 'profile', 'previousProfile', 'picture', 'previousPictureUrl'], 'user change');
                return { ...change, ...('picture' in change ? { picture: decodePicture(change.picture) } : {}) };
            });
            const users = database.updateShulUsers(req.params.id, actor.id, changes);
            return res.json(users.map(({ id, firstName, lastName, email, role, title, pictureUrl, assignedReadings }) =>
                ({ id, firstName, lastName, email, role, title, assignedReadings, ...(pictureUrl ? { pictureUrl } : {}) })));
        } catch (error) {
            if (error instanceof TypeError) return res.status(400).json({ error: error.message });
            if (error.message?.includes('UNIQUE constraint failed: users.email'))
                return res.status(409).json({ error: 'This email is already used by another profile.' });
            if (error.status) return res.status(error.status).json({ error: error.message });
            return next(error);
        }
    });

    app.get("/api/shuls/:id/initial-version", (req, res) => {
        res.set("Cache-Control", "no-store");
        const user = req.currentUserId ? app.locals.database.getUser(req.currentUserId) : null;
        if (!user) return res.status(401).json({ error: "Sign in to restore your shul" });
        if (user.role !== 'admin' || user.shulId !== req.params.id) {
            return res.status(403).json({ error: "Only this shul's administrators can restore its saved version" });
        }
        const version = app.locals.database.getInitialShulVersion(req.params.id);
        if (!version) return res.status(404).json({ error: "Saved version not found" });
        return res.json(version);
    });

    app.patch("/api/shuls/:id", (req, res, next) => {
        res.set("Cache-Control", "no-store");
        const user = req.currentUserId ? app.locals.database.getUser(req.currentUserId) : null;
        if (!user) return res.status(401).json({ error: "Sign in to update your shul" });
        if (user.role !== 'admin' || user.shulId !== req.params.id) {
            return res.status(403).json({ error: "Only this shul's administrators can update its information" });
        }
        if (!app.locals.database.getShul(req.params.id)) {
            return res.status(404).json({ error: "Shul not found" });
        }
        try {
            validateKeys(req.body, ['name', 'websiteUrl', 'donationUrl', 'email', 'phone', 'address', 'picture'], 'shul');
            return res.json(app.locals.database.updateShul(req.params.id, { ...req.body, ...('picture' in req.body ? { picture: decodePicture(req.body.picture) } : {}) }));
        } catch (error) {
            if (error instanceof TypeError) return res.status(400).json({ error: error.message });
            return next(error);
        }
    });

    app.patch("/api/shuls/:id/settings", (req, res, next) => {
        res.set("Cache-Control", "no-store");
        const user = req.currentUserId ? app.locals.database.getUser(req.currentUserId) : null;
        if (!user) return res.status(401).json({ error: "Sign in to update your shul" });
        if (user.role !== 'admin' || user.shulId !== req.params.id) {
            return res.status(403).json({ error: "Only this shul's administrators can update its reading settings" });
        }
        if (!app.locals.database.getShul(req.params.id)) {
            return res.status(404).json({ error: "Shul not found" });
        }
        try {
            return res.json(app.locals.database.updateShulSettings(req.params.id, req.body));
        } catch (error) {
            if (error instanceof TypeError) return res.status(400).json({ error: error.message });
            return next(error);
        }
    });

    function publishReadingLocks(req, res, next, batch) {
        res.set("Cache-Control", "no-store");
        const user = req.currentUserId ? app.locals.database.getUser(req.currentUserId) : null;
        if (!user) return res.status(401).json({ error: "Sign in to update reading locks" });
        if (user.role !== 'admin' || user.shulId !== req.params.id) {
            return res.status(403).json({ error: "Only this shul's administrators can update reading locks" });
        }
        if (!app.locals.database.getShul(req.params.id)) return res.status(404).json({ error: "Shul not found" });
        try {
            if (batch) validateKeys(req.body, ['changes'], 'reading adjustments');
            const changes = batch ? req.body.changes : [req.body];
            if (!Array.isArray(changes) || changes.length === 0 || changes.length > 1000) {
                return res.status(400).json({ error: "Provide between 1 and 1000 reading lock changes" });
            }
            const schedule = getShulSchedule(app.locals.database, req.params.id);
            const readings = new Map(schedule.map(reading => [JSON.stringify([reading.dateString, reading.desc]), reading]));
            for (const change of changes) {
                if (!change || typeof change !== 'object' || !('aliyahCount' in change)) continue;
                const reading = readings.get(JSON.stringify([change.dateString, change.desc]));
                const count = change.aliyahCount ?? reading?.defaultAliyahCount;
                if (!Number.isInteger(count) || count < 1 || count > 7)
                    return res.status(400).json({ error: 'Choose an aliyah count from 1 to 7' });
                if (reading) {
                    const verses = reading.aliyahOptions[count - 1];
                    if (verses.slice(0, 7).filter(value => value && value !== 'null').length !== count)
                        return res.status(400).json({ error: 'This reading does not support that many aliyot' });
                    reading.psukim = verses;
                }
            }
            const seen = new Set();
            const affected = new Set();
            for (const change of changes) {
                validateKeys(change, 'aliyahCount' in change ? ['dateString', 'desc', 'aliyahCount'] : 'readerId' in change ? ['dateString', 'desc', 'aliyah', 'readerId'] : 'manualOccasions' in change ? ['dateString', 'desc', 'manualOccasions'] : ['dateString', 'desc', 'aliyah', 'locked'], 'reading adjustment');
                const { dateString, desc, aliyah, locked } = change;
                if (typeof dateString !== 'string' || typeof desc !== 'string' || (!('aliyahCount' in change) && !('manualOccasions' in change) && !('readerId' in change) && typeof locked !== 'boolean')
                    || (aliyah !== undefined && (!Number.isInteger(aliyah) || aliyah < 1 || aliyah > 9))) {
                    return res.status(400).json({ error: "Provide a reading date, name, lock status, and optional aliyah from 1 to 9" });
                }
                const key = JSON.stringify([dateString, desc]);
                const slot = JSON.stringify([dateString, desc, 'aliyahCount' in change ? 'count' : 'readerId' in change ? `reader:${aliyah}` : 'manualOccasions' in change ? 'occasions' : aliyah ?? 0]);
                if (seen.has(slot)) return res.status(400).json({ error: "Each reading lock may only appear once per publication" });
                seen.add(slot);
                const reading = readings.get(key);
                if (!reading) return res.status(404).json({ error: "Reading not found in your shul's current schedule" });
                if (aliyah !== undefined && (!reading.psukim[aliyah - 1] || reading.psukim[aliyah - 1] === 'null')) {
                    return res.status(400).json({ error: "This aliyah is not part of the current reading" });
                }
                if ('readerId' in change && aliyah === undefined) {
                    return res.status(400).json({ error: "Choose an aliyah for the reader" });
                }
                if ('readerId' in change && change.readerId !== null) {
                    const reader = typeof change.readerId === 'string' ? app.locals.database.getUser(change.readerId) : null;
                    if (!reader || reader.shulId !== req.params.id) return res.status(400).json({ error: "Choose a user from this shul" });
                }
                affected.add(key);
            }
            for (const change of changes.filter(item => 'readerId' in item && item.readerId !== null)) {
                const reading = readings.get(JSON.stringify([change.dateString, change.desc]));
                const lockChanges = changes.filter(item => item.dateString === change.dateString && item.desc === change.desc && 'locked' in item);
                const whole = lockChanges.find(item => item.aliyah === undefined)?.locked ?? reading.locked;
                const slot = lockChanges.find(item => item.aliyah === change.aliyah)?.locked ?? reading.lockedArr[change.aliyah - 1];
                if (whole || slot) return res.status(409).json({ error: "Unlock the aliyah before assigning a reader" });
            }
            // Validate every change before the repository commits the batch atomically.
            app.locals.database.setReadingLocks(req.params.id, changes);
            const updated = getShulSchedule(app.locals.database, req.params.id)
                .filter(reading => affected.has(JSON.stringify([reading.dateString, reading.desc])));
            return res.json(batch ? updated : updated[0]);
        } catch (error) {
            if (error instanceof TypeError) return res.status(400).json({ error: error.message });
            return next(error);
        }
    }

    app.patch("/api/shuls/:id/readings/lock", (req, res, next) => publishReadingLocks(req, res, next, false));
    app.patch("/api/shuls/:id/readings/locks", (req, res, next) => publishReadingLocks(req, res, next, true));

    app.get('/api/users/:id', (req, res) => {
        res.set('Cache-Control', 'no-store');
        const viewer = req.currentUserId ? database.getUser(req.currentUserId) : null;
        if (!viewer) return res.status(401).json({ error: 'Sign in to view user profiles.' });
        if (!['member', 'admin'].includes(viewer.role))
            return res.status(403).json({ error: 'Only members and administrators can view user profiles.' });
        if (!viewer.shulId) return res.status(403).json({ error: 'Join a shul to view its user profiles.' });
        const target = database.getUser(req.params.id);
        if (!target || target.shulId !== viewer.shulId)
            return res.status(404).json({ error: 'User not found.' });
        const { id, firstName, lastName, hebrewName, title, pictureUrl, role } = target;
        return res.json({ id, firstName, lastName, hebrewName, title, role,
            ...(pictureUrl ? { pictureUrl } : {}),
            shulName: database.getShul(target.shulId).name,
            assignedReadings: getAssignedReadingDetails(database, target),
            assignedReadingCount: target.assignedReadings.length });
    });

    app.get('/api/me/guest-readings', (req, res) => {
        res.set('Cache-Control', 'no-store');
        if (!req.sessionUserId) return res.status(401).json({ error: 'Sign in to view your guest registrations.' });
        return res.json(getGuestReadingDetails(database, req.sessionUserId));
    });

    // Sessions identify individual users; opt-in previews can supply a sample identity.
    app.get("/api/me", (req, res) => {
        res.set("Cache-Control", "no-store");
        // Browser session checks must never resurrect the optional demo fallback.
        const userId = req.query.session === 'required' ? req.sessionUserId : req.currentUserId;
        if (!userId) {
            return res.status(401).json({ error: "Sign in to view your profile" });
        }
        const user = app.locals.database.getUser(userId);
        if (!user) return res.status(404).json({ error: "Current user not found" });
        return res.json({ ...user, assignedReadings: getAssignedReadingDetails(database, user) });
    });

    app.patch('/api/me', (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        if (!req.currentUserId) return res.status(401).json({ error: 'Sign in to edit your profile.' });
        if (!database.getUser(req.currentUserId)) return res.status(404).json({ error: 'Current user not found.' });
        try {
            validateKeys(req.body, ['title', 'firstName', 'lastName', 'hebrewName', 'email', 'phone', 'picture'], 'profile');
            for (const [field, value] of Object.entries(req.body)) {
                if (field === 'picture') continue;
                if (typeof value !== 'string' || value.length > 254)
                    throw new TypeError(`${field} must be a string of at most 254 characters`);
            }
            if ('title' in req.body && req.body.title !== '' && !userTitles.includes(req.body.title))
                throw new TypeError('Choose a title from the list.');
            const user = database.updateUser(req.currentUserId, { ...req.body, ...('picture' in req.body ? { picture: decodePicture(req.body.picture) } : {}) });
            return res.json({ ...user, assignedReadings: getAssignedReadingDetails(database, user) });
        } catch (error) {
            if (error instanceof TypeError) return res.status(400).json({ error: error.message });
            if (error.message?.includes('UNIQUE constraint failed: users.email'))
                return res.status(409).json({ error: 'This email is already used by another profile.' });
            return next(error);
        }
    });

    app.get("/api/test", (req, res) => {
        res.json({
            message: "Backend is working"
        });
    });

    app.get("/api/schedule", (req, res) => {
        res.set("Cache-Control", "no-store");
        const year = req.query.year === undefined ? undefined : Number(req.query.year);
        if (year !== undefined && (!Number.isInteger(year) || year < 1 || year > 9999)) {
            return res.status(400).json({ error: "Invalid Hebrew year" });
        }
        const shulId = req.query.shul;
        if (shulId !== undefined) {
            if (typeof shulId !== "string") return res.status(400).json({ error: "Invalid shul ID" });
            if (!app.locals.database.getShul(shulId)) return res.status(404).json({ error: "Shul not found" });
            return res.json(getShulSchedule(app.locals.database, shulId, year));
        }
        return res.json(getSchedule(year));
    });

    app.get(['/login', '/login.html'], (_req, res) => res.redirect('/signin'));
    app.get(['/messages', '/messages/'], (_req, res) => {
        res.sendFile(fileURLToPath(new URL('../frontend/dist/index.html', import.meta.url)), {
            headers: { 'Cache-Control': 'no-store' },
        });
    });
    app.get('/registration.html', (_req, res) => res.redirect('/signup'));
    app.use(express.static(fileURLToPath(new URL("../frontend/dist/", import.meta.url)), {
        setHeaders(res, path) {
            if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
        },
    }));

    // The registration URL renders a page in the React app, including on refresh.
    app.get(["/registration", "/registration/", "/shul", "/shul/", "/shulSettings", "/shulSettings/", "/userSettings", "/userSettings/", "/userView", "/userView/", "/userReadings", "/userReadings/", "/signin", "/signin/", "/signup", "/signup/"], (req, res) => {
        res.sendFile(fileURLToPath(new URL("../frontend/dist/index.html", import.meta.url)), {
            headers: { 'Cache-Control': 'no-store' },
        });
    });

    app.use((error, _req, res, next) => {
        if (error.type === 'entity.too.large') return res.status(413).json({ error: 'The uploaded picture is too large.' });
        return next(error);
    });
    return app;
}
