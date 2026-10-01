import express from "express";
import { getSchedule } from "./schedule.mjs";

const app = express();
const PORT = 3000;

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

app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});