import { parseSignificantDate } from '../core/significantDate.mts';

export interface SignificantPortion {
    portion: string;
    occasion: string;
    gregorianDate?: string;
}

export const significantPortionLimit = 20;

export function validateSignificantPortions(value: unknown): SignificantPortion[] {
    if (!Array.isArray(value) || value.length > significantPortionLimit)
        throw new TypeError(`Save up to ${significantPortionLimit} significant parshiyot.`);
    return value.map(entry => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)
            || Object.keys(entry).some(key => !['portion', 'occasion', 'gregorianDate'].includes(key)))
            throw new TypeError('Provide a parsha and an optional occasion.');
        if (typeof entry.portion !== 'string' || !entry.portion.trim() || entry.portion.length > 100)
            throw new TypeError('Parsha must be 1–100 characters.');
        if (typeof entry.occasion !== 'string' || entry.occasion.length > 200)
            throw new TypeError('Occasion must be at most 200 characters.');
        if ('gregorianDate' in entry) parseSignificantDate(entry.gregorianDate);
        return { portion: entry.portion.trim(), occasion: entry.occasion.trim(),
            ...('gregorianDate' in entry ? { gregorianDate: entry.gregorianDate } : {}) };
    });
}
