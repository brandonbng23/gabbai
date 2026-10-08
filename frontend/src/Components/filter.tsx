import React, {useState} from "react";

interface FilterProps {
    nameFilter: string;
    setNameFilter: (name: string) => void;
    dateFilter: string;
    setDateFilter: (date: string) => void;
    bookFilter: string[];
    setBookFilter: (book: string[]) => void;
    startDate: string;
    setStartDate: (date: string) => void;
    endDate: string;
    setEndDate: (date: string) => void;
}

function TermSearch(
    {nameFilter, setNameFilter}: {nameFilter: string, setNameFilter: (name: string) => void}
): React.JSX.Element {
    return (
        <div>
            <form>
                <div className="filter">
                    <span className="filter-label">Search by Parsha or Yontif name</span>
                    <input 
                        type="text" 
                        name="nameFilter"
                        placeholder="e.g. 'Pinchas' or 'Pesach'"
                        value={nameFilter}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setNameFilter(event.target.value)}></input>
                </div>
            </form>
        </div>
    )
}

function DateSearch(
    {dateFilter, setDateFilter}: {dateFilter: string, setDateFilter: (date: string) => void}
): React.JSX.Element {
    return (
        <div>
            <form>
                <div className="filter">
                        <span className="filter-label">Search by Date</span>
                        <input 
                            type="date" 
                            name="dateFilter"
                            value={dateFilter}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {setDateFilter(event.target.value)}}></input>
                    </div>
            </form>
        </div>
    )
}

function BookFilterButtons(
    {book, bookFilter, setBookFilter}: {book: string, bookFilter: string[], setBookFilter: (books: string[]) => void}
): React.JSX.Element {
    const clicked: boolean = bookFilter.some((b: string) => b === book)

    function updateBookFilter() {
        if (clicked) {
            setBookFilter(bookFilter.filter((b: string) => b !== book));
        } else {
            setBookFilter([...bookFilter, book]);
        }
    }

    return (
        <div>
            <button 
                onClick={updateBookFilter}
                className={`book-filter-btn-${clicked ? "active" : "off"}`}>{book}</button>
        </div>
    )
}

function BookSearch(
    {bookFilter, setBookFilter}: {bookFilter: string[], setBookFilter: (books: string[]) => void}
): React.JSX.Element {
    const books: string[] = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Yontifs"];

    return (
        <div className="book-filter">
            {books.map((b: string, index) => 
                <BookFilterButtons
                    key={index}
                    book={b}
                    bookFilter={bookFilter}
                    setBookFilter={setBookFilter}>
                </BookFilterButtons>)}
        </div>
    )
}

function DateRangeSearch(
    {startDate, endDate, setStartDate, setEndDate}: {startDate: string, endDate: string, setStartDate: (date: string) => void, setEndDate: (date: string) => void}
): React.JSX.Element {
    return (
        <div className="date-range-filter">
            <span className="advanced-filter-label">Search by Date Range:</span>
            <form>
                <div className="filter">
                    <span className="filter-label">Range Start Date</span>
                    <input
                        type="date"
                        name="rangeFilterStart"
                        value={startDate}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {setStartDate(event.target.value)}}>
                    </input>
                </div>
            </form>
            
            <button 
                className="swap-fields"
                disabled={startDate === "" && endDate === ""}
                onClick={() => {
                    const ogStart = startDate;
                    const ogEnd = endDate;
                    setStartDate(ogEnd);
                    setEndDate(ogStart)}
                }></button>

            <form>
                <div className="filter">
                    <span className="filter-label">Range End Date</span>
                        <input
                            type="date"
                            name="rangeFilterStart"
                            value={endDate}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {setEndDate(event.target.value)}}>
                            </input>
                </div>
            </form>
        </div>
    )
}

function ClearButton(
    {nameFilter, setNameFilter, dateFilter, setDateFilter, bookFilter, setBookFilter, startDate, setStartDate, endDate, setEndDate}: FilterProps): React.JSX.Element {
    function clearFilters(): void {
        setNameFilter("");
        setDateFilter("");
        setStartDate("");
        setEndDate("");
        setBookFilter([]);
    }
    
    return (
        <div>
            <button 
                className="clear-button"
                onClick={clearFilters}
                disabled={nameFilter === "" && dateFilter === "" && startDate === "" && endDate === "" && bookFilter.length === 0}>
                    Clear Filters</button>
        </div>
    )
}

function AdvancedFiltersButton(
    {showAdvanced, setShowAdvanced, bookFilter, setBookFilter, startDate, setStartDate, endDate, setEndDate}: {showAdvanced: boolean, setShowAdvanced: (a: boolean) => void, bookFilter: string[], setBookFilter: (book: string[]) => void, startDate: string, setStartDate: (date: string) => void, endDate: string, setEndDate: (date: string) => void}
): React.JSX.Element {
    function updateAdvancedFilters() {
        setShowAdvanced(!showAdvanced);
        setStartDate("");
        setEndDate("");
        setBookFilter([]);
    }

    return (
        <div>
            <span 
                className="show-advanced-link"
                onClick={updateAdvancedFilters}>{
                    !showAdvanced ? "Show Advanced Filters" : "Hide Advanced Filters"
                }</span>
        </div>
    )
}

function Filter(
    {nameFilter, setNameFilter, dateFilter, setDateFilter, bookFilter, setBookFilter, startDate, endDate, setStartDate, setEndDate}: FilterProps): React.JSX.Element {
    const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

    return (
        <div className={`filterBar${showAdvanced ? "" : " filterBar-collapsed"}`}>
            <div className="default-filters">
                <TermSearch
                    nameFilter = {nameFilter}
                    setNameFilter={setNameFilter}>
                </TermSearch>

                <DateSearch
                    dateFilter = {dateFilter}
                    setDateFilter = {setDateFilter}>
                </DateSearch>

                <div className="filterButtons">
                    <ClearButton
                        nameFilter={nameFilter}
                        setNameFilter = {setNameFilter}
                        dateFilter={dateFilter}
                        setDateFilter = {setDateFilter}
                        bookFilter = {bookFilter}
                        setBookFilter = {setBookFilter}
                        startDate = {startDate}
                        setStartDate = {setStartDate}
                        endDate = {endDate}
                        setEndDate = {setEndDate}>
                    </ClearButton>
                    
                    <AdvancedFiltersButton
                        showAdvanced = {showAdvanced}
                        setShowAdvanced = {setShowAdvanced}
                        bookFilter = {bookFilter}
                        setBookFilter = {setBookFilter}
                        startDate = {startDate}
                        setStartDate = {setStartDate}
                        endDate = {endDate}
                        setEndDate = {setEndDate}>
                    </AdvancedFiltersButton>
                </div>
            </div>

            {showAdvanced ? (
                <div className="advanced-filters">
                    <DateRangeSearch
                        startDate = {startDate}
                        setStartDate = {setStartDate}
                        endDate = {endDate}
                        setEndDate = {setEndDate}>
                    </DateRangeSearch>

                    <div className="divider"></div>

                    <BookSearch
                        bookFilter={bookFilter}
                        setBookFilter={setBookFilter}>
                    </BookSearch>
                </div>
            )
            : <span></span>}
            
            {(startDate > endDate && (startDate !== "" && endDate !== "")) ? (
                <div className="range-error">
                    <span className="error-message">Range of dates is invalid. End date cannot preceed start date.</span>
                </div>)
            : <span></span>}
         </div>

    )
}

export default Filter;
