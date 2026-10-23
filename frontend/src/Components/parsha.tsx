import React, { useState } from "react";
import InfoIcon from "./infoTip.tsx";
import AssignedReader from "./assignedReader.tsx";
import { cancelReading } from '../api.ts';

export type { ParshaData as ParshaObj } from '../../../interfaces/parshaData.mts';
import type { ParshaData as ParshaObj } from '../../../interfaces/parshaData.mts';
import type { ShulUser } from '../../../interfaces/user.mts';

export interface Aliyah {
    parshaId: number;
    a: number;
    psukim: string;
    available: boolean;
    locked: boolean;
    reader: ShulUser | null;
}

export interface ReadingActions {
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
    const aliyahLabels = ["Rishon", "Sheni", "Shlishi", "Revi'i", "Chamishi", "Shishi", "Shvi'i", "Maftir", "Haftarah"];
    const suffix = hovered ? '-hover' : '';

    async function cancel(): Promise<void> {
        if (cancelling || !props.shulId || props.reader?.id !== props.currentUserId || !props.onReadingCancelled) return;
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
            <div className={`aliyah${suffix}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
                <div className={`pandora-box${suffix}`}>
                    <div className={`aliyah-label${suffix}`}>{aliyahLabels[props.a - 1]}</div>
                    {props.reader ? (
                        <div className="schedule-reader-assignment">
                            <AssignedReader reader={props.reader} />
                            {props.reader.id === props.currentUserId && props.shulId && props.onReadingCancelled && (
                                <button type="button" className="reader-remove-btn" disabled={cancelling}
                                    aria-label={`Cancel your ${aliyahLabels[props.a - 1]} reading for ${props.desc}, ${props.dateString}`}
                                    title={cancelling ? 'Cancelling…' : 'Cancel your reading'}
                                    aria-busy={cancelling} onClick={() => void cancel()}>
                                    <svg aria-hidden="true" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M232.7 69.9C237.1 56.8 249.3 48 263.1 48L377 48C390.8 48 403 56.8 407.4 69.9L416 96L512 96C529.7 96 544 110.3 544 128C544 145.7 529.7 160 512 160L128 160C110.3 160 96 145.7 96 128C96 110.3 110.3 96 128 96L224 96L232.7 69.9zM128 208L512 208L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 208zM216 272C202.7 272 192 282.7 192 296L192 488C192 501.3 202.7 512 216 512C229.3 512 240 501.3 240 488L240 296C240 282.7 229.3 272 216 272zM320 272C306.7 272 296 282.7 296 296L296 488C296 501.3 306.7 512 320 512C333.3 512 344 501.3 344 488L344 296C344 282.7 333.3 272 320 272zM424 272C410.7 272 400 282.7 400 296L400 488C400 501.3 410.7 512 424 512C437.3 512 448 501.3 448 488L448 296C448 282.7 437.3 272 424 272z"/></svg>
                                </button>
                            )}
                        </div>
                    ) : !props.locked && props.available ? (
                        <button type="button" onClick={register}
                            aria-label={`Register for ${aliyahLabels[props.a - 1]} of ${props.desc}, ${props.dateString}`}>
                            Register
                        </button>
                    ) : (
                        <div className="locked">
                            <img src={hovered ? '/lock-solid-full.svg' : '/lock-solid-full-blue.svg'} alt="" />
                            {props.locked ? 'Locked' : 'Unavailable'}
                        </div>
                    )}
                </div>
                <div className={`psukim-text${suffix}`}>{props.psukim}</div>
            </div>
            {cancelError && <p className="schedule-cancel-error" role="alert">{cancelError}</p>}
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
        <div className="parsha">

            <div className="notices">
                {(props.locked || props.lockedArr.every((a: boolean) => a)) && (
                    <div className="locked-msg">
                        <img src="/lock-solid-full.svg" alt="" />
                        This parsha has been locked by your shul
                    </div>
                )}
                {[...props.occassions, ...(props.manualOccasions ?? [])].map((o: string, index) => (
                    <div key={index} className="occassion">
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
                        <span className="engl">{props.gregDate}</span>
                        <span className="heb">{props.hDate}</span>
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
                                dateString={props.dateString}
                                desc={props.desc}
                                a={index + 1}
                                psukim={psukim}
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
