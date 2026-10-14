import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { getSchedule, getShulSchedule } from "./schedule.mjs";
import { openDatabase } from "./database/index.mjs";

const app = express();
app.locals.database = openDatabase();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
app.get(["/registration", "/registration/"], (req, res) => {
    res.sendFile(fileURLToPath(new URL("../frontend/dist/index.html", import.meta.url)));
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});
