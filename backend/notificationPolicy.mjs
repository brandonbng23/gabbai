export const notificationPolicy = Object.freeze({ memberDailyLimit: 5, guestDailyLimit: 1, globalDailyLimit: 100, globalResetTimezone: 'UTC', roundupHour: 16 });

export function localClock(now, timezone) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map(part => [part.type, part.value]));
    return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
}

export const reportRanges = ['2weeks', '4weeks', '6weeks', '8weeks', '10weeks', '12weeks'];
export const reportWeekdays = [0, 1, 2, 3, 4, 5, 6];

export function isShabbatDeliveryPaused(now, timezone) {
    // Without location/sunset settings, reserve all of Friday and Saturday.
    const { day } = localClock(now, timezone);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    return weekday === 5 || weekday === 6;
}

export function isReportDue(now, settings) {
    const local = localClock(now, settings.timezone);
    const weekday = new Date(`${local.day}T12:00:00Z`).getUTCDay();
    const [hour, minute] = settings.reportTime.split(':').map(Number);
    return settings.reportDays.includes(weekday) && local.hour * 60 + local.minute >= hour * 60 + minute;
}

export function reportWindow(now, timezone, range = '12weeks') {
    // Calendar-month values remain supported by the legacy helper below.
    if (![...reportRanges, '1month', '2months', '3months'].includes(range)) throw new TypeError('Choose a valid summary window.');
    const { day } = localClock(now, timezone);
    const start = new Date(`${day}T12:00:00Z`);
    const weeks = range.endsWith('weeks') ? Number.parseInt(range, 10) : null;
    const end = weeks ? new Date(start) : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + Number(range[0]), 1, 12));
    if (weeks) end.setUTCDate(end.getUTCDate() + weeks * 7);
    else end.setUTCDate(Math.min(start.getUTCDate(), new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()));
    return { start: day, end: end.toISOString().slice(0, 10) };
}

export const threeMonthWindow = (now, timezone) => reportWindow(now, timezone, '3months');
