import PaperPlaneIcon from './paperPlaneIcon.tsx';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { getMessageThread, getMessageCounts, replyToMessage } from '../api.ts';
import type { Message, MessageCounts, MessageThread as Thread } from '../api.ts';

export default function MessageThread({ message, busy, onBusyChange, onUpdate }: {
    message: Message;
    busy: boolean;
    onBusyChange: (busy: boolean) => void;
    onUpdate: (thread: Thread, counts: MessageCounts) => void;
}) {
    const [thread, setThread] = useState<Thread | null>(null);
    const [error, setError] = useState('');
    const [body, setBody] = useState('');
    const [participantId, setParticipantId] = useState('');
    const [notice, setNotice] = useState('');
    const [attempt, setAttempt] = useState(0);
    const updateRef = useRef(onUpdate);
    const sending = useRef(false);
    useEffect(() => { updateRef.current = onUpdate; }, [onUpdate]);

    useEffect(() => {
        if (busy) return;
        const controller = new AbortController();
        let pending = false;
        async function refresh() {
            if (pending || sending.current || document.visibilityState === 'hidden') return;
            pending = true;
            try {
                const [result, counts] = await Promise.all([getMessageThread(message.id, controller.signal), getMessageCounts(controller.signal)]);
                if (!controller.signal.aborted && !sending.current) {
                    setThread(result);
                    setError('');
                    updateRef.current(result, counts);
                }
            } catch (failure) {
                if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to load replies.');
            } finally { pending = false; }
        }
        void refresh();
        const interval = window.setInterval(() => void refresh(), 10000);
        const focus = () => void refresh();
        window.addEventListener('focus', focus);
        return () => { controller.abort(); window.clearInterval(interval); window.removeEventListener('focus', focus); };
    }, [message.id, attempt, busy]);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!thread?.canReply || busy || !body.trim() || (thread.participants && thread.participants.length > 1 && !participantId)) return;
        sending.current = true;
        onBusyChange(true);
        setError('');
        setNotice('');
        try {
            const result = await replyToMessage(message.id, body.trim(), participantId || undefined);
            setThread(result);
            setBody('');
            setNotice('Reply sent.');
            setAttempt(previous => previous + 1);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Unable to send reply.');
        } finally { sending.current = false; onBusyChange(false); }
    }

    return <div className="message-conversation">
        <div className="message-original-body">{message.body}</div>
        {!thread && !error && <p className="thread-status" role="status">Loading conversation…</p>}
        {thread?.replies.map(reply => <article className="thread-reply" key={reply.id}>
            <header>
                <div><strong>{reply.sender.name}</strong>
                    {reply.sender.type === 'shul' && <span className="thread-shul-badge">Shul</span>}
                    {reply.authorName && reply.sender.type === 'shul' && <small>via {reply.authorName}</small>}
                </div>
                <time dateTime={reply.sendAt}>{new Date(reply.sendAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
            </header>
            {thread.participants && thread.participants.length > 1 && <p className="thread-participant">Conversation with {reply.participantName}</p>}
            <div className="thread-reply-body">{reply.body}</div>
        </article>)}
        {error && <div className="thread-error" role="alert">{error} <button type="button" disabled={busy} onClick={() => setAttempt(value => value + 1)}>Retry</button></div>}
        {thread?.canReply ? <form className="thread-reply-form" onSubmit={submit}>
            <div className="thread-reply-heading"><label htmlFor="thread-reply-body">Reply as {thread.replyAs}</label><span>Shared with the shul’s administrators</span></div>
            {thread.participants && thread.participants.length > 1 && <div className="thread-recipient-select">
                <label htmlFor="thread-participant">Reply to</label>
                <select id="thread-participant" required disabled={busy} value={participantId} onChange={event => setParticipantId(event.target.value)}>
                    <option value="">Choose a member</option>
                    {thread.participants.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
            </div>}
            <textarea id="thread-reply-body" required maxLength={10000} rows={4} disabled={busy} value={body}
                onChange={event => setBody(event.target.value)} placeholder="Write your reply…" />
            <div className="thread-reply-footer">
                <button className="inbox-compose" type="submit" disabled={busy || !body.trim() || Boolean(thread.participants && thread.participants.length > 1 && !participantId)}><PaperPlaneIcon />{busy ? 'Sending…' : 'Send reply'}</button>
                <span>{body.length.toLocaleString()} / 10,000</span>
            </div>
        </form> : thread && <p className="thread-status">{thread.replyUnavailableReason ?? (message.sender.type === 'system' ? 'This automated message does not accept replies.' : 'Only current members and administrators can reply.')}</p>}
        {notice && <p className="thread-status" role="status">{notice}</p>}
    </div>;
}
