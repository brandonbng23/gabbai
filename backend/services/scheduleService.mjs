import Schedule from "../core/Schedule.mjs";

export function getSchedule(year) {
    const schedule = new Schedule(year);

    return schedule.getScheduleData();
}