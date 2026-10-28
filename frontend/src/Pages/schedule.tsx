import Schedule from '../Components/schedule.tsx';
import WelcomeBar from '../Components/welcomeBar.tsx';
import { LoadingSkeleton } from '../Components/loadingSkeleton.tsx';
import type { ParshaObj, ReadingActions } from '../Components/parsha.tsx';

export default function SchedulePage({ firstName, shulId, readings, loading, error, currentUserId, onReadingCancelled }: {
    firstName?: string;
    shulId?: string;
    readings: ParshaObj[];
    loading: boolean;
    error: string | null;
} & ReadingActions) {
    return <main className="schedule-page">
        <WelcomeBar fName={firstName} />
        {loading ? <LoadingSkeleton variant="schedule" />
            : error ? <p className="shul-context" role="alert">{error}</p>
            : <Schedule shulId={shulId} parshiyot={readings}
                currentUserId={currentUserId} onReadingCancelled={onReadingCancelled} />}
    </main>;
}
