import type { Aliyah, ParshaObj } from "./parsha.tsx";
import React, { useState } from "react";

function AdminAliyah(props: Aliyah & { disabled: boolean; onToggleLock: () => void }): React.JSX.Element {
    const [hovered, setHovered] = useState<boolean>(false);

    const aliyahLabels: string[] = ["Rishon", "Sheni", "Shlishi", "Revi'i", "Chamishi", "Shishi", "Shvi'i", "Maftir", "Haftarah"];
    const aliyahLabel = (
        <div className={`aliyah-label${hovered ? "-hover" : ""}`}>
            {aliyahLabels[props.a-1]}
        </div>
    );

    return (
        <div className={`admin-aliyah${hovered ? "-hover" : ""}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            <div style={{ width: "7%"}}>
                <button type="button" className="aliyah-lock-btn" disabled={props.disabled}
                    aria-label={`${props.locked ? 'Unlock' : 'Lock'} ${aliyahLabels[props.a - 1]}`}
                    aria-pressed={props.locked} onClick={props.onToggleLock}>
                    {props.locked ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M256 160L256 224L384 224L384 160C384 124.7 355.3 96 320 96C284.7 96 256 124.7 256 160zM192 224L192 160C192 89.3 249.3 32 320 32C390.7 32 448 89.3 448 160L448 224C483.3 224 512 252.7 512 288L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 288C128 252.7 156.7 224 192 224z"/></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M416 160C416 124.7 444.7 96 480 96C515.3 96 544 124.7 544 160L544 192C544 209.7 558.3 224 576 224C593.7 224 608 209.7 608 192L608 160C608 89.3 550.7 32 480 32C409.3 32 352 89.3 352 160L352 224L192 224C156.7 224 128 252.7 128 288L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 288C512 252.7 483.3 224 448 224L416 224L416 160z"/></svg>
                    }
                </button>
            </div>

            <div style={{ width: "15%" }}>{aliyahLabel}</div>

            <div style={{ width: "15%" }}>
                {!props.locked ? (props.reader || "Available") : "Locked"}
            </div>

            <div style={{ width: "25%" }}>
                {props.psukim}
            </div>
        </div>
    )
}

export function SearchResult({ reading, disabled, onLockChange }: {
    reading: ParshaObj;
    disabled: boolean;
    onLockChange: (reading: ParshaObj, locked: boolean, aliyah?: number) => void;
}): React.JSX.Element {
        const [expanded, setExpanded] = useState<boolean>(false);
        const locked = reading.locked;

        return (
            <div className="reading-result">
                <div className="reading-result-head">
                        <div
                            className="result-heading"
                            onClick={() => setExpanded((previous) => !previous)}
                        >
                            <div className="result-info">
                                <div style={{ display: "flex", flexDirection: "row"}}>
                                    <button type="button" className="parsha-lock-btn"
                                        aria-label={`${locked ? 'Unlock' : 'Lock'} ${reading.desc}`}
                                        aria-pressed={locked}
                                        disabled={disabled}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onLockChange(reading, !locked);
                                        }}>
                                        {locked ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M256 160L256 224L384 224L384 160C384 124.7 355.3 96 320 96C284.7 96 256 124.7 256 160zM192 224L192 160C192 89.3 249.3 32 320 32C390.7 32 448 89.3 448 160L448 224C483.3 224 512 252.7 512 288L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 288C128 252.7 156.7 224 192 224z"/></svg>
                                        : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M416 160C416 124.7 444.7 96 480 96C515.3 96 544 124.7 544 160L544 192C544 209.7 558.3 224 576 224C593.7 224 608 209.7 608 192L608 160C608 89.3 550.7 32 480 32C409.3 32 352 89.3 352 160L352 224L192 224C156.7 224 128 252.7 128 288L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 288C512 252.7 483.3 224 448 224L416 224L416 160z"/></svg>
                                        }
                                    </button>

                                    <span className="result-name">{reading.desc}</span>
                                </div>

                                <span className="result-occassions">
                                    {reading.occassions.map((o: string, index) => <span key={index} className="result-occassion">{o}</span>)}
                                </span>
                            </div>

                            <span className="result-readers">
                                <span className="result-available-total">{reading.readers.filter((r: string, index) => !r && Boolean(reading.psukim[index]) && reading.psukim[index] !== "null" && !locked && !reading.lockedArr[index]).length}</span>
                                Aliyot<br></br>available
                            </span>

                            <span className="result-readers">
                                <span className="result-reader-total">{reading.readers.filter((r: string, index) => r !== "" && Boolean(reading.psukim[index]) && reading.psukim[index] !== "null").length}</span>
                                Registered<br></br>readers
                            </span>

                            <button type="button" className="result-toggle-icon"
                                aria-expanded={expanded}
                                aria-label={`${expanded ? 'Collapse' : 'Expand'} ${reading.desc}`}>
                                { !expanded ? <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 640 640">
                                    <path d="M297.4 470.6C309.9 483.1 330.2 483.1 342.7 470.6L534.7 278.6C547.2 266.1 547.2 245.8 534.7 233.3C522.2 220.8 501.9 220.8 489.4 233.3L320 402.7L150.6 233.4C138.1 220.9 117.8 220.9 105.3 233.4C92.8 245.9 92.8 266.2 105.3 278.7L297.3 470.7z"/></svg>
                                : <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 640 640">
                                    <path d="M297.4 169.4C309.9 156.9 330.2 156.9 342.7 169.4L534.7 361.4C547.2 373.9 547.2 394.2 534.7 406.7C522.2 419.2 501.9 419.2 489.4 406.7L320 237.3L150.6 406.6C138.1 419.1 117.8 419.1 105.3 406.6C92.8 394.1 92.8 373.8 105.3 361.3L297.3 169.3z"/></svg>
                                }
                            </button>
                        </div>

                        {expanded ? <>
                            <div className="divider" style={{ width: "97%", margin: "10px"}}></div>
                            <div className="parsha">
                                {reading.psukim.map((p: string, index) =>
                                        p && p !== "null" ?
                                            <AdminAliyah
                                                key={index}
                                                parshaId={reading.id}
                                                a={index+1}
                                                psukim={p}
                                                locked={locked || reading.lockedArr[index]}
                                                disabled={disabled || locked}
                                                onToggleLock={() => onLockChange(reading, !reading.lockedArr[index], index + 1)}
                                                available={!(reading.readers[index] || locked || reading.lockedArr[index])}
                                                reader={reading.readers[index]}
                                            ></AdminAliyah> : null
                                    )}
                            </div>

                            </> : null}
            </div>
        </div>
    )
}
