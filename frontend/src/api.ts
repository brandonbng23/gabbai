import type { Yontifs } from '../../interfaces/yontifs.mts';

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
        yontifs: Yontifs;
        triennial: { tri: boolean; triMaftir: boolean; tradMaftir: boolean; yitro: boolean; vaetchanan: boolean };
    };
}

export type Settings = Shul['settings'];
export type SettingsPatch = Partial<Omit<Settings, 'yontifs' | 'triennial'>> & {
    yontifs?: Partial<Settings['yontifs']>;
    triennial?: Partial<Settings['triennial']>;
};

export async function updateShulSettings(id: string, settings: SettingsPatch): Promise<Shul> {
    const response = await fetch(`/api/shuls/${encodeURIComponent(id)}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
    });
    if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw new Error(failure?.error || 'Unable to save reading settings. Please try again.');
    }
    return response.json();
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

export interface InitialShulVersion {
    info: ShulInfo;
    settings: Settings;
    source: 'creation' | 'migration';
    capturedAt: string;
}

export async function getInitialShulVersion(id: string): Promise<InitialShulVersion> {
    const response = await fetch(`/api/shuls/${encodeURIComponent(id)}/initial-version`, { cache: 'no-store' });
    if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw new Error(failure?.error || 'Unable to load the first saved version.');
    }
    return response.json();
}

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

