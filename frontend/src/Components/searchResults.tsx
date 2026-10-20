import type { Aliyah, ParshaObj } from "./parsha.tsx";
import React, { useState } from "react";

function AdminAliyah(props: Aliyah): React.JSX.Element {
    const [hovered, setHovered] = useState<boolean>(false);

    const aliyahLabels: string[] = ["Rishon", "Sheni", "Shlishi", "Revi'i", "Chamishi", "Shishi", "Shvi'i", "Maftir", "Haftarah"];
    const aliyahLabel = ( 
        <div className={`aliyah-label${hovered ? "-hover" : ""}`}>
            {aliyahLabels[props.a-1]}
        </div>
    );

    return (
        <div className={`admin-aliyah${hovered ? "-hover" : ""}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            <div style={{ width: "15%" }}>{aliyahLabel}</div>

            <div style={{ width: "15%" }}>
                {props.reader || "Available"}
            </div>

            <div style={{ width: "25%" }}>
                {props.psukim}
            </div>
        </div>
    )
}

export function SearchResult({ reading }: { reading: ParshaObj }): React.JSX.Element {
        const [expanded, setExpanded] = useState<boolean>(false);

        return (
            <div className="reading-result">
                <div className="reading-result-head">
                        <button
                            type="button"
                            className="result-heading"
                            aria-expanded={expanded}
                            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${reading.desc}`}
                            onClick={() => setExpanded((previous) => !previous)}
                        >
                            <span className="result-info">
                                <span className="result-name">{reading.desc}</span>

                                <span className="result-occassions">
                                    {reading.occassions.map((o: string, index) => <span key={index} className="result-occassion">{o}</span>)}
                                </span>
                            </span>

                            <span className="result-readers">
                                <span className="result-available-total">{reading.readers.filter((r: string) => r === "").length}</span>
                                Readings available
                            </span>

                            <span className="result-readers">
                                <span className="result-reader-total">{reading.readers.filter((r: string) => r !== "").length}</span>
                                Registered readers
                            </span>                            

                            <span className="result-toggle-icon" aria-hidden="true">
                                { !expanded ? <svg 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    viewBox="0 0 640 640">
                                    <path d="M297.4 470.6C309.9 483.1 330.2 483.1 342.7 470.6L534.7 278.6C547.2 266.1 547.2 245.8 534.7 233.3C522.2 220.8 501.9 220.8 489.4 233.3L320 402.7L150.6 233.4C138.1 220.9 117.8 220.9 105.3 233.4C92.8 245.9 92.8 266.2 105.3 278.7L297.3 470.7z"/></svg>
                                : <svg 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    viewBox="0 0 640 640">
                                    <path d="M297.4 169.4C309.9 156.9 330.2 156.9 342.7 169.4L534.7 361.4C547.2 373.9 547.2 394.2 534.7 406.7C522.2 419.2 501.9 419.2 489.4 406.7L320 237.3L150.6 406.6C138.1 419.1 117.8 419.1 105.3 406.6C92.8 394.1 92.8 373.8 105.3 361.3L297.3 169.3z"/></svg>
                                }
                            </span>
                        </button>

                        {expanded ? <>
                            <div className="divider" style={{ width: "97%", margin: "10px"}}></div>
                            <div className="parsha">
                                {reading.psukim.filter((p: string) => p !== "null")
                                    .map((p: string, index) => 
                                        p !== null ? 
                                            <AdminAliyah
                                                key={index}
                                                parshaId={reading.id}
                                                a={index+1}
                                                psukim={p}
                                                locked={reading.locked}
                                                available={!(reading.readers[index] || reading.locked)}
                                                reader={reading.readers[index]}
                                            ></AdminAliyah> : null
                                    )}
                            </div>
                            
                            </> : null}
            </div>
        </div>
    )
}