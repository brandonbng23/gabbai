export interface DonationDisplaySettings {
    donationHeadline: string;
    donationMessage: string;
    donationHighlightEnabled: boolean;
    donationBannerEnabled: boolean;
}

export const defaultDonationSettings: DonationDisplaySettings = {
    donationHeadline: 'Support our community',
    donationMessage: "Share this honor with your shul's future. Your generosity ensures the next generation of Torah readers at your shul.",
    donationHighlightEnabled: true,
    donationBannerEnabled: true,
};

export function withDonationDefaults(settings: Partial<DonationDisplaySettings> = {}): DonationDisplaySettings {
    return {
        donationHeadline: settings.donationHeadline?.trim() ? settings.donationHeadline : defaultDonationSettings.donationHeadline,
        donationMessage: settings.donationMessage?.trim() ? settings.donationMessage : defaultDonationSettings.donationMessage,
        donationHighlightEnabled: settings.donationHighlightEnabled ?? defaultDonationSettings.donationHighlightEnabled,
        donationBannerEnabled: settings.donationBannerEnabled ?? defaultDonationSettings.donationBannerEnabled,
    };
}

export function validateDonationDisplaySettings(input: Partial<DonationDisplaySettings>): DonationDisplaySettings {
    const settings = { ...defaultDonationSettings, ...input };
    for (const [key, limit] of [['donationHeadline', 100], ['donationMessage', 500]] as const) {
        if (typeof settings[key] !== 'string' || !settings[key].trim() || settings[key].trim().length > limit)
            throw new TypeError(`${key === 'donationHeadline' ? 'Donation headline' : 'Donation message'} must contain 1–${limit} characters.`);
        settings[key] = settings[key].trim();
    }
    for (const key of ['donationHighlightEnabled', 'donationBannerEnabled'] as const)
        if (typeof settings[key] !== 'boolean') throw new TypeError(`${key} must be a boolean.`);
    return settings;
}
