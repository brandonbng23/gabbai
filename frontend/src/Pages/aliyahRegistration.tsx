import { useEffect } from "react";
import { useState } from "react";
import type { ParshaObj } from "../Components/parsha.tsx";

interface RegistrationProps {
    schedule: ParshaObj[];
    loading: boolean;
    error: string | null;
}

function AliyahRegistration({ schedule, loading, error }: RegistrationProps) {

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
    const validSelection = parsha && Number.isInteger(aliyah) && aliyah >= 1 && aliyah <= labels.length
        && Boolean(parsha.psukim[aliyah - 1]) && parsha.psukim[aliyah - 1] !== "null";
    const locked = parsha?.locked || parsha?.lockedArr[aliyah - 1];
    // Match the schedule's current placeholder availability rules.
    const unavailable = (aliyah - 1) % 2 === 0;

    useEffect(() => {
        const previousTitle = document.title;
        document.title = "Aliyah registration | Gabbai";
        return () => { document.title = previousTitle; };
    }, []);

    return (
        <main className="aliyah-registration">
            <a className="registration-back" href="/">← Back to schedule</a>              

            <div className="register-identity">           
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
            </div>

                
            <h1>Register for a Reading</h1>
            {loading ? <p role="status">Loading your reading…</p>
                : error ? <p role="alert">{error}</p>
                : !validSelection || !parsha ? <p role="alert">This reading could not be found. Choose an aliyah from the schedule.</p>
                : <>
                    <dl className="registration-details">
                        <h5>Aliyah Summary</h5>
                        <div><dt>Date</dt><dd>{parsha.gregDate} · {parsha.hDate}</dd></div>
                        <div><dt>Parsha</dt><dd>{parsha.desc}</dd></div>
                        <div><dt>Aliyah</dt><dd>{labels[aliyah - 1]}</dd></div>
                        <div><dt>Psukim</dt><dd>{parsha.psukim[aliyah - 1]}</dd></div>
                    </dl>

                    {guest ? <div className="registration-details">
                        <h5>Register as Guest</h5>
                        <form>
                            <div className="registration-names">
                                <div className="registration-item">
                                    <dt className="registration-label">First Name</dt>
                                    <input
                                        className="name"
                                        type="text"
                                        name="firstNameRegister"
                                        placeholder="i.e. Josh">
                                    </input>
                                </div>

                                <div className="registration-item">
                                    <dt className="registration-label">Last Name</dt>
                                    <input
                                        className="name"
                                        type="text"
                                        name="lastNameRegister"
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
                                    placeholder="i.e. Yehoshua ben Noach v'et Devorah">
                                </input>
                            </div>

                            <div className="registration-item">
                                <dt className="registration-label">Email</dt>
                                <input
                                    type="email"
                                    name="emailRegister"
                                    placeholder="i.e. iheartleyning@gabbai.com">
                                </input>  
                            </div>
                        </form>
                    </div>
                    : null}

                    <p id="registration-status" role="status">
                        {locked ? "Your shul has locked this aliyah."
                            : unavailable ? "This aliyah is unavailable. Choose another reading from the schedule."
                            : "Online registration is not available yet."}
                    </p>
                    <button type="button" className="registration-confirm" disabled aria-describedby="registration-status">
                        Confirm registration
                    </button>
                </>}
        </main>
    );
}

export default AliyahRegistration;
