import { NUM_VERSES, subtractVerses } from '@hebcal/leyning';
import type { TanakhBook } from '@hebcal/leyning';

const books = Object.keys(NUM_VERSES).sort((a, b) => b.length - a.length);
const counts = new Map<string, number | null>();

/** Counts inclusive ranges, including semicolon-separated passages and books.
 * Missing or malformed references return null rather than an invented count.
 */
export function countVerses(reference: string | null | undefined): number | null {
    if (!reference?.trim() || reference.trim() === 'null') return null;
    const normalized = reference.trim().replace(/[–—]/g, '-');
    if (counts.has(normalized)) return counts.get(normalized)!;
    let book: string | undefined;
    let total = 0;
    for (const passage of normalized.split(';')) {
        let range = passage.trim();
        const namedBook = books.find(name => range.startsWith(`${name} `));
        if (namedBook) {
            book = namedBook;
            range = range.slice(namedBook.length).trim();
        }
        const match = /^(\d+):(\d+)(?:\s*-\s*(?:(\d+):)?(\d+))?$/.exec(range);
        if (!book || !match) return remember(null);
        const startChapter = Number(match[1]);
        const startVerse = Number(match[2]);
        const endChapter = match[3] ? Number(match[3]) : startChapter;
        const endVerse = match[4] ? Number(match[4]) : startVerse;
        const chapters = NUM_VERSES[book];
        if (startChapter < 1 || endChapter < startChapter
            || !chapters[startChapter] || !chapters[endChapter]
            || startVerse < 1 || startVerse > chapters[startChapter]
            || endVerse < 1 || endVerse > chapters[endChapter]
            || (startChapter === endChapter && endVerse < startVerse)) return remember(null);
        total += subtractVerses(book as TanakhBook, `${startChapter}:${startVerse}`, `${endChapter}:${endVerse}`) + 1;
    }
    return remember(total);

    function remember(value: number | null): number | null {
        counts.set(normalized, value);
        return value;
    }
}
