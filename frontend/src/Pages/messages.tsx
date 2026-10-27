import { useEffect, useState } from 'react';
import { getCurrentUserMessages } from '../api.ts';
import type { Message } from '../api.ts';
import MessageCard from '../Components/messageCard.tsx';

const pageSize = 50;

export default function Messages() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [offset, setOffset] = useState(0);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError('');
        getCurrentUserMessages(controller.signal, { limit: pageSize, offset })
            .then(result => { if (!controller.signal.aborted) setMessages(result); })
            .catch(failure => {
                if (!controller.signal.aborted)
                    setError(failure instanceof Error ? failure.message : 'Unable to load your messages.');
            })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [offset, attempt]);

    return <main className="messages-page" aria-label="My messages" aria-busy={loading}>
        {loading ? <p role="status">Loading messages…</p>
            : error ? <div role="alert">
                <p>{error}</p>
                <button type="button" onClick={() => setAttempt(previous => previous + 1)}>Try again</button>
            </div>
            : messages.length ? messages.map(message => <MessageCard key={message.id} message={message} />)
            : <p>{offset ? 'No more messages.' : 'No messages yet.'}</p>}
        {!loading && !error && (offset > 0 || messages.length === pageSize) && <nav aria-label="Message pages">
            <button type="button" disabled={offset === 0} onClick={() => setOffset(previous => Math.max(0, previous - pageSize))}>Newer messages</button>
            <button type="button" disabled={messages.length < pageSize} onClick={() => setOffset(previous => previous + pageSize)}>Older messages</button>
        </nav>}
    </main>;
}
