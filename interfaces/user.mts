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

export type ShulUser = Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'role' | 'title'>;
