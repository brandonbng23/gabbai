import { useState } from 'react';
import type { ParshaObj } from './parsha.tsx';
import type { ShulUser } from '../api.ts';
import { shulAnalytics } from '../shulAnalytics.ts';
import { localToday } from '../scheduleHighlights.ts';
import { formatEventDate } from '../../../interfaces/shulEvent.mts';

const aliyahLabels = ['Rishon', 'Sheni', 'Shlishi', 'Revi’i', 'Chamishi', 'Shishi', 'Shvi’i', 'Maftir', 'Haftarah'];

export function ShulAnalytics({ schedule, loading, error, users, usersLoading, usersError, year }: {
    schedule: ParshaObj[]; loading: boolean; error: string | null;
    users: ShulUser[]; usersLoading: boolean; usersError: string; year: number;
}) {
    const [weeks, setWeeks] = useState(8);
    const today = localToday();
    const stats = shulAnalytics(schedule, today, weeks);
    return <section className="content-panel shul-analytics" aria-labelledby="shul-analytics-heading">
        <div className="settings-section-header">
            <div><h2 id="shul-analytics-heading">Analytics</h2><p>Reading coverage and participation from your published schedule for Hebrew year {year}.</p></div>
            <div className="analytics-range">
                <label htmlFor="analytics-weeks">Look ahead</label>
                <select id="analytics-weeks" value={weeks} onChange={event => setWeeks(Number(event.target.value))}>
                    {[4, 8, 12].map(value => <option key={value} value={value}>Next {value} weeks</option>)}
                </select>
            </div>
        </div>
        {loading ? <div className="analytics-feedback" role="status">Loading reading analytics…</div>
            : error ? <div className="analytics-feedback" role="alert">{error}</div> : <>
                <p className="analytics-period">{formatEventDate(today)} – {formatEventDate(stats.buckets.at(-1)!.end)}</p>
                <dl className="analytics-metrics">
                    <div><dt>Reading coverage</dt><dd>{stats.coverage === null ? '—' : `${stats.coverage}%`}</dd><dd className="analytics-metric-note">{stats.assigned} assigned aliyot</dd></div>
                    <div><dt>Open aliyot</dt><dd>{stats.open}</dd><dd className="analytics-metric-note">{stats.locked} unassigned locked aliyot</dd></div>
                    <div><dt>Scheduled readers</dt><dd>{stats.readerCount}</dd><dd className="analytics-metric-note">Distinct people assigned</dd></div>
                    <div><dt>Upcoming readings</dt><dd>{stats.readingCount}</dd><dd className="analytics-metric-note">In this date range</dd></div>
                </dl>
                <p className="analytics-explanation">Coverage includes assigned and open aliyot. Unassigned locked aliyot are excluded. Figures update when changes are published.</p>
                <div className="analytics-detail-grid">
                <div className="analytics-reader-panel">
                <h3>Registered readers in this timeframe</h3>
                <p className="analytics-explanation">Includes guests and admin-assigned readings. The timeframe refers to reading dates.</p>
                {stats.registeredReaders.length ? <div className="analytics-reader-table-wrap"><table className="analytics-reader-table">
                    <caption className="visually-hidden">Registered readers and their readings in the selected timeframe</caption>
                    <thead><tr><th scope="col">Reader</th><th scope="col">Registered readings</th></tr></thead>
                    <tbody>{stats.registeredReaders.map(({ reader, aliyahCount, readings }) => <tr key={reader.id}>
                        <th scope="row">
                            <a href={`/userView?${new URLSearchParams({ user: reader.id })}`}>
                                {[reader.title, reader.firstName, reader.lastName].filter(Boolean).join(' ')}
                            </a>
                            <span className="analytics-reader-summary">{reader.role === 'guest' ? 'Guest · ' : ''}{aliyahCount} {aliyahCount === 1 ? 'aliyah' : 'aliyot'}</span>
                        </th>
                        <td><ul className="analytics-reader-assignments">{readings.map(reading => <li key={`${reading.dateString}:${reading.desc}`}>
                            <strong>{reading.desc}</strong><span aria-hidden="true"> · </span>
                            <time dateTime={reading.dateString}>{formatEventDate(reading.dateString)}</time><span aria-hidden="true"> · </span>
                            <span>{reading.aliyot.map(aliyah => aliyahLabels[aliyah - 1] ?? `Aliyah ${aliyah}`).join(', ')}</span>
                        </li>)}</ul></td>
                    </tr>)}</tbody>
                </table></div> : <div className="analytics-feedback">No readers are registered for readings in this timeframe.</div>}
                </div>
                <div className="analytics-coverage-panel">
                {stats.readingCount === 0 ? <div className="analytics-feedback">No readings fall in this date range in your configured schedule.</div> : <>
                    <div className="analytics-subheading"><h3>Coverage by week</h3><div className="analytics-legend">
                        <span><i className="analytics-assigned" />Assigned</span><span><i className="analytics-open" />Open</span><span><i className="analytics-locked" />Locked</span>
                    </div></div>
                    <ul className="analytics-weeks">{stats.buckets.map(bucket => {
                        const total = bucket.assigned + bucket.open + bucket.locked;
                        return <li key={bucket.start}>
                            <span className="analytics-week-label">{formatEventDate(bucket.start)}</span>
                            <div className="analytics-bar" role="img" aria-label={`${bucket.assigned} assigned, ${bucket.open} open, ${bucket.locked} unassigned locked aliyot`}>
                                {total > 0 && <>
                                    <span className="analytics-assigned" style={{ width: `${100 * bucket.assigned / total}%` }} />
                                    <span className="analytics-open" style={{ width: `${100 * bucket.open / total}%` }} />
                                    <span className="analytics-locked" style={{ width: `${100 * bucket.locked / total}%` }} />
                                </>}
                            </div>
                            <span className="analytics-week-count">{total ? `${bucket.assigned} assigned · ${bucket.open} open` : 'No readings'}</span>
                        </li>;
                    })}</ul>
                </>}
                </div>
                </div>
                {stats.readingCount > 0 && <div className="analytics-open-readings">
                    <h3>Next readings with open aliyot</h3>
                    {stats.attention.length ? <ul className="analytics-attention">{stats.attention.map(({ reading, open }) => <li key={`${reading.dateString}:${reading.desc}`}>
                        <div><strong>{reading.desc}</strong><span>{reading.gregDate}</span></div>
                        <span className="analytics-open-count">{open} {open === 1 ? 'aliyah' : 'aliyot'} open</span>
                    </li>)}</ul> : <div className="analytics-feedback">All unlocked aliyot in this range are assigned.</div>}
                </div>}
            </>}
        <h3>Congregation</h3>
        {usersLoading ? <div className="analytics-feedback" role="status">Loading account totals…</div>
            : usersError ? <div className="analytics-feedback" role="alert">{usersError}</div>
            : <dl className="analytics-roster">
                <div><dt>Members</dt><dd>{users.filter(user => user.role === 'member').length}</dd></div>
                <div><dt>Guests</dt><dd>{users.filter(user => user.role === 'guest').length}</dd></div>
                <div><dt>Admins</dt><dd>{users.filter(user => user.role === 'admin').length}</dd></div>
                <div><dt>Frozen accounts</dt><dd>{users.filter(user => user.frozen).length}</dd></div>
            </dl>}
    </section>;
}
