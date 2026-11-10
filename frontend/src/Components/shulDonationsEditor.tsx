import { defaultDonationSettings, validateDonationDisplaySettings, withDonationDefaults } from '../../../interfaces/donation.mts';
import type { DonationDisplaySettings } from '../../../interfaces/donation.mts';
import { useEffect, useState } from 'react';
import type { SubmitEvent } from 'react';
import { updateShul } from '../api.ts';
import type { Shul } from '../api.ts';
import { DonationHighlight, RegistrationDonationBanner } from './donationHighlight.tsx';

export function ShulDonationsEditor({ shul, onSaved }: { shul: Shul; onSaved: (shul: Shul) => void }) {
    const [url, setUrl] = useState(shul.donationUrl);
    const savedSettings = (): DonationDisplaySettings => withDonationDefaults({
        donationHeadline: shul.donationHeadline, donationMessage: shul.donationMessage,
        donationHighlightEnabled: shul.donationHighlightEnabled, donationBannerEnabled: shul.donationBannerEnabled,
    });
    const [settings, setSettings] = useState<DonationDisplaySettings>(savedSettings);
    const publishedSettings = savedSettings();
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);
    const changes: string[] = [];
    for (const field of [
        { label: 'Donation URL', value: url, saved: shul.donationUrl },
        { label: 'Headline', value: settings.donationHeadline, saved: publishedSettings.donationHeadline },
        { label: 'Message', value: settings.donationMessage, saved: publishedSettings.donationMessage },
    ]) {
        if (field.value !== field.saved) changes.push(`Changed ${field.label} to ${field.value ? `“${field.value}”` : '(empty)'}.`);
    }
    if (settings.donationHighlightEnabled !== publishedSettings.donationHighlightEnabled)
        changes.push(`${settings.donationHighlightEnabled ? 'Show' : 'Hide'} the donation card in schedule highlights.`);
    if (settings.donationBannerEnabled !== publishedSettings.donationBannerEnabled)
        changes.push(`${settings.donationBannerEnabled ? 'Show' : 'Hide'} the donation banner on reading registration.`);
    const changed = changes.length > 0;
    useEffect(() => {
        if (!changed) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [changed]);
    async function save(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving || !changed) return;
        setSaving(true); setFeedback(null);
        try {
            if (url.trim()) {
                const destination = new URL(url.trim());
                if (!['https:', 'http:'].includes(destination.protocol) || destination.username || destination.password)
                    throw new Error('Enter an HTTP or HTTPS donation URL without login credentials.');
            }
            const updated = await updateShul(shul.id, { donationUrl: url, ...validateDonationDisplaySettings(settings) });
            setUrl(updated.donationUrl); setSettings(withDonationDefaults(updated));
            onSaved(updated);
            setFeedback({ text: 'Donation settings published.' });
        } catch (error) {
            setFeedback({ error: true, text: error instanceof Error ? error.message : 'Unable to publish donation settings.' });
        } finally { setSaving(false); }
    }
    return <section className="content-panel" aria-labelledby="shul-donations-heading">
        <div className="settings-section-header"><div><h2 id="shul-donations-heading">Donations</h2>
            <p>Customize your donation headline and message, and choose where they appear.</p>
        </div></div>
        <form className="settings-edit-form" onSubmit={save} onChange={() => setFeedback(null)}>
            <fieldset className="settings-fieldset" disabled={saving}>
                <legend className="visually-hidden">Donation settings</legend>
                <div className="donation-settings-fields">
                    <div className="settings-field-edit"><label htmlFor="shul-donation-url">Donation URL</label>
                        <input id="shul-donation-url" type="url" value={url} maxLength={2048} placeholder="https://"
                            onChange={event => setUrl(event.target.value)} /></div>
                    <div className="settings-field-edit"><label htmlFor="shul-donation-headline">Headline</label>
                        <input id="shul-donation-headline" value={settings.donationHeadline} required maxLength={100}
                            onBlur={() => setSettings(previous => ({ ...previous, donationHeadline: previous.donationHeadline.trim() ? previous.donationHeadline : defaultDonationSettings.donationHeadline }))}
                            onChange={event => setSettings(previous => ({ ...previous, donationHeadline: event.target.value }))} /></div>
                    <div className="settings-field-edit donation-settings-message"><label htmlFor="shul-donation-message">Message</label>
                        <textarea id="shul-donation-message" value={settings.donationMessage} required maxLength={500} rows={3} aria-describedby="donation-message-count"
                            onBlur={() => setSettings(previous => ({ ...previous, donationMessage: previous.donationMessage.trim() ? previous.donationMessage : defaultDonationSettings.donationMessage }))}
                            onChange={event => setSettings(previous => ({ ...previous, donationMessage: event.target.value }))} />
                        <span id="donation-message-count" className="donation-message-count">{settings.donationMessage.length}/500 characters</span>
                    </div>
                </div>
                <div className="donation-default-action">
                    <button type="button" className="settings-reset-btn" aria-label="Reset headline and message to default"
                        disabled={settings.donationHeadline === defaultDonationSettings.donationHeadline && settings.donationMessage === defaultDonationSettings.donationMessage}
                        onClick={() => {
                            setSettings(previous => ({ ...previous, donationHeadline: defaultDonationSettings.donationHeadline, donationMessage: defaultDonationSettings.donationMessage }));
                            setFeedback(null);
                        }}>Reset to default</button>
                </div>
                <div className="donation-previews">
                    <p className="donation-preview-caption">Changes appear after publishing.</p>
                    <h3 className="donation-preview-heading">Schedule highlight</h3>
                    <div className="donation-display-switch">
                        <button type="button" className="donation-visibility-toggle" role="switch" aria-checked={settings.donationHighlightEnabled}
                            onClick={() => { setSettings(previous => ({ ...previous, donationHighlightEnabled: !previous.donationHighlightEnabled })); setFeedback(null); }}>
                            <span className="donation-visibility-track" aria-hidden="true" />
                            <span>Show donation card in schedule highlights</span>
                        </button>
                    </div>
                    <div className="donation-highlight-preview"><DonationHighlight href="" settings={settings} preview /></div>
                    <h3 className="donation-preview-heading">Reading registration banner</h3>
                    <div className="donation-display-switch">
                        <button type="button" className="donation-visibility-toggle" role="switch" aria-checked={settings.donationBannerEnabled}
                            onClick={() => { setSettings(previous => ({ ...previous, donationBannerEnabled: !previous.donationBannerEnabled })); setFeedback(null); }}>
                            <span className="donation-visibility-track" aria-hidden="true" />
                            <span>Show donation banner on reading registration</span>
                        </button>
                    </div>
                    <div className="registration-page donation-banner-preview"><RegistrationDonationBanner href="" settings={settings} preview /></div>
                </div>
                <div className="settings-form-footer">
                    <div className="change-log">
                        <h5>Section Change Log</h5>
                        {changes.length ? <ul>{changes.map(change => <li key={change}>{change}</li>)}</ul> : 'Your changes will be summarized here.'}
                    </div>
                    <div className="settings-footer-actions">
                        <div className="settings-footer-buttons">
                            <button type="button" className="settings-reset-btn" disabled={!changed} onClick={() => {
                                setUrl(shul.donationUrl); setSettings(savedSettings()); setFeedback(null);
                            }}>Reset changes</button>
                            <button type="submit" className="submit-btn" disabled={!changed}>{saving ? 'Publishing…' : 'Publish Changes'}</button>
                        </div>
                        <div className="event-feedback" role={feedback?.error ? 'alert' : 'status'}>{feedback?.text}</div>
                    </div>
                </div>
            </fieldset>
        </form>
    </section>;
}
