import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { UserReading } from '../api.ts';

type ReadingSelection = Pick<UserReading, 'dateString' | 'desc' | 'aliyah' | 'gregDate'>;
const aliyahLabels = ['Rishon', 'Sheni', 'Shlishi', "Revi'i", 'Chamishi', 'Shishi', "Shvi'i", 'Maftir', 'Haftarah'];

function ReadingRemovalDialog({ reading, onDecision }: {
    reading: ReadingSelection;
    onDecision: (remove: boolean) => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const keepButton = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        const element = dialog.current;
        element?.showModal();
        keepButton.current?.focus();
        return () => element?.close();
    }, []);

    return <dialog ref={dialog} className="reading-removal-dialog"
        aria-labelledby={titleId} aria-describedby={descriptionId}
        onCancel={event => { event.preventDefault(); onDecision(false); }}>
        <span className="reading-removal-eyebrow">READING REGISTRATION</span>
        <h2 id={titleId}>Remove this reading?</h2>
        <div id={descriptionId}>
            <p>Remove your registration for <strong>{aliyahLabels[reading.aliyah - 1]}</strong> of <strong>{reading.desc}</strong> on {reading.gregDate || reading.dateString}?</p>
            <p className="reading-removal-note">Your assigned slot will be released.</p>
        </div>
        <div className="reading-removal-actions">
            <button ref={keepButton} type="button" className="reading-removal-keep" onClick={() => onDecision(false)}>Keep reading</button>
            <button type="button" className="reading-removal-confirm" onClick={() => onDecision(true)}>Remove reading</button>
        </div>
    </dialog>;
}

export function useReadingRemovalConfirmation() {
    const [reading, setReading] = useState<ReadingSelection | null>(null);
    const resolveDecision = useRef<((confirmed: boolean) => void) | null>(null);

    useEffect(() => () => {
        resolveDecision.current?.(false);
        resolveDecision.current = null;
    }, []);

    function confirmRemoval(selection: ReadingSelection): Promise<boolean> {
        if (resolveDecision.current) return Promise.resolve(false);
        return new Promise(resolve => {
            resolveDecision.current = resolve;
            setReading(selection);
        });
    }

    function decide(confirmed: boolean): void {
        const resolve = resolveDecision.current;
        resolveDecision.current = null;
        setReading(null);
        resolve?.(confirmed);
    }

    return {
        confirmRemoval,
        confirming: reading !== null,
        confirmationDialog: reading && createPortal(
            <ReadingRemovalDialog reading={reading} onDecision={decide} />, document.body,
        ),
    };
}
