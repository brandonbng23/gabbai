import express from "express";
import { fileURLToPath } from "node:url";
import { getSchedule, getShulSchedule } from "./schedule.mjs";
import { openDatabase } from "./database/index.mjs";
import { ensureDemoUser } from "./database/demo.mjs";
import { validateKeys } from "./database/settings.mjs";

export function createApp(database, {
    development = process.env.NODE_ENV === "development",
    devUserId = process.env.GABBAI_DEV_USER_ID,
    preview = process.env.GABBAI_PREVIEW_MODE === "true",
} = {}) {
    database ??= openDatabase(process.env.GABBAI_DATABASE_PATH || (preview
        ? fileURLToPath(new URL('../data/gabbai.preview.sqlite', import.meta.url))
        : undefined));
    const currentUserId = preview ? ensureDemoUser(database).id : development ? devUserId : undefined;
    const app = express();
    app.locals.database = database;

    app.use(express.json());

    app.get("/api/shuls", (_req, res) => {
        res.json(app.locals.database.listShuls().map(({ id, name }) => ({ id, name })));
    });

    app.get("/api/shuls/:id", (req, res) => {
        const shul = app.locals.database.getShul(req.params.id);
        if (!shul) return res.status(404).json({ error: "Shul not found" });
        return res.json(shul);
    });

    app.get("/api/shuls/:id/users", (req, res) => {
        res.set("Cache-Control", "no-store");
        const user = currentUserId ? app.locals.database.getUser(currentUserId) : null;
        if (!user) return res.status(401).json({ error: "Sign in to view shul users" });
        if (user.role !== 'admin' || user.shulId !== req.params.id) {
            return res.status(403).json({ error: "Only this shul's administrators can view its users" });
        }
        if (!app.locals.database.getShul(req.params.id)) return res.status(404).json({ error: "Shul not found" });
        return res.json(app.locals.database.listShulUsers(req.params.id).map(
            ({ id, firstName, lastName, email, role, title }) => ({ id, firstName, lastName, email, role, title })
        ));
    });

    app.get("/api/shuls/:id/initial-version", (req, res) => {
        res.set("Cache-Control", "no-store");
        const user = currentUserId ? app.locals.database.getUser(currentUserId) : null;
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
        const user = currentUserId ? app.locals.database.getUser(currentUserId) : null;
        if (!user) return res.status(401).json({ error: "Sign in to update your shul" });
        if (user.role !== 'admin' || user.shulId !== req.params.id) {
            return res.status(403).json({ error: "Only this shul's administrators can update its information" });
        }
        if (!app.locals.database.getShul(req.params.id)) {
            return res.status(404).json({ error: "Shul not found" });
        }
        try {
            return res.json(app.locals.database.updateShul(req.params.id, req.body));
        } catch (error) {
            if (error instanceof TypeError) return res.status(400).json({ error: error.message });
            return next(error);
        }
    });

    app.patch("/api/shuls/:id/settings", (req, res, next) => {
        res.set("Cache-Control", "no-store");
        const user = currentUserId ? app.locals.database.getUser(currentUserId) : null;
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
        const user = currentUserId ? app.locals.database.getUser(currentUserId) : null;
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
            const seen = new Set();
            const affected = new Set();
            for (const change of changes) {
                validateKeys(change, 'manualOccasions' in change ? ['dateString', 'desc', 'manualOccasions'] : ['dateString', 'desc', 'aliyah', 'locked'], 'reading adjustment');
                const { dateString, desc, aliyah, locked } = change;
                if (typeof dateString !== 'string' || typeof desc !== 'string' || (!('manualOccasions' in change) && typeof locked !== 'boolean')
                    || (aliyah !== undefined && (!Number.isInteger(aliyah) || aliyah < 1 || aliyah > 9))) {
                    return res.status(400).json({ error: "Provide a reading date, name, lock status, and optional aliyah from 1 to 9" });
                }
                const key = JSON.stringify([dateString, desc]);
                const slot = JSON.stringify([dateString, desc, 'manualOccasions' in change ? 'occasions' : aliyah ?? 0]);
                if (seen.has(slot)) return res.status(400).json({ error: "Each reading lock may only appear once per publication" });
                seen.add(slot);
                const reading = readings.get(key);
                if (!reading) return res.status(404).json({ error: "Reading not found in your shul's current schedule" });
                if (aliyah !== undefined && (!reading.psukim[aliyah - 1] || reading.psukim[aliyah - 1] === 'null')) {
                    return res.status(400).json({ error: "This aliyah is not part of the current reading" });
                }
                affected.add(key);
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

    // Previews share a sample identity; regular deployments will use an authenticated session.
    app.get("/api/me", (_req, res) => {
        res.set("Cache-Control", "no-store");
        if (!currentUserId) {
            return res.status(401).json({ error: "Sign in to view your profile" });
        }
        const user = app.locals.database.getUser(currentUserId);
        if (!user) return res.status(404).json({ error: "Current user not found" });
        return res.json(user);
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

    app.use(express.static(fileURLToPath(new URL("../frontend/dist/", import.meta.url))));

    // The registration URL renders a page in the React app, including on refresh.
    app.get(["/registration", "/registration/", "/shul", "/shul/", "/shulSettings", "/shulSettings/"], (req, res) => {
        res.sendFile(fileURLToPath(new URL("../frontend/dist/index.html", import.meta.url)));
    });

    return app;
}
