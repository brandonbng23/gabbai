import React, { useState } from "react";

/* Identifcal to ParshaData interface (gabbai/interfaces/parshaData.mts) */
export interface ParshaObj {
    id: number;
    hDate: string;
    gregDate: string;
    desc: string;
    occassions: string[];
    psukim: string[];
    book: string;
    readers: string[];
    searchTerms: string[];
    dateString: string;
}

interface Aliyah {
    a: number;
    psukim: string;
    available: boolean;
}

function Aliyah(props: Aliyah): React.JSX.Element {
    const [available, toggleAvailable] = useState<boolean>(props.available);

    function aliyahText(): string {
        return props.a < 8 ? `Aliyah ${props.a}` : (props.a === 8 ? "Maftir" : "Haftarah");
    }

    function buttonText(): string {
        return available ? ("Register for " + aliyahText()) : ("Unavailable");
    }

    function buttonClass(): string {
        return available ? "av" : "un"
    }

    return (
        <div className="aliyah">
            <button className={`parsha-btn-${buttonClass()}`} onClick={() => {toggleAvailable(!available)}}>{buttonText()}</button>
            <span className="psukim">
                <span className="psukimText">{props.psukim}</span>
            </span>
        </div>
    )
}

function formatOccassionView(o: string): string {
    const lowerCase_o: string = o.toLowerCase();

    if (lowerCase_o.includes("sukkot") || lowerCase_o.includes("pesach") || lowerCase_o.includes("shavuot") || lowerCase_o.includes("rosh hashana")) {
        if (lowerCase_o.includes("v") && !(lowerCase_o.includes("v") && lowerCase_o.includes("ii"))) {
            return o.replace("I", "").replace("I", "").replace("I", "").replace("V", "") + " Chol HaMoed";
        } else if (lowerCase_o.includes("iii")) {
            return o.replace("I", "").replace("I", "").replace("I", "").replace("V", "") + " Chol HaMoed";
        } else {
            return o.replace("I", "").replace("I", "").replace("I", "").replace("V", "");
         }
    }

    return o;
}

function Parsha({hDate, gregDate, occassions, desc, psukim}: ParshaObj): React.JSX.Element {
    return (
        <div className="parsha">
            <div className="occassion-bar">
                {occassions.map((o: string, index) => <div 
                key={index} 
                className="occassion">{
                    formatOccassionView(o)}
            </div>)}
        </div>
            <h3>{desc}</h3>
            <span>
                <h5>
                    <span className="engl">{gregDate}</span>
                    <span className="heb">{hDate}</span>
                </h5>
            </span>

            <div className="divider"></div>

            <span>{psukim.map((p: string, index) => p !== "null" ? 
                <Aliyah 
                    key={index}
                    a={index+1} 
                    psukim={p} 
                    available={true}>
                </Aliyah> : "")} 
            </span>
        </div>
    )
}

export default Parsha;