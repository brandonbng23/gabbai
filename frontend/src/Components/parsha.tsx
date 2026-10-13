import React, { useState } from "react";
import HoverTip from "./hoverTip.tsx"

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
    reader: string;
}





function Aliyah(props: Aliyah): React.JSX.Element {
    const [hovered, setHovered] = useState<boolean>(false);
    const [lockedHover, setLockedHover] = useState<boolean>(false);
    const [numberHover, setNumberHover] = useState<boolean>(false);

    const aliyahLabels: string[] = ["Rishon", "Sheni", "Shlishi", "Revi'i", "Chamishi", "Shishi", "Shvi'i", "Maftir", "Haftarah"];
    const englAliyahLabels: string[] = ["First Aliyah", "Second Aliyah", "Third Aliyah", "Fourth Aliyah", "Fifth Aliyah", "Sixth Aliyah", "Seventh Aliyah"];
    const aliyahLabel = (
        <div className={`aliyah-label${hovered ? "-hover" : ""}`} onMouseEnter={() => setNumberHover(true)} onMouseLeave={() => setNumberHover(false)}>
            {aliyahLabels[props.a-1]}
            {numberHover && englAliyahLabels[props.a-1] ? (<HoverTip message={englAliyahLabels[props.a-1]} style={{width: "max-content", whiteSpace: "nowrap"}} />) : null}
        </div>
    );

    return (
        <div>
            { props.locked ? <>
               <div className={`aliyah${hovered ? "-hover" : ""}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
                    <div className={`pandora-box${hovered ? "-hover" : ""}`}>
                        {aliyahLabel}
                        <div className="locked" onMouseEnter={() => setLockedHover(true)} onMouseLeave={() => setLockedHover(false)}>
                            <img src={hovered ? "/lock-solid-full.svg" : "/lock-solid-full-blue.svg"} alt="Locked Icon"/>
                            Locked
                            {lockedHover ? <HoverTip message={"Your shul has locked this aliyah."} style={{width: "200px"}}/> : null}
                        </div>
                    </div>
                    <div className={`psukim-text${hovered ? "-hover" : ""}`}>{props.psukim}</div>
               </div>
            </>
            : <>
                {props.available ? <>
                <div className={`aliyah${hovered ? "-hover" : ""}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
                    <div className={`pandora-box${hovered ? "-hover" : ""}`}>
                        {aliyahLabel}
                        <button>Register</button>
                    </div>
                    <div className={`psukim-text${hovered ? "-hover" : ""}`}>{props.psukim}</div>
                </div>
                </>
                :  <>
                <div className={`aliyah${hovered ? "-hover" : ""}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
                    <div className={`pandora-box${hovered ? "-hover" : ""}`}>
                        {aliyahLabel}
                        <div className="locked" onMouseEnter={() => setLockedHover(true)} onMouseLeave={() => setLockedHover(false)}>
                            <img src={hovered ? "/lock-solid-full.svg" : "/lock-solid-full-blue.svg"} alt="Locked Icon"/>
                            Unavailable
                            {lockedHover ? <HoverTip message={"Another reader has registered for this aliyah."} style={{width: "200px"}} /> : null}
                        </div>
                    </div>
                    <div className={`psukim-text${hovered ? "-hover" : ""}`}>{props.psukim}</div>
                </div>
                </>} 
            </> }
        </div> 
    )
}

function Parsha(props: ParshaObj): React.JSX.Element {
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
                {(props.locked || props.lockedArr.every((a: boolean) => a)) && (
                    <div className="locked-msg">
                        <img src="/lock-solid-full.svg" alt="Locked Icon" />
                        This parsha has been locked by your shul
                    </div>
                )}
                {props.occassions.map((o: string, index) => (
                    <div key={index} className="occassion">
                        {formatOccassionView(o)}
                    </div>
                ))}
            </div>

            <div>
                <h3>{props.desc}</h3>

                <div>
                    <h5>
                        <span className="engl">{props.gregDate}</span>
                        <span className="heb">{props.hDate}</span>
                    </h5>
                </div>

                <div className="divider"></div>

                <div className="aliyot">
                    {props.psukim.map((p: string, index) =>
                        p !== "null" ? (
                            (props.locked ? (
                                <Aliyah
                                    key={index}
                                    a={index + 1}
                                    psukim={p}
                                    locked={props.locked}
                                    available={false}
                                    reader={props.readers[index]}
                                />
                            ) : (
                                <Aliyah
                                    key={index}
                                    a={index + 1}
                                    psukim={p}
                                    locked={props.lockedArr[index]}
                                    available={index % 2 === 0 ? false : true}
                                    reader={props.readers[index]}
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
