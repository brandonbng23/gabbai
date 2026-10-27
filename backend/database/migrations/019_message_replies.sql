-- Each broadcast recipient has a private conversation with the shul.
CREATE TABLE IF NOT EXISTS message_replies (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    participant_user_id TEXT NOT NULL REFERENCES users(id),
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'shul')),
    actor_user_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;
CREATE INDEX IF NOT EXISTS message_replies_thread ON message_replies(message_id, participant_user_id, created_at, id);
