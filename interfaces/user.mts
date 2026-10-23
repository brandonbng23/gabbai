export interface UserReading {
    dateString: string;
    desc: string;
    aliyah: number;
    // Resolved dates and verse details are included by the user profile endpoint.
    gregDate?: string | null;
    hDate?: string | null;
    psukim?: string | null;
    verseCount?: number | null;
}

export interface User {
    id: string;
    shulId: string | null;
    firstName: string;
    lastName: string;
    hebrewName: string;
    email: string;
    phone: string;
    role: 'member' | 'admin' | 'guest';
    title: string;
    pictureUrl?: string;
    settings: Record<string, unknown>;
    // Derived from saved assignments; never includes nested reader profiles.
    assignedReadings: UserReading[];
}

export type ShulUser = Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'role' | 'title' | 'pictureUrl' | 'assignedReadings'>;

export type UserViewProfile = Pick<User, 'id' | 'firstName' | 'lastName' | 'hebrewName' | 'title' | 'pictureUrl' | 'role' | 'assignedReadings'> & {
    shulName: string;
    assignedReadingCount: number;
};
