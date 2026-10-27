import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getShulUsers, sendMessage } from '../api.ts';
import type { ShulUser, User } from '../api.ts';

export interface MessageDraft {
    subject: string;
    body: string;
    recipientIds: string[];
}

export default function MessageComposer({ user, draft, onChange, busy, onBusyChange, onSent }: {
    user: User;
    draft: MessageDraft;
    onChange: (draft: MessageDraft) => void;
    busy: boolean;
    onBusyChange: (busy: boolean) => void;
    onSent: () => void;
}) {
    const [members, setMembers] = useState<ShulUser[]>([]);
    const [loading, setLoading] = useState(user.role === 'admin');
    const [recipientError, setRecipientError] = useState('');
    const [sendError, setSendError] = useState('');
    const [query, setQuery] = useState('');
    const [attempt, setAttempt] = useState(0);
    const canCompose = Boolean(user.shulId) && user.role !== 'guest';

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
    const validRecipients = user.role !== 'admin' || (draft.recipientIds.length > 0 && draft.recipientIds.length <= 1000
        && draft.recipientIds.every(id => members.some(member => member.id === id)));
    const canSend = canCompose && !busy && !loading && !recipientError && validRecipients && Boolean(draft.subject.trim() && draft.body.trim());

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canSend) return;
        onBusyChange(true);
        setSendError('');
        try {
            await sendMessage(user, draft.subject.trim(), draft.body.trim(), draft.recipientIds);
            onSent();
        } catch (error) {
            setSendError(error instanceof Error ? error.message : 'Unable to send your message.');
        } finally {
            onBusyChange(false);
        }
    }

    return <section className="message-composer" aria-labelledby="compose-heading">
        <header className="compose-heading">
            <span className="inbox-eyebrow">NEW MESSAGE</span>
            <h2 id="compose-heading">Write a message</h2>
            <p>{user.role === 'admin' ? 'Send an update on behalf of your shul.' : 'Get in touch with your shul’s administrators.'}</p>
        </header>
        <form className="compose-form" onSubmit={submit} aria-busy={busy}>
            <div className="compose-fields">
                {!canCompose && <p role="alert">You need a member or administrator account with a shul to send messages.</p>}
                {user.role === 'admin' ? <fieldset className="compose-recipients" disabled={busy || !canCompose}>
                    <legend>To <span>{draft.recipientIds.length} selected</span></legend>
                    <label className="compose-search-label" htmlFor="compose-recipient-search">Find members</label>
                    <input id="compose-recipient-search" type="search" placeholder="Search by name…" value={query} onChange={event => setQuery(event.target.value)} />
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
                </fieldset> : <div className="compose-to"><span>To</span><strong>Your shul’s administrators</strong></div>}
                <div className="compose-field">
                    <label htmlFor="compose-subject">Subject <span>{draft.subject.length}/200</span></label>
                    <input id="compose-subject" value={draft.subject} onChange={event => onChange({ ...draft, subject: event.target.value })}
                        maxLength={200} placeholder="What’s your message about?" required disabled={busy || !canCompose} />
                </div>
                <div className="compose-field">
                    <label htmlFor="compose-body">Message <span>{draft.body.length.toLocaleString()}/10,000</span></label>
                    <textarea id="compose-body" value={draft.body} onChange={event => onChange({ ...draft, body: event.target.value })}
                        maxLength={10000} rows={9} placeholder="Write your message here…" required disabled={busy || !canCompose} />
                </div>
                {sendError && <p className="compose-error" role="alert">{sendError}</p>}
            </div>
            <footer className="compose-footer">
                <p>{user.role === 'admin' ? 'From your shul' : `From ${user.firstName} ${user.lastName}`}</p>
                <button type="submit" className="inbox-compose" disabled={!canSend}>{busy ? 'Sending…' : 'Send message'}</button>
            </footer>
        </form>
    </section>;
}
