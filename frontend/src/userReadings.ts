import type { GuestReading, UserReading } from './api.ts';

export type ReadingsView = 'all' | 'upcoming' | 'completed' | 'guest';

export function isGuestReading(reading: UserReading): reading is GuestReading {
    return 'registrationType' in reading && reading.registrationType === 'guest';
}

export function selectUserReadings<T extends UserReading>(readings: T[], view: ReadingsView, today: string, query = ''): T[] {
    const search = query.trim().toLocaleLowerCase();
    return readings.filter(reading => reading.desc.toLocaleLowerCase().includes(search)
        && (view === 'all' || (view === 'guest' ? isGuestReading(reading)
            : view === 'upcoming' ? reading.dateString >= today : reading.dateString < today)))
        .sort((a, b) => {
            const byDate = a.dateString.localeCompare(b.dateString);
            return (view === 'completed' ? -byDate : byDate)
                || a.desc.localeCompare(b.desc) || a.aliyah - b.aliyah;
        });
}
