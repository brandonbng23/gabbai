import type { ReadingLockChange, ReadingOccasionChange, ReadingReaderChange, ShulUser } from './api.ts';
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

export function previewReadingLocks(reading: ParshaObj, drafts: ReadingDrafts, occasions: OccasionDrafts = {}, readers: ReaderDrafts = {}): ParshaObj {
    const preview = { ...reading, lockedArr: [...reading.lockedArr], readers: [...(reading.readers ?? [])], manualOccasions: occasions[readingKey(reading)]?.manualOccasions ?? reading.manualOccasions ?? [] };
    for (const change of Object.values(drafts)) {
        if (readingKey(change) !== readingKey(reading)) continue;
        if (change.aliyah === undefined) preview.locked = change.locked;
        else preview.lockedArr[change.aliyah - 1] = change.locked;
    }
    for (const change of Object.values(readers)) {
        if (readingKey(change) === readingKey(reading)) preview.readers[change.aliyah - 1] = change.reader;
    }
    return preview;
}

export type OccasionDrafts = Record<string, ReadingOccasionChange>;

export function stageReadingOccasions(drafts: OccasionDrafts, saved: ParshaObj, labels: string[]): OccasionDrafts {
    const next = { ...drafts };
    const key = readingKey(saved);
    if (JSON.stringify(labels) === JSON.stringify(saved.manualOccasions ?? [])) delete next[key];
    else next[key] = { dateString: saved.dateString, desc: saved.desc, manualOccasions: [...labels] };
    return next;
}

export function pendingReadingOccasions(drafts: OccasionDrafts, schedule: ParshaObj[]): ReadingOccasionChange[] {
    const saved = new Map(schedule.map(reading => [readingKey(reading), reading]));
    return Object.values(drafts).filter(change => {
        const reading = saved.get(readingKey(change));
        return !reading || JSON.stringify(change.manualOccasions) !== JSON.stringify(reading.manualOccasions ?? []);
    });
}

export function reorderManualOccasions(labels: string[], source: string, target: string): string[] {
    const from = labels.indexOf(source);
    const to = labels.indexOf(target);
    if (from < 0 || to < 0 || from === to) return labels;
    const next = [...labels];
    next.splice(from, 1);
    next.splice(to, 0, source);
    return next;
}

export type ReaderDrafts = Record<string, ReadingReaderChange & { reader: ShulUser | null }>;

export function stageReadingReader(drafts: ReaderDrafts, saved: ParshaObj, aliyah: number, reader: ShulUser | null): ReaderDrafts {
    const key = JSON.stringify([saved.dateString, saved.desc, aliyah]);
    const next = { ...drafts };
    if ((saved.readers[aliyah - 1]?.id ?? null) === (reader?.id ?? null)) delete next[key];
    else next[key] = { dateString: saved.dateString, desc: saved.desc, aliyah, readerId: reader?.id ?? null, reader };
    return next;
}

export function pendingReadingReaders(drafts: ReaderDrafts, schedule: ParshaObj[]): ReadingReaderChange[] {
    const saved = new Map(schedule.map(reading => [readingKey(reading), reading]));
    return Object.values(drafts).filter(change => {
        const reading = saved.get(readingKey(change));
        return !reading || (reading.readers[change.aliyah - 1]?.id ?? null) !== change.readerId;
    }).map(({ dateString, desc, aliyah, readerId }) => ({ dateString, desc, aliyah, readerId }));
}
