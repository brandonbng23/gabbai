import { useId } from 'react';
import type { JSX } from 'react';
import WelcomeBar from './welcomeBar.tsx';
import searchIcon from '../Assets/magnifying-glass-solid-full-white.svg';

export function QuickStart({ firstName, search, onSearchChange }: {
    firstName?: string;
    search: string;
    onSearchChange: (value: string) => void;
}): JSX.Element {
    const searchId = useId();
    return (
        <section className="quick-start">
            <WelcomeBar fName={firstName} />
            <form className="reading-search quick-start-search" role="search" aria-label="Search the schedule" onSubmit={event => event.preventDefault()}>
                <label htmlFor={searchId}>Search by Parsha or Yontif name</label>
                <div className="reading-search-control">
                    <input id={searchId} type="text" placeholder="e.g. Pinchas or Pesach"
                        value={search} onChange={event => onSearchChange(event.target.value)} />
                    <img className="reading-search-icon" src={searchIcon} alt="" aria-hidden="true" />
                </div>
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
