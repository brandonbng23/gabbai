import { useState } from 'react';
import type { JSX } from 'react';
import type { UserReading } from '../api.ts';
import type { ReaderCardUser } from './userCard.tsx';
import AssignedReader from './assignedReader.tsx';
import { TrashIcon } from './trashIcon.tsx';
import { useReadingRemovalConfirmation } from './useReadingRemovalConfirmation.tsx';
import { isGuestReading } from '../userReadings.ts';

const aliyahLabels = ["Rishon", "Sheni", "Shlishi", "Revi'i", "Chamishi", "Shishi", "Shvi'i", "Maftir", "Haftarah"];

export function ReadingCard({ user, reading, onCancelReading, cancellationDisabled = false }: {
    user: ReaderCardUser;
    reading: UserReading;
    onCancelReading?: (reading: UserReading) => Promise<void>;
    cancellationDisabled?: boolean;
}): JSX.Element {
    const [cancelling, setCancelling] = useState(false);
    const [error, setError] = useState('');
    const { confirmRemoval, confirmationDialog } = useReadingRemovalConfirmation();

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
            {isGuestReading(reading) && <span className="reading-card-guest-label">Guest registration · {reading.shulName}</span>}
            <div className="reading-card-header">
                <h3>{reading.desc}</h3>
                <span>·</span>
                <span style={{fontWeight: "250"}}>{aliyahLabels[reading.aliyah-1]}</span>
                <AssignedReader reader={user} portal />
                {onCancelReading && <button type="button" className="reader-remove-btn"
                    disabled={cancelling || cancellationDisabled} aria-busy={cancelling}
                    aria-label={`Cancel your ${aliyahLabels[reading.aliyah - 1]} reading for ${reading.desc}, ${reading.dateString}`}
                    title={cancelling ? 'Cancelling…' : 'Cancel your reading'} onClick={() => void cancel()}>
                    <TrashIcon />
                </button>}
            </div>
            {error && <p className="reading-card-error" role="alert">{error}</p>}
            {confirmationDialog}

            <div className="reading-card-body">
                <span>{reading.gregDate}</span>
                <span>·</span>
                <span>{reading.hDate}</span>
                <span>·</span>
                <span>{reading.psukim}</span>
               
            </div>
        </div>
    )
}
