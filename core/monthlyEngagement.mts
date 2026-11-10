import type { ParshaData } from '../interfaces/parshaData.mts';
import { readingCoverage } from './readingCoverage.mts';

export interface MonthlyEngagement {
    month: string;
    assigned: number;
    open: number;
    locked: number;
    readers: number;
    guestReaders: number;
    readings: number;
    coverage: number | null;
}

export function monthBounds(month: string) {
    if (typeof month !== 'string' || !/^(?!0000)\d{4}-(?:0[1-9]|1[0-2])$/.test(month))
        throw new TypeError('Choose a valid month and year.');
    const [year, number] = month.split('-').map(Number);
    const end = new Date(0);
    end.setUTCFullYear(year, number, 1);
    end.setUTCHours(0, 0, 0, 0);
    const last = new Date(end.getTime() - 86400000);
    return { start: `${month}-01`, end: end.toISOString().slice(0, 10), last: last.toISOString().slice(0, 10) };
}

export function previousMonth(month: string): string {
    monthBounds(month);
    const [year, number] = month.split('-').map(Number);
    return `${String(number === 1 ? year - 1 : year).padStart(4, '0')}-${String(number === 1 ? 12 : number - 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
    const { start } = monthBounds(month);
    return new Date(`${start}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function monthlyEngagement(schedule: ParshaData[], month: string): MonthlyEngagement {
    const { start, end } = monthBounds(month);
    const result: MonthlyEngagement = { month, assigned: 0, open: 0, locked: 0, readers: 0, guestReaders: 0, readings: 0, coverage: null };
    const seen = new Set<string>();
    const readers = new Set<string>(), guests = new Set<string>();
    for (const reading of schedule) {
        const key = JSON.stringify([reading.dateString, reading.desc]);
        if (reading.dateString < start || reading.dateString >= end || seen.has(key)) continue;
        seen.add(key);
        const counts = readingCoverage(reading);
        result.assigned += counts.assigned; result.open += counts.open; result.locked += counts.locked; result.readings++;
        counts.readerIds.forEach(id => readers.add(id));
        reading.psukim.forEach((verses, index) => {
            const reader = reading.readers[index];
            if (verses && verses !== 'null' && reader?.role === 'guest') guests.add(reader.id);
        });
    }
    result.readers = readers.size; result.guestReaders = guests.size;
    result.coverage = result.assigned + result.open ? Math.round(100 * result.assigned / (result.assigned + result.open)) : null;
    return result;
}
