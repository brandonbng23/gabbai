import type { ParshaObj } from './Components/parsha.tsx';
import type { ShulUser } from './api.ts';

export interface ReaderParticipation {
    reader: ShulUser;
    aliyahCount: number;
    readings: { dateString: string; desc: string; aliyot: number[] }[];
}

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
    const participation = new Map<string, ReaderParticipation>();
    const attention: { reading: ParshaObj; open: number }[] = [];
    for (const reading of readings) {
        const counts = readingCoverage(reading);
        assigned += counts.assigned; open += counts.open; locked += counts.locked;
        counts.readerIds.forEach(id => readers.add(id));
        reading.psukim.forEach((verses, index) => {
            const reader = reading.readers[index];
            if (!verses || verses === 'null' || !reader) return;
            let entry = participation.get(reader.id);
            if (!entry) {
                entry = { reader, aliyahCount: 0, readings: [] };
                participation.set(reader.id, entry);
            }
            entry.aliyahCount++;
            let assignment = entry.readings.find(item => item.dateString === reading.dateString && item.desc === reading.desc);
            if (!assignment) {
                assignment = { dateString: reading.dateString, desc: reading.desc, aliyot: [] };
                entry.readings.push(assignment);
            }
            assignment.aliyot.push(index + 1);
        });
        if (counts.open) attention.push({ reading, open: counts.open });
        const bucket = buckets.find(bucket => reading.dateString >= bucket.start && reading.dateString <= bucket.end)!;
        bucket.assigned += counts.assigned; bucket.open += counts.open; bucket.locked += counts.locked;
    }
    const registeredReaders = [...participation.values()].sort((a, b) => (a.reader.lastName ?? '').localeCompare(b.reader.lastName ?? '')
        || (a.reader.firstName ?? '').localeCompare(b.reader.firstName ?? '') || a.reader.id.localeCompare(b.reader.id));
    return { assigned, open, locked, readerCount: readers.size, registeredReaders, readingCount: readings.length, attention: attention.slice(0, 5), buckets, end,
        coverage: assigned + open ? Math.round(assigned * 100 / (assigned + open)) : null };
}
