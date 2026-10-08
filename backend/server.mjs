import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";
import { getSchedule } from "./schedule.mjs";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/api/test", (req, res) => {
    res.json({
        message: "Backend is working"
    });
});

app.get("/api/schedule", (req, res) => {
    const year = Number(req.query.year);

    const schedule = getSchedule(year);

    res.json(schedule);
});

app.use(express.static(fileURLToPath(new URL("../frontend/dist/", import.meta.url))));

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});
