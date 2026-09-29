import React, {useState} from "react";

interface FilterProps {
    nameFilter: string;
    setNameFilter: (name: string) => void;
    dateFilter: string;
    setDateFilter: (date: string) => void;
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
            
            <span className="advanced-filter-label">through</span>

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
    {nameFilter, setNameFilter, dateFilter, setDateFilter, startDate, setStartDate, endDate, setEndDate}: FilterProps): React.JSX.Element {
    function clearFilters(): void {
        setNameFilter("");
        setDateFilter("");
        setStartDate("");
        setEndDate("");
    }
    
    return (
        <div>
            <button 
                className="clear-button"
                onClick={clearFilters}
                disabled={nameFilter === "" && dateFilter === "" && startDate === "" && endDate === ""}>
                    Clear Filters</button>
        </div>
    )
}

function AdvancedFiltersButton(
    {showAdvanced, setShowAdvanced, startDate, setStartDate, endDate, setEndDate}: {showAdvanced: boolean, setShowAdvanced: (a: boolean) => void, startDate: string, setStartDate: (date: string) => void, endDate: string, setEndDate: (date: string) => void}
): React.JSX.Element {
    function updateAdvancedFilters() {
        setShowAdvanced(!showAdvanced);
        setStartDate("");
        setEndDate("");
    }

    return (
        <div>
            <span 
                className="show-advanced-link"
                onClick={updateAdvancedFilters}>{
                    !showAdvanced ? "Search By Date Range" : "Hide Search by Date Range"
                }</span>
        </div>
    )
}

function Filter(
    {nameFilter, setNameFilter, dateFilter, setDateFilter, startDate, endDate, setStartDate, setEndDate}: FilterProps): React.JSX.Element {
    const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

    return (
        <div className="filterBar">
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
                        startDate = {startDate}
                        setStartDate = {setStartDate}
                        endDate = {endDate}
                        setEndDate = {setEndDate}>
                    </ClearButton>
                    
                    <AdvancedFiltersButton
                        showAdvanced = {showAdvanced}
                        setShowAdvanced = {setShowAdvanced}
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
                        </div>
                    )
                    : <span></span>}
                </div>
    )
}

export default Filter;