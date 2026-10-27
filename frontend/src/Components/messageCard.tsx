import type { Message } from '../api.ts';
import { ProfilePicture } from './profilePicture.tsx';

export default function MessageCard( {message}: {message: Message} ): React.JSX.Element {
    return (
        <div className={`msg-card${message.readAt ? "" : "-unread"}`}>
            <div className="msg-sender">
                <ProfilePicture src={message.sender.pictureUrl} name={message.sender.name} small />
                <h1>{message.sender.name}</h1>
            </div>
            <span className="msg-subject">{message.subject}</span>
            <span className="msg-time-stamp">{message.sendAt}</span>
        </div>
    )
}
