import { useState } from 'react';
import type { JSX } from 'react';
import Filter from './filter.tsx';
import Parsha from './parsha.tsx';
import type { ParshaObj, ReadingActions } from './parsha.tsx';

function formatDateString(date: Date, addYears: number): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear() + addYears}-${month}-${day}`;
}

function toDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

export default function Schedule({ parshiyot, shulId, currentUserId, onReadingCancelled }: {
    parshiyot: ParshaObj[];
    shulId?: string;
} & ReadingActions): JSX.Element {
    const [nameFilter, setNameFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [bookFilter, setBookFilter] = useState<string[]>([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const searchTerm = nameFilter.toLowerCase();
    const hasDateRange = Boolean(startDate || endDate);
    const today = new Date();
    const rangeStart = toDate(startDate || formatDateString(today, 0));
    const rangeEnd = toDate(endDate || formatDateString(today, 1));
    const filteredReadings = parshiyot.filter(reading => {
        if (searchTerm && !reading.searchTerms.some(term => term.toLowerCase().includes(searchTerm))) return false;
        if (dateFilter && reading.dateString !== dateFilter) return false;
        if (bookFilter.length && !bookFilter.includes(reading.book)) return false;
        if (hasDateRange) {
            const date = toDate(reading.dateString);
            if (!(date >= rangeStart && date <= rangeEnd)) return false;
        }
        return true;
    });

    return (
        <div className="schedule">
            <Filter
                nameFilter={nameFilter}
                setNameFilter={setNameFilter}
                dateFilter={dateFilter}
                setDateFilter={setDateFilter}
                bookFilter={bookFilter}
                setBookFilter={setBookFilter}
                startDate={startDate}
                setStartDate={setStartDate}
                endDate={endDate}
                setEndDate={setEndDate}
            />
            <div className="parshiyot">
                {filteredReadings.length ? filteredReadings.map(reading => (
                    <Parsha key={`${reading.dateString}-${reading.desc}`} {...reading} shulId={shulId}
                        currentUserId={currentUserId} onReadingCancelled={onReadingCancelled} />
                )) : (
                    <div className="no-results" role="status">
                        <h3>Oy Gevalt!</h3>
                        No readings match your filters. Try another name or date, or clear your filters.
                    </div>
                )}
            </div>
        </div>
    );
}
