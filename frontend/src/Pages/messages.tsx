import { useEffect, useState } from 'react';
import { getCurrentUserMessages, getMessageCounts, markMessageRead, markMessageUnread, setMessageTrash } from '../api.ts';
import type { Message, MessageCounts, User } from '../api.ts';
import MessageCard from '../Components/messageCard.tsx';
import { ProfilePicture } from '../Components/profilePicture.tsx';
import MessageComposer from '../Components/messageComposer.tsx';
import type { MessageDraft } from '../Components/messageComposer.tsx';

const pageSize = 50;

export default function Messages({ user }: { user: User }) {
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
    const [compose, setCompose] = useState<boolean>(false);
    const [draft, setDraft] = useState<MessageDraft>({ subject: '', body: '', recipientIds: [] });
    const [composeNotice, setComposeNotice] = useState('');

    async function updatedSelectedMsg(message: Message) {
        const readAt = message.readAt ?? new Date().toISOString();
        setSelectedMsg({ ...message, readAt });
        setReadError('');
        setCompose(false);
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
                {composeNotice && <p role="status">{composeNotice}</p>}
            </div>
            {!compose ? <button
                type="button"
                className="inbox-compose"
                disabled={actionBusy}
                onClick={() => { setCompose(true); setSelectedMsg(null); setComposeNotice(''); }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
                    <path d="M568.4 37.7C578.2 34.2 589 36.7 596.4 44C603.8 51.3 606.2 62.2 602.7 72L424.7 568.9C419.7 582.8 406.6 592 391.9 592C377.7 592 364.9 583.4 359.6 570.3L295.4 412.3C290.9 401.3 292.9 388.7 300.6 379.7L395.1 267.3C400.2 261.2 399.8 252.3 394.2 246.7C388.6 241.1 379.6 240.7 373.6 245.8L261.2 340.1C252.1 347.7 239.6 349.7 228.6 345.3L70.1 280.8C57 275.5 48.4 262.7 48.4 248.5C48.4 233.8 57.6 220.7 71.5 215.7L568.4 37.7z" />
                </svg>
                Compose
            </button> : <button
                type="button"
                className="inbox-compose"
                disabled={actionBusy}
                onClick={() => setCompose(false)}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="16"viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
                    <path d="M183.1 137.4C170.6 124.9 150.3 124.9 137.8 137.4C125.3 149.9 125.3 170.2 137.8 182.7L275.2 320L137.9 457.4C125.4 469.9 125.4 490.2 137.9 502.7C150.4 515.2 170.7 515.2 183.2 502.7L320.5 365.3L457.9 502.6C470.4 515.1 490.7 515.1 503.2 502.6C515.7 490.1 515.7 469.8 503.2 457.3L365.8 320L503.1 182.6C515.6 170.1 515.6 149.8 503.1 137.3C490.6 124.8 470.3 124.8 457.8 137.3L320.5 274.7L183.1 137.4z"/></svg>
                    Close
             </button>
            }
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
            { !compose ? <>
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
            </> : <>
                <MessageComposer user={user} draft={draft} onChange={setDraft}
                    busy={actionBusy} onBusyChange={setActionBusy}
                    onSent={() => {
                        setCompose(false);
                        setDraft({ subject: '', body: '', recipientIds: [] });
                        setComposeNotice('Message sent.');
                        setAttempt(previous => previous + 1);
                    }} />
            </>}
        </div>
    </main>;
}
