import { useEffect, useState } from 'react';
import type { GuestReading, User, UserReading, UserViewProfile } from '../api.ts';
import { cancelReading, getJson } from '../api.ts';
import { ReadingCard } from '../Components/reading.tsx';
import { LoadingSkeleton } from '../Components/loadingSkeleton.tsx';
import { isGuestReading, selectUserReadings } from '../userReadings.ts';
import type { ReadingsView } from '../userReadings.ts';

export function UserReadings({ user, userId, onReadingCancelled }: {
    user: User;
    userId: string;
    onReadingCancelled: (dateString: string, desc: string, aliyah: number) => void;
}) {
    const ownReadings = userId === user.id;
    const [profile, setProfile] = useState<UserViewProfile | null>(null);
    const [error, setError] = useState('');
    const [view, setView] = useState<ReadingsView>('all');
    const [query, setQuery] = useState('');
    const [guestReadings, setGuestReadings] = useState<GuestReading[]>([]);
    const [guestLoading, setGuestLoading] = useState(ownReadings);
    const [guestError, setGuestError] = useState('');
    const [notice, setNotice] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        if (ownReadings) {
            getJson<GuestReading[]>('/api/me/guest-readings', controller.signal)
                .then(result => { if (!controller.signal.aborted) setGuestReadings(result); })
                .catch(failure => {
                    if (!controller.signal.aborted) setGuestError(failure instanceof Error ? failure.message : 'Unable to load guest registrations.');
                })
                .finally(() => { if (!controller.signal.aborted) setGuestLoading(false); });
            return () => controller.abort();
        }
        getJson<UserViewProfile>(`/api/users/${encodeURIComponent(userId)}`, controller.signal)
            .then(result => { if (!controller.signal.aborted) setProfile(result); })
            .catch(failure => {
                if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to load these readings.');
            });
        return () => controller.abort();
    }, [ownReadings, userId]);

    const reader = ownReadings ? user : profile;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const readings = [...(reader?.assignedReadings ?? []), ...(ownReadings ? guestReadings : [])];
    const visible = selectUserReadings(readings, view, today, query);
    const options = [
        { value: 'all', label: 'All', count: selectUserReadings(readings, 'all', today, query).length },
        { value: 'upcoming', label: 'Upcoming', count: selectUserReadings(readings, 'upcoming', today, query).length },
        { value: 'completed', label: 'Completed', count: selectUserReadings(readings, 'completed', today, query).length },
        ...(ownReadings ? [{ value: 'guest', label: 'Guest registrations', count: selectUserReadings(readings, 'guest', today, query).length }] as const : []),
    ] as const;
    const fullName = reader ? [reader.firstName, reader.lastName].filter(Boolean).join(' ') : '';

    async function removeReading(reading: UserReading): Promise<void> {
        if (!ownReadings || !user.shulId) throw new Error('You can only remove your own registrations.');
        await cancelReading(user.shulId, reading.dateString, reading.desc, reading.aliyah);
        onReadingCancelled(reading.dateString, reading.desc, reading.aliyah);
        setNotice('Your reading registration was removed.');
    }

    return <main className="shul-admin-page user-readings-page">
        <header className="settings-page-header">
            <div>
                <h1>My Readings</h1>
            </div>
        </header>
        {error ? <p className="user-readings-error" role="alert">{error}</p>
            : !reader || (ownReadings && guestLoading) ? <LoadingSkeleton variant="user-readings" />
            : <div className="shul-settings">
                <section className="settings-panel user-readings-panel" aria-labelledby="readings-list-heading">
                    <div className="user-readings-toolbar">
                        <div className="user-readings-filters" role="group" aria-label="Filter readings">
                            {options.map(option => <button key={option.value} type="button"
                                data-filter={option.value}
                                aria-pressed={view === option.value} onClick={() => setView(option.value)}>
                                {option.label} <span>{option.count}</span>
                            </button>)}
                        </div>
                        <div className="user-readings-search">
                            <label htmlFor="reading-name-search">Search by reading name</label>
                            <input id="reading-name-search" type="search" value={query}
                                placeholder="e.g. 'Pinchas' or 'Pesach'" autoComplete="off"
                                onChange={event => setQuery(event.target.value)} />
                        </div>
                        <a href={`/userView?${new URLSearchParams({ user: reader.id })}`}>View profile →</a>
                    </div>
                    {guestError && <p className="user-readings-error" role="alert">Guest registrations could not be loaded. {guestError}</p>}
                    <h2 id="readings-list-heading">{view === 'guest' ? 'Guest registrations' : `${options.find(option => option.value === view)?.label} readings`}</h2>
                    {ownReadings && view === 'guest' && <p className="user-readings-guest-note">Bookings made while signed in using the guest form. These do not count toward your activity or statistics.</p>}
                    <p className="user-readings-notice" role="status">{notice}</p>
                    {visible.length > 0 ? <div className="user-readings-list">
                        {visible.map(reading => <ReadingCard key={`${isGuestReading(reading) ? `guest-${reading.shulId}` : 'profile'}-${reading.dateString}-${reading.desc}-${reading.aliyah}`}
                            user={isGuestReading(reading) ? reading.reader : reader} reading={reading}
                            onCancelReading={ownReadings && !isGuestReading(reading) && user.shulId && reading.dateString >= today ? removeReading : undefined} />)}
                    </div> : <div className="user-readings-empty">
                        <p>{query.trim() ? 'No readings match your search.' : view === 'guest' ? 'No guest registrations linked to your account.' : view === 'all' ? 'No readings assigned yet.' : `No ${view} readings.`}</p>
                        {ownReadings && <a href="/">← Browse the schedule</a>}
                    </div>}
                </section>
            </div>}
    </main>;
}
