import type { Message } from '../api.ts';
import { ProfilePicture } from './profilePicture.tsx';

export default function MessageCard( {message}: {message: Message} ): React.JSX.Element {
    const sentDate = new Date(message.sendAt);
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
                <span className="msg-subject">{message.subject}</span>
                <span className="msg-time-stamp">{sendAtLabel}</span>
            </div>
        </div>
    )
}
