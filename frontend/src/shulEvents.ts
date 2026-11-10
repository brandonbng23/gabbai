import { useEffect, useState } from 'react';
import type { ShulEvent, ShulEventInput } from '../../interfaces/shulEvent.mts';

export async function saveShulEvent(shulId: string, event: ShulEventInput, id?: string): Promise<ShulEvent> {
    const response = await fetch(`/api/shuls/${encodeURIComponent(shulId)}/events${id ? `/${encodeURIComponent(id)}` : ''}`, {
        method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event),
    });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Unable to save the event.');
    return response.json();
}

export async function deleteShulEvent(shulId: string, id: string): Promise<void> {
    const response = await fetch(`/api/shuls/${encodeURIComponent(shulId)}/events/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Unable to delete the event.');
}

export function useShulEvents(shulId?: string) {
    const [events, setEvents] = useState<ShulEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setEvents([]);
        setError('');
        setLoading(Boolean(shulId));
        if (shulId) fetch(`/api/shuls/${encodeURIComponent(shulId)}/events`, { signal: controller.signal, cache: 'no-store' })
            .then(async response => {
                if (!response.ok) throw new Error('Unable to load shul events.');
                const data: ShulEvent[] = await response.json();
                if (!controller.signal.aborted) setEvents(data);
            }).catch(error => { if (!controller.signal.aborted) setError(error.message); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [shulId, attempt]);
    return { events, setEvents, loading, error, retry: () => setAttempt(value => value + 1) };
}
