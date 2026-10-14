import { Schedule } from "../core/schedule.mts";
import { Settings } from "../core/settings.mts";
import { settingsForSchedule } from "./database/settings.mjs";

export function getSchedule(year = 5787) {
    if (!Number.isInteger(year) || year < 1 || year > 9999) throw new TypeError('Invalid Hebrew year');
    const settings = new Settings(year);
    const schedule = new Schedule(settings, year);

    return schedule.getScheduleData();
}

export function getShulSchedule(database, shulId, year) {
    const shul = database.getShul(shulId);
    if (!shul) throw new Error('Shul not found');
    const settings = settingsForSchedule(shul.settings);
    if (year !== undefined) {
        if (!Number.isInteger(year) || year < 1 || year > 9999) throw new TypeError('Invalid Hebrew year');
        settings.setHebYear(year);
    }
    return new Schedule(settings, settings.getHebYear()).getScheduleData();
}
