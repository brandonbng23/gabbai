import { ProfilePicture } from '../Components/profilePicture.tsx';
import type { Shul } from '../api.js';

function publicLink(value: string): string | undefined {
    try {
        const url = new URL(value);
        return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
    } catch {
        return undefined;
    }
}

export default function MyShul({ shul }: { shul: Shul }): React.JSX.Element {
    const settings = shul.settings;
    const website = publicLink(shul.websiteUrl);
    const donation = publicLink(shul.donationUrl);
    return (
        <main className="aliyah-registration">
            <div className="profile-picture-heading">
                <ProfilePicture src={shul.pictureUrl} name={shul.name} square />
                <h1>{shul.name}</h1>
            </div>
            <dl className="registration-details">
                <h5>Shul Information</h5>
                {shul.address && <div><dt>Address</dt><dd>{shul.address}</dd></div>}
                {shul.phone && <div><dt>Phone</dt><dd>{shul.phone}</dd></div>}
                {shul.email && <div><dt>Email</dt><dd><a href={`mailto:${shul.email}`}>{shul.email}</a></dd></div>}
                {website && <div><dt>Website</dt><dd><a href={website}>{website}</a></dd></div>}
                {donation && <div><dt>Donations</dt><dd><a href={donation}>{donation}</a></dd></div>}
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
                <div><dt>Traditional Yontif Aliyah Counts</dt><dd>{settings.yRespect ? 'Enabled' : 'Disabled'}</dd></div>
            </dl>
        </main>
    );
}
