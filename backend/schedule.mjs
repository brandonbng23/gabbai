import { ReadingSet } from "../core/readingSet.mts";
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
    const counts = new Map(database.listReadingAliyahCounts(shulId)
        .map(reading => [JSON.stringify([reading.dateString, reading.desc]), reading.aliyahCount]));
    const occasions = new Map(database.listReadingOccasions(shulId)
        .map(reading => [JSON.stringify([reading.dateString, reading.desc]), reading.manualOccasions]));
    const readers = new Map();
    for (const assignment of database.listReadingReaders(shulId)) {
        const key = JSON.stringify([assignment.dateString, assignment.desc]);
        if (!readers.has(key)) readers.set(key, []);
        readers.get(key).push(assignment);
    }
    const locks = new Map();
    for (const lock of database.listReadingLocks(shulId)) {
        const key = JSON.stringify([lock.dateString, lock.desc]);
        if (!locks.has(key)) locks.set(key, []);
        locks.get(key).push(lock);
    }
    return new Schedule(settings, settings.getHebYear()).getScheduleData().map(reading => {
        reading.defaultAliyahCount = reading.psukim.slice(0, 7).filter(value => value && value !== 'null').length;
        reading.aliyahOptions = Array.from({ length: 7 }, (_, index) => {
            const count = index + 1;
            if (count === reading.defaultAliyahCount) return reading.psukim;
            const localSettings = settingsForSchedule(shul.settings);
            localSettings.setHebYear(settings.getHebYear());
            localSettings.setAliyotCount(count);
            return new ReadingSet(reading.desc, count, localSettings, reading.occassions, settings.getHebYear()).getPsukimArr();
        });
        reading.aliyahCountOverride = counts.get(JSON.stringify([reading.dateString, reading.desc])) ?? null;
        reading.aliyahCount = reading.aliyahCountOverride ?? reading.defaultAliyahCount;
        reading.psukim = reading.aliyahOptions[reading.aliyahCount - 1];
        for (const lock of locks.get(JSON.stringify([reading.dateString, reading.desc])) ?? []) {
            if (lock.aliyah === 0) reading.locked = lock.locked;
            else reading.lockedArr[lock.aliyah - 1] = lock.locked;
        }
        for (const assignment of readers.get(JSON.stringify([reading.dateString, reading.desc])) ?? []) {
            const index = assignment.aliyah - 1;
            if (reading.psukim[index] && reading.psukim[index] !== 'null') reading.readers[index] = assignment.reader;
        }
        reading.manualOccasions = occasions.get(JSON.stringify([reading.dateString, reading.desc])) ?? [];
        reading.searchTerms = [...reading.searchTerms, ...reading.manualOccasions];
        return reading;
    });
}
