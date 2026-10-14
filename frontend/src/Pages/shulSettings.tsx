import type { Shul } from '../api.js';

export default function ShulSettings({ shul }: { shul: Shul }): React.JSX.Element {
    const settings = shul.settings;

    return (
        <main>
            <h1>Shul Settings</h1>

            <dl className="registration-details">
                <h5>Shul Information</h5>
                {shul.address && <div><dt>Address</dt><dd>{shul.address}</dd></div>}
            </dl>
        </main>
    )
}