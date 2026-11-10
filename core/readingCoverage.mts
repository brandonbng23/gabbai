import type { ParshaData } from '../interfaces/parshaData.mts';

export function readingCoverage(reading: Pick<ParshaData, 'psukim' | 'readers' | 'locked' | 'lockedArr'>) {
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
