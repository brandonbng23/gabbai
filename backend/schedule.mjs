import { Schedule } from "../core/schedule.mts";
import { Settings } from "../core/settings.mts";

export function getSchedule(year) {
    const settings = new Settings(5787);
    const schedule = new Schedule(settings, 5787);

    return schedule.getScheduleData();
}