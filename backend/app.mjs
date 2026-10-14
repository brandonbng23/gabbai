import express from "express";
import { fileURLToPath } from "node:url";
import { getSchedule, getShulSchedule } from "./schedule.mjs";
import { openDatabase } from "./database/index.mjs";
import { ensureDemoUser } from "./database/demo.mjs";

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
