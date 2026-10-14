import { useEffect } from "react";
import { useState } from "react";
import type { ParshaObj } from "../Components/parsha.tsx";
import InfoIcon from "../Components/infoTip.tsx"
import type { User } from "../api.js"

interface RegistrationProps {
    schedule: ParshaObj[];
    loading: boolean;
    error: string | null;
    user: User | null;
}

function AliyahRegistration({ schedule, loading, error, user }: RegistrationProps) {

    // If a user is signing up
    const [guest, setGuest] = useState<boolean>(false);
    const [focus, setFocus] = useState<boolean>(true);

    function updateStates() {
        setFocus((current: boolean) => !current);
        setGuest((current: boolean) => !current);
    }

    const params = new URLSearchParams(window.location.search);
    const parshaId = Number(params.get("parsha"));
    const aliyah = Number(params.get("aliyah"));
    const parsha = params.has("parsha") && Number.isInteger(parshaId)
        ? schedule.find(reading => reading.id === parshaId)
        : undefined;
    const labels = ["Rishon", "Sheni", "Shlishi", "Revi'i", "Chamishi", "Shishi", "Shvi'i", "Maftir", "Haftarah"];
    const englLabels = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh"];
    const validSelection = parsha && Number.isInteger(aliyah) && aliyah >= 1 && aliyah <= labels.length
        && Boolean(parsha.psukim[aliyah - 1]) && parsha.psukim[aliyah - 1] !== "null";
    const locked = parsha?.locked || parsha?.lockedArr[aliyah - 1];
    const unavailable = Boolean(parsha?.readers[aliyah - 1]);

    useEffect(() => {
        const previousTitle = document.title;
        document.title = "Aliyah registration | Gabbai";
        return () => { document.title = previousTitle; };
    }, []);

    return (
        <main className="aliyah-registration">
            <a className="registration-back" href="/">← Back to schedule</a>

            {loading ? <h1>Loading registration…</h1>
            : !locked && !unavailable && validSelection ? <h1>Register for {parsha?.desc ?? "a reading"}</h1>
            : (!validSelection ? <h1>Oy Gevalt!</h1>
            : <h1>Registration has Closed</h1>)} 

            {!locked && !unavailable && validSelection ? <div className="register-identity">           
                    <div className={`register-switch${focus ? "" : " register-switch-guest"}`}>
                        <div className="register-switch-options">
                            <div
                                className={`register-option${focus ? " register-option-focus" : ""}`}
                                onClick={() => { if (!focus) updateStates(); }}
                            >
                                Register with Profile
                            </div>
                            <div
                                className={`register-option${focus ? "" : " register-option-focus"}`}
                                onClick={() => { if (focus) updateStates(); }}
                            >
                                Register as Guest
                            </div>
                        </div>
                    </div>
                    <div className="register-switch-info">
                        Use your Gabbai profile to register with your saved details, or register as a guest.
                    </div>
                </div> : null}
            

            {loading ? <dl className="registration-details registration-details-loading" role="status" aria-label="Loading registration details">
                    <h5 aria-hidden="true">Aliyah Summary</h5>
                    <div aria-hidden="true"><dt>Date</dt><dd>&nbsp;</dd></div>
                    <div aria-hidden="true"><dt>Parsha</dt><dd>&nbsp;</dd></div>
                    <div aria-hidden="true"><dt>Aliyah</dt><dd>&nbsp;</dd></div>
                    <div aria-hidden="true"><dt>Psukim</dt><dd>&nbsp;</dd></div>
                </dl>
                : error ? <p role="alert">{error}</p>
                : !validSelection || !parsha ? <p role="alert">This reading could not be found. Choose another aliyah from the schedule.</p>
                : <>
                    <dl className="registration-details">
                        <h5>Aliyah Summary</h5>
                        <div><dt>Date</dt><dd>{parsha.gregDate} · {parsha.hDate}</dd></div>
                        <div><dt>Parsha</dt><dd>{parsha.desc}</dd></div>
                        <div><dt>Aliyah</dt><dd><span style={{ marginRight: "8px"}}>{labels[aliyah - 1]}</span>{englLabels[aliyah - 1] ? <InfoIcon message={englLabels[aliyah - 1]}></InfoIcon> : null}</dd></div>
                        <div><dt>Psukim</dt><dd>{parsha.psukim[aliyah - 1]}</dd></div>
                    </dl>

                    {!locked && !unavailable && guest ? <>
                        <div className="registration-details">
                            <h5>Register as Guest</h5>
                            <form>
                                <div className="registration-names">
                                    <div className="registration-item">
                                        <dt className="registration-label">First Name</dt>
                                        <input
                                            className="name"
                                            type="text"
                                            name="firstNameRegister"
                                            defaultValue={user?.firstName ?? ''}
                                            placeholder="i.e. Josh">
                                        </input>
                                    </div>

                                    <div className="registration-item">
                                        <dt className="registration-label">Last Name</dt>
                                        <input
                                            className="name"
                                            type="text"
                                            name="lastNameRegister"
                                            defaultValue={user?.lastName ?? ''}
                                            placeholder="i.e. Cohen">
                                        </input>
                                    </div>
                                </div>

                                <div className="registration-item">
                                    <dt className="registration-label">Hebrew Name</dt>
                                    <input
                                        className="h-name"
                                        type="text"
                                        name="hebrewNameRegister"
                                        defaultValue={user?.hebrewName ?? ''}
                                        placeholder="i.e. Moishe ben Shlomo v'et Devorah">
                                    </input>
                                </div>

                                <div className="registration-item">
                                    <dt className="registration-label">Email</dt>
                                    <input
                                        type="email"
                                        name="emailRegister"
                                        defaultValue={user?.email ?? ''}
                                        placeholder="i.e. iheartleyning@gabbai.com">
                                    </input>  
                                </div>
                            </form>
                        </div>

                    
                        <div>
                            <p id="registration-status" role="status">
                                Online registration is not available yet.
                            </p>

                            <button type="button" className="registration-confirm" disabled aria-describedby="registration-status">
                                Confirm Registration
                            </button>
                        </div>
                    </>
                    
                    : <div>
                        <p id="registration-status" role="status">
                        {locked ? "Your shul has locked this aliyah. Choose another aliyah from the schedule"
                            : unavailable ? "Another reader has already registered for this reading. Choose another aliyah from the schedule"
                            : "Online registration is not available yet."}
                    </p>
                    <button type="button" className="registration-confirm" disabled aria-describedby="registration-status">
                        Confirm Registration
                    </button>
                    </div>}

                   
                </>}
        </main>
    );
}

export default AliyahRegistration;
