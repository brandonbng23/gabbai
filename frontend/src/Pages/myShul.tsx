import type { Shul } from '../api';

function publicLink(value: string): string | undefined {
    try {
        const url = new URL(value);
        return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
    } catch {
        return undefined;
    }
}

export default function MyShul({ shul }: { shul: Shul }) {
    const settings = shul.settings;
    const website = publicLink(shul.websiteUrl);
    const donation = publicLink(shul.donationUrl);
    return (
        <main className="aliyah-registration">
            <h1>{shul.name}</h1>
            <dl className="registration-details">
                <h5>Shul Information</h5>
                {shul.address && <div><dt>Address</dt><dd>{shul.address}</dd></div>}
                {shul.email && <div><dt>Email</dt><dd>{shul.email}</dd></div>}
                {shul.phone && <div><dt>Phone</dt><dd>{shul.phone}</dd></div>}
                {website && <div><dt>Website</dt><dd><a href={website}>Visit website</a></dd></div>}
                {donation && <div><dt>Donations</dt><dd><a href={donation}>Support your shul</a></dd></div>}
                {!shul.address && !shul.email && !shul.phone && !website && !donation
                    && <div>Contact information hasn’t been added yet.</div>}
            </dl>
            <dl className="registration-details">
                <h5>Reading Schedule</h5>
                <div><dt>Hebrew Year</dt><dd>{settings.hebYear}</dd></div>
                <div><dt>Calendar</dt><dd>{settings.il ? 'Israel' : 'Diaspora'}</dd></div>
                <div><dt>Aliyot</dt><dd>{settings.a}</dd></div>
                <div><dt>Reading Cycle</dt><dd>{settings.triennial.tri ? 'Triennial' : 'Annual'}</dd></div>
                <div><dt>Maftir</dt><dd>{settings.triennial.triMaftir ? 'Triennial' : settings.triennial.tradMaftir ? 'Traditional' : 'Disabled'}</dd></div>
                <div><dt>Traditional Holiday Aliyah Counts</dt><dd>{settings.yRespect ? 'Enabled' : 'Disabled'}</dd></div>
            </dl>
        </main>
    );
}
