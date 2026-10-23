import React, { useState } from "react";
import InfoIcon from "./infoTip.tsx";

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
                <span><span style={{ fontWeight: "700", paddingRight: "7.5px"}}>Unavailable:</span>Another reader has registered for this aliyah.</span><br></br>
            </div>
        </div>
    );
}

function Aliyah(props: Aliyah & { shulId?: string; dateString: string; desc: string }): React.JSX.Element {
    const [hovered, setHovered] = useState(false);
    const aliyahLabels = ["Rishon", "Sheni", "Shlishi", "Revi'i", "Chamishi", "Shishi", "Shvi'i", "Maftir", "Haftarah"];
    const suffix = hovered ? '-hover' : '';

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
                    {!props.locked && props.available ? (
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
        </div>
    );
}

export default function Parsha(props: ParshaObj & { shulId?: string }): React.JSX.Element {
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
