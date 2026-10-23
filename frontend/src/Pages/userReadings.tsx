import { useEffect, useState } from 'react';
import type { User, UserReading, UserViewProfile } from '../api.ts';
import { cancelReading, getJson } from '../api.ts';
import { ReadingCard } from '../Components/reading.tsx';
import { LoadingSkeleton } from '../Components/loadingSkeleton.tsx';
import { selectUserReadings } from '../userReadings.ts';
import type { ReadingsView } from '../userReadings.ts';

export function UserReadings({ user, userId, onReadingCancelled }: {
    user: User;
    userId: string;
    onReadingCancelled: (dateString: string, desc: string, aliyah: number) => void;
}) {
    const ownReadings = userId === user.id;
    const [profile, setProfile] = useState<UserViewProfile | null>(null);
    const [error, setError] = useState('');
    const [view, setView] = useState<ReadingsView>('upcoming');
    const [notice, setNotice] = useState('');

    useEffect(() => {
        if (ownReadings) return;
        const controller = new AbortController();
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
    const readings = reader?.assignedReadings ?? [];
    const visible = selectUserReadings(readings, view, today);
    const options = [
        { value: 'upcoming', label: 'Upcoming', count: selectUserReadings(readings, 'upcoming', today).length },
        { value: 'completed', label: 'Completed', count: selectUserReadings(readings, 'completed', today).length },
        { value: 'all', label: 'All', count: readings.length },
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
                <span className="settings-eyebrow">READING ACTIVITY</span>
                <h1>{ownReadings ? 'My readings' : fullName ? `${fullName}’s readings` : 'User readings'}</h1>
                <p>Upcoming assignments and past readings in one place.</p>
            </div>
        </header>
        {error ? <p className="user-readings-error" role="alert">{error}</p>
            : !reader ? <LoadingSkeleton variant="user-readings" />
            : <div className="shul-settings">
                <section className="settings-panel user-readings-panel" aria-labelledby="readings-list-heading">
                    <div className="user-readings-toolbar">
                        <div className="user-readings-filters" role="group" aria-label="Filter readings">
                            {options.map(option => <button key={option.value} type="button"
                                aria-pressed={view === option.value} onClick={() => setView(option.value)}>
                                {option.label} <span>{option.count}</span>
                            </button>)}
                        </div>
                        <a href={`/userView?${new URLSearchParams({ user: reader.id })}`}>View profile →</a>
                    </div>
                    <h2 id="readings-list-heading">{options.find(option => option.value === view)?.label} readings</h2>
                    <p className="user-readings-notice" role="status">{notice}</p>
                    {visible.length > 0 ? <div className="user-readings-list">
                        {visible.map(reading => <ReadingCard key={`${reading.dateString}-${reading.desc}-${reading.aliyah}`}
                            user={reader} reading={reading}
                            onCancelReading={ownReadings && user.shulId && reading.dateString >= today ? removeReading : undefined} />)}
                    </div> : <div className="user-readings-empty">
                        <p>{view === 'all' ? 'No readings assigned yet.' : `No ${view} readings.`}</p>
                        {ownReadings && <a href="/">← Browse the schedule</a>}
                    </div>}
                </section>
            </div>}
    </main>;
}
