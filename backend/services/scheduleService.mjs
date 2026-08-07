import { Schedule } from "../../core/schedule.mjs";
import { Settings } from "../../core/settings.mjs"

export function getSchedule(year) {
    const schedule = new Schedule(new Settings(year));

    return schedule.getScheduleData();
}