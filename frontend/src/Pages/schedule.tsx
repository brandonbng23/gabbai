import Schedule from '../Components/schedule.tsx';
import { useState } from 'react';
import { QuickStart } from '../Components/quickStart.tsx';
import { LoadingSkeleton } from '../Components/loadingSkeleton.tsx';
import type { ParshaObj, ReadingActions } from '../Components/parsha.tsx';

export default function SchedulePage({ firstName, shulId, readings, loading, error, currentUserId, onReadingCancelled }: {
    firstName?: string;
    shulId?: string;
    readings: ParshaObj[];
    loading: boolean;
    error: string | null;
} & ReadingActions) {
    const [search, setSearch] = useState('');
    return <main className="schedule-page">
        <QuickStart firstName={firstName} search={search} onSearchChange={setSearch} />

        <div id="full-schedule" className="schedule-content" tabIndex={-1} aria-label="Full schedule">
        {loading ? <LoadingSkeleton variant="schedule" />
            : error ? <p className="shul-context" role="alert">{error}</p>
            : <Schedule shulId={shulId} parshiyot={readings}
                nameFilter={search} setNameFilter={setSearch}
                currentUserId={currentUserId} onReadingCancelled={onReadingCancelled} />}
        </div>
    </main>;
}
