import { reorderManualOccasions } from '../readingAdjustments.ts';
import type { Aliyah, ParshaObj } from "./parsha.tsx";
import React, { useState } from "react";
import { UserDropDown } from "./dropdown.tsx";
import type { ShulUser } from "../api.ts";

function AdminAliyah(props: Aliyah & { disabled: boolean; onToggleLock: () => void, users: ShulUser[]; onAssignReader: (reader: ShulUser | null) => void }): React.JSX.Element {
    const [hovered, setHovered] = useState<boolean>(false);
    const hasReader = props.reader != null;
    const readerName = props.reader ? `${props.reader.firstName} ${props.reader.lastName}`.trim() : '';

    const aliyahLabels: string[] = ["Rishon", "Sheni", "Shlishi", "Revi'i", "Chamishi", "Shishi", "Shvi'i", "Maftir", "Haftarah"];
    const aliyahLabel = (
        <div className={`aliyah-label${hovered ? "-hover" : ""}`}>
            {aliyahLabels[props.a-1]}
        </div>
    );

    return (
        <div className={`admin-aliyah${hovered ? "-hover" : ""}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            <div style={{ width: "7%"}}>
                <div className="aliyah-status-icon">
                    {!hasReader ?
                        <button 
                            type="button" 
                            className="aliyah-lock-btn"
                            disabled={props.disabled} 
                            aria-label={`${props.locked ? 'Unlock' : 'Lock'} ${aliyahLabels[props.a - 1]}`}
                            aria-pressed={props.locked} onClick={props.onToggleLock}
                        >
                            {props.locked ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M256 160L256 224L384 224L384 160C384 124.7 355.3 96 320 96C284.7 96 256 124.7 256 160zM192 224L192 160C192 89.3 249.3 32 320 32C390.7 32 448 89.3 448 160L448 224C483.3 224 512 252.7 512 288L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 288C128 252.7 156.7 224 192 224z"/></svg>
                                : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M416 160C416 124.7 444.7 96 480 96C515.3 96 544 124.7 544 160L544 192C544 209.7 558.3 224 576 224C593.7 224 608 209.7 608 192L608 160C608 89.3 550.7 32 480 32C409.3 32 352 89.3 352 160L352 224L192 224C156.7 224 128 252.7 128 288L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 288C512 252.7 483.3 224 448 224L416 224L416 160z"/></svg>
                            }
                        </button>
                        : <svg role="img" aria-label={`Assigned to ${readerName}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M286 368C384.5 368 464.3 447.8 464.3 546.3C464.3 562.7 451 576 434.6 576L78 576C61.6 576 48.3 562.7 48.3 546.3C48.3 447.8 128.1 368 226.6 368L286 368zM585.7 169.9C593.5 159.2 608.5 156.8 619.2 164.6C629.9 172.4 632.3 187.4 624.5 198.1L522.1 338.9C517.9 344.6 511.4 348.3 504.4 348.7C497.4 349.1 490.4 346.5 485.5 341.4L439.1 293.4C429.9 283.9 430.1 268.7 439.7 259.5C449.2 250.3 464.4 250.6 473.6 260.1L500.1 287.5L585.7 169.8zM256.3 312C190 312 136.3 258.3 136.3 192C136.3 125.7 190 72 256.3 72C322.6 72 376.3 125.7 376.3 192C376.3 258.3 322.6 312 256.3 312z"/></svg>
                    }
                </div>
            </div>

            <div style={{ width: "15%" }}>{aliyahLabel}</div>

            <div style={{ width: "20%" }}>
                {hasReader ? <div className="assigned-reader">
                    <span>{readerName}</span>
                    <button type="button" className="reader-remove-btn"
                        aria-label={`Remove ${readerName} from ${aliyahLabels[props.a - 1]}`}
                        title="Remove reader"
                        disabled={props.disabled || props.locked}
                        onClick={event => {
                            event.stopPropagation();
                            props.onAssignReader(null);
                        }}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M232.7 69.9C237.1 56.8 249.3 48 263.1 48L377 48C390.8 48 403 56.8 407.4 69.9L416 96L512 96C529.7 96 544 110.3 544 128C544 145.7 529.7 160 512 160L128 160C110.3 160 96 145.7 96 128C96 110.3 110.3 96 128 96L224 96L232.7 69.9zM128 208L512 208L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 208zM216 272C202.7 272 192 282.7 192 296L192 488C192 501.3 202.7 512 216 512C229.3 512 240 501.3 240 488L240 296C240 282.7 229.3 272 216 272zM320 272C306.7 272 296 282.7 296 296L296 488C296 501.3 306.7 512 320 512C333.3 512 344 501.3 344 488L344 296C344 282.7 333.3 272 320 272zM424 272C410.7 272 400 282.7 400 296L400 488C400 501.3 410.7 512 424 512C437.3 512 448 501.3 448 488L448 296C448 282.7 437.3 272 424 272z"/></svg>
                    </button>
                </div>
                : props.locked ? "Locked" : <UserDropDown options={props.users}
                    selected={props.reader} onSelect={props.onAssignReader} disabled={props.disabled || props.locked} />}
            </div>

            <div style={{ width: "25%" }}>
                {props.psukim}
            </div>
        </div>
    )
}

export function SearchResult({ reading, disabled, users, onLockChange, onOccasionsChange, onReaderChange }: {
    reading: ParshaObj;
    disabled: boolean;
    users: ShulUser[];
    onLockChange: (reading: ParshaObj, locked: boolean, aliyah?: number) => void;
    onOccasionsChange: (reading: ParshaObj, labels: string[]) => void;
    onReaderChange: (reading: ParshaObj, aliyah: number, reader: ShulUser | null) => void;
}): React.JSX.Element {
        const [expanded, setExpanded] = useState<boolean>(false);
        const [newOccasion, setNewOccasion] = useState<string>("");
        const [draggedOccasion, setDraggedOccasion] = useState<string | null>(null);
        const [dropTarget, setDropTarget] = useState<string | null>(null);
        const manualOccasions = reading.manualOccasions ?? [];
        const canReorderOccasions = expanded && !disabled && manualOccasions.length > 1;
        function moveOccasion(source: string, target: string): void {
            if (!canReorderOccasions) return;
            const next = reorderManualOccasions(manualOccasions, source, target);
            if (next !== manualOccasions) onOccasionsChange(reading, next);
        }
        function addOccasion(): void {
            const label = newOccasion.trim();
            if (disabled || !label || label.length > 120 || manualOccasions.length >= 100
                || [...reading.occassions, ...manualOccasions].some(item => item.toLowerCase() === label.toLowerCase())) return;
            onOccasionsChange(reading, [...manualOccasions, label]);
            setNewOccasion('');
        }
        const locked = reading.locked;

        return (
            <div className="reading-result">
                <div className="reading-result-head">
                        <div
                            className="result-heading"
                            onClick={() => setExpanded((previous) => !previous)}
                        >
                            <div className="result-info">
                                <div className="result-title-row">
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

                                <div style={{ display: "flex", flexDirection: "row"}}>
                                    <span className="result-greg-date">{reading.gregDate}</span>
                                    <span className="result-heb-date">{reading.hDate}</span>
                                </div>

                                <span className="result-occassions">
                                    {reading.occassions.map((o: string, index) => <span key={index} className="result-occassion">{o}</span>)}
                                    {manualOccasions.map(label => (
                                        <span key={label}
                                            className={`result-occassion manual-occasion-tag${draggedOccasion === label ? ' is-dragging' : ''}${dropTarget === label ? ' is-drop-target' : ''}`}
                                            draggable={canReorderOccasions}
                                            tabIndex={canReorderOccasions ? 0 : undefined}
                                            title={canReorderOccasions ? 'Drag to reorder, or use Alt + Left/Right Arrow' : undefined}
                                            onDragStart={event => {
                                                if (!canReorderOccasions || (event.target instanceof Element && event.target.closest('button'))) {
                                                    event.preventDefault();
                                                    return;
                                                }
                                                event.stopPropagation();
                                                event.dataTransfer.effectAllowed = 'move';
                                                event.dataTransfer.setData('text/plain', label);
                                                setDraggedOccasion(label);
                                            }}
                                            onDragOver={event => {
                                                if (!canReorderOccasions || draggedOccasion === null || draggedOccasion === label) return;
                                                event.preventDefault();
                                                event.stopPropagation();
                                                event.dataTransfer.dropEffect = 'move';
                                                setDropTarget(label);
                                            }}
                                            onDragLeave={event => {
                                                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
                                            }}
                                            onDrop={event => {
                                                if (!canReorderOccasions || draggedOccasion === null) return;
                                                event.preventDefault();
                                                event.stopPropagation();
                                                moveOccasion(draggedOccasion, label);
                                                setDraggedOccasion(null);
                                                setDropTarget(null);
                                            }}
                                            onDragEnd={() => { setDraggedOccasion(null); setDropTarget(null); }}
                                            onKeyDown={event => {
                                                if (event.target !== event.currentTarget || !canReorderOccasions || !event.altKey
                                                    || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
                                                event.preventDefault();
                                                event.stopPropagation();
                                                const index = manualOccasions.indexOf(label);
                                                const target = manualOccasions[index + (event.key === 'ArrowLeft' ? -1 : 1)];
                                                if (target !== undefined) moveOccasion(label, target);
                                            }}>

                                            {label}
                                            {expanded && <button type="button" className="occasion-add-btn occasion-remove-btn"
                                                aria-label={`Remove ${label}`} disabled={disabled}
                                                onClick={event => {
                                                    event.stopPropagation();
                                                    onOccasionsChange(reading, manualOccasions.filter(item => item !== label));
                                                }}>
                                                <svg aria-hidden="true" viewBox="0 0 640 640">
                                                    <path d="M232.7 69.9C237.1 56.8 249.3 48 263.1 48L377 48C390.8 48 403 56.8 407.4 69.9L416 96L512 96C529.7 96 544 110.3 544 128C544 145.7 529.7 160 512 160L128 160C110.3 160 96 145.7 96 128C96 110.3 110.3 96 128 96L224 96L232.7 69.9zM128 208L512 208L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 208zM216 272C202.7 272 192 282.7 192 296L192 488C192 501.3 202.7 512 216 512C229.3 512 240 501.3 240 488L240 296C240 282.7 229.3 272 216 272zM320 272C306.7 272 296 282.7 296 296L296 488C296 501.3 306.7 512 320 512C333.3 512 344 501.3 344 488L344 296C344 282.7 333.3 272 320 272zM424 272C410.7 272 400 282.7 400 296L400 488C400 501.3 410.7 512 424 512C437.3 512 448 501.3 448 488L448 296C448 282.7 437.3 272 424 272z" />
                                                </svg>
                                            </button>}
                                        </span>
                                    ))}
                                </span>
                            </div>

                            <span className="result-readers">
                                <span className="result-available-total">{reading.readers.filter((r, index) => !r && Boolean(reading.psukim[index]) && reading.psukim[index] !== "null" && !locked && !reading.lockedArr[index]).length}</span>
                                Aliyot<br></br>available
                            </span>

                            <span className="result-readers">
                                <span className="result-reader-total">{reading.readers.filter((r, index) => r != null && Boolean(reading.psukim[index]) && reading.psukim[index] !== "null").length}</span>
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
                            <div className="add-occassions">
                                <span>Add an Occassion:</span>
                                <div className="result-occassion occasion-input-tag">
                                    <input
                                        type="text"
                                        aria-label="Add an occasion"
                                        placeholder="e.g. Josh Cohen's Bar Mitzvah"
                                        value={newOccasion}
                                        maxLength={120}
                                        disabled={disabled}
                                        onKeyDown={event => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                if (!event.nativeEvent.isComposing) addOccasion();
                                            }
                                        }}
                                        onChange={(event) => setNewOccasion(event.currentTarget.value)}
                                    />
                                    <button
                                        type="button"
                                        className="occasion-add-btn"
                                        aria-label="Add occasion"
                                        disabled={disabled || !newOccasion.trim()}
                                        onClick={addOccasion}>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M352 128C352 110.3 337.7 96 320 96C302.3 96 288 110.3 288 128L288 288L128 288C110.3 288 96 302.3 96 320C96 337.7 110.3 352 128 352L288 352L288 512C288 529.7 302.3 544 320 544C337.7 544 352 529.7 352 512L352 352L512 352C529.7 352 544 337.7 544 320C544 302.3 529.7 288 512 288L352 288L352 128z"/></svg>
                                    </button>
                                </div>
                            </div>
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
                                                users={users}
                                                onAssignReader={reader => onReaderChange(reading, index + 1, reader)}
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
