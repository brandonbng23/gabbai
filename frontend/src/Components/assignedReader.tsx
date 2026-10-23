import { useId, useState } from 'react';
import type { ShulUser } from '../../../interfaces/user.mts';
import { ProfilePicture } from './profilePicture.tsx';
import { ReaderCard } from './userCard.tsx';

export default function AssignedReader({ reader }: { reader: ShulUser }) {
    const cardId = useId();
    const [open, setOpen] = useState(false);
    const name = `${reader.firstName} ${reader.lastName}`.trim();

    return (
        <div className="assigned-reader-name schedule-assigned-reader"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={event => {
                if (event.target.matches(':focus-visible')) setOpen(true);
            }}
            onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
            }}
            onKeyDown={event => {
                if (event.key === 'Escape') {
                    event.stopPropagation();
                    event.currentTarget.querySelector<HTMLButtonElement>('.assigned-reader-trigger')?.focus();
                    setOpen(false);
                }
            }}>
            <button type="button" className="assigned-reader-trigger"
                aria-expanded={open} aria-controls={cardId}
                onClick={() => setOpen(value => !value)}>
                <ProfilePicture src={reader.pictureUrl} name={name} small />
                <span>{name}</span>
            </button>
            <div id={cardId} role="group" aria-label={`Details for ${name}`}
                className="assigned-reader-preview" hidden={!open}>
                <ReaderCard user={reader} />
            </div>
        </div>
    );
}
