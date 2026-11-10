import { useEffect, useId, useRef } from 'react';
import type { ShulEvent } from '../../../interfaces/shulEvent.mts';
import { formatEventDate, formatEventTime } from '../../../interfaces/shulEvent.mts';

export function EventDeletionConfirmation({ event, onDecision }: {
    event: ShulEvent;
    onDecision: (confirmed: boolean) => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const cancelButton = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        const element = dialog.current;
        element?.showModal();
        cancelButton.current?.focus();
        return () => element?.close();
    }, []);

    return <dialog ref={dialog} className="confirmation-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
        onCancel={event => { event.preventDefault(); onDecision(false); }}>
        <span className="confirmation-dialog-eyebrow">FEATURED EVENTS</span>
        <h2 id={titleId}>Delete this event?</h2>
        <div id={descriptionId}>
            <p><strong>{event.name}</strong></p>
            <p>{formatEventDate(event.date)} · {formatEventTime(event.time)} · {event.location}</p>
            <p>This will remove the event from My Shul and schedule highlights.</p>
        </div>
        <div className="confirmation-dialog-actions">
            <button ref={cancelButton} type="button" className="confirmation-dialog-cancel" onClick={() => onDecision(false)}>Cancel</button>
            <button type="button" className="confirmation-dialog-confirm" onClick={() => onDecision(true)}>Delete event</button>
        </div>
    </dialog>;
}
