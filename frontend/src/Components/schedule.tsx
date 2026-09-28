import React, {useState} from "react";
import Filter from "./filter.tsx";
import Parsha, { ParshaObj } from "./parsha.tsx";



function Schedule({parshiyot}: {parshiyot: ParshaObj[]}): React.JSX.Element {
    const [nameFilter, setNameFilter] = useState<string>("");
    const [dateFilter, setDateFilter] = useState<string>("");

    return (
        <div className="schedule">
            <Filter
                nameFilter={nameFilter}
                setNameFilter={setNameFilter}
                dateFilter={dateFilter}
                setDateFilter={setDateFilter}>
            </Filter>
            <div className="parshiyot">
                {(nameFilter !== "" || dateFilter !== "") ?
                        (nameFilter !== "" ? 
                            (parshiyot.filter((p: ParshaObj) => p.searchTerms
                                .some((t: string) => 
                                    t.toLowerCase()
                                        .includes(nameFilter.toLowerCase())))
                                            .map((p, index) => <Parsha key={index} {...p}></Parsha>)) 
                            : parshiyot.filter((p: ParshaObj) => p.dateString === dateFilter)
                                .map((p, index) => <Parsha key={index} {...p}></Parsha>))
                        : (parshiyot.map((p, index) => <Parsha key={index} {...p}></Parsha>))}
            </div>          
        </div>
    )
}

export default Schedule;