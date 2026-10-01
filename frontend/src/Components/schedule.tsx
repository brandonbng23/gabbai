import React, {useState} from "react";
import Filter from "./filter.tsx";
import Parsha, { ParshaObj } from "./parsha.tsx";

function Schedule({parshiyot}: {parshiyot: ParshaObj[]}): React.JSX.Element {
    const [nameFilter, setNameFilter] = useState<string>("");
    const [dateFilter, setDateFilter] = useState<string>("");
    const [bookFilter, setBookFilter] = useState<string[]>([]);
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");

    function filterByName(parshaArr: ParshaObj[]): ParshaObj[] {
        return parshaArr.filter((p: ParshaObj) => 
            p.searchTerms.some((t: string) => 
                t.toLowerCase()
                    .includes(nameFilter
                        .toLowerCase())))
    }

    function filterByDate(parshaArr: ParshaObj[]): ParshaObj[] {
        return parshaArr.filter((p: ParshaObj) =>
            p.dateString === dateFilter);
    }

    function filterByBook(parshaArr: ParshaObj[]): ParshaObj[] {
        return bookFilter.length > 0 ? parshaArr.filter((p: ParshaObj) =>
        bookFilter.includes(p.book)) : parshaArr;
    }

    function isDateInRange(date: string, rangeStart: string, rangeEnd: string): boolean {
        const toDate = (date: string): Date => {
            const [year, month, day] = date.split("-");
            return new Date(+year, (+month)-1, +day);
        }

        const target: Date = toDate(date);
        const start: Date = toDate(rangeStart);
        const end: Date = toDate(rangeEnd);

        return target >= start && target <= end;
    }

    function filterByDateRange(parshaArr: ParshaObj[], rangeStart: string, rangeEnd: string): ParshaObj[] {
        return parshaArr.filter((p: ParshaObj) =>
            isDateInRange(p.dateString, rangeStart, rangeEnd));
    }

    function formatDateString(date: Date, addYears: number): string {
        const month = String(date.getMonth()+1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const year = String(date.getFullYear() + addYears)

        return `${year}-${month}-${day}`
    }

    function applyAllFilters(): ParshaObj[] {
        let parshaArr: ParshaObj[] = parshiyot;

        if (nameFilter !== "") {
            parshaArr = filterByName(parshaArr);
        }

        if (dateFilter !== "") {
            parshaArr = filterByDate(parshaArr);
        }

        if (startDate !== "" && endDate === "") {
            const today = new Date()
            parshaArr = filterByDateRange(parshaArr, 
                startDate, 
                formatDateString(today, 1))
        }

        if (startDate === "" && endDate !== "") {
            const today = new Date();
            parshaArr = filterByDateRange(parshaArr, 
                formatDateString(today, 0), 
                endDate)
        }

        if (startDate !== "" && endDate !== "") {
            parshaArr = filterByDateRange(parshaArr, startDate, endDate);
        }

        parshaArr = filterByBook(parshaArr);

        return parshaArr;
    }

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
                {applyAllFilters().length > 0 ? 
                    applyAllFilters().map((p: ParshaObj, index) => <Parsha key={index} {...p}></Parsha>)
                : <span className="no-results">
                    <h3>Oy Gevalt!</h3>
                    No results. Double check filters are applied as intended.
                </span>}   
            </div>          
        </div>
    )
}

export default Schedule;