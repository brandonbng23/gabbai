import React, { useState } from "react";

export interface ParshaObj {
    id: number;
    hDate: string;
    gregDate: string;
    desc: string;
    occassion: string;
    psukim: string[];
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

function Parsha({hDate, gregDate, occassion, desc, psukim}: ParshaObj): React.JSX.Element {
    return (
        <div className="parsha">
            <div className="occassion">
                <span>{occassion}</span>
            </div>
            <h3>{desc}</h3>
            <span>
                <h5>
                    <span className="engl">{gregDate}</span>
                    <span className="heb">{hDate}</span>
                </h5>
            </span>

            <div className="divider"></div>

            <span>{psukim.map((p: string, index) => <Aliyah 
                                                        key={index}
                                                        a={index+1} 
                                                        psukim={p} 
                                                        available={true}>
                                                        </Aliyah>)}
            </span>
            
            
        </div>
    )
}

export default Parsha;