import { useEffect, useState } from 'react';
import { getCurrentUserMessages, getMessageCounts, markMessageRead, markMessageUnread, setMessageTrash } from '../api.ts';
import type { Message, MessageCounts } from '../api.ts';
import MessageCard from '../Components/messageCard.tsx';
import { ProfilePicture } from '../Components/profilePicture.tsx';

const pageSize = 50;

export default function Messages() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [counts, setCounts] = useState<MessageCounts | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [offset, setOffset] = useState<number>(0);
    const [attempt, setAttempt] = useState<number>(0);
    const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
    const [readError, setReadError] = useState('');
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [sort, setSort] = useState<'oldest' | 'newest'>('newest');
    const [folder, setFolder] = useState<'inbox' | 'trash'>('inbox');
    const [actionBusy, setActionBusy] = useState(false);
    const visibleMessages = unreadOnly ? messages.filter(message => message.readAt === null) : messages;

    async function updatedSelectedMsg(message: Message) {
        const readAt = message.readAt ?? new Date().toISOString();
        setSelectedMsg({ ...message, readAt });
        setReadError('');
        if (message.readAt !== null) return;

        setMessages(previous => previous.map(item =>
            item.id === message.id ? { ...item, readAt: item.readAt ?? readAt } : item));
        if (folder === 'inbox') setCounts(previous => previous && { ...previous, unread: Math.max(0, previous.unread - 1) });
        setActionBusy(true);
        try {
            await markMessageRead(message.id);
        } catch (failure) {
            if (folder === 'inbox') setCounts(previous => previous && { ...previous, unread: previous.unread + 1 });
            setMessages(previous => previous.map(item =>
                item.id === message.id && item.readAt === readAt ? { ...item, readAt: null } : item));
            setSelectedMsg(previous => previous?.id === message.id && previous.readAt === readAt
                ? { ...previous, readAt: null }
                : previous);
            setReadError(failure instanceof Error ? failure.message : 'Unable to mark the message as read.');
        } finally {
            setActionBusy(false);
        }
    }

    async function updateSelectedMessage(action: 'unread' | 'trash') {
        if (!selectedMsg || actionBusy) return;
        setActionBusy(true);
        setReadError('');
        try {
            if (action === 'unread') {
                await markMessageUnread(selectedMsg.id);
                setMessages(previous => previous.map(message =>
                    message.id === selectedMsg.id ? { ...message, readAt: null } : message));
                setSelectedMsg(previous => previous?.id === selectedMsg.id
                    ? { ...previous, readAt: null }
                    : previous);
                if (folder === 'inbox' && selectedMsg.readAt !== null) {
                    setCounts(previous => previous && { ...previous, unread: previous.unread + 1 });
                }
            } else {
                await setMessageTrash(selectedMsg.id, folder !== 'trash');
                setSelectedMsg(null);
                setAttempt(previous => previous + 1);
            }
        } catch (failure) {
            setReadError(failure instanceof Error ? failure.message : 'Unable to update the message.');
        } finally {
            setActionBusy(false);
        }
    }

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError('');
        setSelectedMsg(null);
        Promise.all([
            getCurrentUserMessages(controller.signal, { limit: pageSize, offset, folder, sort, unread: unreadOnly }),
            getMessageCounts(controller.signal),
        ])
            .then(([result, totals]) => {
                if (!controller.signal.aborted) {
                    setMessages(result);
                    setCounts(totals);
                }
            })
            .catch(failure => {
                if (!controller.signal.aborted)
                    setError(failure instanceof Error ? failure.message : 'Unable to load your messages.');
            })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [offset, attempt, folder, sort, unreadOnly]);

    return <main className="messages-page" aria-label="My messages" aria-busy={loading}>
        <header className="inbox-header">
            <div>
                <h1>My Messages</h1>
                {readError && <p role="alert">{readError}</p>}
            </div>
            <button type="button" className="inbox-compose">Compose</button>
        </header>
        <div className="inbox">
            <div className="message-list-panel">
                <div className="msg-filters" role="group" aria-label="Message filters">
                    <div className="msg-filter-group" role="group" aria-label="Sort order">
                    <button type="button" disabled={actionBusy} aria-pressed={sort === 'newest'} onClick={() => { setSort('newest'); setOffset(0); }}>Newest</button>
                    <button type="button" disabled={actionBusy} aria-pressed={sort === 'oldest'} onClick={() => { setSort('oldest'); setOffset(0); }}>Oldest</button>
                    </div>
                    <span className="msg-filter-separator" aria-hidden="true">·</span>
                    <div className="msg-filter-group" role="group" aria-label="Message status">
                    <button type="button" disabled={actionBusy} aria-pressed={folder === 'inbox' && !unreadOnly} onClick={() => { setFolder('inbox'); setUnreadOnly(false); setOffset(0); }}>All <span className="msg-filter-count">{counts?.all ?? '–'}</span></button>
                    <button type="button" disabled={actionBusy} aria-pressed={folder === 'inbox' && unreadOnly} onClick={() => { setFolder('inbox'); setUnreadOnly(true); setOffset(0); }}>Unread <span className="msg-filter-count">{counts?.unread ?? '–'}</span></button>
                    <button type="button" disabled={actionBusy} aria-pressed={folder === 'trash'} onClick={() => { setFolder('trash'); setUnreadOnly(false); setOffset(0); }}>Trash <span className="msg-filter-count">{counts?.trash ?? '–'}</span></button>
                    </div>
                </div>

                <div className="message-list">
                    {loading ? <p role="status">Loading messages…</p>
                        : error ? <div role="alert">
                            <p>{error}</p>
                            <button type="button" onClick={() => setAttempt(previous => previous + 1)}>Try again</button>
                        </div>
                        : visibleMessages.length ? visibleMessages.map(message => (
                            <button
                                key={message.id}
                                type="button"
                                className="message-select"
                                disabled={actionBusy}
                                aria-pressed={selectedMsg?.id === message.id}
                                onClick={() => void updatedSelectedMsg(message)}
                            >
                                <MessageCard message={message} />
                            </button>
                        ))
                        : <p>{offset ? 'No more messages.' : folder === 'trash' ? 'Trash is empty.' : unreadOnly ? 'No unread messages.' : 'No messages yet.'}</p>}
                    {!loading && !error && (offset > 0 || messages.length === pageSize) && <nav aria-label="Message pages">
                        <button type="button" disabled={actionBusy || offset === 0} onClick={() => setOffset(previous => Math.max(0, previous - pageSize))}>Previous page</button>
                        <button type="button" disabled={actionBusy || messages.length < pageSize} onClick={() => setOffset(previous => previous + pageSize)}>Next page</button>
                    </nav>}
                </div>
            </div>

            <section className={selectedMsg ? "message-view" : "no-message-view"} aria-label="Message details">
                {selectedMsg ?
                <>
                    <header className="message-detail-header">
                        <div className="msg-buttons">
                            <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => void (selectedMsg.readAt === null
                                    ? updatedSelectedMsg(selectedMsg)
                                    : updateSelectedMessage('unread'))}
                            >
                                {selectedMsg.readAt === null ? 'Mark as Read' : 'Mark as Unread'}
                            </button>
                            <button type="button" className={folder === 'trash' ? '' : 'msg-delete'} disabled={actionBusy} onClick={() => void updateSelectedMessage('trash')}>{folder === 'trash' ? 'Restore' : 'Delete'}</button>
                        </div>

                        <h2>{selectedMsg.subject}</h2>
                        <div className="message-detail-sender">
                            <ProfilePicture src={selectedMsg.sender.pictureUrl} name={selectedMsg.sender.name} small />
                            <div>
                                <strong>{selectedMsg.sender.name}</strong>
                                <time dateTime={selectedMsg.sendAt}>{Number.isNaN(new Date(selectedMsg.sendAt).getTime()) ? 'Unknown date' : new Date(selectedMsg.sendAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
                            </div>
                        </div>
                    </header>
                    <div key={selectedMsg.id} className="message-detail-body" tabIndex={0} role="region" aria-label="Message body">{selectedMsg.body}</div>
                </>
                : <div>
                    <svg className="inbox-empty-icon" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
                        <path d="M112 128C85.5 128 64 149.5 64 176C64 191.1 71.1 205.3 83.2 214.4L291.2 370.4C308.3 383.2 331.7 383.2 348.8 370.4L556.8 214.4C568.9 205.3 576 191.1 576 176C576 149.5 554.5 128 528 128L112 128zM64 260L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 260L377.6 408.8C343.5 434.4 296.5 434.4 262.4 408.8L64 260z" />
                    </svg>
                    <p>Select a message to read it here.</p>
                </div>}
            </section>
        </div>
    </main>;
}
