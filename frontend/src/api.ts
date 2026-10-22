import type { UserTitle } from '../../interfaces/titles.mts';
import type { User, ShulUser } from '../../interfaces/user.mts';
import type { Yontifs } from '../../interfaces/yontifs.mts';
import type { ParshaObj } from './Components/parsha.tsx';

export interface ReadingCountChange {
    dateString: string;
    desc: string;
    aliyahCount: number | null;
}

export interface ReadingLockChange {
    dateString: string;
    desc: string;
    locked: boolean;
    aliyah?: number;
}

export interface ReadingOccasionChange {
    dateString: string;
    desc: string;
    manualOccasions: string[];
}

export interface ReadingReaderChange {
    dateString: string;
    desc: string;
    aliyah: number;
    readerId: string | null;
}

export async function publishReadingLocks(shulId: string, changes: (ReadingLockChange | ReadingOccasionChange | ReadingReaderChange | ReadingCountChange)[]): Promise<ParshaObj[]> {
    const response = await fetch(`/api/shuls/${encodeURIComponent(shulId)}/readings/locks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
    });
    if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw new Error(failure?.error || 'Unable to publish reading adjustments. Please try again.');
    }
    return response.json();
}

export interface ShulSummary {
    id: string;
    name: string;
}

export interface Shul extends ShulSummary {
    pictureUrl?: string;
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

export type { User, ShulUser } from '../../interfaces/user.mts';

export type UserProfile = Pick<User, 'title' | 'firstName' | 'lastName' | 'hebrewName' | 'email' | 'phone'>;

export async function updateCurrentUser(changes: Partial<UserProfile> & { picture?: string | null }): Promise<User> {
    const response = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
    });
    if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw new Error(failure?.error || 'Unable to save your profile. Please try again.');
    }
    return response.json();
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

export async function updateShul(id: string, info: ShulInfo & { picture?: string | null }): Promise<Shul> {
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



export async function getShulUsers(id: string, signal: AbortSignal): Promise<ShulUser[]> {
    const response = await fetch(`/api/shuls/${encodeURIComponent(id)}/users`, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to load shul users. Please try again.');
    return response.json();
}

export interface GuestRegistration {
    title: UserTitle;
    firstName: string;
    lastName: string;
    hebrewName: string;
    email: string;
}

export async function registerForReading(shulId: string, reading: ParshaObj, aliyah: number, guest?: GuestRegistration): Promise<void> {
    const response = await fetch(`/api/shuls/${encodeURIComponent(shulId)}/readings/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateString: reading.dateString, desc: reading.desc, aliyah, ...(guest ? { guest } : {}) }),
    });
    if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw new Error(failure?.error || 'Unable to register. Please try again.');
    }
}
