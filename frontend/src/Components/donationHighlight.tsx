import { withDonationDefaults } from '../../../interfaces/donation.mts';
import type { DonationDisplaySettings } from '../../../interfaces/donation.mts';

export function donationHighlightLink(shulId?: string, donationUrl?: string): string | undefined {
    if (!shulId || !donationUrl) return;
    try {
        const url = new URL(donationUrl);
        if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password)
            return `/api/shuls/${encodeURIComponent(shulId)}/donate`;
    } catch { /* No donation card until the shul has a valid donation link. */ }
}

export function DonationHighlight({ href, settings, preview = false }: { href: string; settings?: DonationDisplaySettings; preview?: boolean }) {
    const text = withDonationDefaults(settings);
    return <a className="highlight-parsha-card" href={preview ? undefined : href} target="_blank" rel="noopener noreferrer">
        <span className="highlight-kind">From your shul</span>
        <strong className="highlight-card-name">{text.donationHeadline}</strong>
        <span>{text.donationMessage}</span>
        <span className="highlight-occasion">Make a donation ↗</span>
    </a>;
}

export function RegistrationDonationBanner({ href, settings, preview = false }: { href: string; settings?: DonationDisplaySettings; preview?: boolean }) {
    const text = withDonationDefaults(settings);
    return <aside className="registration-donation-banner" aria-labelledby="registration-donation-heading">
        <div className="registration-donation-copy">
            <h2 id="registration-donation-heading">{text.donationHeadline}</h2>
            <p>{text.donationMessage}</p>
        </div>
        <a className="registration-donation-link" href={preview ? undefined : href} target="_blank" rel="noopener noreferrer">Make a donation ↗</a>
    </aside>;
}
