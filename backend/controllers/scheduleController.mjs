import { getSchedule, getScheduleByID } from "../services/scheduleService.mjs";

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

export function getScheduleByIDHandler(req, res) {
    try {
        const { id } = req.params;
        const year = 5787;

        const schedule = getScheduleByID(year, id);
        
        if (!schedule) {
            return res.status(404).json({error: "Schedule not found."});
        }

        res.json(schedule);
    } catch (err) {
        console.error(err);

        res.status(500).json({error: "Schedule generation failed."});
    }
}