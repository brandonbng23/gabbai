import { useId, useRef, useState } from 'react';
import type { JSX } from 'react';
import WelcomeBar from './welcomeBar.tsx';
import searchIcon from '../Assets/magnifying-glass-solid-full-white.svg';
import type { ParshaObj } from './parsha.tsx';
import { readingAnchor } from '../readingAnchor.ts';

function QuickStartResult({ reading, onSelect }: {
    reading: ParshaObj;
    onSelect: (reading: ParshaObj) => void;
}) {
    const slots = reading.psukim.map((verses, index) => ({ verses, index })).filter(slot => slot.verses && slot.verses !== 'null');
    const assigned = slots.filter(slot => reading.readers[slot.index]).length;
    const available = slots.filter(slot => !reading.locked && !reading.lockedArr[slot.index] && !reading.readers[slot.index]).length;

    return <a className="quick-start-result" href={`#${encodeURIComponent(readingAnchor(reading))}`} onClick={event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onSelect(reading);
    }}>
            <span className="quick-start-result-info">
                <strong>{reading.desc}</strong>
                <span>{reading.gregDate} · {reading.hDate}</span>
            </span>
            <span className="quick-start-result-counts"><span>{assigned} assigned</span><span>{available} available</span></span>
            <svg className="quick-start-result-arrow" width="14" height="14" viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
                <path d="M297.4 169.4C309.9 156.9 330.2 156.9 342.7 169.4L534.7 361.4C547.2 373.9 547.2 394.2 534.7 406.7C522.2 419.2 501.9 419.2 489.4 406.7L320 237.3L150.6 406.6C138.1 419.1 117.8 419.1 105.3 406.6C92.8 394.1 92.8 373.8 105.3 361.3L297.3 169.3z" />
            </svg>
    </a>;
}

export function QuickStart({ firstName, readings, loading, error, onSelectReading }: {
    firstName?: string;
    readings: ParshaObj[];
    loading: boolean;
    error: string | null;
    onSelectReading: (reading: ParshaObj) => void;
}): JSX.Element {
    const searchId = useId();
    const resultsId = useId();
    const input = useRef<HTMLInputElement>(null);
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const query = search.trim().toLowerCase();
    const results = query ? readings.filter(reading => reading.searchTerms.some(term => term.toLowerCase().includes(query))) : [];
    const showResults = open && Boolean(query);
    return (
        <section className="quick-start">
            <WelcomeBar fName={firstName} />
            <form className="reading-search quick-start-search" role="search" aria-label="Quick Start reading search"
                onSubmit={event => event.preventDefault()}
                onBlur={event => {
                    const nextTarget = event.relatedTarget;
                    if (nextTarget instanceof HTMLElement && nextTarget.closest('dialog')) return;
                    if (!event.currentTarget.contains(nextTarget)) setOpen(false);
                }}
                onKeyDown={event => {
                    if (event.key === 'Escape') { event.preventDefault(); input.current?.focus(); setOpen(false); }
                    if (event.key === 'ArrowDown' && event.target === input.current && showResults) {
                        const first = event.currentTarget.querySelector<HTMLElement>('.quick-start-result');
                        if (first) { event.preventDefault(); first.focus(); }
                    }
                }}>
                <label htmlFor={searchId}>Search by Parsha or Yontif name</label>
                <div className="reading-search-control">
                    <input ref={input} id={searchId} type="text" placeholder="e.g. Pinchas or Pesach" autoComplete="off"
                        aria-controls={showResults ? resultsId : undefined}
                        value={search} onFocus={() => setOpen(true)} onChange={event => { setSearch(event.target.value); setOpen(true); }} />
                    <img className="reading-search-icon" src={searchIcon} alt="" aria-hidden="true" />
                </div>
                {showResults && <div id={resultsId} className="quick-start-results" aria-label="Matching readings" aria-busy={loading}>
                    {loading ? <p className="quick-start-search-status" role="status">Loading readings…</p>
                        : error ? <p className="quick-start-search-status" role="alert">{error}</p>
                        : results.length ? <>
                            <p className="quick-start-search-status" role="status">{results.length} {results.length === 1 ? 'reading' : 'readings'} found</p>
                            {results.map(reading => <QuickStartResult key={`${reading.dateString}-${reading.desc}`} reading={reading}
                                onSelect={selected => { onSelectReading(selected); setOpen(false); }} />)}
                        </> : <p className="quick-start-search-status" role="status">No readings found. Try another Parsha or Yontif name.</p>}
                </div>}
            </form>
            <a className="quick-start-reveal" href="#full-schedule" onClick={event => {
                const schedule = document.getElementById('full-schedule');
                if (!schedule) return;
                event.preventDefault();
                schedule.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
                schedule.focus({ preventScroll: true });
            }}>
                <span>Reveal Full Schedule</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
                    <path d="M297.4 169.4C309.9 156.9 330.2 156.9 342.7 169.4L534.7 361.4C547.2 373.9 547.2 394.2 534.7 406.7C522.2 419.2 501.9 419.2 489.4 406.7L320 237.3L150.6 406.6C138.1 419.1 117.8 419.1 105.3 406.6C92.8 394.1 92.8 373.8 105.3 361.3L297.3 169.3z" />
                </svg>
            </a>
        </section>
    )
}
