// Edit the donation highlight's wording here.
const donationMessage = {
    title: 'Support our community',
    message: 'Share this honor with your shul\'s future. Your genorosity ensures the next generation of Torah readers at your shul.',
    action: 'Make a donation',
};

export function donationHighlightLink(shulId?: string, donationUrl?: string): string | undefined {
    if (!shulId || !donationUrl) return;
    try {
        const url = new URL(donationUrl);
        if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password)
            return `/api/shuls/${encodeURIComponent(shulId)}/donate`;
    } catch { /* No donation card until the shul has a valid donation link. */ }
}

export function DonationHighlight({ href }: { href: string }) {
    return <a className="highlight-parsha-card" href={href} target="_blank" rel="noopener noreferrer">
        <span className="highlight-kind">From your shul</span>
        <strong className="highlight-card-name">{donationMessage.title}</strong>
        <span>{donationMessage.message}</span>
        <span className="highlight-occasion">{donationMessage.action} ↗</span>
    </a>;
}
