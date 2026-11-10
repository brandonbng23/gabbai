export const ALIYAH_NOTE_MAX_LENGTH = 120;

export function validateAliyahNote(value: unknown): string {
    if (typeof value !== 'string' || value.length > ALIYAH_NOTE_MAX_LENGTH || /[\r\n\u2028\u2029]/u.test(value)) {
        throw new TypeError(`An aliyah note must be a single line of at most ${ALIYAH_NOTE_MAX_LENGTH} characters.`);
    }
    return value.trim();
}
