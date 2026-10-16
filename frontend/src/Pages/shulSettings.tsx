import type { Shul } from '../api.js';
import { updateShul } from '../api.js';
import { useState } from "react";
import type { SubmitEvent } from "react";

function EditField( { field }: { field: string } ): React.JSX.Element {
    const [clicked, setClicked] = useState<boolean>(false)

    return ( 
        <>
            <button onClick={() => setClicked(!clicked)}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M160 96C124.7 96 96 124.7 96 160L96 480C96 515.3 124.7 544 160 544L480 544C515.3 544 544 515.3 544 480L544 160C544 124.7 515.3 96 480 96L160 96zM421.8 203.7L436.2 218.1C451.8 233.7 451.8 259 436.2 274.7L412.4 298.5L341.4 227.5L365.2 203.7C380.8 188.1 406.1 188.1 421.8 203.7zM215.9 353L307.4 261.4L378.4 332.4L286.8 423.9C282.7 428 277.6 430.9 271.9 432.3L211.8 447.3C206.3 448.7 200.6 447.1 196.6 443.1C192.6 439.1 191 433.4 192.4 427.9L207.4 367.8C208.8 362.2 211.7 357 215.8 352.9z"/></svg>
            </button>

            { clicked? <div>
                <form>
                    <input
                        type="text">
                    </input>
                </form>
            </div> : null}
        </>
    )
}

export default function ShulSettings({ shul, onSaved }: { shul: Shul; onSaved: (shul: Shul) => void }): React.JSX.Element {
    const [name, setName] = useState<string>(shul.name);
    const [address, setAddress] = useState<string>(shul.address);
    const [phone, setPhone] = useState<string>(shul.phone);
    const [email, setEmail] = useState<string>(shul.email);
    const [website, setWebsite] = useState<string>(shul.websiteUrl);
    const [donation, setDonation] = useState<string>(shul.donationUrl);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    async function updateShulInfo(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
            const updated = await updateShul(shul.id, {
                name, address, phone, email, websiteUrl: website, donationUrl: donation,
            });
            setName(updated.name);
            setAddress(updated.address);
            setPhone(updated.phone);
            setEmail(updated.email);
            setWebsite(updated.websiteUrl);
            setDonation(updated.donationUrl);
            onSaved(updated);
            setSaved(true);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Unable to save your shul.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <main className="shul-settings">
            <h1>Shul Settings</h1>

            <dl className="registration-details">
                <h5>Shul Information</h5>
                <div className="shul-edit">
                    <form onSubmit={updateShulInfo} onChange={() => setSaved(false)}>
                        <fieldset disabled={saving}>
                        <dt>Shul Name</dt>
                        <dd>
                            <input
                                type="text"
                                value={name}
                                required
                                pattern=".*\S.*"
                                onChange={(e) => setName(e.target.value)}
                            ></input>
                        </dd>

                        <dt>Address</dt>
                        <dd>
                            <input
                                type="text"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                            ></input>
                        </dd>

                        <dt>Phone</dt>
                        <dd>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            ></input>
                        </dd>

                        <dt>Email</dt>
                        <dd>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            ></input>
                        </dd>

                        <dt>Website URL</dt>
                        <dd>
                            <input
                                type="url"
                                value={website}
                                onChange={(e) => setWebsite(e.target.value)}
                            ></input>
                        </dd>

                        <dt>Donation URL</dt>
                        <dd>
                            <input
                                type="url"
                                value={donation}
                                onChange={(e) => setDonation(e.target.value)}
                            ></input>
                        </dd>

                        <button type="submit">{saving ? 'Saving…' : 'Save changes'}</button>
                        </fieldset>
                        {error && <p role="alert">{error}</p>}
                        {saved && <p role="status">Shul information saved.</p>}
                    </form>
                </div>
            </dl>
        </main>
    )
}
