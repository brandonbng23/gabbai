import type { ReadingCountChange, ReadingLockChange, ReadingOccasionChange, ReadingReaderChange, ReadingNoteChange, ShulUser } from './api.ts';
import type { ParshaObj } from './Components/parsha.tsx';
import { countVerses } from '../../core/verseCount.mts';
import { validateAliyahNote } from '../../interfaces/readingNote.mts';

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

export function previewReadingLocks(reading: ParshaObj, drafts: ReadingDrafts, occasions: OccasionDrafts = {}, readers: ReaderDrafts = {}, counts: CountDrafts = {}, notes: NoteDrafts = {}): ParshaObj {
    const preview = { ...reading, lockedArr: [...reading.lockedArr], readers: [...(reading.readers ?? [])], manualOccasions: occasions[readingKey(reading)]?.manualOccasions ?? reading.manualOccasions ?? [] };
    const countChange = counts[readingKey(reading)];
    if (countChange && reading.aliyahOptions) {
        preview.aliyahCountOverride = countChange.aliyahCount;
        preview.aliyahCount = countChange.aliyahCount ?? reading.defaultAliyahCount;
        preview.psukim = reading.aliyahOptions[(preview.aliyahCount ?? 1) - 1];
        preview.verseCounts = preview.psukim.map(countVerses);
    }
    for (const change of Object.values(drafts)) {
        if (readingKey(change) !== readingKey(reading)) continue;
        if (change.aliyah === undefined) preview.locked = change.locked;
        else preview.lockedArr[change.aliyah - 1] = change.locked;
    }
    for (const change of Object.values(readers)) {
        if (readingKey(change) === readingKey(reading)) preview.readers[change.aliyah - 1] = change.reader;
    }
    for (const change of Object.values(notes)) {
        if (readingKey(change) !== readingKey(reading)) continue;
        preview.aliyahNotes ??= reading.psukim.map(() => '');
        preview.aliyahNotes = [...preview.aliyahNotes];
        preview.aliyahNotes[change.aliyah - 1] = change.note;
    }
    return preview;
}

export type NoteDrafts = Record<string, ReadingNoteChange>;

export type NoteScope = 'aliyah' | 'parsha';
type NoteSnapshot = Record<string, ReadingNoteChange | undefined>;
export interface NoteApplication {
    scope: NoteScope;
    previous: NoteSnapshot;
    applied: NoteSnapshot;
}
export interface NoteDraftState {
    drafts: NoteDrafts;
    applications: Record<string, NoteApplication>;
}

export function readingNoteKey(reading: Pick<ParshaObj, 'dateString' | 'desc'>, aliyah: number): string {
    return JSON.stringify([reading.dateString, reading.desc, aliyah]);
}

export function stageReadingNote(drafts: NoteDrafts, saved: ParshaObj, aliyah: number, note: string): NoteDrafts {
    const key = readingNoteKey(saved, aliyah);
    const next = { ...drafts };
    if (note === (saved.aliyahNotes?.[aliyah - 1] ?? '')) delete next[key];
    else next[key] = { dateString: saved.dateString, desc: saved.desc, aliyah, note };
    return next;
}

export function pendingReadingNotes(drafts: NoteDrafts, schedule: ParshaObj[]): ReadingNoteChange[] {
    const saved = new Map(schedule.map(reading => [readingKey(reading), reading]));
    return Object.values(drafts).filter(change => !saved.has(readingKey(change))
        || change.note.trim() !== (saved.get(readingKey(change))?.aliyahNotes?.[change.aliyah - 1] ?? ''))
        .map(change => ({ ...change, note: change.note.trim() }));
}

export function stageAliyahNotes(drafts: NoteDrafts, schedule: ParshaObj[], aliyah: number, note: string, counts: CountDrafts = {}): NoteDrafts {
    const text = validateAliyahNote(note);
    if (!text || !Number.isInteger(aliyah) || aliyah < 1 || aliyah > 9) return drafts;
    return schedule.reduce((next, saved) => {
        const preview = previewReadingLocks(saved, {}, {}, {}, counts);
        const passage = preview.psukim[aliyah - 1];
        return passage?.trim() && passage !== 'null' ? stageReadingNote(next, saved, aliyah, text) : next;
    }, drafts);
}

function restoreNoteApplication(state: NoteDraftState, sourceKey: string): NoteDraftState {
    const application = state.applications[sourceKey];
    if (!application) return state;
    const drafts = { ...state.drafts };
    const applications = { ...state.applications };
    const order = Object.keys(applications);
    const laterApplications = order.slice(order.indexOf(sourceKey) + 1);
    for (const key of Object.keys(application.applied)) {
        if (key === sourceKey) continue;
        // Remove this scope from the history beneath any later overlapping scope.
        const laterKey = laterApplications.find(owner => Object.hasOwn(applications[owner].applied, key));
        if (laterKey) {
            const later = applications[laterKey];
            if (later.previous[key]?.note === application.applied[key]?.note) {
                applications[laterKey] = { ...later, previous: { ...later.previous, [key]: application.previous[key] } };
            }
            continue;
        }
        // Keep any later individual edits to other notes.
        if (drafts[key]?.note !== application.applied[key]?.note) continue;
        const previous = application.previous[key];
        if (previous) drafts[key] = previous;
        else delete drafts[key];
    }
    delete applications[sourceKey];
    return { drafts, applications };
}

export function editReadingNote(state: NoteDraftState, saved: ParshaObj, aliyah: number, note: string): NoteDraftState {
    const sourceKey = readingNoteKey(saved, aliyah);
    const restored = restoreNoteApplication(state, sourceKey);
    return { drafts: stageReadingNote(restored.drafts, saved, aliyah, note), applications: restored.applications };
}

export function toggleNoteApplication(state: NoteDraftState, schedule: ParshaObj[], source: ParshaObj, aliyah: number,
    note: string, scope: NoteScope, counts: CountDrafts = {}): NoteDraftState {
    const text = validateAliyahNote(note);
    if (!Number.isInteger(aliyah) || aliyah < 1 || aliyah > 9) return state;
    const sourceKey = readingNoteKey(source, aliyah);
    const previousApplication = state.applications[sourceKey];
    if (!text && previousApplication?.scope !== scope) return state;
    const restored = restoreNoteApplication(state, sourceKey);
    let drafts = restored.drafts;
    const applications = { ...restored.applications };
    if (previousApplication?.scope === scope) return { drafts, applications };

    const targets = schedule.flatMap(saved => {
        if (scope === 'parsha' && readingKey(saved) !== readingKey(source)) return [];
        const preview = previewReadingLocks(saved, {}, {}, {}, counts);
        return preview.psukim.flatMap((passage, index) =>
            passage?.trim() && passage !== 'null' && (scope === 'parsha' || index + 1 === aliyah)
                ? [{ saved, aliyah: index + 1 }] : []);
    });
    if (targets.length === 0) return state;
    const previous: NoteSnapshot = {};
    for (const target of targets) previous[readingNoteKey(target.saved, target.aliyah)] = drafts[readingNoteKey(target.saved, target.aliyah)];
    drafts = scope === 'aliyah' ? stageAliyahNotes(drafts, schedule, aliyah, text, counts)
        : targets.reduce((next, target) => stageReadingNote(next, target.saved, target.aliyah, text), drafts);
    const applied: NoteSnapshot = {};
    for (const key of Object.keys(previous)) applied[key] = drafts[key];
    applications[sourceKey] = { scope, previous, applied };
    return { drafts, applications };
}

export function noteChangeLog(state: NoteDraftState, schedule: ParshaObj[]): string[] {
    const labels = ['Rishon', 'Sheni', 'Shlishi', "Revi'i", 'Chamishi', 'Shishi', "Shvi'i", 'Maftir', 'Haftarah'];
    const saved = new Map(schedule.map(reading => [readingKey(reading), reading]));
    const remaining = new Map(pendingReadingNotes(state.drafts, schedule)
        .map(change => [readingNoteKey(change, change.aliyah), change]));
    const summaries: string[] = [];
    // The latest bulk action owns overlapping changes; individual edits remain separate.
    for (const [sourceKey, application] of Object.entries(state.applications).reverse()) {
        const grouped = [...remaining].filter(([key, change]) => application.applied[key]?.note.trim() === change.note);
        if (grouped.length === 0) continue;
        for (const [key] of grouped) remaining.delete(key);
        const [dateString, desc, aliyah] = JSON.parse(sourceKey) as [string, string, number];
        const reading = saved.get(readingKey({ dateString, desc }));
        const target = application.scope === 'aliyah' ? `${labels[aliyah - 1]} across the current schedule`
            : `all aliyot of ${desc} (${reading?.gregDate ?? dateString})`;
        const count = grouped.length;
        summaries.push(`Set the note for ${target} to “${grouped[0][1].note}” (${count} ${count === 1 ? 'aliyah' : 'aliyot'} changed).`);
    }
    return [...summaries.reverse(), ...[...remaining.values()].map(change => {
        const reading = saved.get(readingKey(change));
        const target = `${labels[change.aliyah - 1]} of ${change.desc} (${reading?.gregDate ?? change.dateString})`;
        return change.note ? `Set the note for ${target} to “${change.note}”.` : `Remove the note for ${target}.`;
    })];
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

export function occasionChangeLog(drafts: OccasionDrafts, schedule: ParshaObj[]): string[] {
    const saved = new Map(schedule.map(reading => [readingKey(reading), reading]));
    return pendingReadingOccasions(drafts, schedule).flatMap(change => {
        const reading = saved.get(readingKey(change));
        const before = reading?.manualOccasions ?? [];
        const after = change.manualOccasions;
        const target = `${change.desc} (${reading?.gregDate ?? change.dateString})`;
        if (!reading) return [`Set manually added occasions for ${target} to ${after.length ? after.map(label => `“${label}”`).join(', ') : 'none'}.`];
        const previousOrder = before.filter(label => after.includes(label));
        const nextOrder = after.filter(label => before.includes(label));
        const entries: string[] = [];
        if (JSON.stringify(previousOrder) !== JSON.stringify(nextOrder)) {
            entries.push(`Reorder manually added occasions for ${target}: ${after.map(label => `“${label}”`).join(', ')}.`);
        }
        for (const label of after.filter(label => !before.includes(label)))
            entries.push(`Add “${label}” to ${target}.`);
        for (const label of before.filter(label => !after.includes(label)))
            entries.push(`Remove “${label}” from ${target}.`);
        return entries;
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

export type CountDrafts = Record<string, ReadingCountChange>;

export function stageReadingCount(drafts: CountDrafts, saved: ParshaObj, aliyahCount: number | null): CountDrafts {
    const next = { ...drafts };
    const key = readingKey(saved);
    if (aliyahCount === (saved.aliyahCountOverride ?? null)) delete next[key];
    else next[key] = { dateString: saved.dateString, desc: saved.desc, aliyahCount };
    return next;
}

export function pendingReadingCounts(drafts: CountDrafts, schedule: ParshaObj[]): ReadingCountChange[] {
    const saved = new Map(schedule.map(reading => [readingKey(reading), reading]));
    return Object.values(drafts).filter(change => !saved.has(readingKey(change))
        || change.aliyahCount !== (saved.get(readingKey(change))?.aliyahCountOverride ?? null));
}
