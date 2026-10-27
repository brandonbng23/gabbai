import type { Message } from '../api.ts';
import { ProfilePicture } from './profilePicture.tsx';

export default function MessageCard( {message}: {message: Message} ): React.JSX.Element {
    const sentDate = new Date(message.lastReplyAt ?? message.sendAt);
    const sendAtLabel = Number.isNaN(sentDate.getTime())
        ? 'Unknown date'
        : sentDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

    return (
        <div className={`msg-card${message.readAt ? '' : ' msg-card-unread'}`}>
            <div className="msg-sender">
                <span className={`msg-unread-dot${message.readAt ? ' msg-unread-dot-hidden' : ''}`} aria-hidden="true" />
                <ProfilePicture src={message.sender.pictureUrl} name={message.sender.name} small />
                <span className="msg-sender-name">{message.sender.name}</span>
            </div>
            <div className="msg-info">
                {message.recipient?.type === 'shul' && <span className="msg-shul-recipient">To: {message.recipient.name} · Shul inbox</span>}
                {!message.recipient && message.sharedInbox && <span className="msg-shul-recipient">{message.sharedInbox.name} · Shul inbox</span>}
                <span className="msg-subject">{message.subject}</span>
                {Boolean(message.replyCount) && <span className="msg-thread-count">{message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}</span>}
                <span className="msg-time-stamp">{sendAtLabel}</span>
                {message.trashExpiresAt && <time className="msg-trash-deadline" dateTime={message.trashExpiresAt} title={new Date(message.trashExpiresAt).toLocaleString()}>
                    Deletes permanently on {new Date(message.trashExpiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </time>}
            </div>
        </div>
    )
}
