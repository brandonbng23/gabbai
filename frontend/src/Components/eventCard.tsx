import type { ShulEvent } from '../../../interfaces/shulEvent.mts';
import { formatEventDate, formatEventTime } from '../../../interfaces/shulEvent.mts';
import { useEffect, useRef } from 'react';

export function EventCard({ event, compact = false }: { event: ShulEvent; compact?: boolean }) {
    const card = useRef<HTMLElement>(null);
    useEffect(() => {
        if (compact || window.location.hash !== `#shul-event-${event.id}`) return;
        const frame = requestAnimationFrame(() => {
            card.current?.scrollIntoView({ block: 'start' });
            card.current?.focus({ preventScroll: true });
        });
        return () => cancelAnimationFrame(frame);
    }, [compact, event.id]);
    return <article ref={card} className={`shul-event-card${compact ? ' shul-event-card-compact' : ''}`} id={`shul-event-${event.id}`} tabIndex={-1}>
        <span className="highlight-kind">Shul event</span>
        <h3>{event.name}</h3>
        <span className="shul-event-when">{formatEventDate(event.date)} · {formatEventTime(event.time)}</span>
        <span className="shul-event-location">{event.location}</span>
        {event.details && <p>{event.details}</p>}
        {compact && <a className="shul-event-details-link" href={`/shul?${new URLSearchParams({ shul: event.shulId })}#shul-event-${event.id}`}>Event details →</a>}
        {event.registrationLink && <a className="shul-event-register" href={event.registrationLink} target="_blank" rel="noopener noreferrer">Register <span aria-hidden="true">↗</span></a>}
    </article>;
}
