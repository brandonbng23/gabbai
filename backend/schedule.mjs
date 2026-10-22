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
    const occasions = new Map(database.listReadingOccasions(shulId)
        .map(reading => [JSON.stringify([reading.dateString, reading.desc]), reading.manualOccasions]));
    const locks = new Map();
    for (const lock of database.listReadingLocks(shulId)) {
        const key = JSON.stringify([lock.dateString, lock.desc]);
        if (!locks.has(key)) locks.set(key, []);
        locks.get(key).push(lock);
    }
    return new Schedule(settings, settings.getHebYear()).getScheduleData().map(reading => {
        for (const lock of locks.get(JSON.stringify([reading.dateString, reading.desc])) ?? []) {
            if (lock.aliyah === 0) reading.locked = lock.locked;
            else reading.lockedArr[lock.aliyah - 1] = lock.locked;
        }
        reading.manualOccasions = occasions.get(JSON.stringify([reading.dateString, reading.desc])) ?? [];
        reading.searchTerms = [...reading.searchTerms, ...reading.manualOccasions];
        return reading;
    });
}
