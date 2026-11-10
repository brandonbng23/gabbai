import { useEffect, useState } from 'react';
import type { StarredReading, UserReading } from '../../interfaces/user.mts';

export type StarTarget = UserReading & { shulId?: string };
export interface ReadingStarActions {
    starredReadings?: StarredReading[];
    starError?: string;
    onReadingStarred?: (reading: StarTarget, starred: boolean) => Promise<void>;
}

export function sameReading(a: StarTarget, b: StarTarget): boolean {
    return a.shulId === b.shulId && a.dateString === b.dateString && a.desc === b.desc && a.aliyah === b.aliyah;
}

export function useStarredReadings(userId?: string, shulId?: string): ReadingStarActions {
    const [state, setState] = useState<{ userId?: string; readings?: StarredReading[]; error?: string }>({});
    const readings = state.userId === userId ? state.readings : undefined;
    const error = state.userId === userId ? state.error : undefined;
    useEffect(() => {
        if (!userId) return;
        const controller = new AbortController();
        fetch('/api/me/starred-readings', { signal: controller.signal, cache: 'no-store' })
            .then(async response => {
                if (!response.ok) throw new Error('Unable to load your starred readings. Refresh and try again.');
                return response.json() as Promise<StarredReading[]>;
            })
            .then(result => { if (!controller.signal.aborted) setState({ userId, readings: result }); })
            .catch(failure => {
                if (!controller.signal.aborted) setState({ userId, error: failure instanceof Error ? failure.message : 'Unable to load your starred readings.' });
            });
        return () => controller.abort();
    }, [userId]);

    async function onReadingStarred(reading: StarTarget, starred: boolean): Promise<void> {
        if (!userId || !readings) throw new Error('Your starred readings are not loaded. Refresh and try again.');
        const target = { shulId, ...reading };
        const response = await fetch('/api/me/starred-readings', {
            method: starred ? 'PUT' : 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shulId: target.shulId, dateString: target.dateString, desc: target.desc, aliyah: target.aliyah }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to save your starred reading. Please try again.');
        setState(previous => previous.userId === userId ? { userId,
            readings: [...(previous.readings ?? []).filter(item => !sameReading(item, target)), ...(starred ? [result as StarredReading] : [])],
        } : previous);
    }

    return { starredReadings: userId ? readings : undefined, starError: error,
        onReadingStarred: userId ? onReadingStarred : undefined };
}
