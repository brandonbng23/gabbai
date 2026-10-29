import Schedule from '../Components/schedule.tsx';
import { useRef } from 'react';
import type { ScheduleHandle } from '../Components/schedule.tsx';
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
    const schedule = useRef<ScheduleHandle>(null);
    return <main className="schedule-page">
        <QuickStart firstName={firstName} readings={readings} loading={loading} error={error}
            onSelectReading={reading => schedule.current?.revealReading(reading)} />

        <div id="full-schedule" className="schedule-content" tabIndex={-1} aria-label="Full schedule">
        {loading ? <LoadingSkeleton variant="schedule" />
            : error ? <p className="shul-context" role="alert">{error}</p>
            : <Schedule ref={schedule} shulId={shulId} parshiyot={readings}
                currentUserId={currentUserId} onReadingCancelled={onReadingCancelled} />}
        </div>
    </main>;
}
