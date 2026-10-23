import { useId } from 'react';
import type { JSX } from 'react';
import type { UserReading } from '../api.js';
import type { ReaderCardUser } from './userCard.tsx';
import { ReadingCard } from './reading.tsx';

export function UserReadingStats({ user, onCancelReading, cancellationDisabled = false }: {
    user: ReaderCardUser;
    onCancelReading?: (reading: UserReading) => Promise<void>;
    cancellationDisabled?: boolean;
}): JSX.Element {
    const headingId = useId();
    const upcomingReadings = user.assignedReadings.filter(reading => new Date(reading.dateString) > new Date());
    return (
        <section className="shul-card user-stats" aria-labelledby={headingId}>
            <header className="settings-summary-heading">
                <div>
                    <span className="settings-eyebrow">ACTIVITY</span>
                    <h2 id={headingId}>Reading statistics</h2>
                </div>
            </header>
            <div className="user-reading-stats">
                <div className="stat-group">
                    <div className="reading-stat lifetime-stat">
                        <span>{user.assignedReadings.length}</span>
                    </div>
                    <span className="stat-label">Lifetime<br></br>Readings</span>
                </div>

                <div className="stat-group">
                    <div className="reading-stat verses-stat">
                        <span>{user.assignedReadings.reduce((sum, r: UserReading) => sum += r.verseCount ?? 0, 0)}</span>
                    </div>
                    <span className="stat-label">Lifetime<br></br>Verses</span>
                </div>

                <div className="stat-group">
                    <div className="reading-stat completed-stat">
                        <span>{user.assignedReadings.filter((r: UserReading) => new Date(r.dateString) < new Date()).length}</span>
                    </div>
                    <span className="stat-label">Completed<br></br>Readings</span>
                </div>

                <div className="stat-group">
                    <div className="reading-stat upcoming-stat">
                        <span>{user.assignedReadings.filter((r: UserReading) => new Date(r.dateString) > new Date()).length}</span>
                    </div>
                    <span className="stat-label">Upcoming<br></br>Readings</span>
                </div>
            </div>
            <div className="activity-readings">
                <h2 id={`${headingId}-upcoming`}>Upcoming Readings</h2>
                {upcomingReadings.length > 0 ? (
                    <div className="reading-list" role="region" aria-labelledby={`${headingId}-upcoming`} tabIndex={0}>
                        {upcomingReadings.map(reading => (
                            <ReadingCard key={`${reading.dateString}-${reading.desc}-${reading.aliyah}`}
                                user={user} reading={reading} onCancelReading={onCancelReading}
                                cancellationDisabled={cancellationDisabled} />
                        ))}
                    </div>
                ) : <p className="activity-readings-empty">No upcoming readings.</p>}
            </div>
        </section>
    );
}
