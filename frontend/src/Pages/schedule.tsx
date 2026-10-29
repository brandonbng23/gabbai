import Schedule from '../Components/schedule.tsx';
import { useEffect, useRef, useState } from 'react';
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
    const page = useRef<HTMLElement>(null);
    const [showBackToTop, setShowBackToTop] = useState(false);

    useEffect(() => {
        const update = () => setShowBackToTop(window.scrollY > 400);
        update();
        window.addEventListener('scroll', update, { passive: true });
        return () => window.removeEventListener('scroll', update);
    }, []);

    return <main ref={page} className="schedule-page" tabIndex={-1}>
        <QuickStart firstName={firstName} readings={readings} loading={loading} error={error}
            onSelectReading={reading => schedule.current?.revealReading(reading)} />

        <div id="full-schedule" className="schedule-content" tabIndex={-1} aria-label="Full schedule">
        {loading ? <LoadingSkeleton variant="schedule" />
            : error ? <p className="shul-context" role="alert">{error}</p>
            : <Schedule ref={schedule} shulId={shulId} parshiyot={readings}
                currentUserId={currentUserId} onReadingCancelled={onReadingCancelled} />}
        </div>
        {showBackToTop && <button type="button" className="schedule-back-to-top" onClick={() => {
            window.scrollTo({ top: 0, behavior: 'instant' });
            page.current?.focus({ preventScroll: true });
        }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
                <path d="M297.4 169.4C309.9 156.9 330.2 156.9 342.7 169.4L534.7 361.4C547.2 373.9 547.2 394.2 534.7 406.7C522.2 419.2 501.9 419.2 489.4 406.7L320 237.3L150.6 406.6C138.1 419.1 117.8 419.1 105.3 406.6C92.8 394.1 92.8 373.8 105.3 361.3L297.3 169.3z" />
            </svg>
            Back to top
        </button>}
    </main>;
}
