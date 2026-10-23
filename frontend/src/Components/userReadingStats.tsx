import { useId } from 'react';
import type { JSX } from 'react';
import type { ShulUser, UserReading } from '../api.js';

export function UserReadingStats({ user }: { user: Pick<ShulUser, 'assignedReadings'> }): JSX.Element {
    const headingId = useId();
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
        </section>
    );
}
