import type { ParshaObj } from './Components/parsha.tsx';

export function addCalendarDays(date: string, days: number): string {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}

export function readingCoverage(reading: ParshaObj) {
    let assigned = 0, open = 0, locked = 0;
    const readerIds = new Set<string>();
    reading.psukim.forEach((verses, index) => {
        if (!verses || verses === 'null') return;
        const reader = reading.readers[index];
        if (reader) { assigned++; readerIds.add(reader.id); }
        else if (reading.locked || reading.lockedArr[index]) locked++;
        else open++;
    });
    return { assigned, open, locked, readerIds };
}

export function shulAnalytics(schedule: ParshaObj[], today: string, weeks: number) {
    const end = addCalendarDays(today, weeks * 7);
    const readings = schedule.filter(reading => reading.dateString >= today && reading.dateString < end)
        .sort((a, b) => a.dateString.localeCompare(b.dateString) || a.desc.localeCompare(b.desc));
    const buckets = Array.from({ length: weeks }, (_, index) => ({
        start: addCalendarDays(today, index * 7), end: addCalendarDays(today, index * 7 + 6), assigned: 0, open: 0, locked: 0,
    }));
    let assigned = 0, open = 0, locked = 0;
    const readers = new Set<string>();
    const attention: { reading: ParshaObj; open: number }[] = [];
    for (const reading of readings) {
        const counts = readingCoverage(reading);
        assigned += counts.assigned; open += counts.open; locked += counts.locked;
        counts.readerIds.forEach(id => readers.add(id));
        if (counts.open) attention.push({ reading, open: counts.open });
        const bucket = buckets.find(bucket => reading.dateString >= bucket.start && reading.dateString <= bucket.end)!;
        bucket.assigned += counts.assigned; bucket.open += counts.open; bucket.locked += counts.locked;
    }
    return { assigned, open, locked, readerCount: readers.size, readingCount: readings.length, attention: attention.slice(0, 5), buckets, end,
        coverage: assigned + open ? Math.round(assigned * 100 / (assigned + open)) : null };
}
