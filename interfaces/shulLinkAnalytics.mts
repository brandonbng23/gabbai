export interface ShulLinkAnalytics {
    currentEventCount: number;
    eventRegistrationClicks: number;
    donationClicks: number;
    eventRegistrationByEvent: Record<string, number>;
}
