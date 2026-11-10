export interface ShulEventInput {
    name: string;
    date: string;
    time: string;
    location: string;
    registrationLink: string;
    details: string;
}

export interface ShulEvent extends ShulEventInput {
    id: string;
    shulId: string;
}

export function validateShulEvent(input: unknown): ShulEventInput {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Provide event details.');
    const values = input as Record<string, unknown>;
    const limits = { name: 120, date: 10, time: 5, location: 200, registrationLink: 2048, details: 2000 };
    if (Object.keys(values).some(key => !Object.hasOwn(limits, key))) throw new TypeError('Unknown event field.');
    const result = {} as ShulEventInput;
    for (const [key, limit] of Object.entries(limits)) {
        const value = values[key] ?? '';
        if (typeof value !== 'string' || value.length > limit) throw new TypeError(`${key} must be at most ${limit} characters.`);
        result[key as keyof ShulEventInput] = value.trim();
    }
    if (!result.name || !result.location) throw new TypeError('Enter an event name and location.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result.date) || result.date < '0001-01-01'
        || !Number.isFinite(Date.parse(result.date)) || new Date(result.date).toISOString().slice(0, 10) !== result.date)
        throw new TypeError('Choose a valid event date.');
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(result.time)) throw new TypeError('Choose a valid event time.');
    if (result.registrationLink) {
        try {
            const url = new URL(result.registrationLink);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
        } catch { throw new TypeError('Use an http or https registration link.'); }
    }
    return result;
}

export function formatEventDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    const value = new Date(2000, 0, 1, 12);
    value.setFullYear(year, month - 1, day);
    return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatEventTime(time: string): string {
    const [hour, minute] = time.split(':').map(Number);
    return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
