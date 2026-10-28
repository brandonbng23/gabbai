import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Message } from '../api.ts';

type TrashSelection = Pick<Message, 'subject' | 'replyRestoresInbox'>;

function MessageTrashDialog({ message, onDecision }: {
    message: TrashSelection;
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

    return <dialog ref={dialog} className="reading-removal-dialog"
        aria-labelledby={titleId} aria-describedby={descriptionId}
        onCancel={event => { event.preventDefault(); onDecision(false); }}>
        <span className="reading-removal-eyebrow">MESSAGES</span>
        <h2 id={titleId}>Move this message to Trash?</h2>
        <div id={descriptionId}>
            <p><strong>{message.subject}</strong></p>
            <p>Messages moved to Trash are permanently deleted after 30 days.</p>
            {message.replyRestoresInbox && <p className="reading-removal-note">
                This only removes the conversation from your inbox. A new reply will bring it back, even after the 30-day Trash period.
            </p>}
        </div>
        <div className="reading-removal-actions">
            <button ref={cancelButton} type="button" className="reading-removal-keep" onClick={() => onDecision(false)}>Cancel</button>
            <button type="button" className="reading-removal-confirm" onClick={() => onDecision(true)}>Move to Trash</button>
        </div>
    </dialog>;
}

export function useMessageTrashConfirmation() {
    const [message, setMessage] = useState<TrashSelection | null>(null);
    const resolveDecision = useRef<((confirmed: boolean) => void) | null>(null);

    useEffect(() => () => {
        resolveDecision.current?.(false);
        resolveDecision.current = null;
    }, []);

    function confirmTrash(selection: TrashSelection): Promise<boolean> {
        if (resolveDecision.current) return Promise.resolve(false);
        return new Promise(resolve => {
            resolveDecision.current = resolve;
            setMessage(selection);
        });
    }

    function decide(confirmed: boolean) {
        const resolve = resolveDecision.current;
        resolveDecision.current = null;
        setMessage(null);
        resolve?.(confirmed);
    }

    return {
        confirmTrash,
        confirmationDialog: message && createPortal(
            <MessageTrashDialog message={message} onDecision={decide} />, document.body,
        ),
    };
}
