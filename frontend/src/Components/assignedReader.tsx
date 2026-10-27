import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import { ProfilePicture } from './profilePicture.tsx';
import { ReaderCard } from './userCard.tsx';
import type { ReaderCardUser } from './userCard.tsx';

export default function AssignedReader({ reader, portal = false }: { reader: ReaderCardUser; portal?: boolean }) {
    const cardId = useId();
    const [open, setOpen] = useState(false);
    const container = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const preview = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<CSSProperties>({ position: 'fixed', visibility: 'hidden' });
    const name = `${reader.firstName} ${reader.lastName}`.trim();

    useLayoutEffect(() => {
        if (!open || !portal) return;
        function placeCard() {
            if (!trigger.current || !preview.current) return;
            const anchor = trigger.current.getBoundingClientRect();
            const card = preview.current.getBoundingClientRect();
            setPosition({
                position: 'fixed',
                left: Math.max(8, Math.min(anchor.left, window.innerWidth - card.width - 8)),
                top: anchor.bottom + card.height <= window.innerHeight - 8
                    ? anchor.bottom : Math.max(8, anchor.top - card.height),
            });
        }
        placeCard();
        window.addEventListener('resize', placeCard);
        window.addEventListener('scroll', placeCard, true);
        return () => {
            window.removeEventListener('resize', placeCard);
            window.removeEventListener('scroll', placeCard, true);
        };
    }, [open, portal, reader]);

    function containsFocus(target: EventTarget | null): boolean {
        return target instanceof Node && Boolean(container.current?.contains(target) || preview.current?.contains(target));
    }

    const card = <div ref={preview} id={cardId} role="group" aria-label={`Details for ${name}`}
        className="assigned-reader-preview" hidden={!open} style={portal ? position : undefined}
        onMouseLeave={event => {
            if (!containsFocus(event.relatedTarget)) setOpen(false);
        }}>
        <ReaderCard user={reader} />
    </div>;

    return (
        <div ref={container} className="assigned-reader-name schedule-assigned-reader"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={event => {
                if (!containsFocus(event.relatedTarget)) setOpen(false);
            }}
            onFocus={event => {
                if (event.target.matches(':focus-visible')) setOpen(true);
            }}
            onBlur={event => {
                if (!containsFocus(event.relatedTarget)) setOpen(false);
            }}
            onKeyDown={event => {
                if (event.key === 'Escape') {
                    event.stopPropagation();
                    trigger.current?.focus();
                    setOpen(false);
                }
            }}>
            <button ref={trigger} type="button" className="assigned-reader-trigger"
                aria-expanded={open} aria-controls={cardId}
                onClick={() => setOpen(value => !value)}>
                <ProfilePicture src={reader.pictureUrl} name={name} small />
                <span>{name}</span>
            </button>
            {portal ? open && createPortal(card, document.body) : card}
        </div>
    );
}
