import type { SignificantPortion } from '../../interfaces/significantPortions.mts';

const normalize = (name: string) => name.replace(/^Parash(?:at|a)\s+/i, '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f'’\-–—\s]/g, '');

export function upcomingSignificantParshiyot<T extends { dateString: string; desc: string }>(
    readings: T[], saved: SignificantPortion[], today: string,
): { reading: T; occasions: string[] }[] {
    const seen = new Set<string>();
    return readings.filter(reading => reading.dateString >= today)
        .sort((a, b) => a.dateString.localeCompare(b.dateString) || a.desc.localeCompare(b.desc))
        .flatMap(reading => {
            const key = JSON.stringify([reading.dateString, reading.desc]);
            if (seen.has(key)) return [];
            seen.add(key);
            const names = [reading.desc, ...reading.desc.split(/[-–—]/)].map(normalize);
            const matches = saved.filter(entry => [entry.portion, ...entry.portion.split(/[-–—]/)]
                .map(normalize).some(name => name && names.includes(name)));
            return matches.length ? [{ reading, occasions: [...new Set(matches.map(entry => entry.occasion).filter(Boolean))] }] : [];
        }).slice(0, 3);
}
