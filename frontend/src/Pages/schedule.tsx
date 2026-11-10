import Schedule from '../Components/schedule.tsx';
import { useRef } from 'react';
import { BackToTopButton } from '../Components/backToTopButton.tsx';
import type { ScheduleHandle } from '../Components/schedule.tsx';
import { QuickStart } from '../Components/quickStart.tsx';
import { ScheduleHighlights } from '../Components/scheduleHighlights.tsx';
import type { ShulEvent } from '../../../interfaces/shulEvent.mts';
import type { SignificantPortion } from '../../../interfaces/significantPortions.mts';
import { LoadingSkeleton } from '../Components/loadingSkeleton.tsx';
import type { ParshaObj, ReadingActions } from '../Components/parsha.tsx';

export default function SchedulePage({ firstName, shulId, donationUrl, readings, loading, error, currentUserId, onReadingCancelled, significantParshiyot = [], events, eventsLoading, eventsError, ...readingStars }: {
    firstName?: string;
    shulId?: string;
    donationUrl?: string;
    readings: ParshaObj[];
    loading: boolean;
    error: string | null;
    significantParshiyot?: SignificantPortion[];
    events: ShulEvent[];
    eventsLoading: boolean;
    eventsError: string;
} & ReadingActions) {
    const schedule = useRef<ScheduleHandle>(null);
    const page = useRef<HTMLElement>(null);

    return <main ref={page} className="schedule-page" tabIndex={-1}>
        <QuickStart firstName={firstName} readings={readings} loading={loading} error={error}
            onSelectReading={reading => schedule.current?.revealReading(reading)} />

        <div id="full-schedule" className="schedule-content" tabIndex={-1} aria-label="Full schedule">
        {!loading && !error && <ScheduleHighlights readings={readings} saved={significantParshiyot} shulId={shulId} donationUrl={donationUrl}
            events={events} eventsLoading={eventsLoading} eventsError={eventsError} signedIn={Boolean(currentUserId)}
            onSelect={reading => schedule.current?.revealReading(reading)} />}
        {readingStars.starError && <p className="page-message" role="alert">Starred readings could not be loaded. {readingStars.starError}</p>}
        {loading ? <LoadingSkeleton variant="schedule" />
            : error ? <p className="page-message" role="alert">{error}</p>
            : <Schedule ref={schedule} shulId={shulId} parshiyot={readings}
                currentUserId={currentUserId} onReadingCancelled={onReadingCancelled} {...readingStars} />}
        </div>
        <BackToTopButton focusTarget={page} />
    </main>;
}
