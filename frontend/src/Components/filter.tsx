import { useState } from 'react';
import type { JSX } from 'react';

interface FilterProps {
    nameFilter: string;
    setNameFilter: (name: string) => void;
    dateFilter: string;
    setDateFilter: (date: string) => void;
    bookFilter: string[];
    setBookFilter: (books: string[]) => void;
    startDate: string;
    setStartDate: (date: string) => void;
    endDate: string;
    setEndDate: (date: string) => void;
}

const books = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Yontifs'];

function FilterField({ id, label, name, type, value, onChange, placeholder }: {
    id: string;
    label: string;
    name: string;
    type: 'text' | 'date';
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}): JSX.Element {
    return (
        <div className="schedule-filter-field">
            <div className="filter">
                <label className="filter-label" htmlFor={id}>{label}</label>
                <input
                    id={id}
                    name={name}
                    type={type}
                    value={value}
                    placeholder={placeholder}
                    data-empty={type === 'date' ? !value : undefined}
                    onChange={event => onChange(event.target.value)}
                />
            </div>
        </div>
    );
}

export default function Filter({
    nameFilter, setNameFilter, dateFilter, setDateFilter, bookFilter, setBookFilter,
    startDate, setStartDate, endDate, setEndDate,
}: FilterProps): JSX.Element {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const hasFilters = Boolean(nameFilter || dateFilter || startDate || endDate || bookFilter.length);
    const invalidRange = Boolean(startDate && endDate && startDate > endDate);

    function clearAdvancedFilters(): void {
        setStartDate('');
        setEndDate('');
        setBookFilter([]);
    }

    function clearFilters(): void {
        setNameFilter('');
        setDateFilter('');
        clearAdvancedFilters();
    }

    function toggleAdvancedFilters(): void {
        setShowAdvanced(open => !open);
        clearAdvancedFilters();
    }

    return (
        <div className={`filterBar${showAdvanced ? '' : ' filterBar-collapsed'}`}>
            <div className="default-filters">
                <FilterField id="schedule-name" name="nameFilter" type="text"
                    label="Parsha or Yontif" placeholder="e.g. 'Pinchas' or 'Pesach'"
                    value={nameFilter} onChange={setNameFilter} />
                <FilterField id="schedule-date" name="dateFilter" type="date"
                    label="Date" value={dateFilter} onChange={setDateFilter} />
                <div className="filterButtons">
                    <button type="button" className="clear-button" onClick={clearFilters} disabled={!hasFilters}>
                        Clear filters
                    </button>
                    <button type="button" className="show-advanced-link"
                        aria-expanded={showAdvanced} aria-controls="schedule-advanced-filters"
                        onClick={toggleAdvancedFilters}>
                        {showAdvanced ? 'Fewer filters −' : 'More filters +'}
                    </button>
                </div>
            </div>

            {showAdvanced && (
                <div className="advanced-filters" id="schedule-advanced-filters">
                    <div className="date-range-filter">
                        <FilterField id="schedule-start" name="rangeFilterStart" type="date"
                            label="From" value={startDate} onChange={setStartDate} />
                        <button type="button" className="swap-fields" aria-label="Swap start and end dates"
                            title="Swap start and end dates"
                            disabled={!startDate && !endDate}
                            onClick={() => { setStartDate(endDate); setEndDate(startDate); }} />
                        <FilterField id="schedule-end" name="rangeFilterEnd" type="date"
                            label="To" value={endDate} onChange={setEndDate} />
                    </div>
                    <div className="divider" />
                    <div className="book-filter" role="group" aria-label="Filter by book or Yontif">
                        {books.map(book => {
                            const selected = bookFilter.includes(book);
                            return (
                                <div key={book}>
                                    <button type="button" className={`book-filter-btn-${selected ? 'active' : 'off'}`}
                                        aria-pressed={selected} onClick={() => setBookFilter(selected
                                            ? bookFilter.filter(value => value !== book)
                                            : [...bookFilter, book])}>
                                        {book}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {invalidRange && (
                <div className="range-error" role="alert">
                    <span className="error-message">End date must be on or after the start date.</span>
                </div>
            )}
        </div>
    );
}
