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

    return (<div style={{backgroundColor: "#262626"}}>
                        <div style={{marginTop: "15px"}}>
                <div style={{marginLeft: "2%", color: "white", display: "flex", flexDirection: "column", gap: "0px"}}>
                    <h1 style={{ margin: 0 }}>Administration Settings</h1>
                    <span style={{fontWeight: "300", fontSize: "15px"}}>You are able to view this page because your shul has marked your account as an administrator.</span>
                </div>
                <div className="divider" style={{ width: "96%", borderColor: "white" }}></div>
            </div>

            <div style={{display: "flex", flexDirection: "row", marginRight: "2%"}}>
                <div className="shul-card">
                    <div className="shul-card-item"><h1>{shul.name}</h1></div>
                    <div className="shul-card-item">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="rgb(255, 255, 255)" d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z"/></svg>
                        <span>{shul.address}</span></div>
                    <div className="shul-card-item">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="rgb(255, 255, 255)" d="M224.2 89C216.3 70.1 195.7 60.1 176.1 65.4L170.6 66.9C106 84.5 50.8 147.1 66.9 223.3C104 398.3 241.7 536 416.7 573.1C493 589.3 555.5 534 573.1 469.4L574.6 463.9C580 444.2 569.9 423.6 551.1 415.8L453.8 375.3C437.3 368.4 418.2 373.2 406.8 387.1L368.2 434.3C297.9 399.4 241.3 341 208.8 269.3L253 233.3C266.9 222 271.6 202.9 264.8 186.3L224.2 89z"/></svg>
                        <span>{shul.phone}</span></div>
                    <div className="shul-card-item">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="rgb(255, 255, 255)" d="M320 128C214 128 128 214 128 320C128 426 214 512 320 512C337.7 512 352 526.3 352 544C352 561.7 337.7 576 320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320L576 352C576 405 533 448 480 448C450.7 448 424.4 434.8 406.8 414.1C384 435.1 353.5 448 320 448C249.3 448 192 390.7 192 320C192 249.3 249.3 192 320 192C347.9 192 373.7 200.9 394.7 216.1C400.4 211.1 407.8 208 416 208C433.7 208 448 222.3 448 240L448 352C448 369.7 462.3 384 480 384C497.7 384 512 369.7 512 352L512 320C512 214 426 128 320 128zM384 320C384 284.7 355.3 256 320 256C284.7 256 256 284.7 256 320C256 355.3 284.7 384 320 384C355.3 384 384 355.3 384 320z"/></svg>
                        <span>{shul.email}</span></div>
                    <div className="shul-card-item">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="rgb(255, 255, 255)" d="M451.5 160C434.9 160 418.8 164.5 404.7 172.7C388.9 156.7 370.5 143.3 350.2 133.2C378.4 109.2 414.3 96 451.5 96C537.9 96 608 166 608 252.5C608 294 591.5 333.8 562.2 363.1L491.1 434.2C461.8 463.5 422 480 380.5 480C294.1 480 224 410 224 323.5C224 322 224 320.5 224.1 319C224.6 301.3 239.3 287.4 257 287.9C274.7 288.4 288.6 303.1 288.1 320.8C288.1 321.7 288.1 322.6 288.1 323.4C288.1 374.5 329.5 415.9 380.6 415.9C405.1 415.9 428.6 406.2 446 388.8L517.1 317.7C534.4 300.4 544.2 276.8 544.2 252.3C544.2 201.2 502.8 159.8 451.7 159.8zM307.2 237.3C305.3 236.5 303.4 235.4 301.7 234.2C289.1 227.7 274.7 224 259.6 224C235.1 224 211.6 233.7 194.2 251.1L123.1 322.2C105.8 339.5 96 363.1 96 387.6C96 438.7 137.4 480.1 188.5 480.1C205 480.1 221.1 475.7 235.2 467.5C251 483.5 269.4 496.9 289.8 507C261.6 530.9 225.8 544.2 188.5 544.2C102.1 544.2 32 474.2 32 387.7C32 346.2 48.5 306.4 77.8 277.1L148.9 206C178.2 176.7 218 160.2 259.5 160.2C346.1 160.2 416 230.8 416 317.1C416 318.4 416 319.7 416 321C415.6 338.7 400.9 352.6 383.2 352.2C365.5 351.8 351.6 337.1 352 319.4C352 318.6 352 317.9 352 317.1C352 283.4 334 253.8 307.2 237.5z"/></svg>
                        <span>{shul.websiteUrl}</span></div>
                    <div className="shul-card-item">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="rgb(255, 255, 255)" d="M305 151.1L320 171.8L335 151.1C360 116.5 400.2 96 442.9 96C516.4 96 576 155.6 576 229.1L576 231.7C576 343.9 436.1 474.2 363.1 529.9C350.7 539.3 335.5 544 320 544C304.5 544 289.2 539.4 276.9 529.9C203.9 474.2 64 343.9 64 231.7L64 229.1C64 155.6 123.6 96 197.1 96C239.8 96 280 116.5 305 151.1z"/></svg>
                        <span>{shul.donationUrl}</span></div>
                </div>

                <div className="shul-card">
                    <div className="shul-card-item"><h1>{`Preview: ${name}`}</h1></div>
                    <div className="shul-card-item">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="rgb(255, 255, 255)" d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z"/></svg>
                        <span>{address}</span></div>
                    <div className="shul-card-item">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="rgb(255, 255, 255)" d="M224.2 89C216.3 70.1 195.7 60.1 176.1 65.4L170.6 66.9C106 84.5 50.8 147.1 66.9 223.3C104 398.3 241.7 536 416.7 573.1C493 589.3 555.5 534 573.1 469.4L574.6 463.9C580 444.2 569.9 423.6 551.1 415.8L453.8 375.3C437.3 368.4 418.2 373.2 406.8 387.1L368.2 434.3C297.9 399.4 241.3 341 208.8 269.3L253 233.3C266.9 222 271.6 202.9 264.8 186.3L224.2 89z"/></svg>
                        <span>{phone}</span></div>
                    <div className="shul-card-item">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="rgb(255, 255, 255)" d="M320 128C214 128 128 214 128 320C128 426 214 512 320 512C337.7 512 352 526.3 352 544C352 561.7 337.7 576 320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320L576 352C576 405 533 448 480 448C450.7 448 424.4 434.8 406.8 414.1C384 435.1 353.5 448 320 448C249.3 448 192 390.7 192 320C192 249.3 249.3 192 320 192C347.9 192 373.7 200.9 394.7 216.1C400.4 211.1 407.8 208 416 208C433.7 208 448 222.3 448 240L448 352C448 369.7 462.3 384 480 384C497.7 384 512 369.7 512 352L512 320C512 214 426 128 320 128zM384 320C384 284.7 355.3 256 320 256C284.7 256 256 284.7 256 320C256 355.3 284.7 384 320 384C355.3 384 384 355.3 384 320z"/></svg>
                        <span>{email}</span></div>
                    <div className="shul-card-item">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="rgb(255, 255, 255)" d="M451.5 160C434.9 160 418.8 164.5 404.7 172.7C388.9 156.7 370.5 143.3 350.2 133.2C378.4 109.2 414.3 96 451.5 96C537.9 96 608 166 608 252.5C608 294 591.5 333.8 562.2 363.1L491.1 434.2C461.8 463.5 422 480 380.5 480C294.1 480 224 410 224 323.5C224 322 224 320.5 224.1 319C224.6 301.3 239.3 287.4 257 287.9C274.7 288.4 288.6 303.1 288.1 320.8C288.1 321.7 288.1 322.6 288.1 323.4C288.1 374.5 329.5 415.9 380.6 415.9C405.1 415.9 428.6 406.2 446 388.8L517.1 317.7C534.4 300.4 544.2 276.8 544.2 252.3C544.2 201.2 502.8 159.8 451.7 159.8zM307.2 237.3C305.3 236.5 303.4 235.4 301.7 234.2C289.1 227.7 274.7 224 259.6 224C235.1 224 211.6 233.7 194.2 251.1L123.1 322.2C105.8 339.5 96 363.1 96 387.6C96 438.7 137.4 480.1 188.5 480.1C205 480.1 221.1 475.7 235.2 467.5C251 483.5 269.4 496.9 289.8 507C261.6 530.9 225.8 544.2 188.5 544.2C102.1 544.2 32 474.2 32 387.7C32 346.2 48.5 306.4 77.8 277.1L148.9 206C178.2 176.7 218 160.2 259.5 160.2C346.1 160.2 416 230.8 416 317.1C416 318.4 416 319.7 416 321C415.6 338.7 400.9 352.6 383.2 352.2C365.5 351.8 351.6 337.1 352 319.4C352 318.6 352 317.9 352 317.1C352 283.4 334 253.8 307.2 237.5z"/></svg>
                        <span>{website}</span></div>
                    <div className="shul-card-item">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill="rgb(255, 255, 255)" d="M305 151.1L320 171.8L335 151.1C360 116.5 400.2 96 442.9 96C516.4 96 576 155.6 576 229.1L576 231.7C576 343.9 436.1 474.2 363.1 529.9C350.7 539.3 335.5 544 320 544C304.5 544 289.2 539.4 276.9 529.9C203.9 474.2 64 343.9 64 231.7L64 229.1C64 155.6 123.6 96 197.1 96C239.8 96 280 116.5 305 151.1z"/></svg>
                        <span>{donation}</span></div>
                </div>
            </div>

            <main className="shul-settings">
                <aside>
                    Admin Naviagtion
                </aside>

                <div className="settings-view">
                    <h1>Update Your Shul</h1>
                    <dl className="shul-settings-details">
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
                </div>
            </main>
        </div>
    )
}
