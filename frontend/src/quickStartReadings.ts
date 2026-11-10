import type { ParshaData } from '../../interfaces/parshaData.mts';

type AvailabilityReading = Pick<ParshaData, 'dateString' | 'desc' | 'psukim' | 'readers' | 'locked' | 'lockedArr'>;

export function availableAliyot(reading: AvailabilityReading): number[] {
    if (reading.locked) return [];
    return reading.psukim.flatMap((verses, index) =>
        verses && verses !== 'null' && !reading.lockedArr[index] && !reading.readers[index] ? [index + 1] : []);
}

export function upcomingAvailableReadings<T extends AvailabilityReading>(readings: T[], today: string): T[] {
    return readings.filter(reading => reading.dateString >= today && availableAliyot(reading).length > 0)
        .sort((a, b) => a.dateString.localeCompare(b.dateString) || a.desc.localeCompare(b.desc))
        .slice(0, 3);
}
