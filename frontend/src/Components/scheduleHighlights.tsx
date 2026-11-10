import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { SignificantPortion } from '../../../interfaces/significantPortions.mts';
import type { ShulEvent } from '../../../interfaces/shulEvent.mts';
import type { ParshaObj } from './parsha.tsx';
import { scheduleHighlights, localToday } from '../scheduleHighlights.ts';
import type { ScheduleHighlight } from '../scheduleHighlights.ts';
import { readingAnchor } from '../readingAnchor.ts';
import { ReadingCardArrow } from './readingCardArrow.tsx';
import { EventCard } from './eventCard.tsx';
import { availableAliyot } from '../quickStartReadings.ts';
import { DonationHighlight, donationHighlightLink } from './donationHighlight.tsx';

function HighlightRow({ items, prompt, label }: { items: ReactNode[]; prompt?: ReactNode; label: string }) {
    const track = useRef<HTMLUListElement>(null);
    const id = useId();
    const itemCount = items.length + (prompt ? 1 : 0);
    function scroll(direction: number) {
        const element = track.current;
        if (!element) return;
        element.scrollBy({ left: direction * (element.clientWidth + 12) / 3,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
    return <div className="highlight-row">
        {itemCount > 3 && <div className="highlight-scroll-controls">
            <button type="button" aria-label={`Previous ${label}`} aria-controls={id} onClick={() => scroll(-1)}>←</button>
            <button type="button" aria-label={`Next ${label}`} aria-controls={id} onClick={() => scroll(1)}>→</button>
        </div>}
        <ul ref={track} id={id} className="highlight-track" aria-label={label} tabIndex={itemCount > 3 ? 0 : undefined}>
            {items}{prompt}
        </ul>
    </div>;
}

export function ScheduleHighlights({ readings, saved, events, eventsLoading, eventsError, signedIn, onSelect, shulId, donationUrl }: {
    shulId?: string; donationUrl?: string;
    readings: ParshaObj[]; saved: SignificantPortion[]; events: ShulEvent[];
    eventsLoading: boolean; eventsError: string; signedIn: boolean;
    onSelect: (reading: ParshaObj) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const extraId = useId();
    const highlights = scheduleHighlights(readings, saved, events, localToday());
    const donationLink = donationHighlightLink(shulId, donationUrl);
    const firstRowCount = 5 - (signedIn ? 1 : 0) - (donationLink ? 1 : 0);
    function card(item: ScheduleHighlight) {
        if (item.kind === 'event') return <li key={item.id}><EventCard event={item.event} compact /></li>;
        const { reading, occasions } = item;
        const available = availableAliyot(reading).length;
        return <li key={item.id}><a className="highlight-parsha-card" href={`#${encodeURIComponent(readingAnchor(reading))}`} onClick={event => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault(); onSelect(reading);
        }}>
            <span className="highlight-kind">Significant parsha</span>
            <strong className="highlight-card-name">{reading.desc}<ReadingCardArrow /></strong>
            <span>{reading.gregDate} · {reading.hDate}</span>
            <span className="highlight-availability">{available} {available === 1 ? 'aliyah' : 'aliyot'} available</span>
            {occasions.length > 0 && <span className="highlight-occasion">{occasions.join(' · ')}</span>}
        </a></li>;
    }
    const prompt = signedIn ? <li key="add-parsha"><a className="highlight-parsha-card highlight-prompt" href="/userSettings#significant-parshiyot-heading">
        <strong className="highlight-card-name">{highlights.length ? 'Add significant parshiyot' : 'Which parshiyot are special to you?'}</strong>
        <span>Add your b’nai mitzvah parsha or a meaningful date in My Preferences.</span>
        <span className="highlight-occasion">Add a parsha →</span>
    </a></li> : undefined;
    const firstRow = highlights.slice(0, firstRowCount).map(card);
    if (donationLink) firstRow.unshift(<li key="donation"><DonationHighlight href={donationLink} /></li>);
    if (!signedIn && !highlights.length && !donationLink && !eventsLoading && !eventsError) return null;
    return <section className="schedule-highlights" aria-labelledby="schedule-highlights-heading">
        <h2 id="schedule-highlights-heading">Highlights</h2>
        {eventsLoading && <div className="event-feedback" role="status">Loading shul events…</div>}
        {eventsError && <div className="event-feedback" role="status">{eventsError}</div>}
        <HighlightRow items={firstRow} prompt={prompt} label="highlights" />
        {highlights.length > firstRowCount && <>
            <button type="button" className="highlights-expand" aria-expanded={expanded} aria-controls={extraId}
                onClick={() => setExpanded(value => !value)}>{expanded ? 'Show fewer highlights' : `Show more highlights (${highlights.length - firstRowCount})`}</button>
            <div id={extraId} hidden={!expanded}>
                {expanded && <HighlightRow items={highlights.slice(firstRowCount).map(card)} label="additional highlights" />}
            </div>
        </>}
    </section>;
}
