export interface ShulSummary {
    id: string;
    name: string;
}

export interface Shul extends ShulSummary {
    websiteUrl: string;
    donationUrl: string;
    email: string;
    phone: string;
    address: string;
    settings: {
        hebYear: number;
        il: boolean;
        a: number;
        hhRespect: boolean;
        yRespect: boolean;
        specialSeventh: boolean;
        yontifs: Record<string, boolean>;
        triennial: { tri: boolean; triMaftir: boolean; tradMaftir: boolean; yitro: boolean; vaetchanan: boolean };
    };
}

export interface User {
    id: string;
    shulId: string;
    firstName: string;
    lastName: string;
    hebrewName: string;
    email: string;
    phone: string;
    role: 'member' | 'admin';
    title: string;
    settings: Record<string, unknown>;
}

export type ShulInfo = Pick<Shul, 'name' | 'address' | 'phone' | 'email' | 'websiteUrl' | 'donationUrl'>;

export async function updateShul(id: string, info: ShulInfo): Promise<Shul> {
    const response = await fetch(`/api/shuls/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(info),
    });
    if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw new Error(failure?.error || 'Unable to save your shul. Please try again.');
    }
    return response.json();
}

export async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
    const response = await fetch(path, { signal });
    if (!response.ok) throw new Error('Unable to load your shul. Please try again.');
    return response.json();
}

export async function getCurrentUser(signal: AbortSignal): Promise<User | null> {
    const response = await fetch('/api/me', { signal });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error('Unable to load your profile. Please try again.');
    return response.json();
}

