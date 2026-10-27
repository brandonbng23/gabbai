import type { Message } from '../api.ts';

export default function MessageCard( {message}: {message: Message} ): React.JSX.Element {
    return (
        <div className={`msg-card${message.readAt ? "" : "-unread"}`}>
            <div className="msg-sender">
                <img src={message.sender.pictureUrl} alt={`${message.sender.name}'s Profile Picture`}></img>
                <h1>{message.sender.name}</h1>
            </div>
            <span className="msg-subject">{message.subject}</span>
            <span className="msg-time-stamp">{message.sendAt}</span>
        </div>
    )
}
