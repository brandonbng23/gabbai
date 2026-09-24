import React, { useState } from "react";
import { Form } from "react-bootstrap";

interface Aliyah {
    hDate: string;
    gregDate: string;
    parsha: string;
    psukim: string[];
    reader: string;
    user: string;
}

function Parsha({hDate, gregDate, parsha, psukim, reader, user}: Aliyah): React.JSX.Element {
    const [available, setAvailability] = useState<boolean>(true);

    return (
        <div className="aliyah">
            <h3>{parsha}</h3>
            <span>
                <h5>
                    <span className="gregDate">{gregDate}</span>
                    <span className="hDate">{hDate}</span>
                </h5>
            </span>

            <div className="divider"></div>

            <ol>{psukim.map((p: string, index) => <li key={index}>{p}</li>)}</ol>
            
            
        </div>
    )
}

export default Parsha;