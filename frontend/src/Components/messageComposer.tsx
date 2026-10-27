import PaperPlaneIcon from './paperPlaneIcon.tsx';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getShulUsers, sendMessage } from '../api.ts';
import type { ShulUser, User } from '../api.ts';

export interface MessageDraft {
    destination: 'shul' | 'members';
    subject: string;
    body: string;
    recipientIds: string[];
}

export default function MessageComposer({ user, draft, onChange, busy, onBusyChange, onSent, onClose, onDiscard }: {
    user: User;
    draft: MessageDraft;
    onChange: (draft: MessageDraft) => void;
    busy: boolean;
    onBusyChange: (busy: boolean) => void;
    onSent: () => void;
    onClose: () => void;
    onDiscard: () => void;
}) {
    const [members, setMembers] = useState<ShulUser[]>([]);
    const [loading, setLoading] = useState(user.role === 'admin');
    const [recipientError, setRecipientError] = useState('');
    const [sendError, setSendError] = useState('');
    const [query, setQuery] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [recipientsOpen, setRecipientsOpen] = useState(false);
    const [recipientNotice, setRecipientNotice] = useState('');
    const canCompose = Boolean(user.shulId) && user.role !== 'guest';
    const toMembers = user.role === 'admin' && draft.destination === 'members';

    useEffect(() => {
        if (user.role !== 'admin' || !user.shulId) { setLoading(false); return; }
        const controller = new AbortController();
        setLoading(true);
        setRecipientError('');
        getShulUsers(user.shulId, controller.signal)
            .then(result => {
                if (!controller.signal.aborted) setMembers(result.filter(member => member.role !== 'guest'));
            })
            .catch(error => {
                if (!controller.signal.aborted) setRecipientError(error instanceof Error ? error.message : 'Unable to load recipients.');
            })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [user.role, user.shulId, attempt]);

    const visibleMembers = members.filter(member => `${member.firstName} ${member.lastName}`.toLowerCase().includes(query.toLowerCase()));
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    nextMonth.setDate(Math.min(today.getDate(), lastDay));
    const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const startDate = dateKey(today);
    const endDate = dateKey(nextMonth);
    const threeMonthsLater = new Date(today.getFullYear(), today.getMonth() + 3, 1);
    const lastDayInThreeMonths = new Date(threeMonthsLater.getFullYear(), threeMonthsLater.getMonth() + 1, 0).getDate();
    threeMonthsLater.setDate(Math.min(today.getDate(), lastDayInThreeMonths));
    const threeMonthEndDate = dateKey(threeMonthsLater);
    const upcomingReaders = members.filter(member => member.assignedReadings.some(reading =>
        reading.dateString >= startDate && reading.dateString <= endDate));
    const unscheduledReaders = members.filter(member => member.assignedReadings.length > 0
        && !member.assignedReadings.some(reading => reading.dateString >= startDate && reading.dateString <= threeMonthEndDate));

    function addRecipients(group: ShulUser[], emptyNotice = 'No members match this group.') {
        const recipientIds = [...new Set([...draft.recipientIds, ...group.map(member => member.id)])];
        if (recipientIds.length > 1000) {
            setRecipientNotice('A message can have up to 1,000 recipients. Remove some recipients or select a smaller group.');
            return;
        }
        onChange({ ...draft, recipientIds });
        const added = recipientIds.length - draft.recipientIds.length;
        setRecipientNotice(added ? `Added ${added} ${added === 1 ? 'recipient' : 'recipients'}.` : group.length ? 'These members are already selected.' : emptyNotice);
    }
    const validRecipients = !toMembers || (draft.recipientIds.length > 0 && draft.recipientIds.length <= 1000
        && draft.recipientIds.every(id => members.some(member => member.id === id)));
    const canSend = canCompose && !busy && (!toMembers || (!loading && !recipientError)) && validRecipients && Boolean(draft.subject.trim() && draft.body.trim());

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canSend) return;
        onBusyChange(true);
        setSendError('');
        try {
            await sendMessage(user, draft.subject.trim(), draft.body.trim(), draft.recipientIds, toMembers ? 'members' : 'shul');
            onSent();
        } catch (error) {
            setSendError(error instanceof Error ? error.message : 'Unable to send your message.');
        } finally {
            onBusyChange(false);
        }
    }

    return <section className="message-composer" aria-labelledby="compose-heading">
        <header className="compose-window-header">
            <h2 id="compose-heading">New message</h2>
            <button type="button" className="compose-icon-button" disabled={busy} onClick={onClose} aria-label="Close composer and keep draft" title="Close and keep draft">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
            </button>
        </header>
        <form className="compose-form" onSubmit={submit} aria-busy={busy}>
            <div className="compose-fields">
                {!canCompose && <p className="compose-error" role="alert">You need a member or administrator account with a shul to send messages.</p>}
                <div className="compose-address-row compose-from-row">
                    <span className="compose-row-label">From</span>
                    <span>{toMembers ? 'Your shul' : `${user.firstName} ${user.lastName}`}</span>
                    <small>{toMembers ? 'On behalf of your shul' : user.email}</small>
                </div>
                <div className="compose-address-row">
                    <label className="compose-row-label" htmlFor={user.role === 'admin' ? 'compose-destination' : undefined}>To</label>
                    {user.role === 'admin' ? <div className="compose-select-wrap"><select id="compose-destination" value={draft.destination} disabled={busy || !canCompose}
                        onChange={event => onChange({ ...draft, destination: event.target.value as MessageDraft['destination'] })}>
                        <option value="members">Shul Members</option>
                        <option value="shul">My Shul</option>
                    </select><ComposeArrow className="compose-select-arrow" /></div> : <span>Your shul’s administrators</span>}
                </div>
                {toMembers && <div className="compose-recipient-area">
                    <div className="compose-recipient-chips">
                        {draft.recipientIds.map(id => {
                            const member = members.find(member => member.id === id);
                            return <span className="compose-recipient-chip" key={id}>
                                <span>{member ? `${member.firstName} ${member.lastName}` : 'Selected member'}</span>
                                <button type="button" disabled={busy} aria-label={`Remove ${member ? `${member.firstName} ${member.lastName}` : 'recipient'}`}
                                    onClick={() => onChange({ ...draft, recipientIds: draft.recipientIds.filter(recipientId => recipientId !== id) })}>×</button>
                            </span>;
                        })}
                    </div>
                    <div className="compose-recipient-toolbar">
                        <button type="button" className="compose-recipient-toggle" disabled={busy || !canCompose}
                            aria-expanded={recipientsOpen} aria-controls="compose-recipient-options" onClick={() => setRecipientsOpen(previous => !previous)}>
                            <ComposeArrow className={recipientsOpen ? 'compose-picker-arrow compose-picker-arrow-open' : 'compose-picker-arrow'} />
                            {draft.recipientIds.length ? 'Edit recipients' : 'Add recipients'}
                        </button>
                        <button type="button" disabled={busy || loading || Boolean(recipientError) || !canCompose || !members.length} onClick={() => addRecipients(members)}>Add all members</button>
                        <button type="button" disabled={busy || loading || Boolean(recipientError) || !canCompose} title={`Readings from ${startDate} through ${endDate}`} onClick={() => addRecipients(upcomingReaders, 'No members have readings in the next month.')}>Add all members reading in the next month</button>
                        <button type="button" disabled={busy || loading || Boolean(recipientError) || !canCompose} title={`Members with reading assignments, but none from ${startDate} through ${threeMonthEndDate}`} onClick={() => addRecipients(unscheduledReaders, 'No readers match this group.')}>All readers <i>not</i> reading in the next 3 months</button>
                    </div>
                    {recipientNotice && <p className="compose-recipient-notice" role="status">{recipientNotice}</p>}
                    <div id="compose-recipient-options" hidden={!recipientsOpen}>
                        <fieldset className="compose-recipients" disabled={busy || !canCompose}>
                            <legend className="compose-sr-only">Select recipients</legend>
                            <label className="compose-sr-only" htmlFor="compose-recipient-search">Find members</label>
                            <input id="compose-recipient-search" type="search" placeholder="Search members…" value={query} onChange={event => setQuery(event.target.value)} />
                            <div className="compose-recipient-list">
                                {loading ? <p role="status">Loading members…</p>
                                    : recipientError ? <div role="alert"><p>{recipientError}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>
                                    : visibleMembers.length ? visibleMembers.map(member => <label className="compose-recipient" key={member.id}>
                                        <input type="checkbox" checked={draft.recipientIds.includes(member.id)}
                                            disabled={!draft.recipientIds.includes(member.id) && draft.recipientIds.length >= 1000}
                                            onChange={event => onChange({ ...draft, recipientIds: event.target.checked
                                                ? [...draft.recipientIds, member.id] : draft.recipientIds.filter(id => id !== member.id) })} />
                                        <span>{member.firstName} {member.lastName}</span>
                                        <small>{member.role === 'admin' ? 'Admin' : 'Member'}</small>
                                    </label>) : <p>{query ? 'No members match your search.' : 'No recipients available.'}</p>}
                            </div>
                        </fieldset>
                    </div>
                </div>}
                <div className="compose-subject-row">
                    <label htmlFor="compose-subject" className="compose-sr-only">Subject</label>
                    <input id="compose-subject" value={draft.subject} onChange={event => onChange({ ...draft, subject: event.target.value })}
                        maxLength={200} placeholder="Subject" required disabled={busy || !canCompose} />
                    <span className="compose-subject-count">{draft.subject.length}/200</span>
                </div>
                <div className="compose-editor">
                    <label htmlFor="compose-body" className="compose-sr-only">Message</label>
                    <textarea id="compose-body" value={draft.body} onChange={event => onChange({ ...draft, body: event.target.value })}
                        maxLength={10000} placeholder="Write your message…" required disabled={busy || !canCompose} />
                </div>
                {sendError && <p className="compose-error" role="alert">{sendError}</p>}
            </div>
            <footer className="compose-footer">
                <button type="submit" className="inbox-compose compose-send" disabled={!canSend}>
                    <PaperPlaneIcon />
                    {busy ? 'Sending…' : 'Send'}
                </button>
                <span className="compose-body-count">{draft.body.length.toLocaleString()} / 10,000</span>
                <button type="button" className="compose-icon-button compose-discard" disabled={busy} onClick={onDiscard} aria-label="Discard draft" title="Discard draft">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
                        {/* Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc. */}
                        <path d="M232.7 69.9C237.1 56.8 249.3 48 263.1 48L377 48C390.8 48 403 56.8 407.4 69.9L416 96L512 96C529.7 96 544 110.3 544 128C544 145.7 529.7 160 512 160L128 160C110.3 160 96 145.7 96 128C96 110.3 110.3 96 128 96L224 96L232.7 69.9zM128 208L512 208L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 208zM216 272C202.7 272 192 282.7 192 296L192 488C192 501.3 202.7 512 216 512C229.3 512 240 501.3 240 488L240 296C240 282.7 229.3 272 216 272zM320 272C306.7 272 296 282.7 296 296L296 488C296 501.3 306.7 512 320 512C333.3 512 344 501.3 344 488L344 296C344 282.7 333.3 272 320 272zM424 272C410.7 272 400 282.7 400 296L400 488C400 501.3 410.7 512 424 512C437.3 512 448 501.3 448 488L448 296C448 282.7 437.3 272 424 272z" />
                    </svg>
                </button>
            </footer>
        </form>
    </section>;
}

function ComposeArrow({ className }: { className: string }) {
    return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
        {/* Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc. */}
        <path d="M297.4 169.4C309.9 156.9 330.2 156.9 342.7 169.4L534.7 361.4C547.2 373.9 547.2 394.2 534.7 406.7C522.2 419.2 501.9 419.2 489.4 406.7L320 237.3L150.6 406.6C138.1 419.1 117.8 419.1 105.3 406.6C92.8 394.1 92.8 373.8 105.3 361.3L297.3 169.3z" />
    </svg>;
}
