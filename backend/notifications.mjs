import { HDate } from '@hebcal/core';
import { getShulSchedule } from './schedule.mjs';
import { localClock, notificationPolicy, reportWindow, isReportDue } from './notificationPolicy.mjs';
import { validateKeys } from './database/settings.mjs';
import { formatCommunicationDate } from './communicationDate.mjs';

export function buildReadingRoundup(database, shulId, now, timezone, window = '12weeks') {
    const shul = database.getShul(shulId);
    const range = reportWindow(now, timezone, window);
    const hebrewYear = day => {
        const [year, month, date] = day.split('-').map(Number);
        return new HDate(new Date(year, month - 1, date, 12)).getFullYear();
    };
    const startYear = hebrewYear(range.start);
    const endYear = hebrewYear(range.end);
    const lines = [`${shul.name} — registration summary`, `Upcoming readings: ${formatCommunicationDate(range.start)} through ${formatCommunicationDate(range.end)} (${timezone})`, ''];
    let registrations = 0;
    let vacancies = 0;
    for (let year = startYear; year <= endYear; year++) {
        for (const reading of getShulSchedule(database, shulId, year).filter(item => item.dateString >= range.start && item.dateString <= range.end)) {
            const open = [];
            for (const [index, verses] of reading.psukim.entries()) {
                if (!verses || verses === 'null') continue;
                const reader = reading.readers[index];
                if (reader) {
                    registrations++;
                    lines.push(`${formatCommunicationDate(reading.dateString)} · ${reading.desc} · Aliyah ${index + 1}: ${reader.title ? `${reader.title} ` : ''}${reader.firstName} ${reader.lastName}${reader.role === 'guest' ? ' (guest)' : ''} — ${verses}${reading.verseCounts[index] ? ` (${reading.verseCounts[index]} verses)` : ''}`);
                } else if (!reading.locked && !reading.lockedArr[index]) open.push(index + 1);
            }
            if (open.length) {
                vacancies += open.length;
                lines.push(`${formatCommunicationDate(reading.dateString)} · ${reading.desc}: ${open.length} open (${open.join(', ')})`);
            }
        }
    }
    lines.splice(2, 0, `${registrations} registrations · ${vacancies} vacancies`);
    if (!registrations && !vacancies) lines.push('No registrations or available readings in this date range.');
    return lines.join('\n');
}

export function createNotificationService({ database, mailer, preview = false, clock = () => new Date(), roundupBuilder = buildReadingRoundup }) {
    let running = false;
    let stopping = false;
    let active;
    let interval;
    const emailEnabled = mailer.enabled && !preview;
    async function work() {
        const now = clock();
        // Inbox roundups are generated even when email is unavailable or capped.
        for (const shul of database.listShuls()) {
            if (stopping) break;
            try {
                const config = database.getNotificationSettings(shul.id);
                const local = localClock(now, config.timezone);
                if (!isReportDue(now, config) || !database.needsDailyRoundup(shul.id, local.day)) continue;
                const body = roundupBuilder(database, shul.id, now, config.timezone, config.reportRange);
                database.recordDailyRoundup(shul.id, local.day, body, { now, emailEnabled });
            } catch {
                console.error('A shul roundup could not be generated; it will be retried on the next tick.');
            }
        }
        if (!emailEnabled) return;
        // Bound a tick without dropping the durable remainder of the queue.
        const deadline = Date.now() + 45000;
        for (let processed = 0; processed < 200 && !stopping && Date.now() < deadline; processed++) {
            const job = database.claimNotificationEmail(clock());
            if (!job) break;
            if (job.skipped) continue;
            try {
                const result = await mailer.send({ to: job.to, subject: job.subject, text: job.text });
                database.finishNotificationEmail(job.id, result.status === 'accepted'
                    ? { status: 'accepted', providerId: result.id }
                    : { status: 'skipped', releaseQuota: true });
            } catch (error) {
                // Definite provider rejection did not send. Unknown outcomes retain the reservation and are never retried automatically.
                database.finishNotificationEmail(job.id, error.status >= 400 && error.status < 500
                    ? { status: 'failed', releaseQuota: true }
                    : { status: 'unknown' });
            }
        }
    }
    function tick() {
        if (running || stopping) return active ?? Promise.resolve();
        running = true;
        active = work().finally(() => { running = false; });
        return active;
    }
    return {
        tick,
        start() {
            if (interval) return;
            const run = () => { void tick().catch(() => console.error('Notification worker failed; inbox messages and queued jobs are retained.')); };
            run();
            interval = setInterval(run, 60000);
            interval.unref();
        },
        wake() {
            if (!interval || stopping) return;
            setImmediate(() => { void tick().catch(() => console.error('Notification worker failed; queued jobs are retained.')); }).unref();
        },
        async stop() { stopping = true; clearInterval(interval); await active; },
    };
}

export function installNotificationRoutes(app, database, { emailEnabled }) {
    app.get('/api/shuls/:id/notification-policy', (req, res, next) => {
        try {
            const config = database.getNotificationSettings(req.params.id);
            res.set('Cache-Control', 'no-store').json({ ...notificationPolicy, timezone: config.timezone, roundupHour: Number(config.reportTime.split(':')[0]),
                reportTime: config.reportTime, reportFrequency: config.reportFrequency, reportRange: config.reportRange, emailAvailable: emailEnabled() });
        }
        catch (error) { if (error.status) res.status(error.status).json({ error: error.message }); else next(error); }
    });
    app.get('/api/shuls/:id/notifications', (req, res, next) => {
        const actor = req.currentUserId ? database.getUser(req.currentUserId) : null;
        if (!actor) return res.status(401).json({ error: 'Sign in to manage notifications.' });
        if (actor.role !== 'admin' || actor.shulId !== req.params.id) return res.status(403).json({ error: 'Only this shul’s administrators can manage notifications.' });
        try { res.set('Cache-Control', 'no-store').json(database.getNotificationSettings(req.params.id)); }
        catch (error) { if (error.status) res.status(error.status).json({ error: error.message }); else next(error); }
    });
    app.patch('/api/shuls/:id/notifications', (req, res, next) => {
        try {
            validateKeys(req.body, ['timezone', 'instantAdminUserId', 'dailyReports', 'reportTime', 'reportFrequency', 'reportRange'], 'notification settings');
            res.set('Cache-Control', 'no-store').json(database.updateNotificationSettings(req.currentUserId, req.params.id, req.body));
        } catch (error) {
            if (error instanceof TypeError) res.status(400).json({ error: error.message });
            else if (error.status) res.status(error.status).json({ error: error.message });
            else next(error);
        }
    });
}
