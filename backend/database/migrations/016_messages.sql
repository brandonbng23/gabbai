CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    shul_id TEXT NOT NULL REFERENCES shuls(id),
    sender_type TEXT NOT NULL CHECK (sender_type IN ('system', 'shul', 'user')),
    sender_user_id TEXT REFERENCES users(id),
    actor_user_id TEXT REFERENCES users(id),
    kind TEXT NOT NULL CHECK (kind IN ('message', 'confirmation', 'reading_invitation')),
    subject TEXT NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
    body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
    idempotency_key TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CHECK ((sender_type = 'user' AND sender_user_id IS NOT NULL AND actor_user_id IS NOT NULL AND actor_user_id = sender_user_id)
        OR (sender_type = 'shul' AND sender_user_id IS NULL AND actor_user_id IS NOT NULL)
        OR (sender_type = 'system' AND sender_user_id IS NULL AND actor_user_id IS NULL)),
    CHECK (sender_type = 'system' OR kind = 'message')
) STRICT;

CREATE TABLE IF NOT EXISTS message_recipients (
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    read_at TEXT,
    PRIMARY KEY (message_id, user_id)
) STRICT;

-- User messages go to the shared shul inbox; its read state is shared by admins.
CREATE TABLE IF NOT EXISTS shul_message_receipts (
    message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    read_at TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS messages_shul_created ON messages(shul_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS messages_sender ON messages(sender_user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS message_recipients_user ON message_recipients(user_id, message_id);
