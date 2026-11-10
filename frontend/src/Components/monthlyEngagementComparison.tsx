import { useEffect, useState } from 'react';
import type { ParshaObj } from './parsha.tsx';
import type { MonthlyEngagement } from '../../../core/monthlyEngagement.mts';
import { monthLabel, previousMonth } from '../../../core/monthlyEngagement.mts';
import { localToday } from '../scheduleHighlights.ts';

const metrics = [
    { key: 'assigned', label: 'Assigned aliyot' },
    { key: 'readers', label: 'Distinct readers' },
    { key: 'guestReaders', label: 'Guest readers' },
    { key: 'coverage', label: 'Reading coverage' },
    { key: 'open', label: 'Open aliyot' },
    { key: 'readings', label: 'Scheduled readings' },
] as const;

export function MonthlyEngagementComparison({ shulId, schedule, active }: { shulId: string; schedule: ParshaObj[]; active: boolean }) {
    const [first, setFirst] = useState(() => localToday().slice(0, 7));
    const [second, setSecond] = useState(() => previousMonth(localToday().slice(0, 7)));
    const [comparison, setComparison] = useState<{ first: MonthlyEngagement; second: MonthlyEngagement } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const validMonths = /^(?!0000)\d{4}-(?:0[1-9]|1[0-2])$/.test(first) && /^(?!0000)\d{4}-(?:0[1-9]|1[0-2])$/.test(second);
    useEffect(() => {
        if (!active) return;
        const controller = new AbortController();
        setComparison(null); setError(''); setLoading(validMonths);
        const timeout = validMonths ? setTimeout(() => {
            fetch(`/api/shuls/${encodeURIComponent(shulId)}/analytics/monthly?${new URLSearchParams({ first, second })}`, {
                signal: controller.signal, cache: 'no-store',
            }).then(async response => {
                const body = await response.json();
                if (!response.ok) throw new Error(body.error || 'Unable to load the month comparison.');
                if (!controller.signal.aborted) setComparison(body);
            }).catch(error => { if (!controller.signal.aborted) setError(error.message); })
                .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        }, 250) : undefined;
        return () => { clearTimeout(timeout); controller.abort(); };
    }, [first, second, shulId, schedule, active, attempt, validMonths]);

    return <section className="analytics-month-comparison" aria-labelledby="analytics-month-heading">
        <div className="analytics-month-header"><div><h3 id="analytics-month-heading">Month-by-month engagement</h3>
            <p>Compare full calendar months by reading date, including upcoming assignments. This comparison is independent of the look-ahead range.</p></div>
            <div className="analytics-month-selectors">
                <div><label htmlFor="analytics-first-month">Month</label><input id="analytics-first-month" type="month" value={first}
                    min="0001-01" max="9999-12" required onChange={event => setFirst(event.target.value)} /></div>
                <div><label htmlFor="analytics-second-month">Compare with</label><input id="analytics-second-month" type="month" value={second}
                    min="0001-01" max="9999-12" required onChange={event => setSecond(event.target.value)} /></div>
            </div>
        </div>
        {!validMonths ? <div className="analytics-feedback">Choose two months to compare.</div>
            : loading ? <div className="analytics-feedback" role="status">Loading month comparison…</div>
            : error ? <div className="analytics-feedback" role="alert">{error} <button type="button" className="settings-reset-btn" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>
            : comparison && comparison.first.month === first && comparison.second.month === second && <>
                <div className="analytics-comparison-table-wrap"><table className="analytics-comparison-table">
                    <caption className="visually-hidden">Engagement for {monthLabel(first)} compared with {monthLabel(second)}</caption>
                    <thead><tr><th scope="col">Engagement</th><th scope="col">{monthLabel(first)}</th><th scope="col">{monthLabel(second)}</th><th scope="col">Difference</th></tr></thead>
                    <tbody>{metrics.map(metric => {
                        const a = comparison.first[metric.key], b = comparison.second[metric.key];
                        const difference = a !== null && b !== null ? a - b : null;
                        const max = Math.max(a ?? 0, b ?? 0, 1);
                        return <tr key={metric.key}><th scope="row">{metric.label}</th>
                            {[a, b].map((value, index) => <td key={index}><strong>{value === null ? '—' : `${value}${metric.key === 'coverage' ? '%' : ''}`}</strong>
                                <span className={`analytics-comparison-bar analytics-comparison-bar-${index}`} aria-hidden="true" style={{ width: `${100 * (value ?? 0) / max}%` }} /></td>)}
                            <td className="analytics-comparison-difference">{difference === null ? '—' : difference === 0 ? 'No change' : `${difference > 0 ? '+' : ''}${difference}${metric.key === 'coverage' ? ' pp' : ''}`}</td>
                        </tr>;
                    })}</tbody>
                </table></div>
                <p className="analytics-comparison-note">Difference is the first month minus the comparison month; pp means percentage points. Includes guests and admin assignments. Based on currently saved assignments and your shul’s current reading settings, not registration timestamps.</p>
                {(!comparison.first.readings || !comparison.second.readings) && <p className="analytics-comparison-note">A month with no scheduled readings shows no coverage percentage.</p>}
            </>}
    </section>;
}
