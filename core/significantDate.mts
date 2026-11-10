import { HDate, getSedra } from '@hebcal/core';

export function parseSignificantDate(value: string): Date {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new TypeError('Choose a valid Gregorian date.');
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(2000, 0, 1, 12);
    date.setFullYear(year, month - 1, day);
    if (year < 1 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
        throw new TypeError('Choose a valid Gregorian date.');
    return date;
}

export function parshaForSignificantDate(value: string, israel = false) {
    const shabbat = new HDate(parseSignificantDate(value)).onOrAfter(6);
    const result = getSedra(shabbat.getFullYear(), israel).lookup(shabbat);
    const date = shabbat.greg();
    const shabbatDate = `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (result.chag) throw new TypeError(`The upcoming Shabbat (${shabbatDate}) has a festival reading (${result.parsha.join('–')}) instead of a weekly parsha. Choose a parsha directly or use another date.`);
    return { portion: result.parsha.join('-'), shabbatDate };
}

export function formatSignificantDate(value: string): string {
    return parseSignificantDate(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
