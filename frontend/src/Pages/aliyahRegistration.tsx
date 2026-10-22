import { useEffect } from "react";
import { useState } from "react";
import type { ParshaObj } from "../Components/parsha.tsx";
import InfoIcon from "../Components/infoTip.tsx"
import { registerForReading } from "../api.js";
import type { User, GuestRegistration } from "../api.js";
import type { SubmitEvent } from "react";

interface RegistrationProps {
    shulId?: string;
    schedule: ParshaObj[];
    loading: boolean;
    error: string | null;
    user: User | null;
}

function AliyahRegistration({ shulId, schedule, loading, error, user }: RegistrationProps) {

    // If a user is signing up
    const [guest, setGuest] = useState<boolean>(false);
    const focus = !guest && Boolean(user);
    const [submitting, setSubmitting] = useState(false);
    const [registered, setRegistered] = useState(false);
    const [registrationError, setRegistrationError] = useState('');
    const backUrl = shulId ? `/?${new URLSearchParams({ shul: shulId })}` : '/';

    function updateStates() {
        if (submitting) return;
        setRegistrationError('');
        setGuest((current: boolean) => !current);
    }

    const params = new URLSearchParams(window.location.search);
    const parshaId = Number(params.get("parsha"));
    const aliyah = Number(params.get("aliyah"));
    const parsha = params.has("parsha") && Number.isInteger(parshaId)
        ? schedule.find(reading => params.has("date") && params.has("desc")
            ? reading.dateString === params.get("date") && reading.desc === params.get("desc")
            : reading.id === parshaId)
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

    async function confirmRegistration(details?: GuestRegistration): Promise<void> {
        if (submitting || !validSelection || !parsha || !shulId || locked || unavailable) return;
        setSubmitting(true);
        setRegistrationError('');
        try {
            await registerForReading(shulId, parsha, aliyah, details);
            setRegistered(true);
        } catch (failure) {
            setRegistrationError(failure instanceof Error ? failure.message : 'Unable to register. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    function submitGuest(event: SubmitEvent<HTMLFormElement>): void {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const value = (name: string) => String(form.get(name) ?? '').trim();
        void confirmRegistration({ firstName: value('firstNameRegister'), lastName: value('lastNameRegister'),
            hebrewName: value('hebrewNameRegister'), email: value('emailRegister') });
    }

    if (registered) return <main className="aliyah-registration">
        <h1>Registration confirmed</h1>
        <p role="status">You’re registered for {labels[aliyah - 1]} of {parsha?.desc} on {parsha?.gregDate}.</p>
        <a className="registration-back" href={backUrl}>← Back to schedule</a>
    </main>;

    return (
        <main className="aliyah-registration">
            <a className="registration-back" href={backUrl}>← Back to schedule</a>
            {registrationError && <p role="alert">{registrationError}</p>}

            {loading ? <h1>Loading registration…</h1>
            : !locked && !unavailable && validSelection ? <h1>Register for {parsha?.desc ?? "a reading"}</h1>
            : (!validSelection ? <h1>Oy Gevalt!</h1>
            : <h1>Registration has Closed</h1>)}

            {!locked && !unavailable && validSelection ? <div className="register-identity">
                    <div className={`register-switch${focus ? "" : " register-switch-guest"}`}>
                        <div className="register-switch-options">
                            <button type="button" disabled={submitting || !user} aria-pressed={focus}
                                className={`register-option${focus ? " register-option-focus" : ""}`}
                                onClick={() => { if (!focus && user) updateStates(); }}>
                                Register with Profile
                            </button>
                            <button type="button" disabled={submitting} aria-pressed={!focus}
                                className={`register-option${focus ? "" : " register-option-focus"}`}
                                onClick={() => { if (focus) updateStates(); }}>
                                Register as Guest
                            </button>
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

                    {!locked && !unavailable && !focus ? <>
                        <div className="registration-details">
                            <h5>Register as Guest</h5>
                            <form id="guest-registration" onSubmit={submitGuest}>
                                <fieldset disabled={submitting} style={{ border: 0, padding: 0, margin: 0 }}>
                                    <div className="registration-names">
                                        <div className="registration-item">
                                            <dt className="registration-label">First Name</dt>
                                            <input
                                                className="name"
                                                type="text"
                                                name="firstNameRegister" aria-label="First name" required maxLength={254}
                                                defaultValue=""
                                                placeholder="i.e. Josh">
                                            </input>
                                        </div>

                                        <div className="registration-item">
                                            <dt className="registration-label">Last Name</dt>
                                            <input
                                                className="name"
                                                type="text"
                                                name="lastNameRegister" aria-label="Last name" required maxLength={254}
                                                defaultValue=""
                                                placeholder="i.e. Cohen">
                                            </input>
                                        </div>
                                    </div>

                                    <div className="registration-item">
                                        <dt className="registration-label">Hebrew Name</dt>
                                        <input
                                            className="h-name"
                                            type="text"
                                            name="hebrewNameRegister" aria-label="Hebrew name" maxLength={254}
                                            defaultValue=""
                                            placeholder="i.e. Moishe ben Shlomo v'et Devorah">
                                        </input>
                                    </div>

                                    <div className="registration-item">
                                        <dt className="registration-label">Email</dt>
                                        <input
                                            type="email"
                                            name="emailRegister" aria-label="Email" required maxLength={254}
                                            defaultValue=""
                                            placeholder="i.e. iheartleyning@gabbai.com">
                                        </input>
                                    </div>
                                </fieldset>
                            </form>
                        </div>


                        <div>
                            <p id="registration-status" role="status">
                                {submitting ? 'Registering…' : 'Confirm your details to reserve this aliyah.'}
                            </p>

                            <button type="submit" form="guest-registration" className="registration-confirm" disabled={submitting} aria-describedby="registration-status">
                                Confirm Registration
                            </button>
                        </div>
                    </>

                    : <div>
                        <p id="registration-status" role="status">
                        {locked ? "Your shul has locked this aliyah. Choose another aliyah from the schedule"
                            : unavailable ? "Another reader has already registered for this reading. Choose another aliyah from the schedule"
                            : submitting ? "Registering…" : "Register using your saved profile details."}
                    </p>
                    <button type="button" className="registration-confirm" disabled={submitting || locked || unavailable || !user}
                        onClick={() => { void confirmRegistration(); }} aria-describedby="registration-status">
                        Confirm Registration
                    </button>
                    </div>}


                </>}
        </main>
    );
}

export default AliyahRegistration;
