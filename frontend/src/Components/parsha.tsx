import { TrashIcon } from './trashIcon.tsx';
import React, { useState } from "react";
import InfoIcon from "./infoTip.tsx";
import AssignedReader from "./assignedReader.tsx";
import { cancelReading } from '../api.ts';
import { useReadingRemovalConfirmation } from './useReadingRemovalConfirmation.tsx';
import { readingAnchor } from '../readingAnchor.ts';
import { sameReading } from '../starredReadings.ts';
import type { ReadingStarActions } from '../starredReadings.ts';
import { ReadingStarButton } from './readingStarButton.tsx';

export type { ParshaData as ParshaObj } from '../../../interfaces/parshaData.mts';
import type { ParshaData as ParshaObj } from '../../../interfaces/parshaData.mts';
import type { ShulUser } from '../../../interfaces/user.mts';

export interface Aliyah {
    parshaId: number;
    a: number;
    psukim: string;
    verseCount: number;
    note?: string;
    available: boolean;
    locked: boolean;
    reader: ShulUser | null;
}

export interface ReadingActions extends ReadingStarActions {
    currentUserId?: string;
    onReadingCancelled?: (dateString: string, desc: string, aliyah: number) => void;
}

export function AliyahInfo(): React.JSX.Element {
     return (
        <div>
            <div>
                <span><span style={{ fontWeight: "700", paddingRight: "7.5px"}}>Rishon:</span>First</span><br></br>
                <span><span style={{ fontWeight: "700", paddingRight: "7.5px"}}>Sheni:</span>Second</span><br></br>
                <span><span style={{ fontWeight: "700", paddingRight: "7.5px"}}>Shlishi:</span>Third</span><br></br>
                <span><span style={{ fontWeight: "700", paddingRight: "7.5px"}}>Revi'i:</span>Fourth</span><br></br>
                <span><span style={{ fontWeight: "700", paddingRight: "7.5px"}}>Chamishi:</span>Fifth</span><br></br>
                <span><span style={{ fontWeight: "700", paddingRight: "7.5px"}}>Shishi:</span>Sixth</span><br></br>
                <span><span style={{ fontWeight: "700", paddingRight: "7.5px"}}>Shvi'i:</span>Seventh</span><br></br>
            </div>
            <div className="divider"></div>
            <div>
                <span><span style={{ fontWeight: "700", paddingRight: "7.5px"}}>Locked:</span>Your shul has locked this aliyah.</span><br></br>
                <span><span style={{ fontWeight: "700", paddingRight: "7.5px"}}>Assigned:</span>Hover over a reader's name to view their card.</span><br></br>
            </div>
        </div>
    );
}

function Aliyah(props: Aliyah & ReadingActions & { shulId?: string; dateString: string; desc: string }): React.JSX.Element {
    const [hovered, setHovered] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [cancelError, setCancelError] = useState('');
    const { confirmRemoval, confirmationDialog } = useReadingRemovalConfirmation();
    const aliyahLabels = ["Rishon", "Sheni", "Shlishi", "Revi'i", "Chamishi", "Shishi", "Shvi'i", "Maftir", "Haftarah"];
    const suffix = hovered ? '-hover' : '';

    async function cancel(): Promise<void> {
        if (cancelling || !props.shulId || props.reader?.id !== props.currentUserId || !props.onReadingCancelled) return;
        if (!await confirmRemoval({ dateString: props.dateString, desc: props.desc, aliyah: props.a })) return;
        setCancelling(true);
        setCancelError('');
        try {
            await cancelReading(props.shulId, props.dateString, props.desc, props.a);
            props.onReadingCancelled(props.dateString, props.desc, props.a);
        } catch (failure) {
            setCancelError(failure instanceof Error ? failure.message : 'Unable to cancel your reading. Please try again.');
        } finally {
            setCancelling(false);
        }
    }

    function register(): void {
        const params = new URLSearchParams({
            parsha: String(props.parshaId),
            aliyah: String(props.a),
            date: props.dateString,
            desc: props.desc,
        });
        if (props.shulId) params.set('shul', props.shulId);
        window.location.assign(`/registration?${params}`);
    }

     return (
        <div>
            <div className={`parsha-aliyah aliyah${suffix}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
                {props.onReadingStarred && <ReadingStarButton
                    starred={props.starredReadings?.some(reading => sameReading(reading, {
                        shulId: props.shulId, dateString: props.dateString, desc: props.desc, aliyah: props.a,
                    })) ?? false}
                    disabled={!props.starredReadings}
                    label={`${aliyahLabels[props.a - 1]} of ${props.desc}, ${props.dateString}`}
                    onChange={starred => props.onReadingStarred!({
                        shulId: props.shulId, dateString: props.dateString, desc: props.desc, aliyah: props.a,
                    }, starred)} />}
                <div className={`aliyah-assignment${suffix}`}>
                    <div className={`aliyah-label${suffix}`}>{aliyahLabels[props.a - 1]}</div>
                    {props.reader ? (
                        <div className="aliyah-reader-assignment">
                            <AssignedReader reader={props.reader} />
                            <div className="aliyah-reader-actions">
                                {props.reader.id === props.currentUserId && props.shulId && props.onReadingCancelled && (
                                    <button type="button" className="reading-assignment-remove-button" disabled={cancelling}
                                        aria-label={`Cancel your ${aliyahLabels[props.a - 1]} reading for ${props.desc}, ${props.dateString}`}
                                        title={cancelling ? 'Cancelling…' : 'Cancel your reading'}
                                        aria-busy={cancelling} onClick={() => void cancel()}>
                                        <TrashIcon />
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : !props.locked && props.available ? (
                        <button type="button" onClick={register}
                            aria-label={`Register for ${aliyahLabels[props.a - 1]} of ${props.desc}, ${props.dateString}`}>
                            Register
                        </button>
                    ) : (
                        <div className="aliyah-availability">
                            <img src={hovered ? '/lock-solid-full.svg' : '/lock-solid-full-blue.svg'} alt="" />
                            {props.locked ? 'Locked' : 'Unavailable'}
                        </div>
                    )}
                </div>
                <div className={`aliyah-verse-count${suffix}`}>{`${props.verseCount} verses`}</div>
                <div className={`aliyah-verse-range${suffix}`}>{props.psukim}</div>
                {props.note && <div className="aliyah-note" title={`From your shul: ${props.note}`}><strong>From your shul: </strong>{props.note}</div>}
            </div>
            {cancelError && <p className="schedule-cancel-error" role="alert">{cancelError}</p>}
            {confirmationDialog}
        </div>
    );
}

export default function Parsha(props: ParshaObj & ReadingActions & { shulId?: string }): React.JSX.Element {
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
        <div className="parsha" id={readingAnchor(props)} tabIndex={-1}>

            <div className="parsha-notices">
                {(props.locked || props.lockedArr.every((a: boolean) => a)) && (
                    <div className="parsha-lock-notice">
                        <img src="/lock-solid-full.svg" alt="" />
                        This parsha has been locked by your shul
                    </div>
                )}
                {[...props.occassions, ...(props.manualOccasions ?? [])].map((o: string, index) => (
                    <div key={index} className="parsha-occasion">
                        {formatOccassionView(o)}
                    </div>
                ))}
            </div>

            <div className="parsha-content">
                <h3 className="parsha-title">
                    <span>{props.desc}</span>
                    <InfoIcon
                        message={<AliyahInfo />}
                        style={{width: "280px", whiteSpace: "pre-line"}}
                    />
                </h3>

                <div>
                    <h5 className="parsha-dates">
                        <span className="parsha-gregorian-date">{props.gregDate}</span>
                        <span className="parsha-hebrew-date">{props.hDate}</span>
                    </h5>
                </div>

                <div className="divider"></div>

                <div className="aliyot">
                    {props.psukim.map((psukim, index) => (
                        psukim.trim() !== '' && psukim !== 'null' ? (
                            <Aliyah
                                key={index}
                                parshaId={props.id}
                                shulId={props.shulId}
                                currentUserId={props.currentUserId}
                                onReadingCancelled={props.onReadingCancelled}
                                starredReadings={props.starredReadings}
                                onReadingStarred={props.onReadingStarred}
                                dateString={props.dateString}
                                desc={props.desc}
                                a={index + 1}
                                psukim={psukim}
                                verseCount={props.verseCounts[index] ?? 0}
                                note={props.aliyahNotes?.[index] ?? ''}
                                locked={props.locked || props.lockedArr[index]}
                                available={!props.locked && !props.readers[index]}
                                reader={props.readers[index]}
                            />
                        ) : null
                    ))}
                </div>
            </div>

        </div>
    );
}
