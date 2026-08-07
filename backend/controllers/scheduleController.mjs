import { getSchedule } from "../services/scheduleService.mjs";

export function getScheduleHandler(req, res) {
    try {
        const year = req.query.year ? Number(req.query.year) : 5787;

        const schedule = getSchedule(year);
        res.json(schedule);
    } catch (err) {
        console.error(err);
        res.status(500).json({error: "Schedule generation failed."});
    }
}