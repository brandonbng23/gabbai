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
        </section>
    )
}
