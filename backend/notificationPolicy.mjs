export const notificationPolicy = Object.freeze({ memberDailyLimit: 5, guestDailyLimit: 1, globalDailyLimit: 100, globalResetTimezone: 'UTC', roundupHour: 16 });

export function localClock(now, timezone) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map(part => [part.type, part.value]));
    return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export function threeMonthWindow(now, timezone) {
    const { day } = localClock(now, timezone);
    const start = new Date(`${day}T12:00:00Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 1, 12));
    end.setUTCDate(Math.min(start.getUTCDate(), new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()));
    return { start: day, end: end.toISOString().slice(0, 10) };
}
