import type { ShulEvent } from '../../interfaces/shulEvent.mts';
import type { SignificantPortion } from '../../interfaces/significantPortions.mts';
import type { ParshaObj } from './Components/parsha.tsx';
import { upcomingSignificantParshiyot } from './upcomingSignificantParshiyot.ts';
import { readingAnchor } from './readingAnchor.ts';

export type ScheduleHighlight =
    | { kind: 'parsha'; id: string; date: string; time: string; reading: ParshaObj; occasions: string[] }
    | { kind: 'event'; id: string; date: string; time: string; event: ShulEvent };

export function localToday(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function scheduleHighlights(readings: ParshaObj[], saved: SignificantPortion[], events: ShulEvent[], today: string): ScheduleHighlight[] {
    const parshiyot: ScheduleHighlight[] = upcomingSignificantParshiyot(readings, saved, today, Infinity)
        .map(({ reading, occasions }) => ({ kind: 'parsha', id: readingAnchor(reading), date: reading.dateString, time: '00:00', reading, occasions }));
    const featuredEvents: ScheduleHighlight[] = events.filter(event => event.date >= today)
        .map(event => ({ kind: 'event', id: `shul-event-${event.id}`, date: event.date, time: event.time, event }));
    return [...parshiyot, ...featuredEvents].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
}
