import React, {useState} from "react";

interface FilterProps {
    nameFilter: string;
    setNameFilter: (name: string) => void;
    dateFilter: string;
    setDateFilter: (date: string) => void;
}

function TermSearch({nameFilter, setNameFilter}: {nameFilter: string, setNameFilter: (name: string) => void}): React.JSX.Element {
    return (
        <div>
            <form>
                <span className="filter">
                    <span className="filterLabel">Filter by Name</span>
                    <input 
                        type="text" 
                        name="nameFilter"
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {setNameFilter(event.target.value)}}></input>
                </span>
            </form>
        </div>
    )
}

function DateSearch({dateFilter, setDateFilter}: {dateFilter: string, setDateFilter: (date: string) => void}): React.JSX.Element {
    return (
        <div>
            <form>
                <span className="filter">
                    <span className="filterLabel">Filter by Date</span>
                    <input 
                        type="date" 
                        name="dateFilter"
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {setDateFilter(event.target.value)}}></input>
                </span>
            </form>
        </div>
    )
}

function Filter({nameFilter, setNameFilter, dateFilter, setDateFilter}: FilterProps): React.JSX.Element {
    return (
        <div className="filterBar">
            <TermSearch
                nameFilter = {nameFilter}
                setNameFilter={setNameFilter}>
            </TermSearch>
            
            <DateSearch
                dateFilter = {dateFilter}
                setDateFilter = {setDateFilter}>
            </DateSearch>
        </div>
    )
}

export default Filter;