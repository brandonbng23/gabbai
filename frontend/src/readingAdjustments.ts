import type { ReadingLockChange } from './api.ts';
import type { ParshaObj } from './Components/parsha.tsx';

export type ReadingDrafts = Record<string, ReadingLockChange>;

export function readingKey(reading: Pick<ParshaObj, 'dateString' | 'desc'>): string {
    return JSON.stringify([reading.dateString, reading.desc]);
}

export function stageReadingLock(drafts: ReadingDrafts, saved: ParshaObj, locked: boolean, aliyah?: number): ReadingDrafts {
    const key = JSON.stringify([saved.dateString, saved.desc, aliyah ?? 0]);
    const next = { ...drafts };
    const previous = aliyah === undefined ? saved.locked : saved.lockedArr[aliyah - 1];
    if (locked === previous) delete next[key];
    else next[key] = { dateString: saved.dateString, desc: saved.desc, locked, ...(aliyah === undefined ? {} : { aliyah }) };
    return next;
}

export function pendingReadingLocks(drafts: ReadingDrafts, schedule: ParshaObj[]): ReadingLockChange[] {
    const saved = new Map(schedule.map(reading => [readingKey(reading), reading]));
    return Object.values(drafts).filter(change => {
        const reading = saved.get(readingKey(change));
        // Retain missing readings for validation on publish, rather than silently losing edits.
        return !reading || change.locked !== (change.aliyah === undefined ? reading.locked : reading.lockedArr[change.aliyah - 1]);
    });
}

export function previewReadingLocks(reading: ParshaObj, drafts: ReadingDrafts): ParshaObj {
    const preview = { ...reading, lockedArr: [...reading.lockedArr] };
    for (const change of Object.values(drafts)) {
        if (readingKey(change) !== readingKey(reading)) continue;
        if (change.aliyah === undefined) preview.locked = change.locked;
        else preview.lockedArr[change.aliyah - 1] = change.locked;
    }
    return preview;
}
