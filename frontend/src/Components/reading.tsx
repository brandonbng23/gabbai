import { useState } from 'react';
import type { JSX } from 'react';
import type { UserReading } from '../api.ts';
import type { ReaderCardUser } from './userCard.tsx';
import AssignedReader from './assignedReader.tsx';
import { TrashIcon } from './trashIcon.tsx';
import { useReadingRemovalConfirmation } from './useReadingRemovalConfirmation.tsx';
import { isGuestReading } from '../userReadings.ts';

const aliyahLabels = ["Rishon", "Sheni", "Shlishi", "Revi'i", "Chamishi", "Shishi", "Shvi'i", "Maftir", "Haftarah"];

export function ReadingCard({ user, reading, onCancelReading, cancellationDisabled = false, showTags = true }: {
    user: ReaderCardUser;
    reading: UserReading;
    onCancelReading?: (reading: UserReading) => Promise<void>;
    cancellationDisabled?: boolean;
    showTags?: boolean;
}): JSX.Element {
    const [cancelling, setCancelling] = useState(false);
    const [error, setError] = useState('');
    const { confirmRemoval, confirmationDialog } = useReadingRemovalConfirmation();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const upcoming = reading.dateString >= today;

    async function cancel(): Promise<void> {
        if (!onCancelReading || cancelling || cancellationDisabled) return;
        if (!await confirmRemoval(reading)) return;
        setCancelling(true);
        setError('');
        try {
            await onCancelReading(reading);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Unable to cancel your reading. Please try again.');
        } finally {
            setCancelling(false);
        }
    }

    return (
        <div className="reading-card">
            <div className="reading-card-header">
                <div className="reading-card-title">
                    <h3>{reading.desc}</h3>
                    <span className="reading-card-aliyah">{aliyahLabels[reading.aliyah - 1]}</span>
                </div>
                <AssignedReader reader={user} portal />
            </div>
            <div className="reading-card-body">
                <div className="reading-card-dates">
                    <time dateTime={reading.dateString}>{reading.gregDate || reading.dateString}</time>
                    {reading.hDate && <span>{reading.hDate}</span>}
                </div>
                {reading.psukim && <div className="reading-card-verses">{reading.psukim}</div>}
            </div>
            {isGuestReading(reading) && <span className="reading-card-guest-label">{reading.shulName}</span>}
            {error && <p className="reading-card-error" role="alert">{error}</p>}
            {(showTags || onCancelReading) && <div className="reading-card-footer">
                {showTags && <div className="reading-card-tags">
                    <span className={`reading-card-tag reading-card-tag-${upcoming ? 'upcoming' : 'completed'}`}>
                        {upcoming ? 'Upcoming' : 'Completed'}
                    </span>
                    {isGuestReading(reading) && <span className="reading-card-tag reading-card-tag-guest">Guest registration</span>}
                </div>}
                <div className="reading-card-actions">
                    {onCancelReading && <button type="button" className="reader-remove-btn"
                        disabled={cancelling || cancellationDisabled} aria-busy={cancelling}
                        aria-label={`Cancel your ${aliyahLabels[reading.aliyah - 1]} reading for ${reading.desc}, ${reading.dateString}`}
                        title={cancelling ? 'Cancelling…' : 'Cancel your reading'} onClick={() => void cancel()}>
                        <TrashIcon />
                    </button>}
                </div>
            </div>}
            {confirmationDialog}
        </div>
    )
}
