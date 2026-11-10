import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ParshaRemovalConfirmation } from './parshaRemovalConfirmation.tsx';
import { PortionTypeahead } from './portionTypeahead.tsx';
import type { SubmitEvent } from 'react';
import { saveSignificantPortions } from '../api.ts';
import type { User } from '../api.ts';
import { significantPortionLimit, validateSignificantPortions } from '../../../interfaces/significantPortions.mts';
import type { SignificantPortion } from '../../../interfaces/significantPortions.mts';
import { formatSignificantDate, parshaForSignificantDate } from '../../../core/significantDate.mts';

export function SignificantPortions({ user, israel, onSaved }: { user: User; israel: boolean; onSaved: (user: User) => void }) {
    const saved = user.settings.significantPortions ?? [];
    const [parsha, setParsha] = useState('');
    const [occasion, setOccasion] = useState('');
    const [entryMode, setEntryMode] = useState<'parsha' | 'date'>('parsha');
    const [gregorianDate, setGregorianDate] = useState('');
    const [busy, setBusy] = useState(false);
    const [removing, setRemoving] = useState<{ index: number; parsha: SignificantPortion } | null>(null);
    const [feedback, setFeedback] = useState<{ error?: boolean; text: string } | null>(null);
    const changed = Boolean(parsha || occasion || gregorianDate);
    let datePreview: ReturnType<typeof parshaForSignificantDate> | null = null;
    let dateError = '';
    if (entryMode === 'date' && gregorianDate) {
        try { datePreview = parshaForSignificantDate(gregorianDate, israel); }
        catch (error) { dateError = error instanceof Error ? error.message : 'Unable to calculate this parsha.'; }
    }
    const selectedParsha = entryMode === 'date' ? datePreview?.portion ?? '' : parsha;

    useEffect(() => {
        if (window.location.hash !== '#significant-parshiyot-heading') return;
        const frame = requestAnimationFrame(() => {
            const heading = document.getElementById('significant-parshiyot-heading');
            heading?.scrollIntoView({ block: 'start', behavior: 'instant' });
            heading?.focus({ preventScroll: true });
        });
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        if (!changed) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [changed]);

    async function save(portions: SignificantPortion[], message: string): Promise<boolean> {
        if (busy) return false;
        setBusy(true);
        setFeedback(null);
        try {
            const updated = await saveSignificantPortions(validateSignificantPortions(portions));
            onSaved(updated);
            setFeedback({ text: message });
            return true;
        } catch (error) {
            setFeedback({ error: true, text: error instanceof Error ? error.message : 'Unable to save your significant parshiyot.' });
            return false;
        } finally {
            setBusy(false);
        }
    }

    async function addParsha(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selectedParsha.trim() || saved.length >= significantPortionLimit) return;
        const entry = { portion: selectedParsha, occasion, ...(entryMode === 'date' ? { gregorianDate } : {}) };
        if (await save([...saved, entry], 'Your parsha has been added.')) {
            setParsha('');
            setOccasion('');
            setGregorianDate('');
        }
    }

    return <section className="content-panel" aria-labelledby="significant-parshiyot-heading">
        <div className="settings-section-header">
            <div>
                <h2 id="significant-parshiyot-heading" tabIndex={-1}>Significant Parshiyot</h2>
                <p>Save your b’nai mitzvah parsha or other parshiyot that are meaningful to you. Choose a parsha or calculate it from a significant date.</p>
            </div>
        </div>
        {saved.length > 0 && <ul className="significant-parshiyot-list" aria-label="Saved significant parshiyot">
            {saved.map((entry, index) => <li className="significant-parsha-saved" key={index}>
                <div><strong>{entry.portion}</strong>{entry.occasion && <span>{entry.occasion}</span>}
                    {entry.gregorianDate && <span>Significant date: {formatSignificantDate(entry.gregorianDate)}</span>}</div>
                <button type="button" className="settings-reset-btn" disabled={busy || removing !== null}
                    aria-label={`Remove ${entry.portion}`} onClick={() => setRemoving({ index, parsha: entry })}>Remove</button>
            </li>)}
        </ul>}
        <form className="settings-edit-form" onSubmit={addParsha} onChange={() => setFeedback(null)}>
            <fieldset className="settings-fieldset" disabled={busy}>
                <legend className="visually-hidden">Add a significant parsha</legend>
                <div className="significant-parsha-entry-mode" role="group" aria-label="Add by parsha or date">
                    <button type="button" aria-pressed={entryMode === 'parsha'} onClick={() => { setEntryMode('parsha'); setFeedback(null); }}>Choose parsha</button>
                    <button type="button" aria-pressed={entryMode === 'date'} onClick={() => { setEntryMode('date'); setFeedback(null); }}>Use Gregorian date</button>
                </div>
                <div className="significant-parsha-fields">
                    <div className="settings-field-edit">
                        {entryMode === 'parsha' ? <>
                        <label htmlFor="significant-parsha">Parsha</label>
                        <PortionTypeahead id="significant-parsha" value={parsha} onChange={value => {
                            setParsha(value);
                            setFeedback(null);
                        }} />
                        </> : <>
                            <label htmlFor="significant-gregorian-date">Significant date (Gregorian)</label>
                            <input id="significant-gregorian-date" type="date" required min="0001-01-01" max="9999-12-31"
                                value={gregorianDate} aria-describedby="significant-date-help" aria-invalid={Boolean(dateError)}
                                onChange={event => setGregorianDate(event.target.value)} />
                        </>}
                    </div>
                    <div className="settings-field-edit">
                        <label htmlFor="significant-occasion">Occasion (optional)</label>
                        <input id="significant-occasion" value={occasion} maxLength={200}
                            placeholder="e.g., B’nai mitzvah" onChange={event => setOccasion(event.target.value)} />
                    </div>
                </div>
                {entryMode === 'date' && <div className="significant-date-preview">
                    <p id="significant-date-help">Uses the first Shabbat on or after your date, including the same day if it is Shabbat, with the {israel ? 'Israel' : 'Diaspora'} calendar.</p>
                    <div role="status">
                        {datePreview && <p><strong>{datePreview.portion}</strong> · Shabbat, {formatSignificantDate(datePreview.shabbatDate)}</p>}
                        {dateError && <p className="significant-date-error">{dateError}</p>}
                    </div>
                </div>}
                <div className="settings-form-footer user-settings-footer">
                    <div className={`submission-msg${feedback ? ` submission-msg-${feedback.error ? 'error' : 'success'}` : ''}`}
                        role={feedback?.error ? 'alert' : 'status'}>{busy ? 'Saving your parshiyot…' : feedback?.text}</div>
                    <div className="settings-footer-actions">
                        {saved.length >= significantPortionLimit && <span>You can save up to {significantPortionLimit} significant parshiyot.</span>}
                        <div className="settings-footer-buttons">
                            <button type="button" className="settings-reset-btn" disabled={!changed} onClick={() => {
                                setParsha('');
                                setOccasion('');
                                setGregorianDate('');
                                setFeedback(null);
                            }}>Reset</button>
                            <button type="submit" className="submit-btn" disabled={!selectedParsha.trim() || saved.length >= significantPortionLimit}>{busy ? 'Saving…' : 'Add parsha'}</button>
                        </div>
                    </div>
                </div>
            </fieldset>
        </form>
        {removing && createPortal(<ParshaRemovalConfirmation parsha={removing.parsha} onDecision={confirmed => {
            const selection = removing;
            setRemoving(null);
            if (confirmed) void save(saved.filter((_, index) => index !== selection.index), 'Your parsha has been removed.');
        }} />, document.body)}
    </section>;
}
