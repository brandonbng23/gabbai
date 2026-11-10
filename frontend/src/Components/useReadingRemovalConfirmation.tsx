import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { UserReading } from '../api.ts';

type ReadingSelection = Pick<UserReading, 'dateString' | 'desc' | 'aliyah' | 'gregDate'>;
const aliyahLabels = ['Rishon', 'Sheni', 'Shlishi', "Revi'i", 'Chamishi', 'Shishi', "Shvi'i", 'Maftir', 'Haftarah'];

function ReadingRemovalDialog({ reading, kind, onDecision }: {
    reading: ReadingSelection;
    kind: 'registration' | 'star';
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
        <span className="reading-removal-eyebrow">{kind === 'star' ? 'STARRED READING' : 'READING REGISTRATION'}</span>
        <h2 id={titleId}>{kind === 'star' ? 'Unstar this reading?' : 'Remove this reading?'}</h2>
        <div id={descriptionId}>
            <p>{kind === 'star' ? 'Remove your star for' : 'Remove your registration for'} <strong>{aliyahLabels[reading.aliyah - 1]}</strong> of <strong>{reading.desc}</strong> on {reading.gregDate || reading.dateString}?</p>
            <p className="reading-removal-note">{kind === 'star' ? 'This removes it from Starred. Any registration stays unchanged.' : 'Your assigned slot will be released.'}</p>
        </div>
        <div className="reading-removal-actions">
            <button ref={keepButton} type="button" className="reading-removal-keep" onClick={() => onDecision(false)}>{kind === 'star' ? 'Keep starred' : 'Keep reading'}</button>
            <button type="button" className="reading-removal-confirm" onClick={() => onDecision(true)}>{kind === 'star' ? 'Remove star' : 'Remove reading'}</button>
        </div>
    </dialog>;
}

export function useReadingRemovalConfirmation(kind: 'registration' | 'star' = 'registration') {
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
            <ReadingRemovalDialog reading={reading} kind={kind} onDecision={decide} />, document.body,
        ),
    };
}
