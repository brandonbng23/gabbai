import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ParshaRemovalConfirmation } from './parshaRemovalConfirmation.tsx';
import { PortionTypeahead } from './portionTypeahead.tsx';
import type { SubmitEvent } from 'react';
import { saveSignificantPortions } from '../api.ts';
import type { User } from '../api.ts';
import { significantPortionLimit, validateSignificantPortions } from '../../../interfaces/significantPortions.mts';
import type { SignificantPortion } from '../../../interfaces/significantPortions.mts';

export function SignificantPortions({ user, onSaved }: { user: User; onSaved: (user: User) => void }) {
    const saved = user.settings.significantPortions ?? [];
    const [parsha, setParsha] = useState('');
    const [occasion, setOccasion] = useState('');
    const [busy, setBusy] = useState(false);
    const [removing, setRemoving] = useState<{ index: number; parsha: SignificantPortion } | null>(null);
    const [feedback, setFeedback] = useState<{ error?: boolean; text: string } | null>(null);
    const changed = Boolean(parsha || occasion);

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
        if (!parsha.trim() || saved.length >= significantPortionLimit) return;
        if (await save([...saved, { portion: parsha, occasion }], 'Your parsha has been added.')) {
            setParsha('');
            setOccasion('');
        }
    }

    return <section className="content-panel" aria-labelledby="significant-parshiyot-heading">
        <div className="settings-section-header">
            <div>
                <h2 id="significant-parshiyot-heading">Significant Parshiyot</h2>
                <p>Save your b’nai mitzvah parsha or other parshiyot that are meaningful to you.</p>
            </div>
        </div>
        {saved.length > 0 && <ul className="significant-parshiyot-list" aria-label="Saved significant parshiyot">
            {saved.map((entry, index) => <li className="significant-parsha-saved" key={index}>
                <div><strong>{entry.portion}</strong>{entry.occasion && <span>{entry.occasion}</span>}</div>
                <button type="button" className="settings-reset-btn" disabled={busy || removing !== null}
                    aria-label={`Remove ${entry.portion}`} onClick={() => setRemoving({ index, parsha: entry })}>Remove</button>
            </li>)}
        </ul>}
        <form className="settings-edit-form" onSubmit={addParsha} onChange={() => setFeedback(null)}>
            <fieldset className="settings-fieldset" disabled={busy}>
                <legend className="visually-hidden">Add a significant parsha</legend>
                <div className="significant-parsha-fields">
                    <div className="settings-field-edit">
                        <label htmlFor="significant-parsha">Parsha</label>
                        <PortionTypeahead id="significant-parsha" value={parsha} onChange={value => {
                            setParsha(value);
                            setFeedback(null);
                        }} />
                    </div>
                    <div className="settings-field-edit">
                        <label htmlFor="significant-occasion">Occasion (optional)</label>
                        <input id="significant-occasion" value={occasion} maxLength={200}
                            placeholder="e.g., B’nai mitzvah" onChange={event => setOccasion(event.target.value)} />
                    </div>
                </div>
                <div className="settings-form-footer user-settings-footer">
                    <div className={`submission-msg${feedback ? ` submission-msg-${feedback.error ? 'error' : 'success'}` : ''}`}
                        role={feedback?.error ? 'alert' : 'status'}>{busy ? 'Saving your parshiyot…' : feedback?.text}</div>
                    <div className="settings-footer-actions">
                        {saved.length >= significantPortionLimit && <span>You can save up to {significantPortionLimit} significant parshiyot.</span>}
                        <div className="settings-footer-buttons">
                            <button type="button" className="settings-reset-btn" disabled={!changed} onClick={() => {
                                setParsha('');
                                setOccasion('');
                                setFeedback(null);
                            }}>Reset</button>
                            <button type="submit" className="submit-btn" disabled={!parsha.trim() || saved.length >= significantPortionLimit}>{busy ? 'Saving…' : 'Add parsha'}</button>
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
