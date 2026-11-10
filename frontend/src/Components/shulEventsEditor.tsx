import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EventDeletionConfirmation } from './eventDeletionConfirmation.tsx';
import type { SubmitEvent } from 'react';
import type { ShulEvent, ShulEventInput } from '../../../interfaces/shulEvent.mts';
import { formatEventDate, formatEventTime, validateShulEvent } from '../../../interfaces/shulEvent.mts';
import { deleteShulEvent, saveShulEvent } from '../shulEvents.ts';

const blank: ShulEventInput = { name: '', date: '', time: '', location: '', registrationLink: '', details: '' };
const fields = [
    { key: 'name', label: 'Event name', type: 'text', max: 120 },
    { key: 'date', label: 'Date', type: 'date', max: 10 },
    { key: 'time', label: 'Time', type: 'time', max: 5 },
    { key: 'location', label: 'Location', type: 'text', max: 200 },
    { key: 'registrationLink', label: 'Registration link (optional)', type: 'url', max: 2048 },
] as const;

export function ShulEventsEditor({ shulId, events, loading, error, onRetry, onChanged }: {
    shulId: string; events: ShulEvent[]; loading: boolean; error: string;
    onRetry: () => void; onChanged: (events: ShulEvent[]) => void;
}) {
    const [draft, setDraft] = useState<ShulEventInput>({ ...blank });
    const [editing, setEditing] = useState<string | null>(null);
    const [savedDraft, setSavedDraft] = useState<ShulEventInput>({ ...blank });
    const [busy, setBusy] = useState(false);
    const [deleting, setDeleting] = useState<ShulEvent | null>(null);
    const [feedback, setFeedback] = useState<{ error?: boolean; text: string } | null>(null);
    const form = useRef<HTMLFormElement>(null);
    const changed = JSON.stringify(draft) !== JSON.stringify(savedDraft);
    useEffect(() => {
        if (!changed) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [changed]);

    function reset() { setDraft({ ...blank }); setSavedDraft({ ...blank }); setEditing(null); }
    function showEditor() {
        requestAnimationFrame(() => {
            form.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
            form.current?.querySelector<HTMLInputElement>('#event-name')?.focus({ preventScroll: true });
        });
    }
    async function save(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setFeedback(null);
        try {
            const saved = await saveShulEvent(shulId, validateShulEvent(draft), editing ?? undefined);
            onChanged([...events.filter(event => event.id !== saved.id), saved].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)));
            reset();
            setFeedback({ text: 'Event published to My Shul and schedule highlights.' });
        } catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : 'Unable to save the event.' }); }
        finally { setBusy(false); }
    }
    async function remove(event: ShulEvent) {
        if (busy) return;
        setBusy(true); setFeedback(null);
        try {
            await deleteShulEvent(shulId, event.id);
            onChanged(events.filter(item => item.id !== event.id));
            if (editing === event.id) reset();
            setFeedback({ text: 'Event deleted.' });
        } catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : 'Unable to delete the event.' }); }
        finally { setBusy(false); }
    }
    return <section className="content-panel" aria-labelledby="shul-events-heading">
        <div className="settings-section-header"><div><h2 id="shul-events-heading">Featured Events</h2>
            <p>Publish events on My Shul and schedule highlights. Times are local to your shul.</p></div>
            <button type="button" className="submit-btn" disabled={busy || loading || Boolean(error)} onClick={() => {
                if (changed && !window.confirm('Discard your unsaved event changes?')) return;
                reset(); setFeedback(null); showEditor();
            }}>Add event</button>
        </div>
        {loading && <div className="event-feedback" role="status">Loading events…</div>}
        {error && <div className="event-feedback" role="alert">{error} <button type="button" onClick={onRetry}>Try again</button></div>}
        {!loading && !error && <>
            {events.length === 0 && <div className="event-feedback">No featured events yet. Add your first event below.</div>}
            {events.length > 0 && <ul className="shul-events-admin-list">{events.map(event => <li key={event.id}>
                <div><strong>{event.name}</strong><span>{formatEventDate(event.date)} · {formatEventTime(event.time)} · {event.location}</span></div>
                <div className="shul-events-admin-actions">
                    <button type="button" className="settings-reset-btn" disabled={busy} onClick={() => {
                        if (changed && !window.confirm('Discard your unsaved event changes?')) return;
                        const { name, date, time, location, registrationLink, details } = event;
                        const values = { name, date, time, location, registrationLink, details };
                        setEditing(event.id); setDraft(values); setSavedDraft(values); setFeedback(null);
                        showEditor();
                    }}>Edit</button>
                    <button type="button" className="settings-reset-btn" disabled={busy} onClick={() => setDeleting(event)}>Delete</button>
                </div>
            </li>)}</ul>}
            <form ref={form} className="settings-edit-form shul-event-edit-form" onSubmit={save} onChange={() => setFeedback(null)}>
                <fieldset className="settings-fieldset" disabled={busy}>
                    <legend className="shul-event-editor-legend">{editing ? 'Edit event' : 'Add an event'}</legend>
                    <div className="shul-event-fields">{fields.map(field => <div className="settings-field-edit" key={field.key}>
                        <label htmlFor={`event-${field.key}`}>{field.label}</label>
                        <input id={`event-${field.key}`} type={field.type} value={draft[field.key]} maxLength={field.max}
                            min={field.type === 'date' ? '0001-01-01' : undefined} max={field.type === 'date' ? '9999-12-31' : undefined}
                            required={field.key !== 'registrationLink'} onChange={event => setDraft(previous => ({ ...previous, [field.key]: event.target.value }))} />
                    </div>)}
                        <div className="settings-field-edit shul-event-details-field"><label htmlFor="event-details">Other details (optional)</label>
                            <textarea id="event-details" value={draft.details} rows={3} maxLength={2000}
                                onChange={event => setDraft(previous => ({ ...previous, details: event.target.value }))} /></div>
                    </div>
                    <div className="settings-form-footer user-settings-footer">
                        <div className="event-feedback" role={feedback?.error ? 'alert' : 'status'}>{feedback?.text}</div>
                        <div className="settings-footer-buttons">
                            <button type="button" className="settings-reset-btn" disabled={!changed && !editing} onClick={reset}>{editing ? 'Cancel edit' : 'Reset'}</button>
                            <button type="submit" className="submit-btn" disabled={!changed}>{busy ? 'Publishing…' : editing ? 'Publish changes' : 'Publish event'}</button>
                        </div>
                    </div>
                </fieldset>
            </form>
        </>}
        {deleting && createPortal(<EventDeletionConfirmation event={deleting} onDecision={confirmed => {
            const event = deleting;
            setDeleting(null);
            if (confirmed) void remove(event);
        }} />, document.body)}
    </section>;
}
