import type { UserReading } from './api.ts';

export type ReadingsView = 'upcoming' | 'completed' | 'all';

export function selectUserReadings(readings: UserReading[], view: ReadingsView, today: string): UserReading[] {
    return readings.filter(reading => view === 'all'
        || (view === 'upcoming' ? reading.dateString >= today : reading.dateString < today))
        .sort((a, b) => {
            const byDate = a.dateString.localeCompare(b.dateString);
            return (view === 'completed' ? -byDate : byDate)
                || a.desc.localeCompare(b.desc) || a.aliyah - b.aliyah;
        });
}
