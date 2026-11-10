import { useEffect, useState } from 'react';
import type { ShulEvent } from '../../interfaces/shulEvent.mts';
import type { ShulLinkAnalytics } from '../../interfaces/shulLinkAnalytics.mts';

export interface LinkAnalyticsState {
    data: ShulLinkAnalytics | null;
    loading: boolean;
    error: string;
    refresh: () => void;
}

export function useShulLinkAnalytics(shulId: string, active: boolean, events: ShulEvent[]): LinkAnalyticsState {
    const [result, setResult] = useState<{ shulId: string; data: ShulLinkAnalytics } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!active) return;
        const refresh = () => setAttempt(value => value + 1);
        window.addEventListener('focus', refresh);
        return () => window.removeEventListener('focus', refresh);
    }, [active]);
    useEffect(() => {
        if (!active) return;
        const controller = new AbortController();
        setLoading(true); setError('');
        fetch(`/api/shuls/${encodeURIComponent(shulId)}/analytics/links`, { signal: controller.signal, cache: 'no-store' })
            .then(async response => {
                if (!response.ok) throw new Error('Unable to load event and link analytics.');
                const data: ShulLinkAnalytics = await response.json();
                if (!controller.signal.aborted) setResult({ shulId, data });
            }).catch(error => { if (!controller.signal.aborted) setError(error.message); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [shulId, active, events, attempt]);
    return { data: result?.shulId === shulId ? result.data : null, loading, error, refresh: () => setAttempt(value => value + 1) };
}
