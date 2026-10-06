import React, { useState } from "react";

/* Identifcal to ParshaData interface (gabbai/interfaces/parshaData.mts) */
export interface ParshaObj {
    id: number;
    hDate: string;
    gregDate: string;
    desc: string;
    occassions: string[];
    locked: boolean;
    lockedArr: boolean[];
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
    locked: boolean;
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
        <div>
            { props.locked ? <div className="locked">
                <div className="aliyah-locked">
                    <div className="lockbox">
                        <img src="/lock-solid-full.svg" alt="Locked Icon" />
                        Locked
                    </div>
                    <div className="psukimText">{props.psukim}</div>
                </div>
                <div className="locked-msg">This aliyah has been restricted by your shul.</div>
            </div>
            : <div className="aliyah">
                <button className={`parsha-btn-${buttonClass()}`} onClick={() => {toggleAvailable(!available)}}>{buttonText()}</button>
                <span className="psukim">
                    <span className="psukimText">{props.psukim}</span>
                </span>
            </div>}
        </div>
    )
}

function Parsha({hDate, gregDate, occassions, locked, lockedArr, desc, psukim}: ParshaObj): React.JSX.Element {
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
   return (
        <div className="parsha">

            <div className="notices">

                <div className="occassion-bar">
                    {occassions.map((o: string, index) => (
                        <div key={index} className="occassion">
                            {formatOccassionView(o)}
                        </div>
                    ))}
                </div>

                {(locked || lockedArr.every((a: boolean) => a) || 1) && (
                    <div className="locked-bar">
                        <img src="/lock-solid-full.svg" alt="Locked Icon" />
                        <span>This parsha has been restricted by your shul.</span>
                    </div>
                )}

            </div>

            <div>
                <h3>{desc}</h3>

                <div>
                    <h5>
                        <span className="engl">{gregDate}</span>
                        <span className="heb">{hDate}</span>
                    </h5>
                </div>

                <div className="divider"></div>

                <div>
                    {psukim.map((p: string, index) =>
                        p !== "null" ? (
                            (locked ? (
                                <Aliyah
                                    key={index}
                                    a={index + 1}
                                    psukim={p}
                                    locked={true}
                                    available={false}
                                />
                            ) : (
                                <Aliyah
                                    key={index}
                                    a={index + 1}
                                    psukim={p}
                                    locked={true}
                                    available={!lockedArr[index]}
                                />
                            ))
                        ) : null
                    )}
                </div>
            </div>

        </div>
    )
}

export default Parsha;