import { useEffect, useId, useRef } from 'react';
import type { SignificantPortion } from '../../../interfaces/significantPortions.mts';
import { formatSignificantDate } from '../../../core/significantDate.mts';

export function ParshaRemovalConfirmation({ parsha, onDecision }: {
    parsha: SignificantPortion;
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
        <span className="confirmation-dialog-eyebrow">SIGNIFICANT PARSHIYOT</span>
        <h2 id={titleId}>Remove this parsha?</h2>
        <div id={descriptionId}>
            <p><strong>{parsha.portion}</strong>{parsha.occasion && <> — {parsha.occasion}</>}</p>
            {parsha.gregorianDate && <p>Significant date: {formatSignificantDate(parsha.gregorianDate)}</p>}
            <p>This will remove it from your significant parshiyot. You can add it again later.</p>
        </div>
        <div className="confirmation-dialog-actions">
            <button ref={cancelButton} type="button" className="confirmation-dialog-cancel" onClick={() => onDecision(false)}>Cancel</button>
            <button type="button" className="confirmation-dialog-confirm" onClick={() => onDecision(true)}>Remove parsha</button>
        </div>
    </dialog>;
}
