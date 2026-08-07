import { Schedule } from "../../core/schedule.mjs";
import { Settings } from "../../core/settings.mjs"

export function getSchedule(year) {
    const schedule = new Schedule(new Settings(year));

    return schedule.getScheduleData();
}

export function getScheduleByID(year, id) {
    const schedule = getSchedule(year);

    return schedule.find(item => item.id == id);
}